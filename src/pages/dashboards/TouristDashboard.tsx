import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bot,
  CalendarCheck,
  CloudSun,
  Compass,
  LayoutDashboard,
  Megaphone,
  QrCode,
  ShieldAlert,
  Timer,
  Wallet,
} from 'lucide-react';
import { DemoDataNotice } from '@/src/components/common/DemoDataNotice';
import { ImageWithFallback } from '@/src/components/common/ImageWithFallback';
import { StatusText } from '@/src/components/common/StatusText';
import { MyPaymentsSection } from '@/src/components/payments/MyPaymentsSection';
import { CAPE_TOWN_DESTINATION_INFO, KIRSTENBOSCH_IMAGE_URL } from '@/src/data/demoData';
import { isFirebaseConfigured } from '@/src/services/firebase/config';
import { dataService } from '@/src/services/firebase/dataService';
import type {
  AttractionItem,
  BookingItem,
  BudgetExpense,
  CapeTownWeather,
  CheckInSession,
  DemoUser,
  DestinationAnnouncement,
  NavSectionId,
  PaymentRecord,
  ProviderPaymentSettings,
  SafetyAdvisory,
  SavedPaymentMethod,
  TripActivity,
} from '@/src/types/app';

interface TouristDashboardProps {
  user: DemoUser;
  attractions: AttractionItem[];
  bookings: BookingItem[];
  tripActivities: TripActivity[];
  advisories: SafetyAdvisory[];
  announcements: DestinationAnnouncement[];
  weather: CapeTownWeather;
  checkIns: CheckInSession[];
  expenses: BudgetExpense[];
  payments: PaymentRecord[];
  savedCards: SavedPaymentMethod[];
  providerPaymentSettings: ProviderPaymentSettings[];
  initialTab?: 'overview' | 'payments';
  onTabChange?: (tab: 'overview' | 'payments') => void;
  onRemoveSavedCard: (cardId: string) => Promise<void> | void;
  onNavigate: (section: NavSectionId) => void;
}

export type TouristDashboardTab = 'overview' | 'payments';

export const TouristDashboard: React.FC<TouristDashboardProps> = ({
  user,
  attractions,
  bookings,
  tripActivities,
  advisories,
  announcements,
  weather,
  checkIns,
  expenses,
  payments,
  savedCards,
  providerPaymentSettings,
  initialTab = 'overview',
  onTabChange,
  onRemoveSavedCard,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<TouristDashboardTab>(initialTab);
  const [fetchedPayments, setFetchedPayments] = useState<PaymentRecord[] | null>(null);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paymentsError, setPaymentsError] = useState('');

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const selectTab = (tab: TouristDashboardTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  const canFetchLivePayments =
    user.authMode === 'firebase' && Boolean(user.emailVerified) && isFirebaseConfigured();

  const fetchPaymentHistory = useCallback(async () => {
    if (!canFetchLivePayments) {
      setFetchedPayments(null);
      setPaymentsError('');
      return;
    }
    setLoadingPayments(true);
    setPaymentsError('');
    try {
      const records = await dataService.fetchUserPayments(user.id);
      setFetchedPayments(records);
    } catch (err) {
      setPaymentsError(
        err instanceof Error
          ? err.message
          : 'Unable to load payment history from Firestore. Showing any synced local records.'
      );
    } finally {
      setLoadingPayments(false);
    }
  }, [canFetchLivePayments, user.id]);

  useEffect(() => {
    if (activeTab === 'payments' && canFetchLivePayments) {
      void fetchPaymentHistory();
    }
  }, [activeTab, canFetchLivePayments, fetchPaymentHistory]);

  const userPayments = useMemo(() => {
    const isFirebaseTourist = user.authMode === 'firebase' && user.role === 'tourist';
    const propScoped = payments.filter((p) =>
      isFirebaseTourist ? p.userId === user.id : p.userId === user.id || p.dataOrigin === 'demo'
    );
    if (!fetchedPayments) return propScoped;

    const merged = new Map<string, PaymentRecord>();
    propScoped.forEach((p) => merged.set(p.id, p));
    fetchedPayments.forEach((p) => merged.set(p.id, p));
    return Array.from(merged.values());
  }, [payments, fetchedPayments, user.authMode, user.role, user.id]);

  const settledPaymentsCount = userPayments.filter(
    (p) => p.paymentStatus === 'Paid' || p.paymentStatus === 'Partially Paid'
  ).length;

  const confirmedBookings = bookings.filter((b) => b.status === 'Confirmed');
  const totalSpend = expenses.reduce((sum, item) => sum + item.amountZar, 0);
  const activeCheckIns = checkIns.filter((c) => c.status === 'Active');
  const upcomingActivities = tripActivities.filter((a) => !a.completed).slice(0, 3);
  const activeAnnouncements = announcements
    .filter((a) => a.active)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned))
    .slice(0, 3);

  const personalizationEnabled = user.aiContextPersonalization !== false;
  const openAdvisoriesCount = advisories.filter((a) => (a.status || 'Open') !== 'Resolved').length;

  const personalizedPicks = [...attractions]
    .sort((a, b) => {
      const aStepFree = /step-free|wheelchair|level|gentle-gradient/i.test(a.accessibilitySummary);
      const bStepFree = /step-free|wheelchair|level|gentle-gradient/i.test(b.accessibilitySummary);
      if (user.accessibilityPriority && aStepFree !== bStepFree) {
        return aStepFree ? -1 : 1;
      }
      if (weather.cablewayRisk !== 'Low') {
        if (a.category === 'Mountain' && b.category !== 'Mountain') return 1;
        if (a.category !== 'Mountain' && b.category === 'Mountain') return -1;
      }
      return 0;
    })
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <DemoDataNotice scope="Sample Cape Town itinerary, bookings & ZAR ledger shown alongside live weather, Firestore advisories, and official announcements" />

      {/* Dashboard Section Tabs */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="tablist"
          aria-label="Tourist dashboard views"
          className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 self-start"
        >
          <button
            type="button"
            role="tab"
            id="tab-tourist-overview"
            aria-selected={activeTab === 'overview'}
            aria-controls="panel-tourist-overview"
            onClick={() => selectTab('overview')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'overview'
                ? 'bg-[#111827] text-white'
                : 'text-slate-600 hover:text-[#111827]'
            }`}
          >
            <LayoutDashboard className="h-3.5 w-3.5" aria-hidden="true" />
            Overview
          </button>
          <button
            type="button"
            role="tab"
            id="tab-tourist-payments"
            aria-selected={activeTab === 'payments'}
            aria-controls="panel-tourist-payments"
            onClick={() => selectTab('payments')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'payments'
                ? 'bg-[#111827] text-white'
                : 'text-slate-600 hover:text-[#111827]'
            }`}
          >
            <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
            My Payments
            <span className="font-mono text-[11px] opacity-80 tabular-nums">
              ({userPayments.length})
            </span>
          </button>
        </div>

        <p className="text-xs text-slate-600">
          <span className="font-mono font-semibold text-[#15803D] tabular-nums">
            {settledPaymentsCount}
          </span>{' '}
          settled receipt(s) ·{' '}
          <button
            type="button"
            onClick={() => onNavigate('bookings')}
            className="font-semibold text-[#1D4ED8] hover:underline"
          >
            Go to Smart Bookings
          </button>
        </p>
      </div>

      {activeTab === 'payments' ? (
        <div
          id="panel-tourist-payments"
          role="tabpanel"
          aria-labelledby="tab-tourist-payments"
        >
          <MyPaymentsSection
            payments={userPayments}
            savedCards={savedCards}
            providerSettingsList={providerPaymentSettings}
            loading={loadingPayments}
            error={paymentsError}
            onRefresh={fetchPaymentHistory}
            onRemoveSavedCard={onRemoveSavedCard}
            onNavigate={onNavigate}
          />
        </div>
      ) : (
        <div
          id="panel-tourist-overview"
          role="tabpanel"
          aria-labelledby="tab-tourist-overview"
          className="space-y-6"
        >
      {/* Welcome & Quick Action Header */}
      <section className="grid gap-6 rounded-xl border border-slate-200 bg-white p-6 lg:grid-cols-12 lg:items-stretch">
        <div className="flex flex-col justify-between lg:col-span-8">
          <div>
            <p className="text-xs font-semibold text-[#1D4ED8]">
              Tourist Workspace · {user.location}
            </p>
            <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-[#111827] sm:text-3xl">
              Welcome back, {user.name.split(' ')[0]}
            </h1>
            <p className="mt-2 text-sm text-slate-600 max-w-2xl leading-relaxed">
              Your Cape Town peninsula schedule is synced for offline access. Check live coastal wind conditions, keep Timed Check-Ins active on mountain trails, and explore accredited local operators.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onNavigate('check-in')}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] transition-colors whitespace-nowrap"
            >
              <Timer className="h-4 w-4" aria-hidden="true" />
              Manage Trail Check-In
            </button>
            <button
              type="button"
              onClick={() => onNavigate('explore')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#111827] hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <Compass className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
              Open Interactive Map
            </button>
            <button
              type="button"
              onClick={() => onNavigate('pass')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#111827] hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <QrCode className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
              Open Digital Pass
            </button>
            <button
              type="button"
              onClick={() => onNavigate('ai-assistant')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#111827] hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <Bot className="h-4 w-4 text-[#111827]" aria-hidden="true" />
              Ask CapeSafe AI
            </button>
            <button
              type="button"
              onClick={() => selectTab('payments')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#111827] hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <Wallet className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
              My Payments &amp; Receipts
            </button>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="relative h-48 overflow-hidden rounded-lg border border-slate-200 lg:h-full">
            <ImageWithFallback
              src={KIRSTENBOSCH_IMAGE_URL}
              alt="Kirstenbosch Boomslang Canopy walkway in morning sunlight"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#090D16]/85 via-[#090D16]/40 to-transparent p-4">
              <p className="font-mono text-[11px] text-blue-300">Next Scheduled Experience</p>
              <p className="font-display text-sm font-semibold text-white">
                Kirstenbosch Canopy Walk · 08:30
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4-Column Metric Strip */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => onNavigate('bookings')}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-[#1D4ED8] transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Confirmed Bookings</span>
            <CalendarCheck className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-[#111827]">
            {confirmedBookings.length}
          </p>
          <p className="mt-1 text-xs text-slate-600">All operators safety-verified</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('check-in')}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-[#1D4ED8] transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Active Check-Ins</span>
            <Timer className="h-4 w-4 text-[#15803D]" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-[#111827]">
            {activeCheckIns.length}
          </p>
          <p className="mt-1 text-xs text-[#15803D] font-medium">Return timer running</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('budget')}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-[#1D4ED8] transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Trip Spend (ZAR)</span>
            <Wallet className="h-4 w-4 text-[#111827]" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-[#111827]">
            R {totalSpend.toLocaleString('en-ZA')}
          </p>
          <p className="mt-1 text-xs text-slate-600">Demo budget: R 12,000</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('safety')}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-[#1D4ED8] transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Zone Advisories</span>
            <ShieldAlert className="h-4 w-4 text-amber-700" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-[#111827]">
            {advisories.length}
          </p>
          <p className="mt-1 text-xs text-slate-600">Tap to report or inspect map</p>
        </button>
      </section>

      {/* Smart Destination Condition Brief & Personalized Recommendations */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-col gap-2 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-[#111827]">
              Smart Destination Condition Brief &amp; Recommended Stops
            </h2>
            <p className="text-xs text-slate-600">
              {weather.cablewayRisk === 'Low'
                ? `Calm ${weather.windSpeedKmh} km/h winds favor morning Table Mountain & coastal routes.`
                : `Elevated ${weather.windGustsKmh} km/h gusts (${weather.cablewayRisk} cableway risk) — sheltered Kirstenbosch, V&A Waterfront & Bo-Kaap routes prioritized.`}{' '}
              · {openAdvisoriesCount} active advisory item(s) ·{' '}
              {personalizationEnabled
                ? user.accessibilityPriority
                  ? 'Tailored for Step-Free Priority'
                  : `Tailored for ${user.location}`
                : 'Personal context paused in Privacy Settings'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('ai-assistant')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1E40AF] whitespace-nowrap self-start sm:self-auto"
          >
            <Bot className="h-3.5 w-3.5" aria-hidden="true" />
            Plan with CapeSafe AI
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {personalizedPicks.map((pick) => (
            <div key={pick.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[#1D4ED8]">{pick.category}</span>
                <StatusText
                  label={pick.safetyStatus}
                  tone={pick.safetyStatus === 'Nominal' ? 'nominal' : 'advisory'}
                />
              </div>
              <p className="font-display text-sm font-bold text-[#111827]">{pick.title}</p>
              <p className="text-[11px] text-slate-600">{pick.accessibilitySummary}</p>
              <div className="flex items-center justify-between pt-1">
                <span className="font-mono text-[11px] text-slate-500">
                  {pick.priceZar === 0 ? 'Free entry' : `From R ${pick.priceZar}`}
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate('explore')}
                  className="font-semibold text-[#1D4ED8] hover:underline"
                >
                  Inspect on Map
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Destination Information & Official Announcements */}
      <div className="grid gap-6 lg:grid-cols-12">
        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <CloudSun className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
              <h2 className="font-display text-base font-bold text-[#111827]">
                Cape Town Weather &amp; Visitor Info
              </h2>
            </div>
            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
              {weather.dataOrigin === 'live' ? 'Live · Open-Meteo' : 'Demo Snapshot'}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p className="font-display text-2xl font-bold text-[#111827] tabular-nums">
                {weather.temperatureC}°C
              </p>
              <p className="text-xs text-slate-600">{weather.conditionLabel}</p>
            </div>
            <div className="text-right text-xs">
              <p className="font-mono font-semibold text-[#111827] tabular-nums">
                Wind {weather.windSpeedKmh} km/h · Gusts {weather.windGustsKmh} km/h
              </p>
              <StatusText
                label={`Cableway Risk: ${weather.cablewayRisk}`}
                tone={
                  weather.cablewayRisk === 'Low'
                    ? 'nominal'
                    : weather.cablewayRisk === 'Moderate'
                    ? 'advisory'
                    : 'alert'
                }
              />
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            {CAPE_TOWN_DESTINATION_INFO.slice(0, 2).map((info) => (
              <div key={info.id} className="rounded-lg border border-slate-200 p-3 text-xs">
                <p className="font-semibold text-[#111827]">{info.title}</p>
                <p className="mt-1 text-[11px] text-slate-600 leading-relaxed">{info.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
              <h2 className="font-display text-base font-bold text-[#111827]">
                Destination Announcements
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('safety')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D4ED8] hover:text-[#1E40AF]"
            >
              Safety &amp; Info <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          <div className="divide-y divide-slate-200">
            {activeAnnouncements.map((ann) => (
              <div key={ann.id} className="py-3 first:pt-2 last:pb-0 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#111827]">{ann.title}</span>
                    {ann.pinned && (
                      <span className="rounded bg-[#EFF6FF] px-1.5 py-0.5 text-[10px] font-semibold text-[#1E40AF]">
                        Pinned
                      </span>
                    )}
                  </div>
                  <StatusText
                    label={ann.priority}
                    tone={
                      ann.priority === 'Urgent'
                        ? 'alert'
                        : ann.priority === 'Advisory'
                        ? 'advisory'
                        : 'nominal'
                    }
                  />
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{ann.body}</p>
                <p className="text-[11px] text-slate-500">
                  {ann.category} · {ann.zone} · {ann.updatedAtLabel}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Two-Column Itinerary & Safety Feed */}
      <div className="grid gap-6 lg:grid-cols-12">
        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="font-display text-base font-bold text-[#111827]">
              Upcoming Itinerary Stops
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('trips')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D4ED8] hover:text-[#1E40AF]"
            >
              Full Schedule <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          <div className="divide-y divide-slate-200">
            {upcomingActivities.map((act) => (
              <div key={act.id} className="flex flex-col gap-1 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono font-medium text-[#111827] tabular-nums">{act.time}</span>
                    <span aria-hidden="true">·</span>
                    <span>{act.zone}</span>
                  </div>
                  <p className="mt-0.5 text-sm font-semibold text-[#111827]">{act.title}</p>
                  <p className="text-xs text-slate-600">{act.transportNote}</p>
                </div>
                <StatusText label={act.safetyNote} tone="nominal" />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="font-display text-base font-bold text-[#111827]">
              Latest Safety Advisories
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('safety')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D4ED8] hover:text-[#1E40AF]"
            >
              Safety Centre <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          <div className="divide-y divide-slate-200">
            {advisories.slice(0, 3).map((adv) => (
              <div key={adv.id} className="py-3.5 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-500">{adv.zone}</span>
                  <StatusText
                    label={adv.severity}
                    tone={
                      adv.severity === 'Nominal'
                        ? 'nominal'
                        : adv.severity === 'Advisory'
                        ? 'advisory'
                        : 'alert'
                    }
                  />
                </div>
                <p className="text-sm font-semibold text-[#111827]">{adv.title}</p>
                <p className="text-xs text-slate-600 leading-relaxed">{adv.summary}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => onNavigate('explore')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#111827] hover:text-[#1D4ED8]"
            >
              <Compass className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
              Explore accessible precincts across the Peninsula
            </button>
          </div>
        </section>
      </div>

      {/* End of Overview Tab */}
        </div>
      )}
    </div>
  );
};
