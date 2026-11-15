import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const MODEL_NAME = 'gemini-4-hydrogen';

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
      server: { middlewareMode: true },
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
