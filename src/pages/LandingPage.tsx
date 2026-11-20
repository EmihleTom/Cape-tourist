import React from 'react';
import {
  ArrowRight,
  Compass,
  ShieldCheck,
  Store,
  UserCheck,
  Users,
} from 'lucide-react';
import { BrandMark } from '@/src/components/common/BrandMark';
import { DemoDataNotice } from '@/src/components/common/DemoDataNotice';
import { ImageWithFallback } from '@/src/components/common/ImageWithFallback';
import { StatusText } from '@/src/components/common/StatusText';
import { PWAInstallButton } from '@/src/components/pwa/PWAInstallButton';
import {
  BOKAAP_IMAGE_URL,
  BOULDERS_IMAGE_URL,
  HERO_IMAGE_URL,
  KIRSTENBOSCH_IMAGE_URL,
} from '@/src/data/demoData';
import type { NavSectionId, UserRole } from '@/src/types/app';

interface LandingPageProps {
  onOpenAuth: (mode: 'login' | 'register') => void;
  onEnterDemoRole: (role: UserRole, section?: NavSectionId) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenAuth,
  onEnterDemoRole,
}) => {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-4 sm:px-6 lg:px-8">
          <a
            href="#top"
            className="whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] rounded-md"
          >
            <BrandMark />
          </a>

          <nav
            aria-label="Landing navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
          >
            <a href="#capabilities" className="hover:text-[#111827] transition-colors whitespace-nowrap shrink-0">
              Capabilities
            </a>
            <a href="#destinations" className="hover:text-[#111827] transition-colors whitespace-nowrap shrink-0">
              Destinations
            </a>
            <a href="#safety-network" className="hover:text-[#111827] transition-colors whitespace-nowrap shrink-0">
              Safety Network
            </a>
            <a href="#portals" className="hover:text-[#111827] transition-colors whitespace-nowrap shrink-0">
              Role Portals
            </a>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="rounded-lg bg-[#111827] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E293B] transition-colors whitespace-nowrap shrink-0"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* Hero Split */}
      <section id="top" className="border-b border-slate-200 bg-gradient-to-b from-[#EFF6FF]/75 via-slate-50 to-white">
        <div className="mx-auto max-w-[1440px] 2xl:max-w-[1640px] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="grid items-stretch gap-8 lg:grid-cols-12 lg:gap-10">
            <div className="flex flex-col justify-between lg:col-span-5">
              <div>
                <p className="text-xs font-semibold text-[#1D4ED8]">
                  Cape Town Metropolitan Tourism &amp; Coastal Safety
                </p>
                <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-[#111827] sm:text-5xl text-balance leading-[1.1]">
                  Explore Cape Town with coordinated safety and verified transit.
                </h1>
                <p className="mt-5 text-base text-slate-600 leading-relaxed max-w-xl">
                  CapeSafe Connect 360 brings together AI itinerary planning, accredited tour bookings,
                  timed mountain check-ins, and MyCiTi mobility inside one installable web platform.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <button
                    type="button"
                    onClick={() => onEnterDemoRole('tourist', 'dashboard')}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1E40AF] transition-colors whitespace-nowrap"
                  >
                    Launch Demo Platform
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenAuth('register')}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-[#111827] hover:bg-slate-100 transition-colors whitespace-nowrap"
                  >
                    Create Account
                  </button>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-200">
                <DemoDataNotice compact scope="Frontend prototype with sample Cape Town records" />
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="relative h-64 overflow-hidden rounded-xl border border-slate-200 bg-[#111827] sm:h-96 lg:h-full lg:min-h-[440px] 2xl:min-h-[520px]">
                <ImageWithFallback
                  src={HERO_IMAGE_URL}
                  alt="Table Mountain rising behind Cape Town Victoria and Alfred Waterfront coastline"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#090D16]/85 via-[#090D16]/40 to-transparent p-5 sm:p-6">
                  <p className="font-mono text-xs text-blue-300">
                    33.9036° S, 18.4205° E · Victoria &amp; Alfred Coastal Corridor
                  </p>
                  <p className="mt-1 font-display text-sm font-semibold text-white">
                    Live-ready architecture integrating tourist itineraries with coastal &amp; mountain safety checkpoints
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 4-Column Operational Strip below Hero Split */}
          <div className="mt-10 grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            <div>
              <p className="text-xs text-slate-500">Integrated Features</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums text-[#111827]">15 Modules</p>
              <p className="mt-0.5 text-xs text-slate-600">Navigation, passes &amp; AI planning</p>
            </div>
            <div className="border-slate-200 lg:border-l lg:pl-6">
              <p className="text-xs text-slate-500">Dedicated Dashboards</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums text-[#111827]">4 Portals</p>
              <p className="mt-0.5 text-xs text-slate-600">Tourist, Admin, Provider &amp; Safety</p>
            </div>
            <div className="border-slate-200 lg:border-l lg:pl-6">
              <p className="text-xs text-slate-500">Demo Patrol Corridors</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums text-[#1D4ED8]">12 Zones</p>
              <p className="mt-0.5 text-xs text-slate-600">Mountain, coastal &amp; heritage routes</p>
            </div>
            <div className="border-slate-200 lg:border-l lg:pl-6">
              <p className="text-xs text-slate-500">Offline Readiness</p>
              <p className="mt-1 font-display text-2xl font-bold text-[#15803D]">PWA Ready</p>
              <p className="mt-0.5 text-xs text-slate-600">Cached passes &amp; emergency dial</p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Capabilities */}
      <section id="capabilities" className="border-b border-slate-200 bg-white py-16">
        <div className="mx-auto max-w-[1440px] 2xl:max-w-[1640px] px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-[#1D4ED8]">Platform Architecture</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#111827] text-balance">
              Built for travelers, municipal safety teams, and local operators.
            </h2>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-12">
            <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-7 lg:col-span-7 hover:border-[#1D4ED8]/40 transition-colors">
              <p className="font-mono text-xs font-semibold text-[#1D4ED8]">01. Discovery &amp; Smart Bookings</p>
              <h3 className="mt-2 font-display text-xl font-semibold text-[#111827]">
                Verified Cape Town experiences with safety vetting
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Browse coastal reserves, botanical canopy trails, and guided heritage quarters. Every listed operator carries compliance verification, PayShap &amp; card tokenization checkout, and accessibility clarity.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-7 lg:col-span-5 hover:border-[#1D4ED8]/40 transition-colors">
              <p className="font-mono text-xs font-semibold text-[#1D4ED8]">02. Safety Centre &amp; Timed Check-In</p>
              <h3 className="mt-2 font-display text-xl font-semibold text-[#111827]">
                Proactive trail timers &amp; wind advisories
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Start a timed mountain or coastal check-in before heading up Lion&apos;s Head or Table Mountain, alerting designated contacts if return windows lapse.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-7 lg:col-span-5 hover:border-[#1D4ED8]/40 transition-colors">
              <p className="font-mono text-xs font-semibold text-[#1D4ED8]">03. Digital Pass &amp; Transit</p>
              <h3 className="mt-2 font-display text-xl font-semibold text-[#111827]">
                Unified MyCiTi routes &amp; offline QR pass
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Keep your Digital Tourist Pass, ZAR budget ledger, and step-free mobility guidance accessible even when coastal signal drops.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-7 lg:col-span-7 hover:border-[#1D4ED8]/40 transition-colors">
              <p className="font-mono text-xs font-semibold text-[#1D4ED8]">04. Multi-Stakeholder Operations</p>
              <h3 className="mt-2 font-display text-xl font-semibold text-[#111827]">
                Four role-tailored operational dashboards
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Switch seamlessly between Tourist, Administrator, Tourism Service Provider, and Safety Management views with live Firebase Authentication, Cloud Firestore sync, and server-side AI planning.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Curated Cape Town Destinations Preview */}
      <section id="destinations" className="border-b border-slate-200 bg-slate-50 py-16">
        <div className="mx-auto max-w-[1440px] 2xl:max-w-[1640px] px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-[#1D4ED8]">Explore Preview</p>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#111827]">
                Featured Cape Peninsula precincts
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onEnterDemoRole('tourist', 'explore')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1D4ED8] hover:text-[#1E40AF] whitespace-nowrap"
            >
              Browse all precincts
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <article className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                <ImageWithFallback
                  src={BOULDERS_IMAGE_URL}
                  alt="Boulders Beach granite boulders and boardwalk in Simon's Town"
                />
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span>Coastal · Simon&apos;s Town</span>
                  <StatusText label="Nominal" tone="nominal" />
                </div>
                <h3 className="mt-2 font-display text-lg font-semibold text-[#111827]">
                  Boulders Beach Sanctuary
                </h3>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                  Timber boardwalk penguin viewing decks with sheltered turquoise coves and step-free visitor centre access.
                </p>
              </div>
            </article>

            <article className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                <ImageWithFallback
                  src={KIRSTENBOSCH_IMAGE_URL}
                  alt="Kirstenbosch Boomslang canopy walkway above indigenous fynbos"
                />
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span>Accessibility · Newlands</span>
                  <StatusText label="Step-Free Verified" tone="nominal" />
                </div>
                <h3 className="mt-2 font-display text-lg font-semibold text-[#111827]">
                  Kirstenbosch Boomslang Canopy
                </h3>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                  Gentle-gradient treetop walkway through indigenous Cape Floristic gardens with electric shuttle assistance.
                </p>
              </div>
            </article>

            <article className="overflow-hidden rounded-xl border border-slate-200 bg-white md:col-span-2 lg:col-span-1">
              <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                <ImageWithFallback
                  src={BOKAAP_IMAGE_URL}
                  alt="Historic Bo-Kaap cobbled street with Table Mountain backdrop"
                />
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span>Heritage · Signal Hill</span>
                  <StatusText label="Guided Recommended" tone="advisory" />
                </div>
                <h3 className="mt-2 font-display text-lg font-semibold text-[#111827]">
                  Bo-Kaap Heritage Quarter
                </h3>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                  Cobbled historic lanes, community spice workshops, and accredited local cultural storytellers.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* Safety Network Section */}
      <section id="safety-network" className="border-b border-slate-200 bg-[#111827] py-16 text-white">
        <div className="mx-auto max-w-[1440px] 2xl:max-w-[1640px] px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-7">
              <p className="text-xs font-semibold text-blue-300">Safety Coordination</p>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-white text-balance">
                Direct link between traveler check-ins and Cape Town safety responders.
              </h2>
              <p className="mt-4 text-sm text-slate-300 leading-relaxed max-w-2xl">
                Whether monitoring southeaster wind thresholds on Table Mountain or coordinating overdue trail check-ins near Lion&apos;s Head, CapeSafe Connect 360 surfaces clear, actionable safety data without clutter.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onEnterDemoRole('safety', 'safety')}
                  className="rounded-lg bg-[#3B82F6] px-4 py-2.5 text-xs font-semibold text-[#090D16] hover:bg-blue-300 transition-colors whitespace-nowrap"
                >
                  Inspect Safety Centre
                </button>
                <button
                  type="button"
                  onClick={() => onEnterDemoRole('tourist', 'check-in')}
                  className="rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/10 transition-colors whitespace-nowrap"
                >
                  Try Timed Check-In
                </button>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-xl border border-white/15 bg-[#1E293B] p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="font-display text-sm font-semibold text-white">
                    Sample Emergency Directory
                  </span>
                  <span className="font-mono text-xs text-blue-300">24/7 Reference</span>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Cape Town Metro Emergency</span>
                    <span className="font-mono font-semibold tabular-nums text-white">107 / 112</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Wilderness Search &amp; Rescue</span>
                    <span className="font-mono font-semibold tabular-nums text-white">021 937 0300</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">NSRI Sea Rescue Coastal Ops</span>
                    <span className="font-mono font-semibold tabular-nums text-white">087 094 9774</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Role Portals */}
      <section id="portals" className="bg-white py-16">
        <div className="mx-auto max-w-[1440px] 2xl:max-w-[1640px] px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-[#1D4ED8]">Hackathon Demonstration Access</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#111827]">
              Open any role dashboard directly
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Select a persona below to explore the complete 15-feature navigation and role-specific operational view using demonstration data.
            </p>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <button
              type="button"
              onClick={() => onEnterDemoRole('tourist', 'dashboard')}
              className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-5 text-left hover:border-[#1D4ED8] hover:bg-white transition-colors"
            >
              <div>
                <Compass className="h-5 w-5 text-[#1D4ED8]" aria-hidden="true" />
                <h3 className="mt-3 font-display text-base font-bold text-[#111827]">
                  Tourist Dashboard
                </h3>
                <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                  Trip timeline, Digital Pass, Check-In timer, CapeSafe AI, ZAR budget, and transit routes.
                </p>
              </div>
              <span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-[#1D4ED8] group-hover:translate-x-0.5 transition-transform">
                Enter as Tourist <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => onEnterDemoRole('admin', 'dashboard')}
              className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-5 text-left hover:border-[#1D4ED8] hover:bg-white transition-colors"
            >
              <div>
                <Users className="h-5 w-5 text-[#111827]" aria-hidden="true" />
                <h3 className="mt-3 font-display text-base font-bold text-[#111827]">
                  Administrator Dashboard
                </h3>
                <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                  Operator accreditation queue, metro precinct load, and Firebase readiness controls.
                </p>
              </div>
              <span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-[#111827] group-hover:translate-x-0.5 transition-transform">
                Enter as Admin <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => onEnterDemoRole('provider', 'dashboard')}
              className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-5 text-left hover:border-[#1D4ED8] hover:bg-white transition-colors"
            >
              <div>
                <Store className="h-5 w-5 text-[#15803D]" aria-hidden="true" />
                <h3 className="mt-3 font-display text-base font-bold text-[#111827]">
                  Service Provider Dashboard
                </h3>
                <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                  Departure capacity, passenger manifest, safety checklists, and accessibility notes.
                </p>
              </div>
              <span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-[#15803D] group-hover:translate-x-0.5 transition-transform">
                Enter as Provider <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => onEnterDemoRole('safety', 'dashboard')}
              className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-5 text-left hover:border-[#1D4ED8] hover:bg-white transition-colors"
            >
              <div>
                <ShieldCheck className="h-5 w-5 text-[#1D4ED8]" aria-hidden="true" />
                <h3 className="mt-3 font-display text-base font-bold text-[#111827]">
                  Safety Management Dashboard
                </h3>
                <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                  Overdue hiker escalations, advisory broadcasts, and patrol corridor statuses.
                </p>
              </div>
              <span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-[#1D4ED8] group-hover:translate-x-0.5 transition-transform">
                Enter as Safety Ops <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="space-y-2">
            <BrandMark />
            <p className="text-xs text-slate-500">
              Cape Town Smart Tourism &amp; Coastal Safety Architecture · Demonstration Build
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <PWAInstallButton variant="subtle" />
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="inline-flex items-center gap-1.5 font-medium text-[#111827] hover:text-[#1D4ED8]"
            >
              <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Sign In
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('register')}
              className="font-medium text-[#111827] hover:text-[#1D4ED8]"
            >
              Register
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
