import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  BellRing,
  CheckCircle2,
  Clock,
  MapPin,
  Navigation,
  Play,
  Plus,
  Timer,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { DemoDataNotice } from '@/src/components/common/DemoDataNotice';
import { StatusText } from '@/src/components/common/StatusText';
import type { CheckInSession, DemoUser, TrustedContact } from '@/src/types/app';

interface CheckInPageProps {
  user: DemoUser;
  checkIns: CheckInSession[];
  trustedContacts: TrustedContact[];
  onStartCheckIn: (session: Omit<CheckInSession, 'id' | 'dataOrigin'>) => Promise<void> | void;
  onExtendCheckIn: (id: string, nextExpectedReturn: string, nextExpectedReturnIso?: string) => Promise<void> | void;
  onTriggerCheckInReminder: (session: CheckInSession) => Promise<void> | void;
  onCompleteCheckIn: (id: string) => Promise<void> | void;
  onAddTrustedContact: (
    contact: Omit<TrustedContact, 'id' | 'uid' | 'dataOrigin'>
  ) => Promise<void> | void;
  onDeleteTrustedContact: (id: string) => Promise<void> | void;
}

function formatSastTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} SAST`;
}

export const CheckInPage: React.FC<CheckInPageProps> = ({
  user,
  checkIns,
  trustedContacts,
  onStartCheckIn,
  onExtendCheckIn,
  onTriggerCheckInReminder,
  onCompleteCheckIn,
  onAddTrustedContact,
  onDeleteTrustedContact,
}) => {
  const [route, setRoute] = useState("Lion's Head Spiral Trail");
  const [returnMode, setReturnMode] = useState<'duration' | 'exact'>('duration');
  const [durationHours, setDurationHours] = useState('2.5');
  const [exactReturnTime, setExactReturnTime] = useState('17:30');
  const [reminderMinutes, setReminderMinutes] = useState(30);
  const [partySize, setPartySize] = useState(2);
  const [emergencyContact, setEmergencyContact] = useState(
    user.emergencyContact || trustedContacts[0]?.phone || '+27 82 555 0148'
  );
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>(() =>
    trustedContacts.filter((c) => c.notifyByDefault).map((c) => c.id)
  );

  // Consented trailhead GPS state
  const [locationConsent, setLocationConsent] = useState(false);
  const [trailheadCoords, setTrailheadCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState('');

  // Trusted Contact creation form state
  const [tcName, setTcName] = useState('');
  const [tcRelationship, setTcRelationship] = useState('Family / Partner');
  const [tcPhone, setTcPhone] = useState('');
  const [tcEmail, setTcEmail] = useState('');
  const [tcFeedback, setTcFeedback] = useState('');
  const [checkInError, setCheckInError] = useState('');
  const [startingCheckIn, setStartingCheckIn] = useState(false);
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const triggeredReminderIdsRef = useRef<Set<string>>(new Set());

  // Live timer tick for active countdown & reminders
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [activeReminderBanner, setActiveReminderBanner] = useState<string | null>(null);
  const [notifPermission, setNotifPermission] = useState<string>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 15000);
    return () => clearInterval(interval);
  }, []);

  // Sync default selected contacts when trustedContacts loads
  useEffect(() => {
    setSelectedContactIds((prev) => {
      if (prev.length > 0) return prev;
      return trustedContacts.filter((c) => c.notifyByDefault).map((c) => c.id);
    });
  }, [trustedContacts]);

  // Monitor active check-ins for reminder window
  useEffect(() => {
    checkIns.forEach((session) => {
      if (
        session.status !== 'Active' ||
        session.reminderSent ||
        !session.expectedReturnIso ||
        triggeredReminderIdsRef.current.has(session.id)
      ) {
        return;
      }
      const dueMs = Date.parse(session.expectedReturnIso);
      if (Number.isNaN(dueMs)) return;
      const leadMs = (session.reminderMinutes ?? 30) * 60 * 1000;
      if (nowMs >= dueMs - leadMs) {
        triggeredReminderIdsRef.current.add(session.id);
        setActiveReminderBanner(
          `Reminder: Check-in for "${session.route}" is due at ${session.expectedReturn}. Confirm Safe Return or extend by +30 min.`
        );
        if (
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          try {
            new Notification('CapeSafe 360 Check-In Reminder', {
              body: `${session.route} expected return at ${session.expectedReturn}.`,
            });
          } catch {
            // Ignore restricted iframe notification error
          }
        }
        void onTriggerCheckInReminder(session);
      }
    });
  }, [nowMs, checkIns, onTriggerCheckInReminder]);

  const handleRequestNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotifPermission('unsupported');
      return;
    }
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
  };

  const handleCaptureTrailheadGps = () => {
    setGpsStatus('');
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatus('Geolocation unavailable in this browser.');
      return;
    }
    setGpsStatus('Capturing trailhead GPS...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setTrailheadCoords({
          lat: Number(pos.coords.latitude.toFixed(5)),
          lng: Number(pos.coords.longitude.toFixed(5)),
        });
        setLocationConsent(true);
        setGpsStatus(
          `Trailhead GPS ready: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`
        );
      },
      () => setGpsStatus('GPS permission denied; check-in will proceed without coordinates.'),
      { enableHighAccuracy: true, timeout: 7000 }
    );
  };

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckInError('');
    setStartingCheckIn(true);
    try {
      const now = new Date();
      let due: Date;
      if (returnMode === 'duration') {
        due = new Date(now.getTime() + Number(durationHours) * 60 * 60 * 1000);
      } else {
        const [hh, mm] = exactReturnTime.split(':').map((v) => Number(v));
        due = new Date(now);
        due.setHours(hh || 17, mm || 30, 0, 0);
        if (due.getTime() <= now.getTime()) {
          due.setDate(due.getDate() + 1);
        }
      }

      const chosenContacts = trustedContacts.filter((c) => selectedContactIds.includes(c.id));
      const contactsSummary = chosenContacts.map((c) => `${c.name} (${c.phone})`).join(', ');
      const shareCoords = Boolean(locationConsent && trailheadCoords);

      await onStartCheckIn({
        touristName: user.name,
        route,
        startedAt: formatSastTime(now),
        expectedReturn: formatSastTime(due),
        expectedReturnIso: due.toISOString(),
        reminderMinutes,
        reminderSent: false,
        status: 'Active',
        emergencyContact: emergencyContact.trim() || chosenContacts[0]?.phone || '+27 82 555 0148',
        ...(contactsSummary ? { trustedContactsSummary: contactsSummary.slice(0, 300) } : {}),
        partySize,
        locationConsent: shareCoords,
        ...(shareCoords && trailheadCoords
          ? { sharedLat: trailheadCoords.lat, sharedLng: trailheadCoords.lng }
          : {}),
      });
    } catch (err) {
      setCheckInError(err instanceof Error ? err.message : 'Unable to start check-in timer.');
    } finally {
      setStartingCheckIn(false);
    }
  };

  const handleExtend = async (session: CheckInSession) => {
    setCheckInError('');
    setBusySessionId(session.id);
    try {
      const baseMs =
        session.expectedReturnIso && !Number.isNaN(Date.parse(session.expectedReturnIso))
          ? Date.parse(session.expectedReturnIso)
          : Date.now() + 30 * 60 * 1000;
      const nextDue = new Date(baseMs + 30 * 60 * 1000);
      triggeredReminderIdsRef.current.delete(session.id);
      await onExtendCheckIn(session.id, formatSastTime(nextDue), nextDue.toISOString());
    } catch (err) {
      setCheckInError(err instanceof Error ? err.message : 'Unable to extend check-in window.');
    } finally {
      setBusySessionId(null);
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setTcFeedback('');
    setCheckInError('');
    if (tcName.trim().length < 2 || tcPhone.trim().length < 4) {
      setCheckInError('Enter contact name (min 2 chars) and phone number (min 4 chars).');
      return;
    }
    try {
      await onAddTrustedContact({
        name: tcName.trim(),
        relationship: tcRelationship.trim() || 'Trusted Contact',
        phone: tcPhone.trim(),
        ...(tcEmail.trim() ? { email: tcEmail.trim() } : {}),
        notifyByDefault: true,
      });
      setTcName('');
      setTcPhone('');
      setTcEmail('');
      setTcFeedback('Trusted contact saved.');
    } catch (err) {
      setCheckInError(err instanceof Error ? err.message : 'Unable to save trusted contact.');
    }
  };

  const toggleContactSelection = (id: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const getCountdownLabel = (session: CheckInSession): string | null => {
    if (session.status !== 'Active' || !session.expectedReturnIso) return null;
    const dueMs = Date.parse(session.expectedReturnIso);
    if (Number.isNaN(dueMs)) return null;
    const diffMin = Math.round((dueMs - nowMs) / 60000);
    if (diffMin <= 0) return `Overdue by ${Math.abs(diffMin)}m`;
    const hrs = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    return hrs > 0 ? `${hrs}h ${mins}m remaining` : `${mins}m remaining`;
  };

  return (
    <div className="space-y-6">
      <DemoDataNotice scope="Pre-loaded check-ins & contacts are demo data; live sessions sync to Firestore and trigger in-app & browser reminders (no automated SMS dispatch)" />

      {activeReminderBanner && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-2 font-semibold">
            <BellRing className="h-4 w-4 text-amber-700 shrink-0" aria-hidden="true" />
            <span>{activeReminderBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveReminderBanner(null)}
            className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 self-start sm:self-auto"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Start New Timed Check-In */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5 space-y-5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Timer className="h-5 w-5 text-[#1D4ED8]" aria-hidden="true" />
                <h1 className="font-display text-xl font-bold text-[#111827]">
                  Start Timed Tourist Check-In
                </h1>
              </div>
              {notifPermission !== 'granted' && notifPermission !== 'unsupported' && (
                <button
                  type="button"
                  onClick={handleRequestNotifications}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-[#111827] hover:bg-slate-100"
                >
                  <Bell className="h-3 w-3 text-[#1D4ED8]" aria-hidden="true" />
                  Enable Alerts
                </button>
              )}
            </div>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
              Log your route, expected return time, reminder alert lead time, and trusted contacts before entering mountain trails or remote coastal paths.
            </p>
          </div>

          <form onSubmit={handleStart} className="space-y-4">
            <div>
              <label htmlFor="chk-route" className="block text-xs font-semibold text-slate-700">
                Trail or Excursion Route
              </label>
              <select
                id="chk-route"
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
              >
                <option>Lion&apos;s Head Spiral Trail</option>
                <option>Platteklip Gorge Ascent</option>
                <option>Kirstenbosch Contour Path</option>
                <option>Cape Point Lighthouse Coastal Walk</option>
                <option>Sea Point to Bantry Bay Evening Walk</option>
              </select>
            </div>

            {/* Expected Return Mode */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Expected Return Time</span>
                <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-[11px] font-semibold">
                  <button
                    type="button"
                    aria-pressed={returnMode === 'duration'}
                    onClick={() => setReturnMode('duration')}
                    className={`rounded px-2 py-0.5 ${
                      returnMode === 'duration' ? 'bg-[#111827] text-white' : 'text-slate-600'
                    }`}
                  >
                    Duration
                  </button>
                  <button
                    type="button"
                    aria-pressed={returnMode === 'exact'}
                    onClick={() => setReturnMode('exact')}
                    className={`rounded px-2 py-0.5 ${
                      returnMode === 'exact' ? 'bg-[#111827] text-white' : 'text-slate-600'
                    }`}
                  >
                    Exact Time
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {returnMode === 'duration' ? (
                  <div>
                    <label htmlFor="chk-duration" className="block text-[11px] text-slate-500">
                      Window
                    </label>
                    <select
                      id="chk-duration"
                      value={durationHours}
                      onChange={(e) => setDurationHours(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                    >
                      <option value="1.5">1.5 hours</option>
                      <option value="2.5">2.5 hours</option>
                      <option value="4">4.0 hours</option>
                      <option value="6">6.0 hours</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label htmlFor="chk-exact-time" className="block text-[11px] text-slate-500">
                      Return Clock (SAST)
                    </label>
                    <input
                      id="chk-exact-time"
                      type="time"
                      value={exactReturnTime}
                      onChange={(e) => setExactReturnTime(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="chk-reminder" className="block text-[11px] text-slate-500">
                    Reminder Lead
                  </label>
                  <select
                    id="chk-reminder"
                    value={reminderMinutes}
                    onChange={(e) => setReminderMinutes(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                  >
                    <option value={15}>15 min before</option>
                    <option value={30}>30 min before</option>
                    <option value={60}>60 min before</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="chk-party" className="block text-xs font-semibold text-slate-700">
                  Party Size
                </label>
                <input
                  id="chk-party"
                  type="number"
                  min={1}
                  max={20}
                  value={partySize}
                  onChange={(e) => setPartySize(Number(e.target.value) || 1)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="chk-ice" className="block text-xs font-semibold text-slate-700">
                  Primary Emergency Contact
                </label>
                <input
                  id="chk-ice"
                  type="text"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>
            </div>

            {/* Trusted Contacts Selection */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
              <p className="text-xs font-semibold text-[#111827]">
                Notify Trusted Contacts for This Session
              </p>
              {trustedContacts.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  Add trusted contacts on the right to attach them to future check-ins.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {trustedContacts.map((tc) => (
                    <label
                      key={tc.id}
                      className="flex items-center justify-between gap-2 text-xs text-slate-700 cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedContactIds.includes(tc.id)}
                          onChange={() => toggleContactSelection(tc.id)}
                          className="rounded border-slate-300 text-[#1D4ED8]"
                        />
                        <span className="font-medium text-[#111827]">{tc.name}</span>
                        <span className="text-slate-500">({tc.relationship})</span>
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">{tc.phone}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Optional Consented Trailhead Location */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={locationConsent}
                    onChange={(e) => setLocationConsent(e.target.checked)}
                    className="rounded border-slate-300 text-[#1D4ED8]"
                  />
                  <span>Share trailhead GPS with Safety Ops</span>
                </label>
                <button
                  type="button"
                  onClick={handleCaptureTrailheadGps}
                  className="inline-flex items-center gap-1 rounded border border-[#1D4ED8] bg-white px-2 py-1 text-[11px] font-semibold text-[#1E40AF] hover:bg-[#EFF6FF]"
                >
                  <Navigation className="h-3 w-3" aria-hidden="true" />
                  Capture GPS
                </button>
              </div>
              {gpsStatus && <p className="font-mono text-[11px] text-slate-600">{gpsStatus}</p>}
            </div>

            {checkInError && (
              <p role="alert" className="text-xs font-medium text-red-700">
                {checkInError}
              </p>
            )}

            <button
              type="submit"
              disabled={startingCheckIn}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] py-2.5 text-sm font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60 transition-colors"
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              {startingCheckIn ? 'Starting Timer...' : 'Activate Check-In Timer'}
            </button>
          </form>
        </section>

        {/* Active & Recent Check-In Sessions + Trusted Contacts Manager */}
        <div className="lg:col-span-7 space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="font-display text-base font-bold text-[#111827]">
                Active &amp; Recent Check-In Log
              </h2>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {checkIns.length} sessions
              </span>
            </div>

            <div className="divide-y divide-slate-200">
              {checkIns.map((session) => {
                const countdown = getCountdownLabel(session);
                return (
                  <div
                    key={session.id}
                    className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[#111827]">{session.route}</span>
                        <StatusText
                          label={session.status}
                          tone={
                            session.status === 'Completed'
                              ? 'nominal'
                              : session.status === 'Overdue'
                              ? 'alert'
                              : 'advisory'
                          }
                        />
                        {countdown && (
                          <span className="rounded bg-[#EFF6FF] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#1E40AF]">
                            {countdown}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600">
                        {session.touristName} · Party of {session.partySize}
                        {session.reminderMinutes
                          ? ` · Reminder ${session.reminderMinutes}m prior`
                          : ''}
                      </p>
                      <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                        Started {session.startedAt} · Due {session.expectedReturn} · ICE{' '}
                        {session.emergencyContact}
                      </p>
                      {session.trustedContactsSummary && (
                        <p className="text-[11px] text-slate-600">
                          <strong className="text-[#111827]">Trusted Contacts:</strong>{' '}
                          {session.trustedContactsSummary}
                        </p>
                      )}
                      {session.locationConsent &&
                        typeof session.sharedLat === 'number' &&
                        typeof session.sharedLng === 'number' && (
                          <p className="inline-flex items-center gap-1 font-mono text-[11px] text-[#1E40AF]">
                            <MapPin className="h-3 w-3" aria-hidden="true" />
                            Trailhead GPS: {session.sharedLat.toFixed(4)}, {session.sharedLng.toFixed(4)}
                          </p>
                        )}
                    </div>

                    {session.status !== 'Completed' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={busySessionId === session.id}
                          onClick={() => handleExtend(session)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-[#111827] hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap"
                        >
                          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                          +30 min
                        </button>
                        <button
                          type="button"
                          disabled={busySessionId === session.id}
                          onClick={async () => {
                            setCheckInError('');
                            setBusySessionId(session.id);
                            try {
                              await onCompleteCheckIn(session.id);
                            } catch (err) {
                              setCheckInError(
                                err instanceof Error ? err.message : 'Unable to mark safe return.'
                              );
                            } finally {
                              setBusySessionId(null);
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#15803D] px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800 disabled:opacity-60 whitespace-nowrap"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Safe Return
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Trusted Contacts Directory & Form */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
                <h2 className="font-display text-base font-bold text-[#111827]">
                  Trusted Emergency Contacts
                </h2>
              </div>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {trustedContacts.length} saved
              </span>
            </div>

            <div className="divide-y divide-slate-200">
              {trustedContacts.map((tc) => (
                <div key={tc.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                  <div>
                    <p className="font-semibold text-[#111827]">
                      {tc.name}{' '}
                      <span className="font-normal text-slate-500">· {tc.relationship}</span>
                    </p>
                    <p className="font-mono text-[11px] text-slate-600">
                      {tc.phone}
                      {tc.email ? ` · ${tc.email}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      setCheckInError('');
                      try {
                        await onDeleteTrustedContact(tc.id);
                      } catch (err) {
                        setCheckInError(
                          err instanceof Error ? err.message : 'Unable to remove trusted contact.'
                        );
                      }
                    }}
                    aria-label={`Remove ${tc.name}`}
                    className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddContact} className="grid gap-2.5 border-t border-slate-200 pt-4 sm:grid-cols-12">
              <input
                type="text"
                aria-label="Contact full name"
                value={tcName}
                onChange={(e) => setTcName(e.target.value)}
                placeholder="Contact full name"
                className="sm:col-span-3 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />
              <input
                type="text"
                aria-label="Relationship"
                value={tcRelationship}
                onChange={(e) => setTcRelationship(e.target.value)}
                placeholder="Relationship"
                className="sm:col-span-3 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />
              <input
                type="text"
                aria-label="Contact phone number"
                value={tcPhone}
                onChange={(e) => setTcPhone(e.target.value)}
                placeholder="+27 82 ..."
                className="sm:col-span-3 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />
              <button
                type="submit"
                className="sm:col-span-3 inline-flex items-center justify-center gap-1 rounded-lg bg-[#111827] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1E293B]"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add Contact
              </button>
            </form>
            {tcFeedback && (
              <p role="status" className="text-xs font-medium text-[#15803D]">
                {tcFeedback}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
