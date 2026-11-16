import React, { useState } from 'react';
import {
  Check,
  Database,
  MapPin,
  Megaphone,
  Pin,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import { DemoDataNotice } from '@/src/components/common/DemoDataNotice';
import { StatusText } from '@/src/components/common/StatusText';
import { AdminPaymentManagementSection } from '@/src/components/payments/AdminPaymentManagementSection';
import { ROLE_LABELS } from '@/src/data/navigation';
import { getArchitectureReadiness } from '@/src/services/firebase/config';
import type {
  AnnouncementCategory,
  DemoUser,
  DestinationAnnouncement,
  NavSectionId,
  PaymentAuditLog,
  PaymentRecord,
  ProviderApplication,
  SafetyAdvisory,
  UserRole,
} from '@/src/types/app';

interface AdminDashboardProps {
  user: DemoUser;
  applications: ProviderApplication[];
  managedUsers: DemoUser[];
  advisories: SafetyAdvisory[];
  announcements: DestinationAnnouncement[];
  payments: PaymentRecord[];
  paymentAuditLogs: PaymentAuditLog[];
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
  const pendingCount = applications.filter((a) => a.status === 'Pending Review').length;
  const approvedCount = applications.filter((a) => a.status === 'Approved').length;

  // Incident Oversight State
  const [incOfficers, setIncOfficers] = useState<Record<string, string>>({});
  const [incStatuses, setIncStatuses] = useState<Record<string, SafetyAdvisory['status']>>({});
  const [incNotes, setIncNotes] = useState<Record<string, string>>({});
  const [incFeedback, setIncFeedback] = useState('');
  const [adminError, setAdminError] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Announcement Composer State
  const [annTitle, setAnnTitle] = useState('');
  const [annCategory, setAnnCategory] = useState<AnnouncementCategory>('Visitor Advisory');
  const [annZone, setAnnZone] = useState('City Bowl & V&A Waterfront');
  const [annPriority, setAnnPriority] = useState<DestinationAnnouncement['priority']>('Info');
  const [annBody, setAnnBody] = useState('');
  const [annPinned, setAnnPinned] = useState(false);
  const [annFeedback, setAnnFeedback] = useState('');
  const [annError, setAnnError] = useState('');

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
            : 'Municipal tourism operations preview with interactive provider audit queue, incident oversight, and announcements'
        }
      />

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-[#0D9488]">
            Administrator Portal · {user.organization}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-[#0B1F3A]">
            CapeSafe Metro Operations &amp; Accreditation
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Review tourism service provider compliance, manage reported incidents, publish official announcements, and assign RBAC roles.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('settings')}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#0B1F3A] hover:bg-slate-50 whitespace-nowrap shrink-0"
        >
          Inspect Firebase Config
        </button>
      </div>

      {/* KPI Strip */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Accredited Operators</span>
            <ShieldCheck className="h-4 w-4 text-[#15803D]" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-[#0B1F3A]">
            {approvedCount}
          </p>
          <p className="mt-1 text-xs text-slate-600">Approved registry applications</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Pending Audits</span>
            <Users className="h-4 w-4 text-amber-700" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-[#0B1F3A]">
            {pendingCount}
          </p>
          <p className="mt-1 text-xs text-slate-600">Awaiting SAMSA / CATHSSETA sign-off</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Active Incidents</span>
            <ShieldAlert className="h-4 w-4 text-[#0D9488]" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-[#0B1F3A]">
            {advisories.filter((a) => (a.status || 'Open') !== 'Resolved').length}
          </p>
          <p className="mt-1 text-xs text-slate-600">Monitored across Peninsula</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Backend Adapter</span>
            <Database className="h-4 w-4 text-[#0B1F3A]" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-lg font-bold text-[#0B1F3A]">
            {readiness.mode === 'firebase-connected' ? 'Firebase Live' : 'Demo Mode'}
          </p>
          <p className="mt-1 text-xs text-[#0D9488] font-medium truncate">{readiness.projectIdLabel}</p>
        </div>
      </section>

      {/* Incident Oversight & Dispatch */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-[#0B1F3A]">
              Submitted Incidents &amp; Safety Management Oversight
            </h2>
            <p className="text-xs text-slate-500">
              Assign response personnel and update resolution status across all reported Cape Town incidents.
            </p>
          </div>
          <span className="font-mono text-xs text-slate-500 tabular-nums">
            {advisories.length} records
          </span>
        </div>

        {incFeedback && (
          <div
            role="status"
            className="border-b border-slate-200 bg-[#F0FDF4] px-5 py-2.5 text-xs font-medium text-[#15803D]"
          >
            {incFeedback}
          </div>
        )}
        {adminError && (
          <div
            role="alert"
            className="border-b border-red-200 bg-red-50 px-5 py-2.5 text-xs font-medium text-red-700"
          >
            {adminError}
          </div>
        )}

        <div className="divide-y divide-slate-200">
          {advisories.map((inc) => {
            const currentStatus = inc.status || 'Open';
            const assignedOfficer = incOfficers[inc.id] ?? inc.assignedOfficerName ?? RESPONSE_UNITS[0];
            const nextStatus = incStatuses[inc.id] ?? currentStatus;
            const noteVal = incNotes[inc.id] ?? inc.resolutionNotes ?? '';

            return (
              <div key={inc.id} className="p-5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-[#0B1F3A]">{inc.title}</span>
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
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
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
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#0F766E]">
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
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-[#0B1F3A]"
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
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-[#0B1F3A]"
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
                      className="w-full rounded-md bg-[#0B1F3A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#102A43] disabled:opacity-60"
                    >
                      {busyKey === `inc-${inc.id}` ? 'Saving...' : 'Update'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Destination Announcements Publisher & Manager */}
      <section className="grid gap-6 rounded-xl border border-slate-200 bg-white p-5 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-[#0D9488]" aria-hidden="true" />
            <h2 className="font-display text-base font-bold text-[#0B1F3A]">
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
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#0D9488] focus:outline-none"
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
                <label htmlFor="ann-priority" className="block text-xs font-semibold text-slate-700">
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
                className="rounded border-slate-300 text-[#0D9488]"
              />
              <span>Pin to top of Tourist Dashboard &amp; Safety Centre</span>
            </label>

            {annFeedback && <p className="text-xs font-medium text-[#15803D]">{annFeedback}</p>}
            {annError && <p className="text-xs font-medium text-red-700">{annError}</p>}

            <button
              type="submit"
              className="w-full rounded-lg bg-[#0D9488] py-2 text-xs font-semibold text-white hover:bg-[#0F766E] transition-colors"
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
                  <span className="text-sm font-bold text-[#0B1F3A]">{ann.title}</span>
                  {ann.pinned && (
                    <span className="rounded bg-[#F0FDFA] px-1.5 py-0.5 text-[10px] font-semibold text-[#0F766E]">
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
                        setAnnError(err instanceof Error ? err.message : 'Unable to update pin state.');
                      } finally {
                        setBusyKey(null);
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-[#0B1F3A] hover:bg-slate-50 disabled:opacity-60"
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
                        setAnnError(err instanceof Error ? err.message : 'Unable to update announcement.');
                      } finally {
                        setBusyKey(null);
                      }
                    }}
                    className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-[#0B1F3A] hover:bg-slate-50 disabled:opacity-60"
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
                        setAnnError(err instanceof Error ? err.message : 'Unable to delete announcement.');
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

      {/* RBAC User Role Management Table */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-[#0B1F3A]">
              User Role Management (RBAC)
            </h2>
            <p className="text-xs text-slate-500">
              Approve requested roles or assign Tourist, Service Provider, Safety Management, or Administrator access.
            </p>
          </div>
          <span className="font-mono text-xs text-slate-500 tabular-nums">
            {managedUsers.length} accounts
          </span>
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
              {managedUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-[#0B1F3A]">{u.name}</p>
                    <p className="text-xs text-slate-500">{u.organization || u.location}</p>
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
                          setAdminError(err instanceof Error ? err.message : 'Unable to update user role.');
                        } finally {
                          setBusyKey(null);
                        }
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-[#0B1F3A] focus:border-[#0D9488] focus:outline-none disabled:opacity-60"
                    >
                      <option value="tourist">Tourist</option>
                      <option value="provider">Service Provider</option>
                      <option value="safety">Safety Management</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Interactive Provider Accreditation Table */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-[#0B1F3A]">
              Tourism Service Provider Accreditation Queue
            </h2>
            <p className="text-xs text-slate-500">
              Approve or request follow-up documentation for Cape Town operators.
            </p>
          </div>
          <span className="font-mono text-xs text-slate-500 tabular-nums">
            {applications.length} applications
          </span>
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
              {applications.map((app) => (
                <tr key={app.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-[#0B1F3A]">{app.businessName}</p>
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
                                err instanceof Error ? err.message : 'Unable to approve application.'
                              );
                            } finally {
                              setBusyKey(null);
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-md bg-[#0D9488] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0F766E] disabled:opacity-60 transition-colors whitespace-nowrap"
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
                                err instanceof Error ? err.message : 'Unable to flag compliance docs.'
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
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Admin Payment Operations, Analytics & Audit Ledger */}
      <AdminPaymentManagementSection
        payments={payments}
        auditLogs={paymentAuditLogs}
        onIssueRefund={onIssueRefund}
      />
    </div>
  );
};
