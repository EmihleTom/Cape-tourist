import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const MODEL_NAME = 'gemini-4-hydrogen';

interface PaymentSessionRecord {
  paymentReference: string;
  paymentProviderReference: string;
  bookingId: string;
  bookingReference: string;
  amount: number;
  bookingTotalZar: number;
  currency: 'ZAR';
  paymentMethod: 'PayShap' | 'Card';
  status: 'Payment Pending' | 'Processing' | 'Paid' | 'Failed' | 'Refunded' | 'Partially Refunded';
  mode: 'live' | 'demo';
  expiresAtMs: number;
  idempotencyKey: string;
  signature: string;
  failureReason?: string;
  payshapInstructions?: {
    shapId: string;
    bankName: string;
    reference: string;
    expiresInMinutes: number;
  };
  authorizationUrl?: string;
  createdAtIso: string;
}

const paymentSessionsByRef = new Map<string, PaymentSessionRecord>();
const paymentSessionsByIdempotency = new Map<string, PaymentSessionRecord>();
const DEMO_SIGNING_SALT = crypto.randomBytes(16).toString('hex');

function getPaymentProviderConfig() {
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY?.trim() || '';
  const webhookSecret =
    process.env.PAYSTACK_WEBHOOK_SECRET?.trim() ||
    process.env.CAPESAFE_PSP_WEBHOOK_SECRET?.trim() ||
    paystackSecret;
  const liveProviderConfigured =
    Boolean(paystackSecret) && paystackSecret !== 'MY_PAYSTACK_SECRET_KEY';

  return {
    mode: liveProviderConfigured ? ('live' as const) : ('demo' as const),
    liveProviderConfigured,
    providerName: liveProviderConfigured
      ? 'Paystack South Africa (ZAR PayShap & Card)'
      : 'CapeSafe Sandbox PSP (Demo Mode)',
    supportedCurrencies: ['ZAR'],
    supportedMethods: ['PayShap', 'Card', 'Pay in Person'],
    webhookConfigured: Boolean(webhookSecret),
    paystackSecret,
    webhookSecret,
  };
}

function signDemoPaymentPayload(ref: string, amount: number, status: string): string {
  return crypto
    .createHmac('sha256', DEMO_SIGNING_SALT)
    .update(`${ref}|${amount}|${status}`)
    .digest('hex');
}

export function detectCardBrand(digits: string): 'Visa' | 'Mastercard' | 'Amex' | 'Other' {
  if (/^4/.test(digits)) return 'Visa';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'Amex';
  return 'Other';
}

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false;
  const normalized = signatureHeader.trim().toLowerCase();
  const expectedSha512 = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  const expectedSha256 = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  for (const candidate of [expectedSha512, expectedSha256]) {
    if (normalized.length === candidate.length) {
      const a = Buffer.from(normalized, 'utf8');
      const b = Buffer.from(candidate, 'utf8');
      if (crypto.timingSafeEqual(a, b)) return true;
    }
  }
  return false;
}

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface DeterministicModerationOutcome {
  allowed: boolean;
  moderationStatus: 'Approved' | 'Under Review' | 'Removed';
  reasons: string[];
  sanitizedTip?: string;
}

const BLOCKED_TERMS_REGEX = /\b(scam|phishing|buy\s+crypto|whatsapp\s+me\s+money|kill|assault|bomb|hate)\b/i;
const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_REGEX = /(\+?\d[\d\s\-()]{7,}\d)/;
const URL_REGEX = /(https?:\/\/|www\.)\S+/i;

export function runDeterministicPostModeration(content: string): DeterministicModerationOutcome {
  const trimmed = (content || '').trim();
  const reasons: string[] = [];

  if (trimmed.length < 6) {
    return {
      allowed: false,
      moderationStatus: 'Removed',
      reasons: ['Post must be at least 6 characters long.'],
    };
  }

  if (EMAIL_REGEX.test(trimmed) || PHONE_REGEX.test(trimmed)) {
    reasons.push('Personal contact details (email or phone number) detected. Remove PII to protect privacy.');
  }
  if (URL_REGEX.test(trimmed)) {
    reasons.push('External promotional links require safety moderator review.');
  }
  if (BLOCKED_TERMS_REGEX.test(trimmed)) {
    reasons.push('Safety/harassment or commercial solicitation phrase flagged for review.');
  }

  if (reasons.length > 0) {
    return {
      allowed: true,
      moderationStatus: 'Under Review',
      reasons,
      sanitizedTip:
        'Your post was submitted to the CapeSafe Moderation Queue (Under Review) so personal details or links can be checked before public listing.',
    };
  }

  return {
    allowed: true,
    moderationStatus: 'Approved',
    reasons: [],
  };
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED') || msg.includes('403')) {
    return {
      status: 503,
      message:
        'Gemini API access could not be verified. Check the configured API key in Settings > Secrets.',
    };
  }
  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
    return {
      status: 429,
      message: 'AI request quota reached momentarily. Please wait a moment and try again.',
    };
  }
  return {
    status: 502,
    message: `CapeSafe AI service error: ${msg}`,
  };
}

async function generateJsonWithRetry<T>(
  ai: GoogleGenAI,
  params: Parameters<GoogleGenAI['models']['generateContent']>[0]
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await ai.models.generateContent(params);
      const raw = (response.text ?? '').trim();
      return JSON.parse(raw) as T;
    } catch (err) {
      lastErr = err;
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 350));
      }
    }
  }
  throw lastErr;
}

export function createApiRouter() {
  const router = express.Router();
  router.use(express.json({ limit: '1mb' }));

  router.get('/health', (_req, res) => {
    const aiConfigured = Boolean(getAiClient());
    res.json({
      status: 'ok',
      aiConfigured,
      model: MODEL_NAME,
    });
  });

  // 1. CapeSafe AI Concierge + Personalized Recommendations + Smart Condition Updates
  router.post('/ai/concierge', async (req, res) => {
    const { message, language = 'English', history = [], context } = req.body as {
      message?: string;
      language?: 'English' | 'Afrikaans' | 'isiXhosa';
      history?: Array<{ sender: string; text: string }>;
      context?: Record<string, unknown>;
    };

    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'A non-empty message is required.' });
      return;
    }

    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Server-side GEMINI_API_KEY is not configured in the environment. Configure it in Settings > Secrets to enable live Gemini AI.',
      });
      return;
    }

    const historyText = Array.isArray(history)
      ? history
          .slice(-6)
          .map((m) => `${m.sender === 'user' ? 'Traveler' : 'CapeSafe AI'}: ${String(m.text || '')}`)
          .join('\n')
      : '';

    const systemInstruction = [
      'You are CapeSafe AI, the official safety-first tourism concierge for Cape Town, South Africa.',
      `Respond clearly in ${language}.`,
      'Ground every answer in the live Cape Town destination conditions, weather/wind speeds, safety advisories, official announcements, attractions, and (when personalization is enabled) the traveler profile provided in JSON context.',
      'Never invent emergency phone numbers — Cape Town official emergency numbers are 107 (landline), 112 (mobile), WSAR 021 937 0300, NSRI 087 094 9774.',
      'When wind gusts >= 30 km/h or Cableway Risk is Moderate/High, proactively advise morning mountain schedules or sheltered coastal alternatives.',
      'Provide up to 3 actionable Cape Town recommendations tailored to the traveler query and context.',
    ].join(' ');

    try {
      const result = await generateJsonWithRetry<{
        reply: string;
        conditionBrief: string;
        recommendations: Array<{
          title: string;
          precinct: string;
          category: string;
          reason: string;
          safetyNote: string;
          bestTimeWindow: string;
          estimatedZar: number;
          stepFree: boolean;
        }>;
      }>(ai, {
        model: MODEL_NAME,
        contents: `Live App Context:\n${JSON.stringify(context ?? {})}\n\nRecent Conversation:\n${historyText}\n\nTraveler Question:\n${message.trim()}`,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {
                type: Type.STRING,
                description: 'Helpful, concise, safety-aware Cape Town concierge answer in the requested language.',
              },
              conditionBrief: {
                type: Type.STRING,
                description: '1-2 sentence synthesis of current weather, wind risk, and active advisories.',
              },
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    precinct: { type: Type.STRING },
                    category: { type: Type.STRING },
                    reason: { type: Type.STRING },
                    safetyNote: { type: Type.STRING },
                    bestTimeWindow: { type: Type.STRING },
                    estimatedZar: { type: Type.INTEGER },
                    stepFree: { type: Type.BOOLEAN },
                  },
                },
              },
            },
          },
        },
      });

      res.json({
        reply: result.reply,
        conditionBrief: result.conditionBrief,
        recommendations: Array.isArray(result.recommendations) ? result.recommendations.slice(0, 3) : [],
        model: MODEL_NAME,
        dataOrigin: 'live',
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 2. AI-Powered Personalized Travel Planner
  router.post('/ai/planner', async (req, res) => {
    const {
      days = 2,
      pace = 'Balanced',
      budgetZar = 6000,
      interests = ['Coastal', 'Heritage'],
      accessibilityRequired = false,
      preferredLanguage = 'English',
      startDate = '2026-11-16',
      context,
    } = req.body as {
      days?: number;
      pace?: string;
      budgetZar?: number;
      interests?: string[];
      accessibilityRequired?: boolean;
      preferredLanguage?: 'English' | 'Afrikaans' | 'isiXhosa';
      startDate?: string;
      context?: Record<string, unknown>;
    };

    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Server-side GEMINI_API_KEY is not configured. Configure it in Settings > Secrets to generate AI travel plans.',
      });
      return;
    }

    const safeDays = Math.max(1, Math.min(5, Math.round(Number(days) || 2)));
    const safeBudget = Math.max(500, Math.min(150000, Math.round(Number(budgetZar) || 6000)));

    const systemInstruction = [
      'You are the CapeSafe AI Personalized Travel Planner for Cape Town.',
      `Write all text fields in ${preferredLanguage}.`,
      `Design a realistic ${safeDays}-day itinerary starting ${startDate} with pace "${pace}" within a total budget of R ${safeBudget} ZAR.`,
      accessibilityRequired
        ? 'CRITICAL: The traveler requires step-free, wheelchair-accessible routes and low-gradient attractions only.'
        : 'Include practical transit notes (MyCiTi bus, Table Mountain Shuttle, Southern Line daylight rail, or verified e-hailing bays).',
      'Respect existing confirmed bookings in the context and schedule mountain activities in calmer morning windows if wind risk is Moderate or High.',
      'Return 2-3 timed stops per day with itemType strictly set to "Accommodation", "Transport", or "Activity".',
    ].join(' ');

    try {
      const result = await generateJsonWithRetry<{
        summary: string;
        totalEstimatedZar: number;
        weatherAdjustmentNote: string;
        stops: Array<{
          day: number;
          dayLabel: string;
          time: string;
          title: string;
          zone: string;
          transportNote: string;
          safetyNote: string;
          itemType: 'Accommodation' | 'Transport' | 'Activity';
          estimatedZar: number;
        }>;
      }>(ai, {
        model: MODEL_NAME,
        contents: `Interests: ${JSON.stringify(interests)}\nLive Context:\n${JSON.stringify(context ?? {})}`,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              totalEstimatedZar: { type: Type.INTEGER },
              weatherAdjustmentNote: { type: Type.STRING },
              stops: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    day: { type: Type.INTEGER },
                    dayLabel: { type: Type.STRING },
                    time: { type: Type.STRING },
                    title: { type: Type.STRING },
                    zone: { type: Type.STRING },
                    transportNote: { type: Type.STRING },
                    safetyNote: { type: Type.STRING },
                    itemType: { type: Type.STRING },
                    estimatedZar: { type: Type.INTEGER },
                  },
                },
              },
            },
          },
        },
      });

      const normalizedStops = Array.isArray(result.stops)
        ? result.stops.slice(0, safeDays * 4).map((s) => ({
            ...s,
            day: Math.max(1, Math.min(30, Math.round(Number(s.day) || 1))),
            itemType:
              s.itemType === 'Accommodation' || s.itemType === 'Transport'
                ? s.itemType
                : ('Activity' as const),
          }))
        : [];

      res.json({
        summary: result.summary,
        totalEstimatedZar: Number(result.totalEstimatedZar || 0),
        weatherAdjustmentNote: result.weatherAdjustmentNote,
        stops: normalizedStops,
        model: MODEL_NAME,
        dataOrigin: 'live',
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 3. Language & Cultural Assistant (English, Afrikaans, isiXhosa)
  router.post('/ai/translate', async (req, res) => {
    const {
      text,
      sourceLang = 'English',
      targetLang = 'isiXhosa',
      scenario = 'Friendly Greeting & Tourism',
    } = req.body as {
      text?: string;
      sourceLang?: 'English' | 'Afrikaans' | 'isiXhosa';
      targetLang?: 'English' | 'Afrikaans' | 'isiXhosa';
      scenario?: string;
    };

    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'Enter a phrase or question to translate.' });
      return;
    }

    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Server-side GEMINI_API_KEY is not configured. Use the Saved Offline Phrasebook below or configure Gemini in Settings > Secrets.',
      });
      return;
    }

    const systemInstruction =
      'You are a South African multilingual cultural guide for Cape Town specializing in English, Afrikaans, and isiXhosa. Provide accurate, respectful translations, clear phonetic pronunciation tips for travelers, local Cape Town cultural etiquette context, and a polite emergency/safety variant when relevant.';

    try {
      const result = await generateJsonWithRetry<{
        translatedText: string;
        pronunciationGuide: string;
        culturalEtiquetteTip: string;
        safetyPhraseVariant: string;
      }>(ai, {
        model: MODEL_NAME,
        contents: `Translate from ${sourceLang} to ${targetLang} for scenario "${scenario}":\n"${text.trim()}"`,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              translatedText: { type: Type.STRING },
              pronunciationGuide: { type: Type.STRING },
              culturalEtiquetteTip: { type: Type.STRING },
              safetyPhraseVariant: { type: Type.STRING },
            },
          },
        },
      });

      res.json({
        ...result,
        model: MODEL_NAME,
        dataOrigin: 'live',
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 3b. Smart Experience Discovery Recommender
  router.post('/ai/recommend-experiences', async (req, res) => {
    const {
      tripLengthDays = 3,
      interests = ['Attractions and sightseeing', 'Nature and wildlife'],
      budgetZar = 3500,
      preferredLocation = 'All Precincts',
      availableTime = 'Morning (08:00–12:00)',
      groupProfile = 'Couple / Friends',
      minChildAge = 18,
      accessibilityNeeds = false,
      preferredLanguage = 'English',
      catalogSummary = [],
      context,
    } = req.body as {
      tripLengthDays?: number;
      interests?: string[];
      budgetZar?: number;
      preferredLocation?: string;
      availableTime?: string;
      groupProfile?: string;
      minChildAge?: number;
      accessibilityNeeds?: boolean;
      preferredLanguage?: 'English' | 'Afrikaans' | 'isiXhosa';
      catalogSummary?: Array<{
        id: string;
        title: string;
        precinct: string;
        categories: string[];
        priceZar: number;
        duration: string;
        minAge?: number;
        accessible?: boolean;
        familyFriendly?: boolean;
        safetyStatus: string;
      }>;
      context?: Record<string, unknown>;
    };

    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Server-side GEMINI_API_KEY is not configured. Configure it in Settings > Secrets to enable Gemini experience matching.',
      });
      return;
    }

    const safeDays = Math.max(1, Math.min(14, Math.round(Number(tripLengthDays) || 3)));
    const safeBudget = Math.max(0, Math.min(200000, Math.round(Number(budgetZar) || 3500)));
    const safeChildAge = Math.max(0, Math.min(99, Math.round(Number(minChildAge) ?? 18)));

    const systemInstruction = [
      'You are CapeSafe Experience Concierge recommending verified Cape Town attractions and activities strictly from the provided catalogSummary JSON.',
      `Write all text fields in ${preferredLanguage}.`,
      `Trip length: ${safeDays} days; Budget ceiling: R ${safeBudget} ZAR; Preferred precinct: ${preferredLocation}; Available window: ${availableTime}; Group: ${groupProfile}.`,
      `CRITICAL AGE & ACCESSIBILITY FILTER: Only select experiences whose minAge <= ${safeChildAge}.`,
      accessibilityNeeds
        ? 'CRITICAL: Only select experiences where accessible === true (step-free/assisted access verified).'
        : 'Flag stepFree accurately from catalogSummary.',
      'Consider current Cape Town wind/cableway conditions in context when picking morning vs afternoon or mountain vs sheltered indoor/coastal stops.',
      'Return 3 to 5 best-matched recommendations using exact listingId and title values from catalogSummary.',
    ].join(' ');

    try {
      const result = await generateJsonWithRetry<{
        summary: string;
        advisoryNote: string;
        recommendations: Array<{
          listingId: string;
          title: string;
          category: string;
          precinct: string;
          matchedReason: string;
          suggestedDay: number;
          suggestedTimeWindow: string;
          estimatedZar: number;
          ageSuitability: string;
          stepFree: boolean;
          transportTip: string;
          safetyNote: string;
        }>;
      }>(ai, {
        model: MODEL_NAME,
        contents: `Interests: ${JSON.stringify(interests)}\nCatalog Summary:\n${JSON.stringify(catalogSummary.slice(0, 48))}\nLive Conditions Context:\n${JSON.stringify(context ?? {})}`,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              advisoryNote: { type: Type.STRING },
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    listingId: { type: Type.STRING },
                    title: { type: Type.STRING },
                    category: { type: Type.STRING },
                    precinct: { type: Type.STRING },
                    matchedReason: { type: Type.STRING },
                    suggestedDay: { type: Type.INTEGER },
                    suggestedTimeWindow: { type: Type.STRING },
                    estimatedZar: { type: Type.INTEGER },
                    ageSuitability: { type: Type.STRING },
                    stepFree: { type: Type.BOOLEAN },
                    transportTip: { type: Type.STRING },
                    safetyNote: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

      res.json({
        summary: result.summary,
        advisoryNote: result.advisoryNote,
        recommendations: Array.isArray(result.recommendations) ? result.recommendations.slice(0, 5) : [],
        model: MODEL_NAME,
        dataOrigin: 'live',
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 4. Community Post Moderation Endpoint
  router.post('/community/moderate', async (req, res) => {
    const { content, zone = 'Cape Town' } = req.body as { content?: string; zone?: string };
    const deterministic = runDeterministicPostModeration(String(content || ''));
    if (!deterministic.allowed || deterministic.moderationStatus !== 'Approved') {
      res.json(deterministic);
      return;
    }

    const ai = getAiClient();
    if (!ai) {
      res.json(deterministic);
      return;
    }

    try {
      const aiCheck = await generateJsonWithRetry<{
        appropriate: boolean;
        reason: string;
      }>(ai, {
        model: MODEL_NAME,
        contents: `Evaluate if this Cape Town traveler community post for zone "${zone}" is safe, respectful, and free of harassment, misinformation, or spam:\n"${String(content || '').trim()}"`,
        config: {
          systemInstruction:
            'You are a community safety moderator for a Cape Town tourism platform. Return appropriate=true for normal trail/accessibility/heritage observations, and appropriate=false only for abuse, dangerous false emergency claims, or spam.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              appropriate: { type: Type.BOOLEAN },
              reason: { type: Type.STRING },
            },
          },
        },
      });

      if (!aiCheck.appropriate) {
        res.json({
          allowed: true,
          moderationStatus: 'Under Review',
          reasons: [aiCheck.reason || 'Flagged by automated safety moderation for review.'],
          sanitizedTip:
            'Your post has been placed into the Moderation Queue (Under Review) for verification by CapeSafe Safety Operations.',
        });
        return;
      }
      res.json(deterministic);
    } catch {
      // Fall back gracefully to deterministic check if AI moderation is unavailable
      res.json(deterministic);
    }
  });

  // 5. CapeSafe Secure Payment Gateway Proxy (PayShap + Tokenised Card + Webhooks + Refunds)
  router.get('/payments/config', (_req, res) => {
    const cfg = getPaymentProviderConfig();
    res.json({
      mode: cfg.mode,
      liveProviderConfigured: cfg.liveProviderConfigured,
      providerName: cfg.providerName,
      supportedCurrencies: cfg.supportedCurrencies,
      supportedMethods: cfg.supportedMethods,
      webhookConfigured: cfg.webhookConfigured,
    });
  });

  router.post('/payments/tokenize-card', (req, res) => {
    const {
      cardNumber,
      expiryMonth,
      expiryYear,
      cvv,
      cardholderName,
    } = req.body as {
      cardNumber?: string;
      expiryMonth?: string;
      expiryYear?: string;
      cvv?: string;
      cardholderName?: string;
    };

    const digits = String(cardNumber || '').replace(/\D/g, '');
    const cleanCvv = String(cvv || '').replace(/\D/g, '');
    const month = String(expiryMonth || '').padStart(2, '0');
    const year = String(expiryYear || '').trim();
    const holder = String(cardholderName || '').trim();

    if (digits.length < 13 || digits.length > 19) {
      res.status(400).json({ error: 'Enter a valid 13–19 digit Visa, Mastercard, or bank card number.' });
      return;
    }
    if (!/^(0[1-9]|1[0-2])$/.test(month) || !/^20[2-9][0-9]$/.test(year)) {
      res.status(400).json({ error: 'Enter a valid card expiry month (01–12) and 4-digit year.' });
      return;
    }
    if (cleanCvv.length < 3 || cleanCvv.length > 4) {
      res.status(400).json({ error: 'Enter a valid 3 or 4 digit security code (CVV).' });
      return;
    }
    if (holder.length < 2) {
      res.status(400).json({ error: 'Cardholder name is required.' });
      return;
    }

    const cfg = getPaymentProviderConfig();
    const cardBrand = detectCardBrand(digits);
    const lastFourDigits = digits.slice(-4);
    const providerToken = `tok_${cfg.mode}_${crypto.randomBytes(12).toString('hex')}`;

    // Only tokenised metadata is returned — full PAN and CVV are immediately discarded and never persisted.
    res.json({
      providerToken,
      cardBrand,
      lastFourDigits,
      expiryMonth: month,
      expiryYear: year,
      cardholderName: holder.slice(0, 100),
      paymentMode: cfg.mode,
    });
  });

  router.post('/payments/initiate', async (req, res) => {
    const {
      bookingId,
      bookingReference,
      amount,
      bookingTotalZar,
      currency = 'ZAR',
      paymentMethod,
      customerEmail,
      idempotencyKey,
      policy = 'reserve_pay_on_arrival',
      depositPercentage = 30,
    } = req.body as {
      bookingId?: string;
      bookingReference?: string;
      amount?: number;
      bookingTotalZar?: number;
      currency?: string;
      paymentMethod?: 'PayShap' | 'Card';
      customerEmail?: string;
      idempotencyKey?: string;
      policy?: string;
      depositPercentage?: number;
    };

    if (!bookingId || !bookingReference) {
      res.status(400).json({ error: 'bookingId and bookingReference are required.' });
      return;
    }
    if (currency !== 'ZAR') {
      res.status(400).json({ error: 'Only South African Rand (ZAR) payments are supported.' });
      return;
    }
    if (paymentMethod !== 'PayShap' && paymentMethod !== 'Card') {
      res.status(400).json({ error: 'Online initiation supports PayShap or Card only.' });
      return;
    }

    const numericAmount = Number(amount);
    const numericTotal = Number(bookingTotalZar ?? amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 500000) {
      res.status(400).json({ error: 'Invalid payment amount (ZAR).' });
      return;
    }
    if (!Number.isFinite(numericTotal) || numericTotal <= 0) {
      res.status(400).json({ error: 'Invalid booking total amount.' });
      return;
    }

    // Server-side amount integrity validation against policy & booking total
    const expectedMin =
      policy === 'deposit_online_balance_in_person'
        ? Math.max(1, Math.round((numericTotal * Math.min(90, Math.max(10, Number(depositPercentage) || 30))) / 100))
        : Math.round(numericTotal);
    if (Math.abs(Math.round(numericAmount) - expectedMin) > 2 && Math.round(numericAmount) !== Math.round(numericTotal)) {
      res.status(400).json({
        error: `Payment amount R ${Math.round(numericAmount)} does not match expected booking charge R ${expectedMin}.`,
      });
      return;
    }

    // Duplicate transaction guard via idempotencyKey
    const cleanIdempotency = (idempotencyKey || `${bookingId}-${paymentMethod}-${Math.round(numericAmount)}`).slice(0, 120);
    const existingSession = paymentSessionsByIdempotency.get(cleanIdempotency);
    if (existingSession && existingSession.expiresAtMs > Date.now() && existingSession.status !== 'Failed') {
      res.json({
        duplicateProtected: true,
        ...existingSession,
      });
      return;
    }

    const cfg = getPaymentProviderConfig();
    const shortRand = crypto.randomBytes(3).toString('hex').toUpperCase();
    const paymentReference = `PAY-${paymentMethod === 'PayShap' ? 'PS' : 'CD'}-${Date.now().toString().slice(-6)}-${shortRand}`;
    let paymentProviderReference = `PSP-${cfg.mode.toUpperCase()}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
    let authorizationUrl: string | undefined;

    if (cfg.liveProviderConfigured && customerEmail) {
      try {
        const initRes = await fetch('https://api.paystack.co/transaction/initialize', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfg.paystackSecret}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: customerEmail,
            amount: Math.round(numericAmount * 100),
            currency: 'ZAR',
            reference: paymentReference,
            channels: paymentMethod === 'PayShap' ? ['payshap', 'bank_transfer', 'eft'] : ['card'],
            metadata: { bookingId, bookingReference, platform: 'CapeSafe Connect 360' },
          }),
        });
        const initJson = (await initRes.json()) as {
          status?: boolean;
          message?: string;
          data?: { authorization_url?: string; reference?: string };
        };
        if (!initRes.ok || !initJson.status) {
          res.status(502).json({ error: initJson.message || 'Live South African PSP rejected transaction initialization.' });
          return;
        }
        authorizationUrl = initJson.data?.authorization_url;
        paymentProviderReference = initJson.data?.reference || paymentReference;
      } catch (err) {
        res.status(502).json({
          error: err instanceof Error ? err.message : 'Unable to reach South African payment service provider.',
        });
        return;
      }
    }

    const session: PaymentSessionRecord = {
      paymentReference,
      paymentProviderReference,
      bookingId,
      bookingReference,
      amount: Math.round(numericAmount),
      bookingTotalZar: Math.round(numericTotal),
      currency: 'ZAR',
      paymentMethod,
      status: 'Payment Pending',
      mode: cfg.mode,
      expiresAtMs: Date.now() + 15 * 60 * 1000,
      idempotencyKey: cleanIdempotency,
      signature: signDemoPaymentPayload(paymentReference, Math.round(numericAmount), 'Payment Pending'),
      ...(paymentMethod === 'PayShap'
        ? {
            payshapInstructions: {
              shapId: 'capesafe.tours@payshap.co.za',
              bankName: 'South African Instant EFT / PayShap Clearing',
              reference: paymentReference,
              expiresInMinutes: 15,
            },
          }
        : {}),
      ...(authorizationUrl ? { authorizationUrl } : {}),
      createdAtIso: new Date().toISOString(),
    };

    paymentSessionsByRef.set(paymentReference, session);
    paymentSessionsByIdempotency.set(cleanIdempotency, session);

    res.json(session);
  });

  router.post('/payments/verify', async (req, res) => {
    const {
      paymentReference,
      simulatedOutcome,
      cardToken,
    } = req.body as {
      paymentReference?: string;
      simulatedOutcome?: 'Paid' | 'Failed' | 'Payment Pending' | 'Expired' | 'Cancelled';
      cardToken?: string;
    };

    if (!paymentReference) {
      res.status(400).json({ error: 'paymentReference is required for verification.' });
      return;
    }

    const cfg = getPaymentProviderConfig();
    const session = paymentSessionsByRef.get(paymentReference);

    if (cfg.liveProviderConfigured) {
      try {
        const verifyRes = await fetch(
          `https://api.paystack.co/transaction/verify/${encodeURIComponent(paymentReference)}`,
          {
            headers: {
              Authorization: `Bearer ${cfg.paystackSecret}`,
            },
          }
        );
        const verifyJson = (await verifyRes.json()) as {
          status?: boolean;
          message?: string;
          data?: {
            status?: string;
            reference?: string;
            amount?: number;
            currency?: string;
            gateway_response?: string;
          };
        };
        if (!verifyRes.ok || !verifyJson.status || !verifyJson.data) {
          res.status(502).json({ error: verifyJson.message || 'Unable to verify payment with South African PSP.' });
          return;
        }
        const gatewayStatus = verifyJson.data.status;
        if (gatewayStatus === 'success') {
          res.json({
            verified: true,
            paymentStatus: 'Paid',
            paymentReference,
            paymentProviderReference: verifyJson.data.reference || paymentReference,
            mode: 'live',
            message: verifyJson.data.gateway_response || 'Verified by Paystack South Africa.',
          });
          return;
        }
        if (gatewayStatus === 'pending' || gatewayStatus === 'ongoing') {
          res.json({
            verified: false,
            paymentStatus: 'Payment Pending',
            paymentReference,
            mode: 'live',
            message: 'Awaiting final confirmation from customer bank / PayShap.',
          });
          return;
        }
        res.json({
          verified: false,
          paymentStatus: 'Failed',
          paymentReference,
          mode: 'live',
          failureReason: verifyJson.data.gateway_response || 'Payment was declined or cancelled at gateway.',
        });
        return;
      } catch (err) {
        res.status(502).json({
          error: err instanceof Error ? err.message : 'Live payment verification failed.',
        });
        return;
      }
    }

    if (!session) {
      res.status(404).json({ error: 'Payment reference not found or session expired on server.' });
      return;
    }

    if (Date.now() > session.expiresAtMs || simulatedOutcome === 'Expired') {
      session.status = 'Failed';
      session.failureReason = 'PayShap payment request expired after 15 minutes without bank confirmation.';
      res.json({
        verified: false,
        paymentStatus: 'Failed',
        expired: true,
        paymentReference,
        paymentProviderReference: session.paymentProviderReference,
        mode: 'demo',
        failureReason: session.failureReason,
      });
      return;
    }

    if (simulatedOutcome === 'Cancelled') {
      session.status = 'Failed';
      session.failureReason = 'Payment cancelled by customer before bank/card authorization completed.';
      res.json({
        verified: false,
        paymentStatus: 'Failed',
        cancelled: true,
        paymentReference,
        paymentProviderReference: session.paymentProviderReference,
        mode: 'demo',
        failureReason: session.failureReason,
      });
      return;
    }

    if (simulatedOutcome === 'Failed') {
      session.status = 'Failed';
      session.failureReason =
        session.paymentMethod === 'Card'
          ? 'Card authorization declined in Sandbox PSP test (insufficient funds / 3DS declined).'
          : 'PayShap instant request rejected or timed out at banking app.';
      res.json({
        verified: false,
        paymentStatus: 'Failed',
        paymentReference,
        paymentProviderReference: session.paymentProviderReference,
        mode: 'demo',
        failureReason: session.failureReason,
      });
      return;
    }

    if (simulatedOutcome === 'Payment Pending') {
      session.status = 'Payment Pending';
      res.json({
        verified: false,
        paymentStatus: 'Payment Pending',
        paymentReference,
        paymentProviderReference: session.paymentProviderReference,
        mode: 'demo',
        message: 'Awaiting customer authorization in banking app (Sandbox PSP Pending state).',
      });
      return;
    }

    if (session.paymentMethod === 'Card' && cardToken && !String(cardToken).startsWith('tok_')) {
      res.status(400).json({ error: 'Invalid card token format.' });
      return;
    }

    session.status = 'Paid';
    session.signature = signDemoPaymentPayload(paymentReference, session.amount, 'Paid');

    res.json({
      verified: true,
      paymentStatus:
        session.amount < session.bookingTotalZar ? 'Partially Paid' : 'Paid',
      paymentReference,
      paymentProviderReference: session.paymentProviderReference,
      mode: 'demo',
      paidAtIso: new Date().toISOString(),
      message: 'Verified in CapeSafe Sandbox PSP (Demo Mode). No real funds were charged.',
    });
  });

  router.post('/payments/webhook', (req, res) => {
    const cfg = getPaymentProviderConfig();
    const signature =
      req.header('x-paystack-signature') || req.header('x-capesafe-signature');
    const rawBody = JSON.stringify(req.body ?? {});

    if (!cfg.webhookSecret || !verifyWebhookSignature(rawBody, signature, cfg.webhookSecret)) {
      res.status(401).json({ error: 'Invalid or missing payment provider webhook signature.' });
      return;
    }

    const event = req.body as { event?: string; data?: { reference?: string; status?: string } };
    const ref = event.data?.reference;
    if (ref && paymentSessionsByRef.has(ref)) {
      const existing = paymentSessionsByRef.get(ref)!;
      if (event.event === 'charge.success' || event.data?.status === 'success') {
        existing.status = 'Paid';
      } else if (event.event === 'charge.failed' || event.data?.status === 'failed') {
        existing.status = 'Failed';
        existing.failureReason = 'Webhook notified payment failure.';
      }
    }

    res.json({ received: true, verified: true });
  });

  router.post('/payments/refund', async (req, res) => {
    const { paymentReference, amount, originalAmount, paymentStatus, reason } = req.body as {
      paymentReference?: string;
      amount?: number;
      originalAmount?: number;
      paymentStatus?: string;
      reason?: string;
    };

    if (!paymentReference) {
      res.status(400).json({ error: 'paymentReference is required.' });
      return;
    }
    if (paymentStatus !== 'Paid' && paymentStatus !== 'Partially Paid' && paymentStatus !== 'Partially Refunded') {
      res.status(400).json({ error: 'Only Paid or Partially Paid transactions are eligible for refund.' });
      return;
    }

    const refundAmt = Number(amount);
    const baseAmt = Number(originalAmount ?? amount);
    if (!Number.isFinite(refundAmt) || refundAmt <= 0 || refundAmt > baseAmt) {
      res.status(400).json({ error: 'Refund amount must be positive and cannot exceed the settled amount.' });
      return;
    }

    const cfg = getPaymentProviderConfig();
    if (cfg.liveProviderConfigured) {
      try {
        const refundRes = await fetch('https://api.paystack.co/refund', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfg.paystackSecret}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transaction: paymentReference,
            amount: Math.round(refundAmt * 100),
            merchant_note: reason || 'CapeSafe Connect 360 policy refund',
          }),
        });
        const refundJson = (await refundRes.json()) as { status?: boolean; message?: string };
        if (!refundRes.ok || !refundJson.status) {
          res.status(502).json({ error: refundJson.message || 'Payment provider refund failed.' });
          return;
        }
      } catch (err) {
        res.status(502).json({ error: err instanceof Error ? err.message : 'Refund gateway error.' });
        return;
      }
    }

    const nextStatus = Math.round(refundAmt) >= Math.round(baseAmt) ? 'Refunded' : 'Partially Refunded';
    res.json({
      success: true,
      paymentStatus: nextStatus,
      refundedAmount: Math.round(refundAmt),
      mode: cfg.mode,
      refundReference: `RFND-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    });
  });

  return router;
}

export async function createServer() {
  const app = express();
  app.use('/api', createApiRouter());

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  return app;
}

const isEntryModule =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryModule) {
  const port = Number(process.env.PORT) || 3000;
  createServer()
    .then((app) => {
      app.listen(port, '0.0.0.0', () => {
        console.log(`CapeSafe Connect 360 full-stack server running on http://0.0.0.0:${port}`);
      });
    })
    .catch((err) => {
      console.error('Failed to start CapeSafe Connect 360 server:', err);
      process.exit(1);
    });
}
