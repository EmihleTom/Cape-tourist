import React, { useEffect, useMemo, useState } from 'react';
import {
  Accessibility,
  Bot,
  CalendarPlus,
  CloudSun,
  Compass,
  Globe,
  Languages,
  Lock,
  Send,
  ShieldAlert,
  Sparkles,
  WifiOff,
} from 'lucide-react';
import { DemoDataNotice } from '@/src/components/common/DemoDataNotice';
import { StatusText } from '@/src/components/common/StatusText';
import { useOnlineStatus } from '@/src/hooks/useOnlineStatus';
import {
  aiService,
  buildSafeAiContext,
  OFFLINE_CAPE_TOWN_PHRASEBOOK,
} from '@/src/services/aiService';
import type {
  AiConciergeResponse,
  AiPlannerResponse,
  AiPlannerStop,
  AiRecommendationItem,
  AiTranslationResponse,
  AttractionItem,
  BookingItem,
  CapeTownWeather,
  DemoUser,
  DestinationAnnouncement,
  NavSectionId,
  PreferredLanguage,
  SafetyAdvisory,
  TripActivity,
} from '@/src/types/app';

interface CapeSafeAIPageProps {
  user: DemoUser;
  weather: CapeTownWeather;
  advisories: SafetyAdvisory[];
  announcements: DestinationAnnouncement[];
  attractions: AttractionItem[];
  bookings: BookingItem[];
  activities: TripActivity[];
  onAddAiStopToTrip: (stop: AiPlannerStop) => Promise<void> | void;
  onUpdateLanguage: (lang: PreferredLanguage) => Promise<void> | void;
  onNavigate: (section: NavSectionId) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  conditionBrief?: string;
  recommendations?: AiRecommendationItem[];
}

type AiTab = 'concierge' | 'planner' | 'language';

const PRESET_PROMPTS = [
  'Check Table Mountain wind & suggest a safe morning plan',
  'Suggest wheelchair-accessible coastal views and MyCiTi stops today',
  'How do I integrate my confirmed bookings into a balanced Cape Peninsula day?',
];

const INTEREST_OPTIONS = [
  'Coastal & Penguins',
  'Mountain & Views',
  'Heritage & Bo-Kaap',
  'Botanical & Gardens',
  'Local Food & Markets',
];

export const CapeSafeAIPage: React.FC<CapeSafeAIPageProps> = ({
  user,
  weather,
  advisories,
  announcements,
  attractions,
  bookings,
  activities,
  onAddAiStopToTrip,
  onUpdateLanguage,
  onNavigate,
}) => {
  const isOnline = useOnlineStatus();
  const [activeTab, setActiveTab] = useState<AiTab>('concierge');
  const [aiHealth, setAiHealth] = useState<{ aiConfigured: boolean; model: string }>({
    aiConfigured: true,
    model: 'gemini-4-hydrogen',
  });

  // Concierge state
  const [language, setLanguage] = useState<PreferredLanguage>(user.preferredLanguage || 'English');
  const [input, setInput] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [chatError, setChatError] = useState('');
  const [savedNotice, setSavedNotice] = useState('');
  const [aiActionError, setAiActionError] = useState('');
  const [savingAction, setSavingAction] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'assistant',
      text: `Molweni, ${user.name.split(' ')[0]}! I am the CapeSafe AI Concierge. Ask about Cape Town routes, weather-safe timing, accessibility, or your itinerary.`,
    },
  ]);

  // Planner state
  const [planDays, setPlanDays] = useState(2);
  const [planPace, setPlanPace] = useState<'Relaxed' | 'Balanced' | 'Active'>('Balanced');
  const [planBudget, setPlanBudget] = useState(3500);
  const [planStartDate, setPlanStartDate] = useState('2026-11-18');
  const [planAccessible, setPlanAccessible] = useState(Boolean(user.accessibilityPriority));
  const [planInterests, setPlanInterests] = useState<string[]>([
    'Coastal & Penguins',
    'Heritage & Bo-Kaap',
  ]);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState('');
  const [planResult, setPlanResult] = useState<AiPlannerResponse | null>(null);

  // Language & Cultural assistant state
  const [sourceLang, setSourceLang] = useState<PreferredLanguage>('English');
  const [targetLang, setTargetLang] = useState<PreferredLanguage>('isiXhosa');
  const [scenario, setScenario] = useState('Heritage & Community Greeting');
  const [phraseInput, setPhraseInput] = useState(
    'Hello, could you point us to the safest step-free entrance?'
  );
  const [loadingTranslate, setLoadingTranslate] = useState(false);
  const [translateError, setTranslateError] = useState('');
  const [translationResult, setTranslationResult] = useState<AiTranslationResponse | null>(null);

  useEffect(() => {
    setLanguage(user.preferredLanguage || 'English');
    setPlanAccessible(Boolean(user.accessibilityPriority));
  }, [user.preferredLanguage, user.accessibilityPriority]);

  useEffect(() => {
    let active = true;
    void aiService.checkHealth().then((h) => {
      if (active) setAiHealth({ aiConfigured: h.aiConfigured, model: h.model });
    });
    return () => {
      active = false;
    };
  }, []);

  const aiContext = useMemo(
    () =>
      buildSafeAiContext({
        user,
        weather,
        advisories,
        announcements,
        attractions,
        bookings,
        activities,
      }),
    [user, weather, advisories, announcements, attractions, bookings, activities]
  );

  const conditionSynthesis = useMemo(() => {
    const activeAdv = advisories.filter((a) => (a.status || 'Open') !== 'Resolved');
    const elevated = activeAdv.filter((a) => a.severity === 'Elevated').length;
    const pinnedAnn = announcements.find((a) => a.active && a.pinned);
    return {
      activeCount: activeAdv.length,
      elevatedCount: elevated,
      pinnedTitle: pinnedAnn?.title,
    };
  }, [advisories, announcements]);

  const handleSendChat = async (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed || loadingChat) return;
    setChatError('');
    setSavedNotice('');

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: trimmed,
    };
    const nextHistory = [...messages, userMsg]
      .slice(-8)
      .map((m) => ({ sender: m.sender, text: m.text }));

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoadingChat(true);

    try {
      const res: AiConciergeResponse = await aiService.askConcierge({
        message: trimmed,
        language,
        history: nextHistory,
        context: aiContext,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          sender: 'assistant',
          text: res.reply,
          conditionBrief: res.conditionBrief,
          recommendations: res.recommendations,
        },
      ]);
    } catch (err) {
      setChatError(
        err instanceof Error
          ? err.message
          : 'Unable to reach server-side CapeSafe AI service.'
      );
    } finally {
      setLoadingChat(false);
    }
  };

  const handleGeneratePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlanError('');
    setSavedNotice('');
    setLoadingPlan(true);

    try {
      const res = await aiService.generatePersonalizedPlan({
        days: planDays,
        pace: planPace,
        budgetZar: planBudget,
        interests: planInterests.length > 0 ? planInterests : ['Coastal & Penguins'],
        accessibilityRequired: planAccessible,
        preferredLanguage: language,
        startDate: planStartDate,
        context: aiContext,
      });
      setPlanResult(res);
    } catch (err) {
      setPlanError(
        err instanceof Error ? err.message : 'Unable to generate AI itinerary plan.'
      );
    } finally {
      setLoadingPlan(false);
    }
  };

  const handleTranslate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phraseInput.trim()) return;
    setTranslateError('');
    setLoadingTranslate(true);
    try {
      const res = await aiService.translateAndCoach({
        text: phraseInput.trim(),
        sourceLang,
        targetLang,
        scenario,
      });
      setTranslationResult(res);
    } catch (err) {
      setTranslateError(
        err instanceof Error ? err.message : 'Unable to reach AI language assistant.'
      );
    } finally {
      setLoadingTranslate(false);
    }
  };

  const handleSaveRecommendation = async (rec: AiRecommendationItem) => {
    setAiActionError('');
    setSavedNotice('');
    setSavingAction(true);
    try {
      await onAddAiStopToTrip({
        day: 1,
        dayLabel: 'Day 1 · AI Recommended Stop',
        time: rec.bestTimeWindow.slice(0, 16) || '09:30',
        title: rec.title,
        zone: rec.precinct,
        transportNote: rec.stepFree
          ? 'Step-free MyCiTi or accessible shuttle recommended'
          : 'Confirm MyCiTi or verified e-hailing bay',
        safetyNote: rec.safetyNote,
        itemType: 'Activity',
        estimatedZar: rec.estimatedZar,
      });
      setSavedNotice(`Added "${rec.title}" to My Trips itinerary.`);
    } catch (err) {
      setAiActionError(
        err instanceof Error ? err.message : 'Unable to save recommendation to My Trips.'
      );
    } finally {
      setSavingAction(false);
    }
  };

  const handleSaveFullPlan = async () => {
    if (!planResult) return;
    setAiActionError('');
    setSavedNotice('');
    setSavingAction(true);
    try {
      for (const stop of planResult.stops) {
        await onAddAiStopToTrip(stop);
      }
      setSavedNotice(`Saved all ${planResult.stops.length} AI planner stops to My Trips.`);
    } catch (err) {
      setAiActionError(
        err instanceof Error ? err.message : 'Unable to save full AI plan to My Trips.'
      );
    } finally {
      setSavingAction(false);
    }
  };

  const handleAddSingleStop = async (stop: AiPlannerStop) => {
    setAiActionError('');
    setSavedNotice('');
    setSavingAction(true);
    try {
      await onAddAiStopToTrip(stop);
      setSavedNotice(`Added "${stop.title}" to My Trips itinerary.`);
    } catch (err) {
      setAiActionError(
        err instanceof Error ? err.message : 'Unable to add planner stop to My Trips.'
      );
    } finally {
      setSavingAction(false);
    }
  };

  const handleLanguageChange = async (next: PreferredLanguage) => {
    setAiActionError('');
    setLanguage(next);
    try {
      await onUpdateLanguage(next);
    } catch (err) {
      setAiActionError(
        err instanceof Error ? err.message : 'Unable to update language preference.'
      );
    }
  };

  const toggleInterest = (item: string) => {
    setPlanInterests((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  };

  return (
    <div className="space-y-6">
      <DemoDataNotice
        scope={`Server-side Gemini AI (${aiHealth.model}) grounded with Cape Town weather, Firestore advisories & privacy-filtered user context`}
      />

      {/* Smart Destination Condition Brief Header */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-[#0D9488]" aria-hidden="true" />
              <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">
                CapeSafe AI &amp; Cultural Companion
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-600 max-w-3xl">
              Live Gemini recommendations, personalized multi-day planning, and English / Afrikaans / isiXhosa cultural guidance routed securely through backend <span className="font-mono text-xs">/api/ai/*</span> endpoints.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="ai-pref-lang" className="text-xs font-semibold text-slate-600">
              AI Language:
            </label>
            <select
              id="ai-pref-lang"
              value={language}
              onChange={(e) => void handleLanguageChange(e.target.value as PreferredLanguage)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#0B1F3A] focus:border-[#0D9488] focus:outline-none"
            >
              <option value="English">English</option>
              <option value="Afrikaans">Afrikaans</option>
              <option value="isiXhosa">isiXhosa</option>
            </select>
          </div>
        </div>

        {/* Live Destination Condition Strip */}
        <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#0B1F3A]">
                <CloudSun className="h-4 w-4 text-[#0D9488]" aria-hidden="true" />
                Wind &amp; Cableway Conditions
              </span>
              <StatusText
                label={`${weather.cablewayRisk} Risk`}
                tone={
                  weather.cablewayRisk === 'Low'
                    ? 'nominal'
                    : weather.cablewayRisk === 'Moderate'
                    ? 'advisory'
                    : 'alert'
                }
              />
            </div>
            <p className="mt-1 text-slate-600">
              {weather.temperatureC}°C · Wind {weather.windSpeedKmh} km/h (gusts {weather.windGustsKmh} km/h) · {weather.conditionLabel}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#0B1F3A]">
                <ShieldAlert className="h-4 w-4 text-amber-700" aria-hidden="true" />
                Active Corridor Advisories
              </span>
              <span className="font-mono font-semibold text-[#0B1F3A]">
                {conditionSynthesis.activeCount} open
              </span>
            </div>
            <p className="mt-1 text-slate-600 truncate">
              {conditionSynthesis.pinnedTitle || `${conditionSynthesis.elevatedCount} elevated alert(s) monitored`}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#0B1F3A]">
                <Lock className="h-4 w-4 text-[#15803D]" aria-hidden="true" />
                Privacy &amp; Context
              </span>
              <button
                type="button"
                onClick={() => onNavigate('settings')}
                className="text-[11px] font-semibold text-[#0D9488] hover:underline"
              >
                Adjust
              </button>
            </div>
            <p className="mt-1 text-slate-600">
              {aiContext.personalizationEnabled
                ? `Personalized (${aiContext.userContext?.confirmedBookings.length ?? 0} bookings, accessibility: ${user.accessibilityPriority ? 'On' : 'Standard'})`
                : 'Personal context paused — generic Cape Town mode only'}
            </p>
          </div>
        </div>

        {!isOnline && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              You are currently offline. Live Gemini AI endpoints require connectivity; switch to the Language tab below for the <strong>Saved Offline Phrasebook</strong> or open Settings for your offline travel packet.
            </span>
          </div>
        )}

        {isOnline && !aiHealth.aiConfigured && (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
            Live server-side Gemini AI credentials are not yet configured in environment secrets. Add the Gemini API secret in project settings to enable live AI generation; the offline EN/AF/XH phrasebook remains available immediately.
          </div>
        )}

        {savedNotice && (
          <div role="status" className="mt-4 flex items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-900">
            <span>{savedNotice}</span>
            <button
              type="button"
              onClick={() => onNavigate('trips')}
              className="font-semibold underline"
            >
              Open My Trips
            </button>
          </div>
        )}

        {aiActionError && (
          <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-medium text-red-800">
            {aiActionError}
          </div>
        )}
      </section>

      {/* 3 Feature Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          aria-pressed={activeTab === 'concierge'}
          onClick={() => setActiveTab('concierge')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
            activeTab === 'concierge'
              ? 'bg-[#0B1F3A] text-white'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          AI Concierge &amp; Recommendations
        </button>
        <button
          type="button"
          aria-pressed={activeTab === 'planner'}
          onClick={() => setActiveTab('planner')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
            activeTab === 'planner'
              ? 'bg-[#0B1F3A] text-white'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Compass className="h-3.5 w-3.5" aria-hidden="true" />
          Personalized Travel Planner
        </button>
        <button
          type="button"
          aria-pressed={activeTab === 'language'}
          onClick={() => setActiveTab('language')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
            activeTab === 'language'
              ? 'bg-[#0B1F3A] text-white'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Languages className="h-3.5 w-3.5" aria-hidden="true" />
          Language &amp; Cultural Assistant (EN / AF / XH)
        </button>
      </div>

      {/* TAB 1: AI Concierge */}
      {activeTab === 'concierge' && (
        <div className="grid gap-6 lg:grid-cols-12">
          <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-4 space-y-4">
            <h2 className="font-display text-base font-bold text-[#0B1F3A]">
              Suggested Cape Town Queries
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Ask about current mountain wind safety, step-free coastal routes, transport corridors, or personalized suggestions based on your CapeSafe trips.
            </p>
            <div className="space-y-2">
              {PRESET_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={loadingChat || !isOnline}
                  onClick={() => handleSendChat(prompt)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-left text-xs font-medium text-[#0B1F3A] hover:border-[#0D9488] hover:bg-[#F0FDFA] disabled:opacity-50 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </section>

          <section className="flex flex-col rounded-xl border border-slate-200 bg-white lg:col-span-8">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <h2 className="font-display text-sm font-bold text-[#0B1F3A]">
                CapeSafe AI Conversation ({language})
              </h2>
              <span className="font-mono text-[11px] text-[#0D9488]">
                {aiHealth.model} · Server Proxy
              </span>
            </div>

            <div className="flex-1 space-y-4 p-5 max-h-[500px] overflow-y-auto">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[90%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-[#0B1F3A] text-white'
                        : 'border border-slate-200 bg-slate-50 text-slate-800'
                    }`}
                  >
                    {msg.conditionBrief && (
                      <p className="mb-2 rounded-md border border-teal-200 bg-[#F0FDFA] px-2.5 py-1.5 text-xs font-medium text-[#0F766E]">
                        Condition Brief: {msg.conditionBrief}
                      </p>
                    )}
                    <p className="whitespace-pre-line">{msg.text}</p>

                    {msg.recommendations && msg.recommendations.length > 0 && (
                      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                        {msg.recommendations.map((rec, idx) => (
                          <div
                            key={`${msg.id}-rec-${idx}`}
                            className="rounded-lg border border-slate-200 bg-white p-3 text-xs space-y-1.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-bold text-[#0B1F3A]">{rec.title}</p>
                              <span className="font-mono text-[11px] font-semibold text-[#0D9488] shrink-0">
                                {rec.estimatedZar === 0 ? 'Free' : `R ${rec.estimatedZar}`}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              {rec.precinct} · {rec.bestTimeWindow}
                            </p>
                            <p className="text-slate-700">{rec.reason}</p>
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                              <span className="text-[11px] font-medium text-[#15803D]">
                                {rec.stepFree ? 'Step-Free' : rec.category}
                              </span>
                              <button
                                type="button"
                                disabled={savingAction}
                                onClick={() => void handleSaveRecommendation(rec)}
                                className="inline-flex items-center gap-1 rounded border border-[#0D9488] px-2 py-1 text-[11px] font-semibold text-[#0D9488] hover:bg-[#F0FDFA] disabled:opacity-50"
                              >
                                <CalendarPlus className="h-3 w-3" aria-hidden="true" />
                                Add to Trips
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loadingChat && (
                <p role="status" className="text-xs font-medium text-[#0D9488]">
                  Consulting CapeSafe AI &amp; destination conditions...
                </p>
              )}
              {chatError && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  {chatError}
                </p>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSendChat(input);
              }}
              className="flex gap-2 border-t border-slate-200 p-4"
            >
              <label htmlFor="ai-prompt-input" className="sr-only">
                Ask CapeSafe AI
              </label>
              <input
                id="ai-prompt-input"
                type="text"
                value={input}
                disabled={loadingChat || !isOnline}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about Cape Town safety, step-free routes, or personalized ideas..."
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#0D9488] focus:outline-none disabled:bg-slate-100"
              />
              <button
                type="submit"
                disabled={loadingChat || !isOnline || !input.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D9488] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0F766E] disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                Send
              </button>
            </form>
          </section>
        </div>
      )}

      {/* TAB 2: AI Personalized Travel Planner */}
      {activeTab === 'planner' && (
        <div className="grid gap-6 lg:grid-cols-12">
          <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5">
            <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
              Build Personalized Cape Town Plan
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Generates a weather-aware, budget-guided multi-day itinerary grounded in CapeSafe attractions and your confirmed bookings.
            </p>

            <form onSubmit={handleGeneratePlan} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="plan-days" className="block text-xs font-semibold text-slate-700">
                    Trip Days (1–5)
                  </label>
                  <input
                    id="plan-days"
                    type="number"
                    min={1}
                    max={5}
                    value={planDays}
                    onChange={(e) => setPlanDays(Number(e.target.value) || 1)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="plan-budget" className="block text-xs font-semibold text-slate-700">
                    Activity Budget (ZAR)
                  </label>
                  <input
                    id="plan-budget"
                    type="number"
                    min={0}
                    step={250}
                    value={planBudget}
                    onChange={(e) => setPlanBudget(Number(e.target.value) || 0)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="plan-pace" className="block text-xs font-semibold text-slate-700">
                    Travel Pace
                  </label>
                  <select
                    id="plan-pace"
                    value={planPace}
                    onChange={(e) =>
                      setPlanPace(e.target.value as 'Relaxed' | 'Balanced' | 'Active')
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="Relaxed">Relaxed</option>
                    <option value="Balanced">Balanced</option>
                    <option value="Active">Active</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="plan-date" className="block text-xs font-semibold text-slate-700">
                    Start Date
                  </label>
                  <input
                    id="plan-date"
                    type="date"
                    value={planStartDate}
                    onChange={(e) => setPlanStartDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-700">Interests</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {INTEREST_OPTIONS.map((item) => {
                    const selected = planInterests.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleInterest(item)}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                          selected
                            ? 'border-[#0D9488] bg-[#F0FDFA] text-[#0F766E]'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={planAccessible}
                  onChange={(e) => setPlanAccessible(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#0D9488]"
                />
                <span className="inline-flex items-center gap-1.5 font-medium text-[#0B1F3A]">
                  <Accessibility className="h-4 w-4 text-[#0D9488]" aria-hidden="true" />
                  Prioritize step-free boardwalks &amp; accessible MyCiTi stops
                </span>
              </label>

              {planError && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  {planError}
                </p>
              )}

              <button
                type="submit"
                disabled={loadingPlan || !isOnline}
                className="w-full rounded-lg bg-[#0D9488] py-2.5 text-xs font-semibold text-white hover:bg-[#0F766E] disabled:opacity-50 transition-colors"
              >
                {loadingPlan ? 'Generating Personalized Plan...' : 'Generate AI Itinerary'}
              </button>
            </form>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <h2 className="font-display text-base font-bold text-[#0B1F3A]">
                Generated Itinerary Preview
              </h2>
              {planResult && (
                <button
                  type="button"
                  disabled={savingAction}
                  onClick={() => void handleSaveFullPlan()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1F3A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#132f57] disabled:opacity-50"
                >
                  <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
                  {savingAction ? 'Saving...' : 'Save All Stops to My Trips'}
                </button>
              )}
            </div>

            {!planResult ? (
              <p className="py-8 text-center text-xs text-slate-500">
                Configure your days, pace, budget, and accessibility options on the left to generate a personalized Cape Town itinerary.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-teal-200 bg-[#F0FDFA] p-4 text-xs space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-[#0B1F3A]">Plan Summary</p>
                    <span className="font-mono font-semibold text-[#0F766E]">
                      Est. Total: R {planResult.totalEstimatedZar.toLocaleString('en-ZA')}
                    </span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">{planResult.summary}</p>
                  <p className="text-[11px] font-medium text-[#0F766E]">
                    Weather Note: {planResult.weatherAdjustmentNote}
                  </p>
                </div>

                <div className="divide-y divide-slate-200">
                  {planResult.stops.map((stop, idx) => (
                    <div
                      key={`${stop.day}-${stop.time}-${idx}`}
                      className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="font-semibold text-[#0D9488]">{stop.dayLabel}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono font-medium text-[#0B1F3A]">{stop.time}</span>
                          <span aria-hidden="true">·</span>
                          <span>{stop.zone}</span>
                        </div>
                        <p className="text-sm font-semibold text-[#0B1F3A]">{stop.title}</p>
                        <p className="text-xs text-slate-600">{stop.transportNote}</p>
                        <p className="text-[11px] font-medium text-[#15803D]">
                          Safety: {stop.safetyNote} · Est. R {stop.estimatedZar}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={savingAction}
                        onClick={() => void handleAddSingleStop(stop)}
                        className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-[#0B1F3A] hover:border-[#0D9488] hover:bg-[#F0FDFA] disabled:opacity-50"
                      >
                        Add Stop
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 3: Language & Cultural Assistant (English, Afrikaans, isiXhosa) */}
      {activeTab === 'language' && (
        <div className="grid gap-6 lg:grid-cols-12">
          <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-6 space-y-4">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-[#0D9488]" aria-hidden="true" />
              <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                AI Translator &amp; Cultural Etiquette Coach
              </h2>
            </div>
            <p className="text-xs text-slate-600">
              Translate practical traveler phrases between <strong>English</strong>, <strong>Afrikaans</strong>, and <strong>isiXhosa</strong> with pronunciation and local Cape Town cultural etiquette.
            </p>

            <form onSubmit={handleTranslate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="src-lang" className="block text-xs font-semibold text-slate-700">
                    From
                  </label>
                  <select
                    id="src-lang"
                    value={sourceLang}
                    onChange={(e) => setSourceLang(e.target.value as PreferredLanguage)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="English">English</option>
                    <option value="Afrikaans">Afrikaans</option>
                    <option value="isiXhosa">isiXhosa</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="tgt-lang" className="block text-xs font-semibold text-slate-700">
                    To
                  </label>
                  <select
                    id="tgt-lang"
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.target.value as PreferredLanguage)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="isiXhosa">isiXhosa</option>
                    <option value="Afrikaans">Afrikaans</option>
                    <option value="English">English</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="lang-scenario" className="block text-xs font-semibold text-slate-700">
                  Cape Town Context
                </label>
                <select
                  id="lang-scenario"
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  <option>Heritage &amp; Community Greeting</option>
                  <option>MyCiTi Bus &amp; Train Transit</option>
                  <option>Trail Safety &amp; Rangers</option>
                  <option>Accessibility &amp; Mobility Request</option>
                  <option>Dining &amp; Markets</option>
                </select>
              </div>

              <div>
                <label htmlFor="phrase-input" className="block text-xs font-semibold text-slate-700">
                  Phrase or Question
                </label>
                <textarea
                  id="phrase-input"
                  rows={3}
                  value={phraseInput}
                  onChange={(e) => setPhraseInput(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              {translateError && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  {translateError}
                </p>
              )}

              <button
                type="submit"
                disabled={loadingTranslate || !isOnline}
                className="w-full rounded-lg bg-[#0D9488] py-2 text-xs font-semibold text-white hover:bg-[#0F766E] disabled:opacity-50"
              >
                {loadingTranslate ? 'Translating via Gemini...' : 'Translate & Get Cultural Tip'}
              </button>
            </form>

            {translationResult && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0D9488]">
                  {targetLang} Translation ({translationResult.model})
                </p>
                <p className="font-display text-base font-bold text-[#0B1F3A]">
                  {translationResult.translatedText}
                </p>
                <p className="text-slate-700">
                  <strong>Pronunciation:</strong> {translationResult.pronunciationGuide}
                </p>
                <p className="text-slate-700">
                  <strong>Cultural Etiquette:</strong> {translationResult.culturalEtiquetteTip}
                </p>
                <p className="text-[#15803D]">
                  <strong>Safety / Emergency Phrase:</strong> {translationResult.safetyPhraseVariant}
                </p>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h2 className="font-display text-base font-bold text-[#0B1F3A]">
                  Saved Offline Phrasebook
                </h2>
                <p className="text-[11px] text-slate-500">
                  Saved Information (Always available offline · Not live AI output)
                </p>
              </div>
              <StatusText label="Saved Offline" tone="nominal" />
            </div>

            <div className="space-y-3 max-h-[480px] overflow-y-auto">
              {OFFLINE_CAPE_TOWN_PHRASEBOOK.map((entry) => (
                <article key={entry.id} className="rounded-lg border border-slate-200 p-3.5 text-xs space-y-1.5">
                  <p className="font-semibold text-[#0D9488]">{entry.category}</p>
                  <p className="text-slate-800">
                    <strong>English:</strong> {entry.en}
                  </p>
                  <p className="text-slate-800">
                    <strong>Afrikaans:</strong> {entry.af}
                  </p>
                  <p className="text-[#0B1F3A] font-medium">
                    <strong>isiXhosa:</strong> {entry.xh}
                  </p>
                  <p className="font-mono text-[11px] text-slate-500">
                    Pronunciation: {entry.pronunciationXh}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
