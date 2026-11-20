import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  MapPin,
  PhoneCall,
  Radio,
  Search,
  ShieldAlert,
  Timer,
  Upload,
  Wind,
} from 'lucide-react';
import { DemoDataNotice } from '@/src/components/common/DemoDataNotice';
import { StatusText } from '@/src/components/common/StatusText';
import { storageService } from '@/src/services/firebase/storageService';
import type {
  CapeTownWeather,
  CheckInSession,
  DemoUser,
  IncidentCategory,
  NavSectionId,
  SafetyAdvisory,
} from '@/src/types/app';

export type SafetyDashboardTab = 'dispatch' | 'checkins' | 'broadcast';

interface SafetyManagementDashboardProps {
  user: DemoUser;
  checkIns: CheckInSession[];
  advisories: SafetyAdvisory[];
  weather?: CapeTownWeather;
  initialTab?: SafetyDashboardTab;
  onTabChange?: (tab: SafetyDashboardTab) => void;
  onResolveCheckIn: (id: string) => Promise<void> | void;
  onPublishAdvisory: (
    advisory: Omit<SafetyAdvisory, 'id' | 'updatedAt' | 'dataOrigin'>
  ) => Promise<void> | void;
  onUpdateIncident: (
    incidentId: string,
    updates: {
      status?: SafetyAdvisory['status'];
      severity?: SafetyAdvisory['severity'];
      assignedOfficerId?: string;
      assignedOfficerName?: string;
      resolutionNotes?: string;
    }
  ) => Promise<void> | void;
  onNavigate: (section: NavSectionId) => void;
}

const RESPONSE_UNITS = [
  'Capt. Nadia Jacobs',
  'WSAR Mountain Team',
  'NSRI Station 8',
  'Metro Tourism Safety Unit',
  'SANParks Visitor Rangers',
];

const PENINSULA_ZONES = [
  { key: 'Table Mountain', label: 'Table Mountain & Platteklip' },
  { key: 'Lion', label: "Lion's Head & Signal Hill" },
  { key: 'Waterfront', label: 'V&A Waterfront & Sea Point' },
  { key: 'Muizenberg', label: 'Muizenberg & False Bay' },
  { key: 'Chapman', label: "Chapman's Peak & Hout Bay" },
];

const DISPATCH_TEMPLATES: {
  id: string;
  label: string;
  category: IncidentCategory;
  severity: SafetyAdvisory['severity'];
  zone: string;
  title: string;
  summary: string;
}[] = [
  {
    id: 'tpl-wind',
    label: 'Southeaster Cableway Hold',
    category: 'Safety Advisory',
    severity: 'Elevated',
    zone: 'Table Mountain Summit & Platteklip Gorge',
    title: 'Southeaster Gusts — Upper Cableway Wind Hold Advisory',
    summary:
      'Strong southeaster gusts exceed upper station operating thresholds. Avoid exposed ridge crests, carry warm windproof layers, and allow extra descent time via Platteklip Gorge before dusk.',
  },
  {
    id: 'tpl-rip',
    label: 'False Bay Rip Current Alert',
    category: 'Coastal / Marine',
    severity: 'Advisory',
    zone: 'Muizenberg to Fish Hoek Coastline',
    title: 'Spring Tide Rip Current & Swell Advisory',
    summary:
      'Elevated swell and lateral rip currents active along False Bay beaches. Swim strictly between lifeguard flags and keep clear of wet low-tide rock ledges.',
  },
  {
    id: 'tpl-mist',
    label: 'Mountain Mist & Headlamp',
    category: 'Trail Hazard',
    severity: 'Advisory',
    zone: "Lion's Head Spiral Trail",
    title: 'Rapid Coastal Cloud Inversion & Visibility Drop',
    summary:
      'Dense mist rolling onto upper contours. Keep to marked granite paths, confirm battery charge for headlamps, and keep Timed Check-In active until back at Signal Hill Road.',
  },
  {
    id: 'tpl-transit',
    label: 'Sunset Traffic Corridor',
    category: 'Transport & Transit',
    severity: 'Nominal',
    zone: 'V&A Waterfront & Sea Point Corridor',
    title: 'Evening MyCiTi & Verified E-Hailing Pick-Up Flow',
    summary:
      'Use designated illuminated MyCiTi stations and verified Waterfront pickup bays after sunset. Tourism patrol units active along Beach Road promenade.',
  },
];

export const SafetyManagementDashboard: React.FC<SafetyManagementDashboardProps> = ({
  user,
  checkIns,
  advisories,
  weather,
  initialTab = 'dispatch',
  onTabChange,
  onResolveCheckIn,
  onPublishAdvisory,
  onUpdateIncident,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<SafetyDashboardTab>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const selectTab = (tab: SafetyDashboardTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  // Broadcast composer state
  const [zone, setZone] = useState('Table Mountain Summit & Platteklip Gorge');
  const [category, setCategory] = useState<IncidentCategory>('Safety Advisory');
  const [severity, setSeverity] = useState<SafetyAdvisory['severity']>('Advisory');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishedFeedback, setPublishedFeedback] = useState('');
  const [publishError, setPublishError] = useState('');

  // Incident Triage Filter & Draft State
  const [statusFilter, setStatusFilter] = useState<'All' | 'Open' | 'Acknowledged' | 'Resolved'>(
    'All'
  );
  const [zoneKeywordFilter, setZoneKeywordFilter] = useState<string>('All');
  const [triageSearch, setTriageSearch] = useState('');
  const [draftAssignments, setDraftAssignments] = useState<Record<string, string>>({});
  const [draftStatuses, setDraftStatuses] = useState<Record<string, SafetyAdvisory['status']>>({});
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [triageMessage, setTriageMessage] = useState('');
  const [triageError, setTriageError] = useState('');

  // Check-in monitor filters
  const [checkInFilter, setCheckInFilter] = useState<'All' | 'Overdue' | 'Active' | 'Completed'>(
    'All'
  );
  const [resolvingCheckInId, setResolvingCheckInId] = useState<string | null>(null);

  const overdueCount = checkIns.filter((c) => c.status === 'Overdue').length;
  const activeCount = checkIns.filter((c) => c.status === 'Active').length;
  const openIncidents = advisories.filter((a) => (a.status || 'Open') !== 'Resolved');
  const elevatedOpenCount = openIncidents.filter((a) => a.severity === 'Elevated').length;

  const corridorSummary = useMemo(() => {
    return PENINSULA_ZONES.map((pz) => {
      const matching = advisories.filter(
        (a) =>
          (a.status || 'Open') !== 'Resolved' &&
          a.zone.toLowerCase().includes(pz.key.toLowerCase())
      );
      const hasElevated = matching.some((m) => m.severity === 'Elevated');
      const hasAdvisory = matching.some((m) => m.severity === 'Advisory');
      return {
        ...pz,
        activeCount: matching.length,
        tone: hasElevated ? ('alert' as const) : hasAdvisory ? ('advisory' as const) : ('nominal' as const),
        statusLabel: hasElevated ? 'Elevated' : hasAdvisory ? 'Advisory' : 'Nominal',
      };
    });
  }, [advisories]);

  const filteredIncidents = useMemo(() => {
    const q = triageSearch.trim().toLowerCase();
    return advisories.filter((inc) => {
      const effectiveStatus = inc.status || 'Open';
      if (statusFilter !== 'All' && effectiveStatus !== statusFilter) return false;
      if (
        zoneKeywordFilter !== 'All' &&
        !inc.zone.toLowerCase().includes(zoneKeywordFilter.toLowerCase())
      ) {
        return false;
      }
      if (!q) return true;
      return (
        inc.title.toLowerCase().includes(q) ||
        inc.zone.toLowerCase().includes(q) ||
        inc.summary.toLowerCase().includes(q) ||
        (inc.assignedOfficerName || '').toLowerCase().includes(q)
      );
    });
  }, [advisories, statusFilter, zoneKeywordFilter, triageSearch]);

  const filteredCheckIns = useMemo(() => {
    return checkIns.filter((c) => checkInFilter === 'All' || c.status === checkInFilter);
  }, [checkIns, checkInFilter]);

  const severityBreakdown = useMemo(() => {
    const elevated = advisories.filter((a) => a.severity === 'Elevated').length;
    const advisory = advisories.filter((a) => a.severity === 'Advisory').length;
    const nominal = advisories.filter((a) => a.severity === 'Nominal').length;
    const total = Math.max(1, advisories.length);
    return [
      { label: 'Elevated', count: elevated, pct: Math.round((elevated / total) * 100), color: 'bg-red-600' },
      { label: 'Advisory', count: advisory, pct: Math.round((advisory / total) * 100), color: 'bg-amber-600' },
      { label: 'Nominal', count: nominal, pct: Math.round((nominal / total) * 100), color: 'bg-[#15803D]' },
    ];
  }, [advisories]);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setPublishedFeedback('');
    setPublishError('');
    if (title.trim().length < 4 || summary.trim().length < 8) {
      setPublishError('Enter a headline (min 4 chars) and guidance summary (min 8 chars).');
      return;
    }

    setPublishing(true);
    try {
      let attachmentUrl: string | undefined;
      if (photoFile && user.authMode === 'firebase' && user.emailVerified) {
        attachmentUrl = await storageService.uploadIncidentPhoto(user.id, photoFile);
      }
      await onPublishAdvisory({
        category,
        zone,
        severity,
        title: title.trim(),
        summary: summary.trim(),
        source:
          user.authMode === 'firebase' && user.emailVerified
            ? `${user.organization} (Live Dispatch)`
            : `${user.organization} (Demo Broadcast)`,
        status: 'Open',
        ...(attachmentUrl ? { attachmentUrl } : {}),
      });
      setTitle('');
      setSummary('');
      setPhotoFile(null);
      setPublishedFeedback(
        user.authMode === 'firebase' && user.emailVerified
          ? 'Advisory published to Cloud Firestore Safety Feed.'
          : 'Advisory added to demonstration feed.'
      );
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Unable to publish advisory.');
    } finally {
      setPublishing(false);
    }
  };

  const handleSaveTriage = async (
    inc: SafetyAdvisory,
    overrides?: { status?: SafetyAdvisory['status']; officerName?: string; notes?: string }
  ) => {
    setTriageMessage('');
    setTriageError('');
    setSavingId(inc.id);
    const nextOfficerName =
      overrides?.officerName ??
      draftAssignments[inc.id] ??
      inc.assignedOfficerName ??
      RESPONSE_UNITS[0];
    const nextStatus = overrides?.status ?? draftStatuses[inc.id] ?? inc.status ?? 'Acknowledged';
    const nextNotes = overrides?.notes ?? draftNotes[inc.id] ?? inc.resolutionNotes ?? '';

    try {
      await onUpdateIncident(inc.id, {
        status: nextStatus,
        assignedOfficerId: user.id,
        assignedOfficerName: nextOfficerName,
        resolutionNotes: nextNotes,
      });
      setTriageMessage(`Updated "${inc.title}" -> ${nextStatus} (${nextOfficerName}).`);
    } catch (err) {
      setTriageError(err instanceof Error ? err.message : 'Unable to save incident triage update.');
    } finally {
      setSavingId(null);
    }
  };

  const applyTemplate = (tpl: (typeof DISPATCH_TEMPLATES)[number]) => {
    setCategory(tpl.category);
    setSeverity(tpl.severity);
    setZone(tpl.zone);
    setTitle(tpl.title);
    setSummary(tpl.summary);
    setPublishedFeedback('');
    setPublishError('');
  };

  return (
    <div className="space-y-6">
      <DemoDataNotice scope="Pre-loaded incidents are demo data; live Firestore reports support real-time unit assignment and status transitions" />

      {/* Dispatch Command Header with Live Peninsula Weather / Cableway Telemetry */}
      <section className="rounded-xl border border-slate-200 bg-[#111827] p-6 text-white">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold text-blue-300">
              Safety Operations · {user.organization}
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold">
              Metropolitan Coastal &amp; Mountain Safety Dispatch
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">
              Assign response teams to incoming tourist incidents, monitor overdue trail check-ins, and broadcast real-time Cape Peninsula advisories.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {weather && (
              <div className="rounded-lg border border-white/15 bg-[#1E293B] px-3.5 py-2 text-xs">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Wind className="h-3.5 w-3.5 text-blue-300" aria-hidden="true" />
                  <span>Mountain &amp; Coastal Telemetry</span>
                </div>
                <p className="mt-0.5 font-mono font-semibold text-blue-300 tabular-nums">
                  {weather.temperatureC}°C · {weather.windSpeedKmh} km/h (gusts{' '}
                  {weather.windGustsKmh} km/h) · Cableway: {weather.cablewayRisk}
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={() => onNavigate('safety')}
              className="rounded-lg bg-[#3B82F6] px-4 py-2 text-xs font-semibold text-[#090D16] hover:bg-blue-300 whitespace-nowrap"
            >
              View Public Safety Centre
            </button>
          </div>
        </div>
      </section>

      {/* Priority Escalation Strip */}
      {(overdueCount > 0 || elevatedOpenCount > 0) && (
        <section className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5 text-xs text-red-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-red-700 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-bold">Priority Dispatch Escalations Active</p>
              <p className="mt-0.5">
                <span className="font-mono font-semibold tabular-nums">{overdueCount}</span> overdue
                trail check-in(s) and{' '}
                <span className="font-mono font-semibold tabular-nums">{elevatedOpenCount}</span>{' '}
                elevated incident(s) require active monitoring.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {overdueCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  selectTab('checkins');
                  setCheckInFilter('Overdue');
                }}
                className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800 whitespace-nowrap"
              >
                Triage Overdue Check-Ins ({overdueCount})
              </button>
            )}
            {elevatedOpenCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  selectTab('dispatch');
                  setStatusFilter('Open');
                }}
                className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100 whitespace-nowrap"
              >
                Review Open Queue
              </button>
            )}
          </div>
        </section>
      )}

      {/* Interactive KPI Strip */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => {
            selectTab('checkins');
            setCheckInFilter('Active');
          }}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-[#1D4ED8] transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Active Trail Check-Ins</span>
            <Timer className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-[#111827]">
            {activeCount}
          </p>
          <p className="mt-1 text-xs text-slate-600">Within expected return window</p>
        </button>

        <button
          type="button"
          onClick={() => {
            selectTab('checkins');
            setCheckInFilter('Overdue');
          }}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-red-400 transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Overdue Escalations</span>
            <ShieldAlert className="h-4 w-4 text-red-700" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-red-700">
            {overdueCount}
          </p>
          <p className="mt-1 text-xs text-slate-600">Requires welfare check</p>
        </button>

        <button
          type="button"
          onClick={() => {
            selectTab('dispatch');
            setStatusFilter('Open');
          }}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-[#1D4ED8] transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Active Incidents</span>
            <Radio className="h-4 w-4 text-amber-700" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-[#111827]">
            {openIncidents.length}
          </p>
          <p className="mt-1 text-xs text-slate-600">Open or acknowledged across zones</p>
        </button>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Dispatch Liaison</span>
            <PhoneCall className="h-4 w-4 text-[#15803D]" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-[#111827]">
            107 / 112
          </p>
          <p className="mt-1 text-xs text-slate-600">WSAR &amp; NSRI direct channels</p>
        </div>
      </section>

      {/* Workspace Segmented Tabs */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="tablist"
          aria-label="Safety Operations dashboard sections"
          className="flex items-center gap-1 overflow-x-auto max-w-full rounded-lg border border-slate-200 bg-white p-1"
        >
          {[
            {
              id: 'dispatch' as const,
              label: 'Live Triage & Dispatch',
              icon: ClipboardCheck,
              count: openIncidents.length,
            },
            {
              id: 'checkins' as const,
              label: 'Check-In Escalations',
              icon: Timer,
              count: activeCount + overdueCount,
            },
            {
              id: 'broadcast' as const,
              label: 'Advisory Broadcasts',
              icon: Radio,
              count: advisories.length,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`tab-safety-${tab.id}`}
                aria-selected={selected}
                aria-controls={`panel-safety-${tab.id}`}
                onClick={() => selectTab(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  selected
                    ? 'bg-[#111827] text-white'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-[#111827]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {tab.label}
                <span className="font-mono text-[11px] opacity-80 tabular-nums">
                  ({tab.count})
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => selectTab('broadcast')}
          className="text-xs font-semibold text-[#1D4ED8] hover:underline"
        >
          + Broadcast New Advisory
        </button>
      </div>

      {/* TAB 1: LIVE TRIAGE & DISPATCH */}
      {activeTab === 'dispatch' && (
        <div
          id="panel-safety-dispatch"
          role="tabpanel"
          aria-labelledby="tab-safety-dispatch"
          className="space-y-6"
        >
          {/* Peninsula Corridor Matrix + Severity Breakdown */}
          <div className="grid gap-6 lg:grid-cols-12">
            <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-8 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Compass className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
                  <h2 className="font-display text-sm font-bold text-[#111827]">
                    Peninsula Corridor Risk Matrix
                  </h2>
                </div>
                {zoneKeywordFilter !== 'All' && (
                  <button
                    type="button"
                    onClick={() => setZoneKeywordFilter('All')}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-[#111827] hover:bg-slate-50"
                  >
                    Show All Corridors
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {corridorSummary.map((corridor) => {
                  const selected = zoneKeywordFilter === corridor.key;
                  return (
                    <button
                      key={corridor.key}
                      type="button"
                      onClick={() =>
                        setZoneKeywordFilter(selected ? 'All' : corridor.key)
                      }
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        selected
                          ? 'border-[#1D4ED8] bg-[#EFF6FF]'
                          : 'border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-white'
                      }`}
                    >
                      <p className="text-xs font-bold text-[#111827]">{corridor.label}</p>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <StatusText label={corridor.statusLabel} tone={corridor.tone} />
                        <span className="font-mono text-[11px] text-slate-600 tabular-nums">
                          {corridor.activeCount} active
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-4 space-y-3">
              <h2 className="font-display text-sm font-bold text-[#111827]">
                Advisory Severity Distribution
              </h2>
              <div className="space-y-3">
                {severityBreakdown.map((item) => (
                  <div key={item.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{item.label}</span>
                      <span className="font-mono text-slate-700 tabular-nums">
                        {item.count} ({item.pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded bg-slate-100">
                      <div
                        className={`h-full ${item.color} transition-all`}
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Incident Dispatch, Assignment & Status Queue */}
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
                  <h2 className="font-display text-base font-bold text-[#111827]">
                    Incident Assignment &amp; Status Management ({filteredIncidents.length})
                  </h2>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  Assign response units and transition incidents from Open to Acknowledged or Resolved.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={triageSearch}
                    onChange={(e) => setTriageSearch(e.target.value)}
                    placeholder="Search zone or headline..."
                    aria-label="Search incident dispatch queue"
                    className="rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-[#111827] focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
                <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                  {(['All', 'Open', 'Acknowledged', 'Resolved'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      aria-pressed={statusFilter === tab}
                      onClick={() => setStatusFilter(tab)}
                      className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                        statusFilter === tab
                          ? 'bg-[#111827] text-white'
                          : 'text-slate-600 hover:text-[#111827]'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {triageMessage && (
              <div
                role="status"
                className="border-b border-slate-200 bg-[#F0FDF4] px-5 py-2.5 text-xs font-medium text-[#15803D]"
              >
                {triageMessage}
              </div>
            )}
            {triageError && (
              <div
                role="alert"
                className="border-b border-red-200 bg-red-50 px-5 py-2.5 text-xs font-medium text-red-700"
              >
                {triageError}
              </div>
            )}

            <div className="divide-y divide-slate-200">
              {filteredIncidents.length === 0 ? (
                <p className="px-5 py-8 text-center text-xs text-slate-500">
                  No incidents matched the current corridor or status filter.
                </p>
              ) : (
                filteredIncidents.map((inc) => {
                  const currentStatus = inc.status || 'Open';
                  const lockedForSafetyOfficer =
                    currentStatus === 'Resolved' && user.role !== 'admin';
                  const selectedUnit =
                    draftAssignments[inc.id] ?? inc.assignedOfficerName ?? RESPONSE_UNITS[0];
                  const selectedStatus = draftStatuses[inc.id] ?? currentStatus;
                  const noteVal = draftNotes[inc.id] ?? inc.resolutionNotes ?? '';

                  return (
                    <div key={inc.id} className="p-5 space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-[#111827]">{inc.title}</span>
                            <StatusText
                              label={inc.severity}
                              tone={
                                inc.severity === 'Nominal'
                                  ? 'nominal'
                                  : inc.severity === 'Advisory'
                                  ? 'advisory'
                                  : 'alert'
                              }
                            />
                            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                              {currentStatus}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-600">
                            {inc.category || 'Safety Advisory'} · {inc.zone} · {inc.source} (
                            {inc.updatedAt})
                          </p>
                          <p className="mt-1.5 text-xs text-slate-700 leading-relaxed">
                            {inc.summary}
                          </p>
                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                            {(['Open', 'Acknowledged', 'Resolved'] as const).map((stepName, idx) => {
                              const currentStep =
                                currentStatus === 'Resolved'
                                  ? 2
                                  : currentStatus === 'Acknowledged'
                                  ? 1
                                  : 0;
                              const isCompleted = idx < currentStep;
                              const isCurrent = idx === currentStep;
                              return (
                                <span
                                  key={stepName}
                                  className={`rounded px-2 py-0.5 font-semibold ${
                                    isCurrent
                                      ? stepName === 'Resolved'
                                        ? 'bg-[#15803D] text-white'
                                        : 'bg-[#111827] text-white'
                                      : isCompleted
                                      ? 'bg-emerald-50 text-[#15803D] border border-emerald-200'
                                      : 'bg-slate-100 text-slate-500'
                                  }`}
                                >
                                  {idx + 1}. {stepName}
                                </span>
                              );
                            })}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                            {inc.locationConsent &&
                              typeof inc.sharedLat === 'number' &&
                              typeof inc.sharedLng === 'number' && (
                                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#1E40AF] tabular-nums">
                                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                                  Consented GPS: {inc.sharedLat.toFixed(4)},{' '}
                                  {inc.sharedLng.toFixed(4)}
                                </span>
                              )}
                            {inc.attachmentUrl && (
                              <a
                                href={inc.attachmentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-[#1D4ED8] hover:underline"
                              >
                                View Field Photo
                              </a>
                            )}
                          </div>
                        </div>
                        {!lockedForSafetyOfficer && currentStatus === 'Open' && (
                          <button
                            type="button"
                            disabled={savingId === inc.id}
                            onClick={() =>
                              handleSaveTriage(inc, {
                                status: 'Acknowledged',
                                officerName: user.name,
                                notes:
                                  noteVal ||
                                  `Acknowledged by ${user.name} for active field triage.`,
                              })
                            }
                            className="rounded-md border border-[#1D4ED8] bg-[#EFF6FF] px-3 py-1.5 text-xs font-semibold text-[#1E40AF] hover:bg-blue-100 disabled:opacity-60 whitespace-nowrap shrink-0"
                          >
                            Acknowledge (Me)
                          </button>
                        )}
                      </div>

                      {lockedForSafetyOfficer ? (
                        <p className="text-xs text-slate-500">
                          Resolved by {inc.assignedOfficerName || 'Safety Operations'}
                          {inc.resolutionNotes ? ` — "${inc.resolutionNotes}"` : ''}. (Administrator
                          override required to reopen.)
                        </p>
                      ) : (
                        <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-12 sm:items-end">
                          <div className="sm:col-span-3">
                            <label
                              htmlFor={`safety-unit-${inc.id}`}
                              className="block text-[11px] font-semibold text-slate-600"
                            >
                              Assigned Officer / Unit
                            </label>
                            <select
                              id={`safety-unit-${inc.id}`}
                              value={selectedUnit}
                              onChange={(e) =>
                                setDraftAssignments((prev) => ({
                                  ...prev,
                                  [inc.id]: e.target.value,
                                }))
                              }
                              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-[#111827]"
                            >
                              <option value={user.name}>{user.name} (Me)</option>
                              {RESPONSE_UNITS.map((unit) => (
                                <option key={unit} value={unit}>
                                  {unit}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="sm:col-span-2">
                            <label
                              htmlFor={`safety-status-${inc.id}`}
                              className="block text-[11px] font-semibold text-slate-600"
                            >
                              Status
                            </label>
                            <select
                              id={`safety-status-${inc.id}`}
                              value={selectedStatus}
                              onChange={(e) =>
                                setDraftStatuses((prev) => ({
                                  ...prev,
                                  [inc.id]: e.target.value as SafetyAdvisory['status'],
                                }))
                              }
                              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-[#111827]"
                            >
                              <option value="Open">Open</option>
                              <option value="Acknowledged">Acknowledged</option>
                              <option value="Resolved">Resolved</option>
                            </select>
                          </div>

                          <div className="sm:col-span-5">
                            <label
                              htmlFor={`safety-note-${inc.id}`}
                              className="block text-[11px] font-semibold text-slate-600"
                            >
                              Dispatch / Resolution Notes
                            </label>
                            <input
                              id={`safety-note-${inc.id}`}
                              type="text"
                              value={noteVal}
                              onChange={(e) =>
                                setDraftNotes((prev) => ({ ...prev, [inc.id]: e.target.value }))
                              }
                              placeholder="Add field verification or clearance note..."
                              maxLength={400}
                              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <button
                              type="button"
                              disabled={savingId === inc.id}
                              onClick={() => handleSaveTriage(inc)}
                              className="w-full rounded-md bg-[#1D4ED8] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60 transition-colors"
                            >
                              {savingId === inc.id ? 'Saving...' : 'Save Update'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: CHECK-IN ESCALATION MONITOR */}
      {activeTab === 'checkins' && (
        <div
          id="panel-safety-checkins"
          role="tabpanel"
          aria-labelledby="tab-safety-checkins"
        >
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-base font-bold text-[#111827]">
                  Tourist Check-In Escalation Monitor ({filteredCheckIns.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Confirm safe return after welfare call to clear overdue status.
                </p>
              </div>
              <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                {(['All', 'Overdue', 'Active', 'Completed'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    aria-pressed={checkInFilter === tab}
                    onClick={() => setCheckInFilter(tab)}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                      checkInFilter === tab
                        ? 'bg-[#111827] text-white'
                        : 'text-slate-600 hover:text-[#111827]'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {triageError && (
              <div
                role="alert"
                className="border-b border-red-200 bg-red-50 px-5 py-2.5 text-xs font-medium text-red-700"
              >
                {triageError}
              </div>
            )}

            <div className="divide-y divide-slate-200">
              {filteredCheckIns.length === 0 ? (
                <p className="px-5 py-8 text-center text-xs text-slate-500">
                  No check-in sessions matched this status filter.
                </p>
              ) : (
                filteredCheckIns.map((session) => (
                  <div
                    key={session.id}
                    className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[#111827]">
                          {session.touristName}
                        </span>
                        <StatusText
                          label={session.status}
                          tone={
                            session.status === 'Overdue'
                              ? 'alert'
                              : session.status === 'Active'
                              ? 'advisory'
                              : 'nominal'
                          }
                        />
                      </div>
                      <p className="text-xs text-slate-700">
                        {session.route} · Party of{' '}
                        <span className="font-mono tabular-nums">{session.partySize}</span>
                      </p>
                      <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-slate-500 tabular-nums">
                        <span>
                          Started {session.startedAt} · Due {session.expectedReturn} · ICE{' '}
                          {session.emergencyContact}
                        </span>
                        {session.locationConsent &&
                          typeof session.sharedLat === 'number' &&
                          typeof session.sharedLng === 'number' && (
                            <span className="inline-flex items-center gap-1 text-[#1E40AF]">
                              <MapPin className="h-3 w-3" aria-hidden="true" />
                              {session.sharedLat.toFixed(4)}, {session.sharedLng.toFixed(4)}
                            </span>
                          )}
                      </div>
                    </div>
                    {session.status !== 'Completed' && (
                      <button
                        type="button"
                        disabled={resolvingCheckInId === session.id}
                        onClick={async () => {
                          setTriageError('');
                          setResolvingCheckInId(session.id);
                          try {
                            await onResolveCheckIn(session.id);
                          } catch (err) {
                            setTriageError(
                              err instanceof Error ? err.message : 'Unable to confirm safe return.'
                            );
                          } finally {
                            setResolvingCheckInId(null);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {resolvingCheckInId === session.id ? 'Confirming...' : 'Confirm Safe Return'}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: ADVISORY BROADCASTS & TEMPLATES */}
      {activeTab === 'broadcast' && (
        <div
          id="panel-safety-broadcast"
          role="tabpanel"
          aria-labelledby="tab-safety-broadcast"
          className="grid gap-6 lg:grid-cols-12"
        >
          {/* Quick Dispatch Templates */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5 space-y-3">
            <h2 className="font-display text-base font-bold text-[#111827]">
              Rapid Dispatch Templates
            </h2>
            <p className="text-xs text-slate-500">
              Load standardized Cape Peninsula safety guidance into the composer before broadcasting.
            </p>
            <div className="space-y-2.5">
              {DISPATCH_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => applyTemplate(tpl)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-left hover:border-[#1D4ED8] hover:bg-[#EFF6FF] transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#111827]">{tpl.label}</span>
                    <StatusText
                      label={tpl.severity}
                      tone={
                        tpl.severity === 'Elevated'
                          ? 'alert'
                          : tpl.severity === 'Advisory'
                          ? 'advisory'
                          : 'nominal'
                      }
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600">{tpl.zone}</p>
                </button>
              ))}
            </div>
          </section>

          {/* Broadcast Advisory Composer */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7">
            <h2 className="font-display text-base font-bold text-[#111827]">
              Publish Corridor Advisory
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Updates immediately appear in Safety Centre and Tourist Dashboard.
            </p>
            <form onSubmit={handlePublish} className="mt-4 space-y-3.5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="adv-cat" className="block text-xs font-semibold text-slate-700">
                    Category
                  </label>
                  <select
                    id="adv-cat"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as IncidentCategory)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                  >
                    <option value="Safety Advisory">Safety Advisory</option>
                    <option value="Trail Hazard">Trail Hazard</option>
                    <option value="Coastal / Marine">Coastal / Marine</option>
                    <option value="Transport & Transit">Transport &amp; Transit</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="adv-severity"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Advisory Level
                  </label>
                  <select
                    id="adv-severity"
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as SafetyAdvisory['severity'])}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                  >
                    <option value="Nominal">Nominal</option>
                    <option value="Advisory">Advisory</option>
                    <option value="Elevated">Elevated</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="adv-zone" className="block text-xs font-semibold text-slate-700">
                  Cape Town Precinct
                </label>
                <select
                  id="adv-zone"
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                >
                  <option>Table Mountain Summit &amp; Platteklip Gorge</option>
                  <option>Lion&apos;s Head Spiral Trail</option>
                  <option>V&amp;A Waterfront &amp; Sea Point Corridor</option>
                  <option>Muizenberg to Fish Hoek Coastline</option>
                  <option>Chapman&apos;s Peak &amp; Hout Bay</option>
                </select>
              </div>

              <div>
                <label htmlFor="adv-title" className="block text-xs font-semibold text-slate-700">
                  Headline
                </label>
                <input
                  id="adv-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Coastal Mist Advisory on Signal Hill"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="adv-summary" className="block text-xs font-semibold text-slate-700">
                  Guidance for Travelers
                </label>
                <textarea
                  id="adv-summary"
                  rows={3}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Provide clear safety action or recommended timing..."
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>

              <div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-[#111827] hover:bg-slate-100">
                  <Upload className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
                  {photoFile ? photoFile.name : 'Attach Field Photo (Firebase Storage)'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                    className="sr-only"
                  />
                </label>
              </div>

              {publishedFeedback && (
                <p className="text-xs font-medium text-[#15803D]">{publishedFeedback}</p>
              )}
              {publishError && (
                <p className="text-xs font-medium text-red-700">{publishError}</p>
              )}

              <button
                type="submit"
                disabled={publishing}
                className="w-full rounded-lg bg-[#111827] py-2 text-xs font-semibold text-white hover:bg-[#1E293B] disabled:opacity-60 transition-colors"
              >
                {publishing ? 'Publishing...' : 'Broadcast Advisory'}
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};
