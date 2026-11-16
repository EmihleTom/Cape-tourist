import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  Database,
  Flag,
  LayoutDashboard,
  MapPin,
  Megaphone,
  Pin,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';
import { DemoDataNotice } from '@/src/components/common/DemoDataNotice';
import { StatusText } from '@/src/components/common/StatusText';
import { AdminPaymentManagementSection } from '@/src/components/payments/AdminPaymentManagementSection';
import { ROLE_LABELS } from '@/src/data/navigation';
import { getArchitectureReadiness } from '@/src/services/firebase/config';
import type {
  AnnouncementCategory,
  BookingItem,
  CapeTownWeather,
  CommunityPost,
  DemoUser,
  DestinationAnnouncement,
  ModerationStatus,
  NavSectionId,
  PaymentAuditLog,
  PaymentRecord,
  ProviderApplication,
  SafetyAdvisory,
  UserRole,
} from '@/src/types/app';

export type AdminDashboardTab = 'overview' | 'governance' | 'announcements' | 'payments';

interface AdminDashboardProps {
  user: DemoUser;
  applications: ProviderApplication[];
  managedUsers: DemoUser[];
  advisories: SafetyAdvisory[];
  announcements: DestinationAnnouncement[];
  payments: PaymentRecord[];
  paymentAuditLogs: PaymentAuditLog[];
  bookings?: BookingItem[];
  communityPosts?: CommunityPost[];
  weather?: CapeTownWeather;
  initialTab?: AdminDashboardTab;
  onTabChange?: (tab: AdminDashboardTab) => void;
  onModeratePost?: (
    postId: string,
    status: ModerationStatus,
    verifiedGuide?: boolean
  ) => Promise<void> | void;
  onIssueRefund: (
    paymentId: string,
    refundAmountZar: number,
    reason: string
  ) => Promise<void>;
  onUpdateApplicationStatus: (id: string, status: ProviderApplication['status']) => void;
  onUpdateUserRole: (uid: string, role: UserRole) => void;
  onUpdateIncident: (
    incidentId: string,
    updates: {
      status?: SafetyAdvisory['status'];
      assignedOfficerId?: string;
      assignedOfficerName?: string;
      resolutionNotes?: string;
    }
  ) => Promise<void> | void;
  onCreateAnnouncement: (payload: {
    title: string;
    category: AnnouncementCategory;
    zone: string;
    body: string;
    priority: DestinationAnnouncement['priority'];
    pinned: boolean;
  }) => Promise<void> | void;
  onUpdateAnnouncement: (
    id: string,
    updates: Partial<Pick<DestinationAnnouncement, 'pinned' | 'active'>>
  ) => Promise<void> | void;
  onDeleteAnnouncement: (id: string) => Promise<void> | void;
  onNavigate: (section: NavSectionId) => void;
}

const ANNOUNCEMENT_CATEGORIES: AnnouncementCategory[] = [
  'Park & Trail Notice',
  'Transport & Airport',
  'Weather & Coastal',
  'Visitor Advisory',
  'Cultural Event',
];

const RESPONSE_UNITS = [
  'Capt. Nadia Jacobs',
  'WSAR Mountain Team',
  'NSRI Station 8',
  'Metro Tourism Safety Unit',
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  user,
  applications,
  managedUsers,
  advisories,
  announcements,
  payments,
  paymentAuditLogs,
  bookings = [],
  communityPosts = [],
  weather,
  initialTab = 'overview',
  onTabChange,
  onModeratePost,
  onIssueRefund,
  onUpdateApplicationStatus,
  onUpdateUserRole,
  onUpdateIncident,
  onCreateAnnouncement,
  onUpdateAnnouncement,
  onDeleteAnnouncement,
  onNavigate,
}) => {
  const readiness = getArchitectureReadiness();
  const [activeTab, setActiveTab] = useState<AdminDashboardTab>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const selectTab = (tab: AdminDashboardTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  // Counts (strictly derived from actual collections — zero artificial offsets)
  const pendingCount = applications.filter((a) => a.status === 'Pending Review').length;
  const approvedCount = applications.filter((a) => a.status === 'Approved').length;
  const openIncidents = advisories.filter((a) => (a.status || 'Open') !== 'Resolved');
  const elevatedIncidentsCount = openIncidents.filter((a) => a.severity === 'Elevated').length;
  const roleUpgradeRequests = managedUsers.filter(
    (u) => u.requestedRole && u.requestedRole !== u.role
  );
  const flaggedPosts = communityPosts.filter(
    (p) => (p.moderationStatus || 'Approved') === 'Under Review'
  );

  // Settled payment volume KPI
  const settledVolumeZar = useMemo(
    () =>
      payments
        .filter((p) => p.paymentStatus === 'Paid' || p.paymentStatus === 'Partially Paid')
        .reduce((sum, p) => sum + p.amount, 0),
    [payments]
  );

  // Incident filters & oversight state
  const [incSearch, setIncSearch] = useState('');
  const [incStatusFilter, setIncStatusFilter] = useState<
    'All' | 'Open' | 'Acknowledged' | 'Resolved'
  >('All');
  const [incZoneFilter, setIncZoneFilter] = useState<string>('All');
  const [incOfficers, setIncOfficers] = useState<Record<string, string>>({});
  const [incStatuses, setIncStatuses] = useState<Record<string, SafetyAdvisory['status']>>({});
  const [incNotes, setIncNotes] = useState<Record<string, string>>({});
  const [incFeedback, setIncFeedback] = useState('');
  const [adminError, setAdminError] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Governance filters (RBAC & Accreditation)
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'pending_upgrade' | UserRole>('all');
  const [appSearch, setAppSearch] = useState('');
  const [appStatusFilter, setAppStatusFilter] = useState<'All' | ProviderApplication['status']>('All');

  // Announcement Composer State
  const [annTitle, setAnnTitle] = useState('');
  const [annCategory, setAnnCategory] = useState<AnnouncementCategory>('Visitor Advisory');
  const [annZone, setAnnZone] = useState('City Bowl & V&A Waterfront');
  const [annPriority, setAnnPriority] = useState<DestinationAnnouncement['priority']>('Info');
  const [annBody, setAnnBody] = useState('');
  const [annPinned, setAnnPinned] = useState(false);
  const [annFeedback, setAnnFeedback] = useState('');
  const [annError, setAnnError] = useState('');

  // Telemetry breakdowns
  const incidentStatusStats = useMemo(() => {
    const open = advisories.filter((a) => (a.status || 'Open') === 'Open').length;
    const ack = advisories.filter((a) => a.status === 'Acknowledged').length;
    const res = advisories.filter((a) => a.status === 'Resolved').length;
    const total = Math.max(1, advisories.length);
    return [
      { label: 'Open', count: open, pct: Math.round((open / total) * 100), barClass: 'bg-red-600' },
      { label: 'Acknowledged', count: ack, pct: Math.round((ack / total) * 100), barClass: 'bg-amber-600' },
      { label: 'Resolved', count: res, pct: Math.round((res / total) * 100), barClass: 'bg-[#15803D]' },
    ];
  }, [advisories]);

  const precinctDensity = useMemo(() => {
    const map = new Map<string, { total: number; elevated: number }>();
    advisories.forEach((a) => {
      const key = a.zone || 'Cape Town';
      const entry = map.get(key) || { total: 0, elevated: 0 };
      entry.total += 1;
      if (a.severity === 'Elevated' && (a.status || 'Open') !== 'Resolved') {
        entry.elevated += 1;
      }
      map.set(key, entry);
    });
    return Array.from(map.entries())
      .map(([zone, info]) => ({ zone, ...info }))
      .sort((a, b) => b.total - a.total || b.elevated - a.elevated)
      .slice(0, 6);
  }, [advisories]);

  const roleDistribution = useMemo(() => {
    const roles: UserRole[] = ['tourist', 'provider', 'safety', 'admin'];
    const total = Math.max(1, managedUsers.length);
    return roles.map((role) => {
      const count = managedUsers.filter((u) => u.role === role).length;
      return {
        role,
        label: ROLE_LABELS[role].short,
        count,
        pct: Math.round((count / total) * 100),
      };
    });
  }, [managedUsers]);

  const filteredIncidents = useMemo(() => {
    const q = incSearch.trim().toLowerCase();
    return advisories.filter((inc) => {
      const status = inc.status || 'Open';
      if (incStatusFilter !== 'All' && status !== incStatusFilter) return false;
      if (incZoneFilter !== 'All' && inc.zone !== incZoneFilter) return false;
      if (!q) return true;
      return (
        inc.title.toLowerCase().includes(q) ||
        inc.zone.toLowerCase().includes(q) ||
        inc.summary.toLowerCase().includes(q) ||
        (inc.assignedOfficerName || '').toLowerCase().includes(q)
      );
    });
  }, [advisories, incStatusFilter, incZoneFilter, incSearch]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return managedUsers.filter((u) => {
      if (userRoleFilter === 'pending_upgrade') {
        if (!u.requestedRole || u.requestedRole === u.role) return false;
      } else if (userRoleFilter !== 'all' && u.role !== userRoleFilter) {
        return false;
      }
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.organization || '').toLowerCase().includes(q) ||
        (u.location || '').toLowerCase().includes(q)
      );
    });
  }, [managedUsers, userRoleFilter, userSearch]);

  const filteredApplications = useMemo(() => {
    const q = appSearch.trim().toLowerCase();
    return applications.filter((app) => {
      if (appStatusFilter !== 'All' && app.status !== appStatusFilter) return false;
      if (!q) return true;
      return (
        app.businessName.toLowerCase().includes(q) ||
        app.zone.toLowerCase().includes(q) ||
        app.category.toLowerCase().includes(q) ||
        app.complianceDocs.toLowerCase().includes(q)
      );
    });
  }, [applications, appStatusFilter, appSearch]);

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setAnnFeedback('');
    setAnnError('');
    if (annTitle.trim().length < 4 || annBody.trim().length < 8) {
      setAnnError('Enter an announcement title (min 4 chars) and message body (min 8 chars).');
      return;
    }

    try {
      await onCreateAnnouncement({
        title: annTitle.trim(),
        category: annCategory,
        zone: annZone.trim() || 'Cape Town',
        body: annBody.trim(),
        priority: annPriority,
        pinned: annPinned,
      });
      setAnnTitle('');
      setAnnBody('');
      setAnnPinned(false);
      setAnnFeedback('Destination announcement published.');
    } catch (err) {
      setAnnError(err instanceof Error ? err.message : 'Failed to publish announcement.');
    }
  };

  return (
    <div className="space-y-6">
      <DemoDataNotice
        scope={
          user.authMode === 'firebase'
            ? `Live Firebase Admin Operations · Project ${readiness.projectIdLabel}`
            : 'Municipal tourism operations preview with interactive provider audit queue, incident oversight, RBAC, and payment audit ledger'
        }
      />

      {/* Executive Metro Command Header */}
      <section className="rounded-xl border border-slate-200 bg-[#111827] p-6 text-white">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold text-blue-300">
              Administrator Command · {user.organization}
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">
              CapeSafe Metro Operations &amp; Governance
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">
              Coordinate incident dispatch, verify SAMSA/CATHSSETA operator compliance, govern RBAC roles, and audit ZAR payment settlements.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {weather && (
              <div className="rounded-lg border border-white/15 bg-[#1E293B] px-3 py-2 text-xs">
                <p className="text-[11px] text-slate-300">Peninsula Conditions</p>
                <p className="font-mono font-semibold text-blue-300 tabular-nums">
                  {weather.temperatureC}°C · Wind {weather.windSpeedKmh} km/h · Cableway {weather.cablewayRisk}
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="rounded-lg border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-colors whitespace-nowrap"
            >
              Inspect Firebase Config
            </button>
          </div>
        </div>
      </section>

      {/* Actionable Alert Strip if items require immediate executive attention */}
      {(pendingCount > 0 || elevatedIncidentsCount > 0 || roleUpgradeRequests.length > 0 || flaggedPosts.length > 0) && (
        <section className="grid gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          {elevatedIncidentsCount > 0 && (
            <button
              type="button"
              onClick={() => {
                selectTab('overview');
                setIncStatusFilter('Open');
              }}
              className="flex items-center justify-between rounded-lg border border-amber-300 bg-white px-3 py-2 text-left hover:bg-amber-50 transition-colors"
            >
              <span className="font-semibold text-[#111827]">Elevated Open Incidents</span>
              <span className="font-mono font-bold text-red-700 tabular-nums">
                {elevatedIncidentsCount}
              </span>
            </button>
          )}
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={() => {
                selectTab('governance');
                setAppStatusFilter('Pending Review');
              }}
              className="flex items-center justify-between rounded-lg border border-amber-300 bg-white px-3 py-2 text-left hover:bg-amber-50 transition-colors"
            >
              <span className="font-semibold text-[#111827]">Pending Provider Audits</span>
              <span className="font-mono font-bold text-amber-800 tabular-nums">{pendingCount}</span>
            </button>
          )}
          {roleUpgradeRequests.length > 0 && (
            <button
              type="button"
              onClick={() => {
                selectTab('governance');
                setUserRoleFilter('pending_upgrade');
              }}
              className="flex items-center justify-between rounded-lg border border-amber-300 bg-white px-3 py-2 text-left hover:bg-amber-50 transition-colors"
            >
              <span className="font-semibold text-[#111827]">RBAC Role Requests</span>
              <span className="font-mono font-bold text-[#1D4ED8] tabular-nums">
                {roleUpgradeRequests.length}
              </span>
            </button>
          )}
          {flaggedPosts.length > 0 && (
            <button
              type="button"
              onClick={() => selectTab('governance')}
              className="flex items-center justify-between rounded-lg border border-amber-300 bg-white px-3 py-2 text-left hover:bg-amber-50 transition-colors"
            >
              <span className="font-semibold text-[#111827]">Flagged Community Notes</span>
              <span className="font-mono font-bold text-amber-800 tabular-nums">
                {flaggedPosts.length}
              </span>
            </button>
          )}
        </section>
      )}

      {/* Interactive KPI Strip */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => {
            selectTab('governance');
            setAppStatusFilter('Approved');
          }}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-[#1D4ED8] transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Accredited Operators</span>
            <ShieldCheck className="h-4 w-4 text-[#15803D]" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-[#111827]">
            {approvedCount}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            <span className="font-mono tabular-nums">{pendingCount}</span> pending review
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            selectTab('overview');
            setIncStatusFilter('Open');
          }}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-[#1D4ED8] transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Active Incidents</span>
            <ShieldAlert className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-[#111827]">
            {openIncidents.length}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Across <span className="font-mono tabular-nums">{precinctDensity.length}</span> Cape Town zones
          </p>
        </button>

        <button
          type="button"
          onClick={() => selectTab('payments')}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-[#1D4ED8] transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Settled ZAR Volume</span>
            <Wallet className="h-4 w-4 text-[#15803D]" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-[#111827]">
            R {settledVolumeZar.toLocaleString('en-ZA')}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            <span className="font-mono tabular-nums">{bookings.length}</span> platform bookings tracked
          </p>
        </button>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Backend Adapter</span>
            <Database className="h-4 w-4 text-[#111827]" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-lg font-bold text-[#111827]">
            {readiness.mode === 'firebase-connected' ? 'Firebase Live' : 'Demo Mode'}
          </p>
          <p className="mt-1 text-xs text-[#1D4ED8] font-medium truncate">
            {readiness.projectIdLabel}
          </p>
        </div>
      </section>

      {/* Workspace Segmented Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div
          role="tablist"
          aria-label="Administrator dashboard sections"
          className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1"
        >
          {[
            {
              id: 'overview' as const,
              label: 'Overview & Dispatch',
              icon: LayoutDashboard,
              count: openIncidents.length,
            },
            {
              id: 'governance' as const,
              label: 'Accreditations & RBAC',
              icon: Building2,
              count: pendingCount + roleUpgradeRequests.length + flaggedPosts.length,
            },
            {
              id: 'announcements' as const,
              label: 'Announcements',
              icon: Megaphone,
              count: announcements.filter((a) => a.active).length,
            },
            {
              id: 'payments' as const,
              label: 'Payments & Audit',
              icon: Wallet,
              count: payments.length,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`tab-admin-${tab.id}`}
                aria-selected={selected}
                aria-controls={`panel-admin-${tab.id}`}
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

        <p className="text-xs text-slate-500">
          <span className="font-mono tabular-nums text-[#111827] font-semibold">
            {managedUsers.length}
          </span>{' '}
          accounts ·{' '}
          <span className="font-mono tabular-nums text-[#111827] font-semibold">
            {paymentAuditLogs.length}
          </span>{' '}
          audit events
        </p>
      </div>

      {adminError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700"
        >
          {adminError}
        </div>
      )}

      {/* TAB 1: OVERVIEW & DISPATCH */}
      {activeTab === 'overview' && (
        <div
          id="panel-admin-overview"
          role="tabpanel"
          aria-labelledby="tab-admin-overview"
          className="space-y-6"
        >
          {/* Telemetry Breakdown Grid */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Incident Resolution Pulse */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
                  <h2 className="font-display text-sm font-bold text-[#111827]">
                    Incident Triage Pipeline
                  </h2>
                </div>
                <span className="font-mono text-xs text-slate-500 tabular-nums">
                  {advisories.length} total
                </span>
              </div>

              <div className="space-y-3">
                {incidentStatusStats.map((row) => (
                  <div key={row.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{row.label}</span>
                      <span className="font-mono text-slate-700 tabular-nums">
                        {row.count} ({row.pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded bg-slate-100">
                      <div
                        className={`h-full ${row.barClass} transition-all`}
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-200 pt-3">
                <p className="text-[11px] font-semibold text-slate-600 mb-2">
                  RBAC Account Distribution
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {roleDistribution.map((r) => (
                    <div
                      key={r.role}
                      className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5"
                    >
                      <span className="text-slate-700 truncate">{r.label}</span>
                      <span className="font-mono font-semibold text-[#111827] tabular-nums">
                        {r.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Precinct Incident Density (Clickable Filter) */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-sm font-bold text-[#111827]">
                    Cape Town Precinct Activity Matrix
                  </h2>
                  <p className="text-xs text-slate-500">
                    Click any precinct below to filter the incident dispatch queue.
                  </p>
                </div>
                {incZoneFilter !== 'All' && (
                  <button
                    type="button"
                    onClick={() => setIncZoneFilter('All')}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-[#111827] hover:bg-slate-50"
                  >
                    Clear Zone Filter
                  </button>
                )}
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                {precinctDensity.map((item) => {
                  const selected = incZoneFilter === item.zone;
                  return (
                    <button
                      key={item.zone}
                      type="button"
                      onClick={() => setIncZoneFilter(selected ? 'All' : item.zone)}
                      className={`flex items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors ${
                        selected
                          ? 'border-[#1D4ED8] bg-[#EFF6FF]'
                          : 'border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-white'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-[#111827]">{item.zone}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-600 tabular-nums">
                          {item.total} record(s)
                          {item.elevated > 0 ? ` · ${item.elevated} elevated` : ''}
                        </p>
                      </div>
                      <StatusText
                        label={item.elevated > 0 ? 'Elevated' : 'Monitored'}
                        tone={item.elevated > 0 ? 'alert' : 'nominal'}
                      />
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Incident Oversight & Dispatch */}
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-display text-base font-bold text-[#111827]">
                  Submitted Incidents &amp; Safety Management Oversight ({filteredIncidents.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Assign response personnel and update resolution status across all reported Cape Town incidents.
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
                    value={incSearch}
                    onChange={(e) => setIncSearch(e.target.value)}
                    placeholder="Filter incidents..."
                    aria-label="Filter incidents by title, zone, or unit"
                    className="rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-[#111827] focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
                <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                  {(['All', 'Open', 'Acknowledged', 'Resolved'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      aria-pressed={incStatusFilter === st}
                      onClick={() => setIncStatusFilter(st)}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                        incStatusFilter === st
                          ? 'bg-[#111827] text-white'
                          : 'text-slate-600 hover:text-[#111827]'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {incFeedback && (
              <div
                role="status"
                className="border-b border-slate-200 bg-[#F0FDF4] px-5 py-2.5 text-xs font-medium text-[#15803D]"
              >
                {incFeedback}
              </div>
            )}

            <div className="divide-y divide-slate-200">
              {filteredIncidents.length === 0 ? (
                <p className="px-5 py-8 text-center text-xs text-slate-500">
                  No incident records matched the active filters.
                </p>
              ) : (
                filteredIncidents.map((inc) => {
                  const currentStatus = inc.status || 'Open';
                  const assignedOfficer =
                    incOfficers[inc.id] ?? inc.assignedOfficerName ?? RESPONSE_UNITS[0];
                  const nextStatus = incStatuses[inc.id] ?? currentStatus;
                  const noteVal = incNotes[inc.id] ?? inc.resolutionNotes ?? '';

                  return (
                    <div key={inc.id} className="p-5 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
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
                          <p className="mt-0.5 text-xs text-slate-500">
                            {inc.category || 'Safety Advisory'} · {inc.zone} · {inc.source}
                          </p>
                        </div>
                        {inc.locationConsent &&
                          typeof inc.sharedLat === 'number' &&
                          typeof inc.sharedLng === 'number' && (
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#1E40AF] tabular-nums">
                              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                              {inc.sharedLat.toFixed(4)}, {inc.sharedLng.toFixed(4)}
                            </span>
                          )}
                      </div>

                      <p className="text-xs text-slate-700">{inc.summary}</p>

                      <div className="grid gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-12 sm:items-end">
                        <div className="sm:col-span-3">
                          <label
                            htmlFor={`admin-unit-${inc.id}`}
                            className="block text-[11px] font-semibold text-slate-600"
                          >
                            Assign Unit
                          </label>
                          <select
                            id={`admin-unit-${inc.id}`}
                            value={assignedOfficer}
                            onChange={(e) =>
                              setIncOfficers((prev) => ({ ...prev, [inc.id]: e.target.value }))
                            }
                            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-[#111827]"
                          >
                            {RESPONSE_UNITS.map((unit) => (
                              <option key={unit} value={unit}>
                                {unit}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label
                            htmlFor={`admin-status-${inc.id}`}
                            className="block text-[11px] font-semibold text-slate-600"
                          >
                            Status
                          </label>
                          <select
                            id={`admin-status-${inc.id}`}
                            value={nextStatus}
                            onChange={(e) =>
                              setIncStatuses((prev) => ({
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
                            htmlFor={`admin-note-${inc.id}`}
                            className="block text-[11px] font-semibold text-slate-600"
                          >
                            Admin / Dispatch Note
                          </label>
                          <input
                            id={`admin-note-${inc.id}`}
                            type="text"
                            value={noteVal}
                            onChange={(e) =>
                              setIncNotes((prev) => ({ ...prev, [inc.id]: e.target.value }))
                            }
                            placeholder="Enter clearance or assignment remarks..."
                            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <button
                            type="button"
                            disabled={busyKey === `inc-${inc.id}`}
                            onClick={async () => {
                              setAdminError('');
                              setIncFeedback('');
                              setBusyKey(`inc-${inc.id}`);
                              try {
                                await onUpdateIncident(inc.id, {
                                  status: nextStatus,
                                  assignedOfficerId: user.id,
                                  assignedOfficerName: assignedOfficer,
                                  resolutionNotes: noteVal,
                                });
                                setIncFeedback(`Incident "${inc.title}" updated to ${nextStatus}.`);
                              } catch (err) {
                                setAdminError(
                                  err instanceof Error ? err.message : 'Unable to update incident.'
                                );
                              } finally {
                                setBusyKey(null);
                              }
                            }}
                            className="w-full rounded-md bg-[#111827] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1E293B] disabled:opacity-60"
                          >
                            {busyKey === `inc-${inc.id}` ? 'Saving...' : 'Update'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: ACCREDITATIONS, RBAC & MODERATION */}
      {activeTab === 'governance' && (
        <div
          id="panel-admin-governance"
          role="tabpanel"
          aria-labelledby="tab-admin-governance"
          className="space-y-6"
        >
          {/* Tourism Service Provider Accreditation Queue */}
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-display text-base font-bold text-[#111827]">
                  Tourism Service Provider Accreditation Queue ({filteredApplications.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Approve or request follow-up documentation for Cape Town operators.
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
                    value={appSearch}
                    onChange={(e) => setAppSearch(e.target.value)}
                    placeholder="Search operator or precinct..."
                    aria-label="Search accreditation applications"
                    className="rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-[#111827] focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
                <select
                  aria-label="Filter accreditation status"
                  value={appStatusFilter}
                  onChange={(e) =>
                    setAppStatusFilter(e.target.value as 'All' | ProviderApplication['status'])
                  }
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-[#111827]"
                >
                  <option value="All">All Statuses</option>
                  <option value="Pending Review">Pending Review</option>
                  <option value="Approved">Approved</option>
                  <option value="Action Required">Action Required</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-5 py-3">Business Name</th>
                    <th className="px-5 py-3">Precinct</th>
                    <th className="px-5 py-3">Compliance Summary</th>
                    <th className="px-5 py-3">Submitted</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredApplications.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-6 text-center text-xs text-slate-500">
                        No applications matched this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredApplications.map((app) => (
                      <tr key={app.id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-[#111827]">{app.businessName}</p>
                          <p className="text-xs text-slate-500">{app.category}</p>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-700">{app.zone}</td>
                        <td className="px-5 py-3.5 text-xs text-slate-600">{app.complianceDocs}</td>
                        <td className="px-5 py-3.5 font-mono text-xs tabular-nums text-slate-600">
                          {app.submittedDate}
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusText
                            label={app.status}
                            tone={
                              app.status === 'Approved'
                                ? 'nominal'
                                : app.status === 'Pending Review'
                                ? 'advisory'
                                : 'alert'
                            }
                          />
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="inline-flex items-center gap-2">
                            {app.status !== 'Approved' && (
                              <button
                                type="button"
                                disabled={busyKey === `app-${app.id}`}
                                onClick={async () => {
                                  setAdminError('');
                                  setBusyKey(`app-${app.id}`);
                                  try {
                                    await onUpdateApplicationStatus(app.id, 'Approved');
                                  } catch (err) {
                                    setAdminError(
                                      err instanceof Error
                                        ? err.message
                                        : 'Unable to approve application.'
                                    );
                                  } finally {
                                    setBusyKey(null);
                                  }
                                }}
                                className="inline-flex items-center gap-1 rounded-md bg-[#1D4ED8] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60 transition-colors whitespace-nowrap"
                              >
                                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                Approve
                              </button>
                            )}
                            {app.status !== 'Action Required' && (
                              <button
                                type="button"
                                disabled={busyKey === `app-${app.id}`}
                                onClick={async () => {
                                  setAdminError('');
                                  setBusyKey(`app-${app.id}`);
                                  try {
                                    await onUpdateApplicationStatus(app.id, 'Action Required');
                                  } catch (err) {
                                    setAdminError(
                                      err instanceof Error
                                        ? err.message
                                        : 'Unable to flag compliance docs.'
                                    );
                                  } finally {
                                    setBusyKey(null);
                                  }
                                }}
                                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 transition-colors whitespace-nowrap"
                              >
                                Flag Docs
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* RBAC User Role Management Table */}
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-display text-base font-bold text-[#111827]">
                  User Role Management (RBAC) ({filteredUsers.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Approve requested roles or assign Tourist, Service Provider, Safety Management, or Administrator access.
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
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search accounts..."
                    aria-label="Search RBAC accounts"
                    className="rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-[#111827] focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
                <select
                  aria-label="Filter RBAC accounts"
                  value={userRoleFilter}
                  onChange={(e) =>
                    setUserRoleFilter(
                      e.target.value as 'all' | 'pending_upgrade' | UserRole
                    )
                  }
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-[#111827]"
                >
                  <option value="all">All Roles</option>
                  <option value="pending_upgrade">
                    Requested Role Differs ({roleUpgradeRequests.length})
                  </option>
                  <option value="tourist">Tourist</option>
                  <option value="provider">Service Provider</option>
                  <option value="safety">Safety Management</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-5 py-3">User</th>
                    <th className="px-5 py-3">Requested Role</th>
                    <th className="px-5 py-3">Assigned Role</th>
                    <th className="px-5 py-3 text-right">Update Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredUsers.map((u) => {
                    const hasUpgradeRequest = Boolean(
                      u.requestedRole && u.requestedRole !== u.role
                    );
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-[#111827]">{u.name}</p>
                          <p className="text-xs text-slate-500">
                            {u.organization || u.location} · {u.email}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-600">
                          {ROLE_LABELS[u.requestedRole || u.role].label}
                        </td>
                        <td className="px-5 py-3">
                          <StatusText
                            label={ROLE_LABELS[u.role].short}
                            tone={u.role === 'admin' ? 'advisory' : 'nominal'}
                          />
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            {hasUpgradeRequest && u.requestedRole && (
                              <button
                                type="button"
                                disabled={busyKey === `role-${u.id}`}
                                onClick={async () => {
                                  setAdminError('');
                                  setBusyKey(`role-${u.id}`);
                                  try {
                                    await onUpdateUserRole(u.id, u.requestedRole!);
                                  } catch (err) {
                                    setAdminError(
                                      err instanceof Error
                                        ? err.message
                                        : 'Unable to approve requested role.'
                                    );
                                  } finally {
                                    setBusyKey(null);
                                  }
                                }}
                                className="rounded-md bg-[#1D4ED8] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60 whitespace-nowrap"
                              >
                                Approve {ROLE_LABELS[u.requestedRole].short}
                              </button>
                            )}
                            <select
                              aria-label={`Assign role for ${u.name}`}
                              disabled={busyKey === `role-${u.id}`}
                              value={u.role}
                              onChange={async (e) => {
                                setAdminError('');
                                setBusyKey(`role-${u.id}`);
                                try {
                                  await onUpdateUserRole(u.id, e.target.value as UserRole);
                                } catch (err) {
                                  setAdminError(
                                    err instanceof Error
                                      ? err.message
                                      : 'Unable to update user role.'
                                  );
                                } finally {
                                  setBusyKey(null);
                                }
                              }}
                              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-[#111827] focus:border-[#1D4ED8] focus:outline-none disabled:opacity-60"
                            >
                              <option value="tourist">Tourist</option>
                              <option value="provider">Service Provider</option>
                              <option value="safety">Safety Management</option>
                              <option value="admin">Administrator</option>
                            </select>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Community Flagged Posts Quick Moderation */}
          {onModeratePost && (
            <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Flag className="h-4 w-4 text-amber-700" aria-hidden="true" />
                  <h2 className="font-display text-base font-bold text-[#111827]">
                    Community Moderation Queue ({flaggedPosts.length})
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('community')}
                  className="text-xs font-semibold text-[#1D4ED8] hover:underline"
                >
                  Open Community Hub
                </button>
              </div>
              {flaggedPosts.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No flagged community notes awaiting administrator review.
                </p>
              ) : (
                <div className="divide-y divide-slate-200">
                  {flaggedPosts.map((post) => (
                    <div
                      key={post.id}
                      className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="text-xs space-y-0.5">
                        <p className="font-semibold text-[#111827]">
                          {post.author} · {post.zone}
                        </p>
                        <p className="text-slate-700">{post.content}</p>
                        {post.flagReason && (
                          <p className="text-[11px] text-amber-800 font-medium">
                            Flag reason: {post.flagReason}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onModeratePost(post.id, 'Approved', true)}
                          className="inline-flex items-center gap-1 rounded-md bg-[#15803D] px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-800"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => onModeratePost(post.id, 'Removed', false)}
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* TAB 3: ANNOUNCEMENTS PUBLISHER & MANAGER */}
      {activeTab === 'announcements' && (
        <div
          id="panel-admin-announcements"
          role="tabpanel"
          aria-labelledby="tab-admin-announcements"
        >
          <section className="grid gap-6 rounded-xl border border-slate-200 bg-white p-5 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <div className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
                <h2 className="font-display text-base font-bold text-[#111827]">
                  Publish Destination Announcement
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Broadcast official Cape Town park, transport, and coastal notices to all tourists.
              </p>

              <form onSubmit={handlePublishAnnouncement} className="mt-4 space-y-3">
                <div>
                  <label htmlFor="ann-title" className="block text-xs font-semibold text-slate-700">
                    Announcement Title
                  </label>
                  <input
                    id="ann-title"
                    type="text"
                    value={annTitle}
                    onChange={(e) => setAnnTitle(e.target.value)}
                    placeholder="e.g., Kirstenbosch Summer Sunset Concert Shuttle Schedule"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="ann-cat" className="block text-xs font-semibold text-slate-700">
                      Category
                    </label>
                    <select
                      id="ann-cat"
                      value={annCategory}
                      onChange={(e) => setAnnCategory(e.target.value as AnnouncementCategory)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900"
                    >
                      {ANNOUNCEMENT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="ann-priority"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Priority
                    </label>
                    <select
                      id="ann-priority"
                      value={annPriority}
                      onChange={(e) =>
                        setAnnPriority(e.target.value as DestinationAnnouncement['priority'])
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900"
                    >
                      <option value="Info">Info</option>
                      <option value="Advisory">Advisory</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="ann-zone" className="block text-xs font-semibold text-slate-700">
                    Affected Area / Precinct
                  </label>
                  <input
                    id="ann-zone"
                    type="text"
                    value={annZone}
                    onChange={(e) => setAnnZone(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label htmlFor="ann-body" className="block text-xs font-semibold text-slate-700">
                    Official Notice Body
                  </label>
                  <textarea
                    id="ann-body"
                    rows={3}
                    value={annBody}
                    onChange={(e) => setAnnBody(e.target.value)}
                    placeholder="Provide clear visitor instructions, operating hours, or detours..."
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={annPinned}
                    onChange={(e) => setAnnPinned(e.target.checked)}
                    className="rounded border-slate-300 text-[#1D4ED8]"
                  />
                  <span>Pin to top of Tourist Dashboard &amp; Safety Centre</span>
                </label>

                {annFeedback && <p className="text-xs font-medium text-[#15803D]">{annFeedback}</p>}
                {annError && <p className="text-xs font-medium text-red-700">{annError}</p>}

                <button
                  type="submit"
                  className="w-full rounded-lg bg-[#1D4ED8] py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] transition-colors"
                >
                  Publish Announcement
                </button>
              </form>
            </div>

            <div className="lg:col-span-7 divide-y divide-slate-200">
              {announcements.map((ann) => (
                <div key={ann.id} className="py-3.5 first:pt-0 last:pb-0 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#111827]">{ann.title}</span>
                      {ann.pinned && (
                        <span className="rounded bg-[#EFF6FF] px-1.5 py-0.5 text-[10px] font-semibold text-[#1E40AF]">
                          Pinned
                        </span>
                      )}
                      {!ann.active && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                          Archived
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
                  <p className="text-xs text-slate-600">{ann.body}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500">
                    <span>
                      {ann.category} · {ann.zone} · {ann.updatedAtLabel}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busyKey === `ann-${ann.id}`}
                        onClick={async () => {
                          setAnnError('');
                          setBusyKey(`ann-${ann.id}`);
                          try {
                            await onUpdateAnnouncement(ann.id, { pinned: !ann.pinned });
                          } catch (err) {
                            setAnnError(
                              err instanceof Error ? err.message : 'Unable to update pin state.'
                            );
                          } finally {
                            setBusyKey(null);
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-[#111827] hover:bg-slate-50 disabled:opacity-60"
                      >
                        <Pin className="h-3 w-3" aria-hidden="true" />
                        {ann.pinned ? 'Unpin' : 'Pin'}
                      </button>
                      <button
                        type="button"
                        disabled={busyKey === `ann-${ann.id}`}
                        onClick={async () => {
                          setAnnError('');
                          setBusyKey(`ann-${ann.id}`);
                          try {
                            await onUpdateAnnouncement(ann.id, { active: !ann.active });
                          } catch (err) {
                            setAnnError(
                              err instanceof Error ? err.message : 'Unable to update announcement.'
                            );
                          } finally {
                            setBusyKey(null);
                          }
                        }}
                        className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-[#111827] hover:bg-slate-50 disabled:opacity-60"
                      >
                        {ann.active ? 'Archive' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        disabled={busyKey === `ann-${ann.id}`}
                        onClick={async () => {
                          setAnnError('');
                          setBusyKey(`ann-${ann.id}`);
                          try {
                            await onDeleteAnnouncement(ann.id);
                          } catch (err) {
                            setAnnError(
                              err instanceof Error ? err.message : 'Unable to delete announcement.'
                            );
                          } finally {
                            setBusyKey(null);
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded border border-red-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        <Trash2 className="h-3 w-3" aria-hidden="true" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* TAB 4: PAYMENTS & AUDIT LEDGER */}
      {activeTab === 'payments' && (
        <div id="panel-admin-payments" role="tabpanel" aria-labelledby="tab-admin-payments">
          <AdminPaymentManagementSection
            payments={payments}
            auditLogs={paymentAuditLogs}
            onIssueRefund={onIssueRefund}
          />
        </div>
      )}
    </div>
  );
};
