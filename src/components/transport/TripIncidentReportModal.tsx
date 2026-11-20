import React, { useEffect, useState } from 'react';
import { PhoneCall, Send, ShieldAlert, X } from 'lucide-react';
import type { DemoUser, IncidentCategory, SafetyAdvisory } from '@/src/types/app';

export interface TripIncidentDraft {
  tripTitle: string;
  zone: string;
  bookingReference?: string;
  pickupCode?: string;
  driverOrProvider?: string;
}

interface TripIncidentReportModalProps {
  draft: TripIncidentDraft | null;
  user?: DemoUser;
  onSubmitIncident: (
    advisory: Omit<SafetyAdvisory, 'id' | 'updatedAt' | 'dataOrigin'>
  ) => Promise<void> | void;
  onClose: () => void;
}

const TRANSPORT_INCIDENT_CATEGORIES: IncidentCategory[] = [
  'Transport & Transit',
  'Safety Advisory',
  'Infrastructure / Lighting',
  'Theft / Suspicious Activity',
  'Medical / Rescue',
];

export const TripIncidentReportModal: React.FC<TripIncidentReportModalProps> = ({
  draft,
  user,
  onSubmitIncident,
  onClose,
}) => {
  const [category, setCategory] = useState<IncidentCategory>('Transport & Transit');
  const [severity, setSeverity] = useState<SafetyAdvisory['severity']>('Advisory');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!draft) return;
    setCategory('Transport & Transit');
    setSeverity('Advisory');
    setTitle('');
    setSummary('');
    setError('');
    setSubmitted(false);
  }, [draft]);

  if (!draft) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (title.trim().length < 4 || summary.trim().length < 8) {
      setError('Please enter a brief headline (min 4 chars) and details (min 8 chars).');
      return;
    }

    if (user?.authMode === 'firebase' && !user.emailVerified) {
      setError('Please verify your email address to submit live safety reports.');
      return;
    }

    const tripContextPrefix = [
      draft.tripTitle,
      draft.bookingReference ? `Ref ${draft.bookingReference}` : null,
      draft.pickupCode ? `Code ${draft.pickupCode}` : null,
      draft.driverOrProvider ? `Operator ${draft.driverOrProvider}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    const combinedSummary = `[${tripContextPrefix}] ${summary.trim()}`.slice(0, 800);

    setSubmitting(true);
    try {
      await onSubmitIncident({
        reporterId: user?.id || 'demo-tourist-1',
        category,
        zone: (draft.zone || 'Cape Town').slice(0, 120),
        severity,
        title: title.trim().slice(0, 160),
        summary: combinedSummary,
        source:
          user?.authMode === 'firebase' && user.emailVerified
            ? `${user.name} (Verified Trip Report)`
            : `${user?.name || 'Cape Town Visitor'} (Trip Safety Report)`,
        status: 'Open',
        locationConsent: false,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit trip safety report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="trip-incident-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Report Safety Concern · Linked to Trip
            </p>
            <h2
              id="trip-incident-title"
              className="mt-0.5 font-display text-base font-bold text-[#111827] truncate"
            >
              {draft.tripTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close trip safety report modal"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {/* Emergency 10111 Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-red-950">
            <span>In immediate danger while riding?</span>
            <div className="flex items-center gap-2 font-mono font-bold">
              <a
                href="tel:10111"
                className="inline-flex items-center gap-1 rounded-lg bg-red-700 px-2.5 py-1.5 text-white hover:bg-red-800"
              >
                <PhoneCall className="h-3 w-3" aria-hidden="true" />
                Call 10111
              </a>
              <a
                href="tel:107"
                className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-white px-2.5 py-1.5 text-red-900 hover:bg-red-100"
              >
                City 107
              </a>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 space-y-0.5 text-[11px] text-slate-600">
            <p>
              <strong className="text-[#111827]">Corridor:</strong> {draft.zone}
              {draft.bookingReference ? ` · Ref: ${draft.bookingReference}` : ''}
              {draft.pickupCode ? ` · Code: ${draft.pickupCode}` : ''}
            </p>
            {draft.driverOrProvider && (
              <p>
                <strong className="text-[#111827]">Operator / Driver:</strong> {draft.driverOrProvider}
              </p>
            )}
          </div>

          {submitted ? (
            <div className="space-y-4 py-2">
              <div
                role="status"
                className="rounded-xl border border-emerald-200 bg-[#F0FDF4] p-4 text-emerald-950 space-y-1"
              >
                <p className="font-bold">Safety Concern Logged with KaapConnect Ops</p>
                <p>
                  Your report is now visible in the Safety Centre linked to{' '}
                  <strong>{draft.tripTitle}</strong> ({draft.zone}). Safety officers track it through
                  Open → Acknowledged → Resolved.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full min-h-[44px] rounded-xl bg-[#111827] px-4 py-2.5 font-semibold text-white hover:bg-[#1E293B]"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-medium text-red-800"
                >
                  {error}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="trip-inc-cat" className="block font-semibold text-slate-700">
                    Concern Category
                  </label>
                  <select
                    id="trip-inc-cat"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as IncidentCategory)}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                  >
                    {TRANSPORT_INCIDENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="trip-inc-sev" className="block font-semibold text-slate-700">
                    Urgency Level
                  </label>
                  <select
                    id="trip-inc-sev"
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as SafetyAdvisory['severity'])}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                  >
                    <option value="Nominal">Low / Feedback</option>
                    <option value="Advisory">Advisory (Needs Follow-up)</option>
                    <option value="Elevated">Elevated / Urgent Dispatch</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="trip-inc-title" className="block font-semibold text-slate-700">
                  Short Summary
                </label>
                <input
                  id="trip-inc-title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Pickup bay lighting out / Route detour question"
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="trip-inc-desc" className="block font-semibold text-slate-700">
                  What happened?
                </label>
                <textarea
                  id="trip-inc-desc"
                  rows={3}
                  required
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Describe pickup location, timing, vehicle details, or road condition..."
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[#111827] px-4 py-2 font-semibold text-white hover:bg-[#1E293B] disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  {submitting ? 'Submitting...' : 'Submit Linked Safety Report'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
