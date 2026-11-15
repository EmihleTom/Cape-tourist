import React, { useMemo, useState } from 'react';
import { Accessibility, Bus, CalendarPlus, Compass, Search } from 'lucide-react';
import { DemoDataNotice } from '@/src/components/common/DemoDataNotice';
import { StatusText } from '@/src/components/common/StatusText';
import type {
  AccessibilityRoute,
  AttractionItem,
  DemoUser,
  NavSectionId,
  ProviderListing,
  TransportRoute,
} from '@/src/types/app';

interface AccessibilityPageProps {
  user: DemoUser;
  routes: AccessibilityRoute[];
  attractions: AttractionItem[];
  transportRoutes: TransportRoute[];
  offerings: ProviderListing[];
  onToggleAccessibilityPriority: (enabled: boolean) => Promise<void> | void;
  onAddToTrip: (attraction: AttractionItem) => Promise<void> | void;
  onNavigate: (section: NavSectionId) => void;
}

export const AccessibilityPage: React.FC<AccessibilityPageProps> = ({
  user,
  routes,
  attractions,
  transportRoutes,
  offerings,
  onToggleAccessibilityPriority,
  onAddToTrip,
  onNavigate,
}) => {
  const [stepFreeDefault, setStepFreeDefault] = useState(Boolean(user.accessibilityPriority));
  const [largeTextMode, setLargeTextMode] = useState(false);
  const [audioGuides, setAudioGuides] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Step-Free Verified' | 'Assisted Access'>('All');
  const [notice, setNotice] = useState('');

  const filteredRoutes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return routes
      .filter((r) => {
        if (statusFilter !== 'All' && r.status !== statusFilter) return false;
        if (!q) return true;
        return (
          r.site.toLowerCase().includes(q) ||
          r.surfaceType.toLowerCase().includes(q) ||
          r.sensoryNote.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (!stepFreeDefault) return 0;
        return a.status === 'Step-Free Verified' && b.status !== 'Step-Free Verified' ? -1 : 1;
      });
  }, [routes, searchQuery, statusFilter, stepFreeDefault]);

  const accessibleAttractions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return attractions.filter((a) => {
      const matchesText =
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.accessibilitySummary.toLowerCase().includes(q) ||
        a.precinct.toLowerCase().includes(q);
      if (!matchesText) return false;
      if (statusFilter === 'Step-Free Verified') {
        return /step-free|wheelchair|level|gentle-gradient/i.test(a.accessibilitySummary);
      }
      return true;
    });
  }, [attractions, searchQuery, statusFilter]);

  const accessibleTransport = useMemo(
    () => transportRoutes.filter((r) => r.accessible),
    [transportRoutes]
  );

  const accessibleOfferings = useMemo(
    () => offerings.filter((o) => o.accessible && o.status === 'Active'),
    [offerings]
  );

  const handleTogglePriority = async (checked: boolean) => {
    setStepFreeDefault(checked);
    await onToggleAccessibilityPriority(checked);
    setNotice(
      checked
        ? 'Step-Free Priority saved — CapeSafe AI and Discover cards will prioritize accessible routes.'
        : 'Step-Free Priority turned off.'
    );
  };

  return (
    <div className="space-y-6">
      <DemoDataNotice scope="Step-free Cape Town route audits, accessible transport bays, and inclusive bookable experiences synced with your profile preference" />

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Accessibility className="h-5 w-5 text-[#0D9488]" aria-hidden="true" />
            <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">
              Accessibility &amp; Inclusive Discovery
            </h1>
          </div>
          <StatusText
            label={stepFreeDefault ? 'Step-Free Priority Active' : 'Standard Ranking'}
            tone={stepFreeDefault ? 'nominal' : 'advisory'}
          />
        </div>
        <p className="mt-1.5 text-sm text-slate-600 max-w-3xl">
          Verified gradients, accessible restroom locations, sensory-friendly morning hours, and step-free attractions, transit, and accredited operators across Cape Town.
        </p>

        {notice && (
          <p className="mt-3 rounded-lg border border-teal-200 bg-[#F0FDFA] px-3 py-2 text-xs font-medium text-[#0F766E]">
            {notice}
          </p>
        )}

        <div className="mt-5 grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-3">
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5 cursor-pointer">
            <input
              type="checkbox"
              checked={stepFreeDefault}
              onChange={(e) => void handleTogglePriority(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0D9488]"
            />
            <span className="text-xs">
              <strong className="block font-semibold text-[#0B1F3A]">Step-Free Route Priority</strong>
              <span className="text-slate-600">Rank boardwalks, level MyCiTi stops &amp; AI suggestions first</span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5 cursor-pointer">
            <input
              type="checkbox"
              checked={largeTextMode}
              onChange={(e) => setLargeTextMode(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0D9488]"
            />
            <span className="text-xs">
              <strong className="block font-semibold text-[#0B1F3A]">Expanded Card Readability</strong>
              <span className="text-slate-600">Increase route note sizing inside this view</span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5 cursor-pointer">
            <input
              type="checkbox"
              checked={audioGuides}
              onChange={(e) => setAudioGuides(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0D9488]"
            />
            <span className="text-xs">
              <strong className="block font-semibold text-[#0B1F3A]">Sensory &amp; Audio Notes</strong>
              <span className="text-slate-600">Highlight quiet hours &amp; tactile boardwalk cues</span>
            </span>
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search boardwalks, ramps, Kirstenbosch, Sea Point, or sensory hours..."
              className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-2 text-xs focus:border-[#0D9488] focus:outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as 'All' | 'Step-Free Verified' | 'Assisted Access'
              )
            }
            aria-label="Filter accessibility access level"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
          >
            <option value="All">All Accessibility Levels</option>
            <option value="Step-Free Verified">Step-Free Verified Only</option>
            <option value="Assisted Access">Assisted Access</option>
          </select>
        </div>
      </div>

      {/* Verified Route Audits */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
          Verified Route &amp; Facility Audits ({filteredRoutes.length})
        </h2>
        <div className="grid gap-4">
          {filteredRoutes.map((route) => (
            <article key={route.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className={`font-display font-bold text-[#0B1F3A] ${largeTextMode ? 'text-xl' : 'text-base'}`}>
                  {route.site}
                </h3>
                <StatusText
                  label={route.status}
                  tone={route.status === 'Step-Free Verified' ? 'nominal' : 'advisory'}
                />
              </div>

              <div className={`mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 ${largeTextMode ? 'text-sm' : 'text-xs'} text-slate-600`}>
                <div>
                  <p className="font-semibold text-slate-800">Surface</p>
                  <p className="mt-0.5">{route.surfaceType}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Gradient</p>
                  <p className="mt-0.5">{route.gradientNote}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Facilities</p>
                  <p className="mt-0.5">{route.restrooms}</p>
                </div>
                {audioGuides && (
                  <div>
                    <p className="font-semibold text-slate-800">Sensory &amp; Audio Note</p>
                    <p className="mt-0.5">{route.sensoryNote}</p>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Unified Accessible Discovery: Attractions + Transport + Bookable Offerings */}
      <div className="grid gap-6 lg:grid-cols-12">
        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-6 space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <Compass className="h-4 w-4 text-[#0D9488]" aria-hidden="true" />
            <h2 className="font-display text-base font-bold text-[#0B1F3A]">
              Accessible Cape Town Attractions ({accessibleAttractions.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-200">
            {accessibleAttractions.map((attr) => (
              <div key={attr.id} className="py-3 first:pt-1 last:pb-0 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#0B1F3A]">{attr.title}</p>
                  <button
                    type="button"
                    onClick={async () => {
                      await onAddToTrip(attr);
                      setNotice(`Added "${attr.title}" to My Trips.`);
                    }}
                    className="inline-flex items-center gap-1 rounded border border-[#0D9488] px-2.5 py-1 text-[11px] font-semibold text-[#0D9488] hover:bg-[#F0FDFA]"
                  >
                    <CalendarPlus className="h-3 w-3" aria-hidden="true" />
                    Add to Trip
                  </button>
                </div>
                <p className={`${largeTextMode ? 'text-sm' : 'text-xs'} text-slate-600`}>
                  {attr.accessibilitySummary}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-6 space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Bus className="h-4 w-4 text-[#0D9488]" aria-hidden="true" />
                <h2 className="font-display text-base font-bold text-[#0B1F3A]">
                  Level-Boarding Transit ({accessibleTransport.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('transport')}
                className="text-xs font-semibold text-[#0D9488] hover:underline"
              >
                Open Transport
              </button>
            </div>
            <div className="mt-2 divide-y divide-slate-200">
              {accessibleTransport.map((trn) => (
                <div key={trn.id} className="py-2.5 text-xs">
                  <p className="font-semibold text-[#0B1F3A]">{trn.routeName}</p>
                  <p className="text-slate-600">
                    {trn.service} · {trn.frequency} · {trn.fareZar}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between pb-2">
              <h3 className="font-display text-sm font-bold text-[#0B1F3A]">
                Accessible Bookable Offerings ({accessibleOfferings.length})
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('bookings')}
                className="text-xs font-semibold text-[#0D9488] hover:underline"
              >
                Book in Smart Bookings
              </button>
            </div>
            <div className="space-y-2">
              {accessibleOfferings.slice(0, 3).map((off) => (
                <div
                  key={off.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                >
                  <div>
                    <p className="font-semibold text-[#0B1F3A]">{off.experienceTitle}</p>
                    <p className="text-[11px] text-slate-600">
                      {off.offeringType} · {off.zone}
                    </p>
                  </div>
                  <span className="font-mono font-semibold text-[#0D9488]">
                    R {off.priceZar}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
