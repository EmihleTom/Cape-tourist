import React, { useState } from 'react';
import {
  BedDouble,
  Bus,
  CalendarCheck,
  CheckSquare,
  Compass,
  Layers,
  Plus,
  Square,
  Trash2,
} from 'lucide-react';
import { DemoDataNotice } from '@/src/components/common/DemoDataNotice';
import { StatusText } from '@/src/components/common/StatusText';
import type {
  BookingItem,
  DemoUser,
  NavSectionId,
  OfferingType,
  TripActivity,
} from '@/src/types/app';
import {
  buildItineraryFromConfirmedBooking,
  isAwaitingBookingStatus,
} from '@/src/utils/bookingCalculations';

interface MyTripsPageProps {
  user: DemoUser;
  activities: TripActivity[];
  bookings: BookingItem[];
  onToggleActivity: (id: string) => Promise<void> | void;
  onAddActivity: (
    activity: Omit<TripActivity, 'id' | 'completed' | 'dataOrigin'>
  ) => Promise<void> | void;
  onDeleteActivity?: (id: string) => Promise<void> | void;
  onNavigate?: (section: NavSectionId) => void;
}

export const MyTripsPage: React.FC<MyTripsPageProps> = ({
  user,
  activities,
  bookings,
  onToggleActivity,
  onAddActivity,
  onDeleteActivity,
  onNavigate,
}) => {
  const [title, setTitle] = useState('');
  const [zone, setZone] = useState('City Bowl');
  const [time, setTime] = useState('14:00');
  const [day, setDay] = useState(1);
  const [itemType, setItemType] = useState<OfferingType>('Activity');
  const [typeFilter, setTypeFilter] = useState<'All' | OfferingType>('All');
  const [combining, setCombining] = useState(false);
  const [submittingStop, setSubmittingStop] = useState(false);
  const [combineFeedback, setCombineFeedback] = useState('');
  const [tripError, setTripError] = useState('');

  // Only Confirmed bookings can be locked into a combined trip itinerary
  const confirmedBookings = bookings.filter((b) => b.status === 'Confirmed');
  const pendingBookings = bookings.filter((b) => isAwaitingBookingStatus(b.status));

  const linkedBookingIds = new Set(activities.map((a) => a.bookingId).filter(Boolean));
  const unlinkedConfirmed = confirmedBookings.filter((b) => !linkedBookingIds.has(b.id));

  const confirmedAccommodation = confirmedBookings.filter(
    (b) => (b.offeringType || 'Activity') === 'Accommodation'
  );
  const confirmedTransport = confirmedBookings.filter(
    (b) => (b.offeringType || 'Activity') === 'Transport'
  );
  const confirmedActivities = confirmedBookings.filter(
    (b) => (b.offeringType || 'Activity') === 'Activity'
  );

  const days = Array.from(new Set(activities.map((a) => a.day))).sort((a, b) => a - b);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setTripError('');
    setCombineFeedback('');
    if (title.trim().length < 3) {
      setTripError('Enter a stop title (at least 3 characters) to add it to your itinerary.');
      return;
    }
    setSubmittingStop(true);
    try {
      await onAddActivity({
        day,
        dayLabel: `Day ${day} · Cape Peninsula Itinerary`,
        time,
        title: title.trim(),
        zone: zone.trim() || 'City Bowl',
        itemType,
        transportNote:
          itemType === 'Transport'
            ? 'Scheduled transit departure'
            : itemType === 'Accommodation'
            ? 'Check-in / hospitality base'
            : 'Verified shuttle or MyCiTi route',
        safetyNote: 'Daylight corridor recommended',
      });
      setTitle('');
      setCombineFeedback(`Added "${title.trim()}" to Day ${day}.`);
    } catch (err) {
      setTripError(err instanceof Error ? err.message : 'Unable to add itinerary stop.');
    } finally {
      setSubmittingStop(false);
    }
  };

  const handleCombineConfirmed = async () => {
    if (unlinkedConfirmed.length === 0) return;
    setCombining(true);
    setCombineFeedback('');
    setTripError('');
    try {
      const sorted = [...unlinkedConfirmed].sort((a, b) => a.date.localeCompare(b.date));
      const baseDate = sorted[0]?.date;
      const baseMs = baseDate ? Date.parse(`${baseDate}T00:00:00Z`) : NaN;

      for (const bk of sorted) {
        const bkMs = bk.date ? Date.parse(`${bk.date}T00:00:00Z`) : NaN;
        const computedDay =
          Number.isFinite(baseMs) && Number.isFinite(bkMs)
            ? Math.max(1, Math.min(30, Math.round((bkMs - baseMs) / 86400000) + 1))
            : 1;
        const payload = buildItineraryFromConfirmedBooking(bk, computedDay);
        await onAddActivity(payload);
      }
      setCombineFeedback(
        `Combined ${sorted.length} confirmed booking(s) (Accommodation, Transport & Activities) into your chronological daily itinerary.`
      );
    } catch (err) {
      setTripError(err instanceof Error ? err.message : 'Unable to combine confirmed bookings.');
    } finally {
      setCombining(false);
    }
  };

  const handleCombineSingleBooking = async (booking: BookingItem, targetDay: number) => {
    setTripError('');
    setCombineFeedback('');
    try {
      const payload = buildItineraryFromConfirmedBooking(booking, targetDay);
      await onAddActivity(payload);
      setCombineFeedback(`Added "${booking.title}" to Day ${targetDay}.`);
    } catch (err) {
      setTripError(err instanceof Error ? err.message : 'Unable to add confirmed booking to trip.');
    }
  };

  return (
    <div className="space-y-6">
      <DemoDataNotice
        scope={
          user.authMode === 'firebase' && user.emailVerified
            ? 'Live Firestore My Trips Planner — confirmed Accommodation, Transport & Activity bookings sync into one daily itinerary'
            : 'Interactive My Trips workspace with sample Cape Town itinerary & confirmed booking combiner'
        }
      />

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h1 className="font-display text-2xl font-bold text-[#111827]">
          My Trips &amp; Daily Travel Itinerary
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Combine confirmed accommodation, transport, and activity reservations with custom Cape Town stops into one schedule.
        </p>
      </div>

      {/* My Trips Overview KPI Strip */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Confirmed Stay</span>
            <BedDouble className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
          </div>
          <p className="mt-1.5 font-display text-2xl font-bold text-[#111827] tabular-nums">
            {confirmedAccommodation.length}
          </p>
          <p className="text-[11px] text-slate-500">Accommodation bookings</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Confirmed Transport</span>
            <Bus className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
          </div>
          <p className="mt-1.5 font-display text-2xl font-bold text-[#111827] tabular-nums">
            {confirmedTransport.length}
          </p>
          <p className="text-[11px] text-slate-500">Shuttles &amp; transfers</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Confirmed Activities</span>
            <Compass className="h-4 w-4 text-[#15803D]" aria-hidden="true" />
          </div>
          <p className="mt-1.5 font-display text-2xl font-bold text-[#111827] tabular-nums">
            {confirmedActivities.length}
          </p>
          <p className="text-[11px] text-slate-500">Tours &amp; excursions</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Awaiting Provider</span>
            <CalendarCheck className="h-4 w-4 text-amber-700" aria-hidden="true" />
          </div>
          <p className="mt-1.5 font-display text-2xl font-bold text-[#111827] tabular-nums">
            {pendingBookings.length}
          </p>
          <p className="text-[11px] text-slate-500">Awaiting provider confirmation (not locked)</p>
        </div>
      </section>

      {/* Combine Confirmed Accommodation, Transport & Activity Bookings */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
              <h2 className="font-display text-base font-bold text-[#111827]">
                Combine Confirmed Bookings into One Itinerary
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-600">
              Only provider-confirmed bookings appear here. Pending bookings remain on Smart Bookings until confirmed.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {unlinkedConfirmed.length > 0 && (
              <button
                type="button"
                disabled={combining}
                onClick={handleCombineConfirmed}
                className="rounded-lg bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60 transition-colors whitespace-nowrap"
              >
                {combining
                  ? 'Combining...'
                  : `Combine All (${unlinkedConfirmed.length}) Confirmed`}
              </button>
            )}
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('bookings')}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#111827] hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                Manage Bookings
              </button>
            )}
          </div>
        </div>

        {combineFeedback && (
          <p role="status" className="text-xs font-medium text-[#15803D]">
            {combineFeedback}
          </p>
        )}
        {tripError && (
          <p role="alert" className="text-xs font-medium text-red-700">
            {tripError}
          </p>
        )}

        {unlinkedConfirmed.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            All {confirmedBookings.length} confirmed accommodation, transport, and activity booking(s) are already included in your daily itinerary below.
          </p>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {unlinkedConfirmed.map((bk) => (
              <div
                key={bk.id}
                className="flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[#1D4ED8]">
                      {bk.offeringType || 'Activity'}
                    </span>
                    <span className="font-mono text-[11px] text-slate-600 tabular-nums">
                      {bk.date} {bk.timeSlot}
                    </span>
                  </div>
                  <p className="font-semibold text-[#111827]">{bk.title}</p>
                  <p className="text-[11px] text-slate-500">
                    {bk.providerName} · {bk.endDate ? `Ends ${bk.endDate}` : `${bk.guests} guests`}
                    {bk.bookingReference ? ` · ${bk.bookingReference}` : ''}
                  </p>
                  {bk.paymentStatus && (
                    <p className="text-[11px] font-medium text-slate-600">
                      Payment: {bk.paymentStatus}
                      {typeof bk.balanceDueInPersonZar === 'number' &&
                      bk.balanceDueInPersonZar > 0 &&
                      bk.paymentStatus !== 'Paid'
                        ? ` (R ${bk.balanceDueInPersonZar.toLocaleString('en-ZA')} due in person)`
                        : ''}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleCombineSingleBooking(bk, day)}
                  className="mt-3 w-full rounded-md border border-[#1D4ED8] bg-white py-1.5 text-xs font-semibold text-[#1E40AF] hover:bg-[#EFF6FF] transition-colors"
                >
                  Add to Day {day}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Manual Stop Composer + Type Filter */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-[#111827]">
              Daily Travel Itinerary
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Combined accommodation check-ins, transport schedules, and guided activities.
            </p>
          </div>

          <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            {(['All', 'Accommodation', 'Transport', 'Activity'] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={typeFilter === t}
                onClick={() => setTypeFilter(t)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                  typeFilter === t
                    ? 'bg-[#111827] text-white'
                    : 'text-slate-600 hover:text-[#111827]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleAdd} className="grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-12">
          <div className="sm:col-span-4">
            <label htmlFor="trip-title" className="sr-only">
              Activity title
            </label>
            <input
              id="trip-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add stop (e.g., Green Point Urban Park)"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="trip-type" className="sr-only">
              Type
            </label>
            <select
              id="trip-type"
              value={itemType}
              onChange={(e) => setItemType(e.target.value as OfferingType)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
            >
              <option value="Activity">Activity</option>
              <option value="Accommodation">Accommodation</option>
              <option value="Transport">Transport</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="trip-zone" className="sr-only">
              Zone
            </label>
            <input
              id="trip-zone"
              type="text"
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              placeholder="Precinct"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="trip-day" className="sr-only">
              Day
            </label>
            <select
              id="trip-day"
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
            >
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <option key={d} value={d}>
                  Day {d}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 flex gap-2">
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              aria-label="Time"
              className="w-20 rounded-lg border border-slate-300 px-2 py-2 text-xs font-mono text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
            />
            <button
              type="submit"
              disabled={submittingStop}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#1D4ED8] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60 transition-colors whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {submittingStop ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>
      </div>

      {/* Daily Timeline Cards */}
      <div className="space-y-4">
        {days.map((dayNum) => {
          const dayItems = activities
            .filter(
              (a) =>
                a.day === dayNum &&
                (typeFilter === 'All' || (a.itemType || 'Activity') === typeFilter)
            )
            .sort((a, b) => a.time.localeCompare(b.time));

          if (dayItems.length === 0) return null;
          const heading = dayItems[0]?.dayLabel ?? `Day ${dayNum}`;

          return (
            <section key={dayNum} className="rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
                <h2 className="font-display text-sm font-bold text-[#111827]">{heading}</h2>
                <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                  {dayItems.length} stop(s)
                </span>
              </div>
              <div className="divide-y divide-slate-200">
                {dayItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <button
                      type="button"
                      onClick={async () => {
                        setTripError('');
                        try {
                          await onToggleActivity(item.id);
                        } catch (err) {
                          setTripError(
                            err instanceof Error ? err.message : 'Unable to update stop status.'
                          );
                        }
                      }}
                      className="flex items-start gap-3 text-left"
                    >
                      {item.completed ? (
                        <CheckSquare className="mt-0.5 h-4 w-4 text-[#15803D] shrink-0" aria-hidden="true" />
                      ) : (
                        <Square className="mt-0.5 h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
                      )}
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="font-mono font-semibold tabular-nums text-[#111827]">
                            {item.time}
                          </span>
                          <span className="rounded bg-[#EFF6FF] px-1.5 py-0.5 text-[10px] font-semibold text-[#1E40AF]">
                            {item.itemType || 'Activity'}
                          </span>
                          <span>{item.zone}</span>
                          {item.bookingId && (
                            <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#15803D]">
                              Linked Booking
                            </span>
                          )}
                        </div>
                        <p
                          className={`mt-0.5 text-sm font-semibold ${
                            item.completed ? 'line-through text-slate-400' : 'text-[#111827]'
                          }`}
                        >
                          {item.title}
                        </p>
                        <p className="text-xs text-slate-600">{item.transportNote}</p>
                      </div>
                    </button>

                    <div className="flex items-center gap-3">
                      <StatusText
                        label={item.completed ? 'Completed' : item.safetyNote}
                        tone={item.completed ? 'nominal' : 'neutral'}
                      />
                      {onDeleteActivity && (
                        <button
                          type="button"
                          onClick={async () => {
                            setTripError('');
                            try {
                              await onDeleteActivity(item.id);
                            } catch (err) {
                              setTripError(
                                err instanceof Error ? err.message : 'Unable to remove stop.'
                              );
                            }
                          }}
                          aria-label={`Remove ${item.title}`}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
