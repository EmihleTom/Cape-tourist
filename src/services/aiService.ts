import type {
  AiConciergeResponse,
  AiExperienceRecommendationResponse,
  AiPlannerResponse,
  AiTranslationResponse,
  AppAiContext,
  AttractionItem,
  BookingItem,
  CapeTownWeather,
  CommunityModerationResult,
  DemoUser,
  DestinationAnnouncement,
  PreferredLanguage,
  SafetyAdvisory,
  TripActivity,
} from '@/src/types/app';

export function buildSafeAiContext(params: {
  user: DemoUser;
  weather: CapeTownWeather;
  advisories: SafetyAdvisory[];
  announcements: DestinationAnnouncement[];
  attractions: AttractionItem[];
  bookings: BookingItem[];
  activities: TripActivity[];
}): AppAiContext {
  const personalizationEnabled = params.user.aiContextPersonalization !== false;

  return {
    weather: {
      temperatureC: params.weather.temperatureC,
      windSpeedKmh: params.weather.windSpeedKmh,
      windGustsKmh: params.weather.windGustsKmh,
      conditionLabel: params.weather.conditionLabel,
      cablewayRisk: params.weather.cablewayRisk,
    },
    advisories: params.advisories
      .filter((a) => (a.status || 'Open') !== 'Resolved')
      .slice(0, 6)
      .map((a) => ({
        zone: a.zone,
        severity: a.severity,
        title: a.title,
        summary: a.summary,
      })),
    announcements: params.announcements
      .filter((ann) => ann.active)
      .slice(0, 5)
      .map((ann) => ({
        title: ann.title,
        zone: ann.zone,
        priority: ann.priority,
        body: ann.body,
      })),
    attractions: params.attractions.map((attr) => ({
      title: attr.title,
      precinct: attr.precinct,
      category: attr.category,
      safetyStatus: attr.safetyStatus,
      accessibilitySummary: attr.accessibilitySummary,
      priceZar: attr.priceZar,
    })),
    personalizationEnabled,
    ...(personalizationEnabled
      ? {
          userContext: {
            location: params.user.location,
            accessibilityPriority: Boolean(params.user.accessibilityPriority),
            preferredLanguage: params.user.preferredLanguage || 'English',
            confirmedBookings: params.bookings
              .filter((b) => b.status === 'Confirmed')
              .slice(0, 6)
              .map((b) => ({
                title: b.title,
                offeringType: b.offeringType,
                date: b.date,
                zone: b.zone,
              })),
            upcomingActivities: params.activities
              .filter((a) => !a.completed)
              .slice(0, 6)
              .map((a) => ({
                title: a.title,
                day: a.day,
                time: a.time,
                zone: a.zone,
              })),
          },
        }
      : {}),
  };
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(payload.error || `Request to ${url} failed (${res.status})`);
  }
  return payload;
}

export const aiService = {
  async checkHealth(): Promise<{ status: string; aiConfigured: boolean; model: string }> {
    const res = await fetch('/api/health');
    if (!res.ok) {
      return { status: 'offline', aiConfigured: false, model: 'gemini-4-hydrogen' };
    }
    return (await res.json()) as { status: string; aiConfigured: boolean; model: string };
  },

  async askConcierge(params: {
    message: string;
    language: PreferredLanguage;
    history: Array<{ sender: 'user' | 'assistant'; text: string }>;
    context: AppAiContext;
  }): Promise<AiConciergeResponse> {
    return postJson<AiConciergeResponse>('/api/ai/concierge', params);
  },

  async generatePersonalizedPlan(params: {
    days: number;
    pace: 'Relaxed' | 'Balanced' | 'Active';
    budgetZar: number;
    interests: string[];
    accessibilityRequired: boolean;
    preferredLanguage: PreferredLanguage;
    startDate: string;
    context: AppAiContext;
  }): Promise<AiPlannerResponse> {
    return postJson<AiPlannerResponse>('/api/ai/planner', params);
  },

  async translateAndCoach(params: {
    text: string;
    sourceLang: PreferredLanguage;
    targetLang: PreferredLanguage;
    scenario: string;
  }): Promise<AiTranslationResponse> {
    return postJson<AiTranslationResponse>('/api/ai/translate', params);
  },

  async recommendExperiences(params: {
    tripLengthDays: number;
    interests: string[];
    budgetZar: number;
    preferredLocation: string;
    availableTime: string;
    groupProfile: string;
    minChildAge: number;
    accessibilityNeeds: boolean;
    preferredLanguage: PreferredLanguage;
    catalogSummary: Array<{
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
    context: AppAiContext;
  }): Promise<AiExperienceRecommendationResponse> {
    return postJson<AiExperienceRecommendationResponse>('/api/ai/recommend-experiences', params);
  },

  async moderateCommunityPost(params: {
    content: string;
    zone: string;
  }): Promise<CommunityModerationResult> {
    return postJson<CommunityModerationResult>('/api/community/moderate', params);
  },
};

export interface OfflinePhraseEntry {
  id: string;
  category: 'Greeting' | 'Transit & Directions' | 'Safety & Help' | 'Accessibility & Dining';
  en: string;
  af: string;
  xh: string;
  pronunciationXh: string;
}

export const OFFLINE_CAPE_TOWN_PHRASEBOOK: OfflinePhraseEntry[] = [
  {
    id: 'phr-1',
    category: 'Greeting',
    en: 'Hello, how are you today?',
    af: 'Hallo, hoe gaan dit vandag?',
    xh: 'Molo, unjani namhlanje?',
    pronunciationXh: 'MOH-loh, oon-JAH-nee nahm-HLAHN-jeh',
  },
  {
    id: 'phr-2',
    category: 'Greeting',
    en: 'Thank you very much for your help.',
    af: 'Baie dankie vir jou hulp.',
    xh: 'Enkosi kakhulu ngoncedo lwakho.',
    pronunciationXh: 'ehn-KOH-see kah-KOO-loo ngohn-TSEH-doh lwah-koh',
  },
  {
    id: 'phr-3',
    category: 'Transit & Directions',
    en: 'Where is the nearest MyCiTi bus stop?',
    af: 'Waar is die naaste MyCiTi-bushalte?',
    xh: 'Iphi indawo ekufutshane yokukhwela ibhasi ye-MyCiTi?',
    pronunciationXh: 'ee-PEE een-DAH-woh eh-koo-foo-TSHAH-neh yoh-koo-KWEH-lah ee-BAH-see',
  },
  {
    id: 'phr-4',
    category: 'Safety & Help',
    en: 'Please help, we need emergency assistance.',
    af: 'Help asseblief, ons benodig noodhulp.',
    xh: 'Nceda, sifuna uncedo olukhawulezileyo.',
    pronunciationXh: 'NTSEH-dah, see-FOO-nah oon-TSEH-doh oh-loo-kah-woo-leh-zee-LEH-yoh',
  },
  {
    id: 'phr-5',
    category: 'Accessibility & Dining',
    en: 'Is there a step-free wheelchair entrance here?',
    af: 'Is hier ’n trapvrye rolstoelingang?',
    xh: 'Ngaba likhona isango elingena zinyuko zesitulo esinamavili apha?',
    pronunciationXh: 'ngah-BAH lee-KOH-nah ee-SAHN-goh eh-lee-ngeh-nah zee-NYOO-koh',
  },
  {
    id: 'phr-6',
    category: 'Safety & Help',
    en: 'Is this walking route safe right now?',
    af: 'Is hierdie staproete nou veilig?',
    xh: 'Ngaba le ndlela yokuhamba ikhuselekile ngoku?',
    pronunciationXh: 'ngah-BAH leh NDLEH-lah yoh-koo-HAHM-bah ee-koo-seh-leh-KEE-leh ngoh-KOO',
  },
];
