import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock, QrCode, RefreshCw, ShieldAlert, Wifi } from 'lucide-react';
import { DemoDataNotice } from '@/src/components/common/DemoDataNotice';
import { StatusText } from '@/src/components/common/StatusText';
import type { BookingItem, CheckInSession, DemoUser } from '@/src/types/app';
import { isAwaitingBookingStatus } from '@/src/utils/bookingCalculations';

interface DigitalPassPageProps {
  user: DemoUser;
  bookings: BookingItem[];
  checkIns?: CheckInSession[];
  onSyncPassId?: (nextPassId: string) => Promise<void> | void;
}

const OFFLINE_PASS_STORAGE_KEY = 'capesafe_offline_pass_v1';

export const DigitalPassPage: React.FC<DigitalPassPageProps> = ({
  user,
  bookings,
  checkIns = [],
  onSyncPassId,
}) => {
  const [offlineSavedAt, setOfflineSavedAt] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem(OFFLINE_PASS_STORAGE_KEY);
      if (!raw) return 'Cached';
      const parsed = JSON.parse(raw) as { savedAt?: string };
      return parsed.savedAt || 'Cached';
    } catch {
      return 'Cached';
    }
  });
  const [syncingPass, setSyncingPass] = useState(false);
  const [passFeedback, setPassFeedback] = useState('');
  const [passError, setPassError] = useState('');

  const passCode = user.passId || 'CS360-884210';

  // Strictly distinguish Confirmed bookings from Pending Verification / Awaiting Provider Confirmation
  const confirmedBookings = bookings.filter((b) => b.status === 'Confirmed');
  const pendingBookings = bookings.filter((b) => isAwaitingBookingStatus(b.status));
  const activeCheckIn = checkIns.find((c) => c.status === 'Active');

  const validityWindow = useMemo(() => {
    if (confirmedBookings.length === 0) return 'Active Tourist Credential · No fixed bookings yet';
    const starts = confirmedBookings.map((b) => b.date).filter(Boolean).sort();
    const ends = confirmedBookings
      .map((b) => b.endDate || b.date)
      .filter(Boolean)
      .sort();
    const first = starts[0] || '2026-11-15';
    const last = ends[ends.length - 1] || first;
    return `${first} — ${last}`;
  }, [confirmedBookings]);

  // Deterministic pseudo-matrix pattern derived from passCode for visual QR
  const qrCells = useMemo(() => {
    const cells: Array<{ x: number; y: number; color: string }> = [];
    let seed = 0;
    for (let i = 0; i < passCode.length; i += 1) {
      seed = (seed * 31 + passCode.charCodeAt(i)) % 9973;
    }
    for (let row = 0; row < 21; row += 1) {
      for (let col = 0; col < 21; col += 1) {
        const inTopLeft = row < 8 && col < 8;
        const inTopRight = row < 8 && col > 12;
        const inBottomLeft = row > 12 && col < 8;
        if (inTopLeft || inTopRight || inBottomLeft) continue;
        const hash = (seed + row * 17 + col * 37) % 11;
        if (hash < 4) {
          cells.push({
            x: col,
            y: row,
            color: hash === 0 ? '#0D9488' : '#0B1F3A',
          });
        }
      }
    }
    return cells;
  }, [passCode]);

  const handleSaveOfflineCopy = () => {
    const nowLabel = new Date().toLocaleTimeString('en-ZA', {
      hour: '2-digit',
      minute: '2-digit',
    });
    try {
      localStorage.setItem(
        OFFLINE_PASS_STORAGE_KEY,
        JSON.stringify({
          passCode,
          holder: user.name,
          validityWindow,
          confirmedIds: confirmedBookings.map((b) => b.id),
          savedAt: `${nowLabel} SAST`,
        })
      );
    } catch {
      // ignore storage errors
    }
    setOfflineSavedAt(`${nowLabel} SAST`);
  };

  const handleRegeneratePassId = async () => {
    if (!onSyncPassId) return;
    setPassFeedback('');
    setPassError('');
    setSyncingPass(true);
    try {
      const randomNum = Math.floor(100000 + Math.random() * 899999);
      const nextCode = `CS360-${randomNum}`;
      await onSyncPassId(nextCode);
      setPassFeedback(`Updated pass code to ${nextCode}.`);
    } catch (err) {
      setPassError(err instanceof Error ? err.message : 'Unable to rotate pass code.');
    } finally {
      setSyncingPass(false);
    }
  };

  return (
    <div className="space-y-6">
      <DemoDataNotice
        scope={
          user.authMode === 'firebase' && user.emailVerified
            ? 'Live CapeSafe Digital Tourist Pass synced with your confirmed Firebase reservations & PWA offline cache'
            : 'Digital Tourist Pass preview — QR credential & confirmed entitlements cached for offline PWA inspection'
        }
      />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Pass Card */}
        <section className="rounded-xl border border-slate-200 bg-[#0B1F3A] p-6 text-white lg:col-span-6">
          <div className="flex items-start justify-between border-b border-white/15 pb-4">
            <div>
              <p className="text-xs font-semibold text-teal-300">CapeSafe Connect 360</p>
              <h1 className="mt-1 font-display text-2xl font-bold">Digital Tourist Pass</h1>
            </div>
            <span className="font-mono text-xs text-teal-300 tabular-nums">{passCode}</span>
          </div>

          <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row">
            <div className="rounded-xl bg-white p-3.5 shrink-0">
              <svg
                role="img"
                aria-label={`QR verification code ${passCode}`}
                width="132"
                height="132"
                viewBox="0 0 21 21"
                fill="none"
              >
                <rect width="21" height="21" fill="#FFFFFF" />
                <rect x="1" y="1" width="6" height="6" stroke="#0B1F3A" strokeWidth="1.5" />
                <rect x="3" y="3" width="2" height="2" fill="#0B1F3A" />
                <rect x="14" y="1" width="6" height="6" stroke="#0B1F3A" strokeWidth="1.5" />
                <rect x="16" y="3" width="2" height="2" fill="#0B1F3A" />
                <rect x="1" y="14" width="6" height="6" stroke="#0B1F3A" strokeWidth="1.5" />
                <rect x="3" y="16" width="2" height="2" fill="#0B1F3A" />
                {qrCells.map((c) => (
                  <rect
                    key={`${c.x}-${c.y}`}
                    x={c.x}
                    y={c.y}
                    width="1"
                    height="1"
                    fill={c.color}
                  />
                ))}
              </svg>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <p className="text-slate-400">Pass Holder</p>
                <p className="font-display text-base font-semibold text-white">{user.name}</p>
              </div>
              <div>
                <p className="text-slate-400">Validity Window (From Confirmed Bookings)</p>
                <p className="font-mono text-white tabular-nums">{validityWindow}</p>
              </div>
              <div>
                <p className="text-slate-400">Trail Safety Status</p>
                <p className="font-mono text-teal-300">
                  {activeCheckIn
                    ? `Active Check-In: ${activeCheckIn.route}`
                    : 'No overdue safety timers'}
                </p>
              </div>
              <div className="pt-1">
                <StatusText
                  label={
                    offlineSavedAt
                      ? `Cached Offline (${offlineSavedAt})`
                      : 'Online Sync Only'
                  }
                  tone="nominal"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-4">
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
              <Wifi className="h-3.5 w-3.5 text-teal-300" aria-hidden="true" />
              Offline PWA snapshot ready
            </span>
            <div className="flex flex-wrap gap-2">
              {onSyncPassId && (
                <button
                  type="button"
                  disabled={syncingPass}
                  onClick={handleRegeneratePassId}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-60 transition-colors whitespace-nowrap"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  {syncingPass ? 'Syncing...' : 'Rotate Pass Code'}
                </button>
              )}
              <button
                type="button"
                onClick={handleSaveOfflineCopy}
                className="rounded-lg bg-[#14B8A6] px-3.5 py-2 text-xs font-semibold text-[#071529] hover:bg-teal-300 transition-colors whitespace-nowrap"
              >
                Save / Refresh Offline Copy
              </button>
            </div>
          </div>
          {passFeedback && (
            <p role="status" className="mt-3 text-xs font-medium text-teal-300">
              {passFeedback}
            </p>
          )}
          {passError && (
            <p role="alert" className="mt-3 text-xs font-medium text-red-300">
              {passError}
            </p>
          )}
        </section>

        {/* Confirmed Booking Pass Entitlements */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-[#0D9488]" aria-hidden="true" />
              <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                Verified Pass Entitlements ({confirmedBookings.length})
              </h2>
            </div>
            <span className="font-mono text-[11px] text-[#15803D] font-semibold">
              Provider Confirmed Only
            </span>
          </div>

          {confirmedBookings.length === 0 ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
              No confirmed bookings are linked to your pass yet. Confirmed accommodation, transport, and activity reservations will automatically activate here.
            </p>
          ) : (
            <div className="divide-y divide-slate-200 text-sm">
              {confirmedBookings.map((bk) => (
                <div
                  key={bk.id}
                  className="flex items-start justify-between gap-3 py-3 first:pt-1"
                >
                  <div className="flex items-start gap-2">
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 text-[#15803D] shrink-0"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="font-semibold text-[#0B1F3A]">{bk.title}</p>
                      <p className="text-xs text-slate-500">
                        {bk.offeringType || bk.category} · {bk.providerName}
                        {bk.bookingReference ? ` · ${bk.bookingReference}` : ''}
                      </p>
                      {bk.paymentStatus && (
                        <p className="text-[11px] text-slate-600">
                          Payment: <strong>{bk.paymentStatus}</strong>
                          {typeof bk.balanceDueInPersonZar === 'number' &&
                          bk.balanceDueInPersonZar > 0 &&
                          bk.paymentStatus !== 'Paid'
                            ? ` · R ${bk.balanceDueInPersonZar.toLocaleString('en-ZA')} due in person`
                            : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right font-mono text-xs text-slate-700 whitespace-nowrap tabular-nums">
                    <p>{bk.date}</p>
                    {bk.endDate && <p className="text-[11px] text-slate-500">to {bk.endDate}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {pendingBookings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 space-y-1.5">
              <p className="flex items-center gap-1.5 font-semibold">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {pendingBookings.length} Reservation(s) Awaiting Provider Confirmation
              </p>
              <p className="text-[11px]">
                Excluded from active QR entry until confirmed by the tourism provider:
              </p>
              <ul className="list-disc pl-4 text-[11px]">
                {pendingBookings.map((p) => (
                  <li key={p.id}>
                    {p.title} ({p.date}) — {p.status}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {user.emergencyContact && (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700">
              <ShieldAlert className="h-4 w-4 text-[#0D9488] shrink-0" aria-hidden="true" />
              <span>
                Pass Emergency Contact: <strong className="text-[#0B1F3A]">{user.emergencyContact}</strong>
              </span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
