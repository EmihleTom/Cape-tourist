import React, { useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  MapPin,
  PhoneCall,
  Radio,
  ShieldAlert,
  Timer,
  Upload,
} from 'lucide-react';
import { DemoDataNotice } from '@/src/components/common/DemoDataNotice';
import { StatusText } from '@/src/components/common/StatusText';
import { storageService } from '@/src/services/firebase/storageService';
import type {
  CheckInSession,
  DemoUser,
  IncidentCategory,
  NavSectionId,
  SafetyAdvisory,
} from '@/src/types/app';

interface SafetyManagementDashboardProps {
  user: DemoUser;
  checkIns: CheckInSession[];
  advisories: SafetyAdvisory[];
  onResolveCheckIn: (id: string) => void;
  onPublishAdvisory: (advisory: Omit<SafetyAdvisory, 'id' | 'updatedAt' | 'dataOrigin'>) => Promise<void> | void;
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

export const SafetyManagementDashboard: React.FC<SafetyManagementDashboardProps> = ({
  user,
  checkIns,
  advisories,
  onResolveCheckIn,
  onPublishAdvisory,
  onUpdateIncident,
  onNavigate,
}) => {
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
  const [statusFilter, setStatusFilter] = useState<'All' | 'Open' | 'Acknowledged' | 'Resolved'>('All');
  const [draftAssignments, setDraftAssignments] = useState<Record<string, string>>({});
  const [draftStatuses, setDraftStatuses] = useState<Record<string, SafetyAdvisory['status']>>({});
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [triageMessage, setTriageMessage] = useState('');

  const overdueCount = checkIns.filter((c) => c.status === 'Overdue').length;
  const activeCount = checkIns.filter((c) => c.status === 'Active').length;
  const openIncidentsCount = advisories.filter((a) => (a.status || 'Open') !== 'Resolved').length;

  const filteredIncidents = advisories.filter((inc) => {
    const effectiveStatus = inc.status || 'Open';
    return statusFilter === 'All' || effectiveStatus === statusFilter;
  });

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

  const handleSaveTriage = async (inc: SafetyAdvisory) => {
    setTriageMessage('');
    setSavingId(inc.id);
    const nextOfficerName =
      draftAssignments[inc.id] ?? inc.assignedOfficerName ?? RESPONSE_UNITS[0];
    const nextStatus = draftStatuses[inc.id] ?? inc.status ?? 'Acknowledged';
    const nextNotes = draftNotes[inc.id] ?? inc.resolutionNotes ?? '';

    try {
      await onUpdateIncident(inc.id, {
        status: nextStatus,
        assignedOfficerId: user.id,
        assignedOfficerName: nextOfficerName,
        resolutionNotes: nextNotes,
      });
      setTriageMessage(`Updated "${inc.title}" -> ${nextStatus} (${nextOfficerName}).`);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <DemoDataNotice scope="Pre-loaded incidents are demo data; live Firestore reports support real-time unit assignment and status transitions" />

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-[#0B1F3A] p-6 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-teal-300">
            Safety Operations · {user.organization}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold">
            Metropolitan Coastal &amp; Mountain Safety Dispatch
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Assign response teams to incoming tourist incidents, update resolution status, and monitor trail check-ins.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('safety')}
          className="rounded-lg bg-[#14B8A6] px-4 py-2 text-xs font-semibold text-[#071529] hover:bg-teal-300 whitespace-nowrap shrink-0"
        >
          View Public Safety Centre
        </button>
      </div>

      {/* KPI Strip */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Active Trail Check-Ins</span>
            <Timer className="h-4 w-4 text-[#0D9488]" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-[#0B1F3A]">
            {activeCount}
          </p>
          <p className="mt-1 text-xs text-slate-600">Within expected return window</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Overdue Escalations</span>
            <ShieldAlert className="h-4 w-4 text-red-700" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-red-700">
            {overdueCount}
          </p>
          <p className="mt-1 text-xs text-slate-600">Requires welfare check</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Active Incidents</span>
            <Radio className="h-4 w-4 text-amber-700" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-[#0B1F3A]">
            {openIncidentsCount}
          </p>
          <p className="mt-1 text-xs text-slate-600">Open or acknowledged across zones</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Dispatch Liaison</span>
            <PhoneCall className="h-4 w-4 text-[#15803D]" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-[#0B1F3A]">107 / 112</p>
          <p className="mt-1 text-xs text-slate-600">WSAR &amp; NSRI direct channels</p>
        </div>
      </section>

      {/* Incident Dispatch, Assignment & Status Queue */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-[#0D9488]" aria-hidden="true" />
              <h2 className="font-display text-base font-bold text-[#0B1F3A]">
                Incident Assignment &amp; Status Management
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Assign response units and transition incidents from Open to Acknowledged or Resolved.
            </p>
          </div>

          <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            {(['All', 'Open', 'Acknowledged', 'Resolved'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                  statusFilter === tab
                    ? 'bg-[#0B1F3A] text-white'
                    : 'text-slate-600 hover:text-[#0B1F3A]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {triageMessage && (
          <div className="border-b border-slate-200 bg-[#F0FDF4] px-5 py-2.5 text-xs font-medium text-[#15803D]">
            {triageMessage}
          </div>
        )}

        <div className="divide-y divide-slate-200">
          {filteredIncidents.map((inc) => {
            const currentStatus = inc.status || 'Open';
            const lockedForSafetyOfficer = currentStatus === 'Resolved' && user.role !== 'admin';
            const selectedUnit =
              draftAssignments[inc.id] ?? inc.assignedOfficerName ?? RESPONSE_UNITS[0];
            const selectedStatus = draftStatuses[inc.id] ?? currentStatus;
            const noteVal = draftNotes[inc.id] ?? inc.resolutionNotes ?? '';

            return (
              <div key={inc.id} className="p-5 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
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
                    <p className="mt-1 text-xs text-slate-600">
                      {inc.category || 'Safety Advisory'} · {inc.zone} · {inc.source} ({inc.updatedAt})
                    </p>
                    <p className="mt-1.5 text-xs text-slate-700 leading-relaxed">{inc.summary}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                      {inc.locationConsent &&
                        typeof inc.sharedLat === 'number' &&
                        typeof inc.sharedLng === 'number' && (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#0F766E]">
                            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                            Consented GPS: {inc.sharedLat.toFixed(4)}, {inc.sharedLng.toFixed(4)}
                          </span>
                        )}
                      {inc.attachmentUrl && (
                        <a
                          href={inc.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-[#0D9488] hover:underline"
                        >
                          View Field Photo
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {lockedForSafetyOfficer ? (
                  <p className="text-xs text-slate-500">
                    Resolved by {inc.assignedOfficerName || 'Safety Operations'}
                    {inc.resolutionNotes ? ` — "${inc.resolutionNotes}"` : ''}. (Administrator override required to reopen.)
                  </p>
                ) : (
                  <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-12 sm:items-end">
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-600">
                        Assigned Officer / Unit
                      </label>
                      <select
                        value={selectedUnit}
                        onChange={(e) =>
                          setDraftAssignments((prev) => ({ ...prev, [inc.id]: e.target.value }))
                        }
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-[#0B1F3A]"
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
                      <label className="block text-[11px] font-semibold text-slate-600">
                        Status
                      </label>
                      <select
                        value={selectedStatus}
                        onChange={(e) =>
                          setDraftStatuses((prev) => ({
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
                      <label className="block text-[11px] font-semibold text-slate-600">
                        Dispatch / Resolution Notes
                      </label>
                      <input
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
                        className="w-full rounded-md bg-[#0D9488] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0F766E] disabled:opacity-60 transition-colors"
                      >
                        {savingId === inc.id ? 'Saving...' : 'Save Update'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Check-In Monitoring Table */}
        <section className="rounded-xl border border-slate-200 bg-white lg:col-span-7">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-display text-base font-bold text-[#0B1F3A]">
              Tourist Check-In Escalation Monitor
            </h2>
            <p className="text-xs text-slate-500">
              Confirm safe return after welfare call to clear overdue status.
            </p>
          </div>
          <div className="divide-y divide-slate-200">
            {checkIns.map((session) => (
              <div key={session.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#0B1F3A]">{session.touristName}</span>
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
                  <p className="mt-0.5 text-xs text-slate-700">
                    {session.route} · Party of {session.partySize}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-500 tabular-nums">
                    Started {session.startedAt} · Due {session.expectedReturn} · ICE {session.emergencyContact}
                  </p>
                </div>
                {session.status !== 'Completed' && (
                  <button
                    type="button"
                    onClick={() => onResolveCheckIn(session.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D9488] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0F766E] transition-colors whitespace-nowrap shrink-0"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Confirm Safe Return
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Broadcast Advisory Composer */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5">
          <h2 className="font-display text-base font-bold text-[#0B1F3A]">
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
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#0D9488] focus:outline-none"
                >
                  <option value="Safety Advisory">Safety Advisory</option>
                  <option value="Trail Hazard">Trail Hazard</option>
                  <option value="Coastal / Marine">Coastal / Marine</option>
                  <option value="Transport & Transit">Transport &amp; Transit</option>
                </select>
              </div>
              <div>
                <label htmlFor="adv-severity" className="block text-xs font-semibold text-slate-700">
                  Advisory Level
                </label>
                <select
                  id="adv-severity"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as SafetyAdvisory['severity'])}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#0D9488] focus:outline-none"
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
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#0D9488] focus:outline-none"
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
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#0D9488] focus:outline-none"
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
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#0D9488] focus:outline-none"
              />
            </div>

            <div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-[#0B1F3A] hover:bg-slate-100">
                <Upload className="h-3.5 w-3.5 text-[#0D9488]" aria-hidden="true" />
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
              className="w-full rounded-lg bg-[#0B1F3A] py-2 text-xs font-semibold text-white hover:bg-[#102A43] disabled:opacity-60 transition-colors"
            >
              {publishing ? 'Publishing...' : 'Broadcast Advisory'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};
