import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BedDouble,
  Bus,
  CalendarCheck,
  CheckSquare,
  Clock,
  Compass,
  Heart,
  Layers,
  Plus,
  Route,
  Share2,
  Square,
  Trash2,
} from 'lucide-react';
import { DemoDataNotice } from '@/src/components/common/DemoDataNotice';
import { StatusText } from '@/src/components/common/StatusText';
import { TripStatusShareModal } from '@/src/components/safety/TripStatusShareModal';
import type {
  AttractionItem,
  BookingItem,
  CapeTownWeather,
  DemoUser,
  FavouriteItem,
  NavSectionId,
  OfferingType,
  ProviderListing,
  TripActivity,
  TrustedContact,
} from '@/src/types/app';
import {
  buildItineraryFromConfirmedBooking,
  derivePickupVerificationCode,
  isAwaitingBookingStatus,
  parseTimeHHMM,
} from '@/src/utils/bookingCalculations';
import { computeSmartGuidance, estimateRouteTransfer } from '@/src/utils/safetyGuidance';

interface MyTripsPageProps {
  user: DemoUser;
  activities: TripActivity[];
  bookings: BookingItem[];
  favourites?: FavouriteItem[];
  attractions?: AttractionItem[];
  offerings?: ProviderListing[];
  weather?: CapeTownWeather;
  trustedContacts?: TrustedContact[];
  onToggleActivity: (id: string) => Promise<void> | void;
  onAddActivity: (
    activity: Omit<TripActivity, 'id' | 'completed' | 'dataOrigin'>
  ) => Promise<void> | void;
  onDeleteActivity?: (id: string) => Promise<void> | void;
  onNavigate?: (section: NavSectionId) => void;
}

interface BuilderStopDraft {
  uid: string;
  sourceId: string;
  title: string;
  zone: string;
  category: string;
  durationMinutes: number;
}

function formatHHMMFromMinutes(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hh = String(Math.floor(normalized / 60)).padStart(2, '0');
  const mm = String(normalized % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export const MyTripsPage: React.FC<MyTripsPageProps> = ({
  user,
  activities,
  bookings,
  favourites = [],
  attractions = [],
  offerings = [],
  weather,
  trustedContacts = [],
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

  // Multi-Stop Saved Itinerary Builder State
  const [builderDay, setBuilderDay] = useState(1);
  const [builderStartTime, setBuilderStartTime] = useState('08:30');
  const [queuedStops, setQueuedStops] = useState<BuilderStopDraft[]>([]);
  const [savingBuilderPlan, setSavingBuilderPlan] = useState(false);
  const [sharePayload, setSharePayload] = useState<{
    title: string;
    zone: string;
    dateLabel: string;
    timeWindowLabel: string;
    pickupCode?: string;
    providerName?: string;
    providerVerified?: boolean;
  } | null>(null);

  const savedStopPool = useMemo(() => {
    const wishlistEntries = favourites.map((fav) => ({
      sourceId: fav.listingId,
      title: fav.listingTitle,
      zone: fav.precinct,
      category: fav.listingType || 'Attraction',
      isWishlist: true,
    }));
    const existingIds = new Set(wishlistEntries.map((w) => w.sourceId));
    const quickPickDirectory = [
      ...attractions.slice(0, 6).map((a) => ({
        sourceId: a.id,
        title: a.title,
        zone: a.precinct,
        category: a.activityCategories?.[0] || a.category,
        isWishlist: false,
      })),
      ...offerings
        .filter((o) => o.status === 'Active')
        .slice(0, 4)
        .map((o) => ({
          sourceId: o.id,
          title: o.experienceTitle,
          zone: o.zone || 'Cape Town',
          category: o.activityCategory || o.category || 'Activity',
          isWishlist: false,
        })),
    ].filter((entry) => !existingIds.has(entry.sourceId));
    return [...wishlistEntries, ...quickPickDirectory].slice(0, 14);
  }, [favourites, attractions, offerings]);

  const builderTimeline = useMemo(() => {
    const parsedStart = parseTimeHHMM(builderStartTime);
    let cursorMinutes = parsedStart.hours * 60 + parsedStart.minutes;
    let totalStopMinutes = 0;
    let totalTransitMinutes = 0;
    let totalTransitFareZar = 0;

    const steps = queuedStops.map((stop, idx) => {
      const prevStop = idx > 0 ? queuedStops[idx - 1] : null;
      const transfer = prevStop ? estimateRouteTransfer(prevStop.zone, stop.zone) : null;
      if (transfer) {
        cursorMinutes += transfer.estimatedMinutes;
        totalTransitMinutes += transfer.estimatedMinutes;
        totalTransitFareZar += transfer.estimatedFareZar;
      }
      const startLabel = formatHHMMFromMinutes(cursorMinutes);
      const endMinutes = cursorMinutes + stop.durationMinutes;
      const endLabel = formatHHMMFromMinutes(endMinutes);
      const guidance = computeSmartGuidance({
        title: stop.title,
        zone: stop.zone,
        category: stop.category,
        timeSlot: startLabel,
        endTime: endLabel,
        durationUnit: 'hours',
        durationValue: Math.max(1, Math.round(stop.durationMinutes / 60)),
        weather,
      });
      totalStopMinutes += stop.durationMinutes;
      cursorMinutes = endMinutes;

      return {
        ...stop,
        startLabel,
        endLabel,
        transfer,
        guidance,
      };
    });

    return {
      steps,
      totalStopMinutes,
      totalTransitMinutes,
      totalCombinedMinutes: totalStopMinutes + totalTransitMinutes,
      totalTransitFareZar,
      finishTimeLabel: queuedStops.length > 0 ? formatHHMMFromMinutes(cursorMinutes) : builderStartTime,
    };
  }, [queuedStops, builderStartTime, weather]);

  const handleQueueStop = (candidate: {
    sourceId: string;
    title: string;
    zone: string;
    category: string;
  }) => {
    setTripError('');
    setQueuedStops((prev) => [
      ...prev,
      {
        uid: `${candidate.sourceId}-${Date.now()}-${prev.length}`,
        sourceId: candidate.sourceId,
        title: candidate.title,
        zone: candidate.zone,
        category: candidate.category,
        durationMinutes: 90,
      },
    ]);
  };

  const handleLoadWishlistStops = () => {
    if (favourites.length === 0) return;
    setQueuedStops(
      favourites.slice(0, 6).map((fav, idx) => ({
        uid: `${fav.listingId}-${Date.now()}-${idx}`,
        sourceId: fav.listingId,
        title: fav.listingTitle,
        zone: fav.precinct,
        category: fav.listingType || 'Attraction',
        durationMinutes: 90,
      }))
    );
  };

  const handleMoveQueuedStop = (index: number, delta: -1 | 1) => {
    const targetIdx = index + delta;
    if (targetIdx < 0 || targetIdx >= queuedStops.length) return;
    setQueuedStops((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
  };

  const handleSaveMultiStopPlan = async () => {
    if (builderTimeline.steps.length === 0) return;
    setSavingBuilderPlan(true);
    setTripError('');
    setCombineFeedback('');
    try {
      for (const step of builderTimeline.steps) {
        const rawTransport = step.transfer
          ? `${step.transfer.recommendedMode} (${step.transfer.estimatedMinutes} min, ~R ${step.transfer.estimatedFareZar})`
          : `Start Day ${builderDay} in ${step.zone} · ~${step.durationMinutes} min`;
        const rawSafety = `${step.guidance.timeBand} · +${step.guidance.bufferMinutes}m buffer`;
        await onAddActivity({
          day: builderDay,
          dayLabel: `Day ${builderDay} · Multi-Stop Peninsula Plan`,
          time: step.startLabel,
          title: step.title.slice(0, 155),
          zone: step.zone.slice(0, 95),
          itemType: 'Activity',
          transportNote: rawTransport.slice(0, 190),
          safetyNote: rawSafety.slice(0, 190),
        });
      }
      setCombineFeedback(
        `Saved ${builderTimeline.steps.length}-stop Day ${builderDay} itinerary (${Math.round(
          builderTimeline.totalCombinedMinutes / 60 * 10
        ) / 10} hrs combined with transit estimates).`
      );
      setQueuedStops([]);
    } catch (err) {
      setTripError(err instanceof Error ? err.message : 'Unable to save multi-stop itinerary.');
    } finally {
      setSavingBuilderPlan(false);
    }
  };

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
      const stopGuidance = computeSmartGuidance({
        title: title.trim(),
        zone: zone.trim() || 'City Bowl',
        category: itemType,
        timeSlot: time,
        weather,
      });
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
        safetyNote: `${stopGuidance.timeBand} · +${stopGuidance.bufferMinutes}m buffer`,
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
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:grid-cols-4">
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
            {unlinkedConfirmed.map((bk) => {
              const pickupCode = derivePickupVerificationCode(bk.id, bk.bookingReference);
              return (
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
                    <p className="font-mono text-[11px] font-bold text-[#1D4ED8] tabular-nums">
                      Pickup Handoff Code: {pickupCode}
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
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleCombineSingleBooking(bk, day)}
                      className="flex-1 rounded-md border border-[#1D4ED8] bg-white py-1.5 text-xs font-semibold text-[#1E40AF] hover:bg-[#EFF6FF] transition-colors"
                    >
                      Add to Day {day}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSharePayload({
                          title: bk.title,
                          zone: bk.zone || bk.providerName,
                          dateLabel: bk.date,
                          timeWindowLabel: `${bk.timeSlot}${bk.endTime ? ` → ${bk.endTime}` : ''} SAST`,
                          pickupCode,
                          providerName: bk.providerName,
                          providerVerified: bk.safetyVerified,
                        })
                      }
                      aria-label={`Share ${bk.title} trip status`}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#111827] hover:bg-slate-100"
                    >
                      <Share2 className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Saved Itinerary Builder: Build Multi-Stop Day Plan from Wishlist & Directory */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Route className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
              <h2 className="font-display text-base font-bold text-[#111827]">
                Saved Itinerary Builder · Multi-Stop Day Plan
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-600">
              Select saved Wishlist places or Cape Town stops to auto-calculate combined duration, transit times, ZAR transfers, and weather/dusk buffers.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {favourites.length > 0 && (
              <button
                type="button"
                onClick={handleLoadWishlistStops}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 whitespace-nowrap"
              >
                <Heart className="h-3.5 w-3.5 fill-red-600 text-red-600" aria-hidden="true" />
                Load Saved Wishlist ({favourites.length})
              </button>
            )}
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('explore')}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#111827] hover:bg-slate-50 whitespace-nowrap"
              >
                Browse Places
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-12">
          {/* Left: Saved Places & Quick-Pick Stops */}
          <div className="lg:col-span-5 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>Saved &amp; Recommended Cape Town Stops</span>
              <span className="font-mono text-[11px] text-slate-500">
                {favourites.length} wishlisted
              </span>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-200 rounded-lg border border-slate-200 bg-slate-50">
              {savedStopPool.length === 0 ? (
                <p className="p-4 text-xs text-slate-500">
                  Save places in Discover Cape Town to build your multi-stop route.
                </p>
              ) : (
                savedStopPool.map((cand) => (
                  <div
                    key={cand.sourceId}
                    className="flex items-center justify-between gap-2 px-3 py-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[#111827] truncate">
                        {cand.isWishlist ? '★ ' : ''}
                        {cand.title}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {cand.zone} · {cand.category}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleQueueStop(cand)}
                      className="inline-flex items-center gap-1 rounded-md border border-[#1D4ED8] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1E40AF] hover:bg-[#EFF6FF] whitespace-nowrap shrink-0"
                    >
                      <Plus className="h-3 w-3" aria-hidden="true" />
                      Add Stop
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: Sequence Queue + Combined Duration & Transport Estimates */}
          <div className="lg:col-span-7 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="builder-day"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Target Trip Day
                </label>
                <select
                  id="builder-day"
                  value={builderDay}
                  onChange={(e) => setBuilderDay(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-[#111827]"
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <option key={d} value={d}>
                      Day {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="builder-start"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Departure Time (SAST)
                </label>
                <input
                  id="builder-start"
                  type="time"
                  value={builderStartTime}
                  onChange={(e) => setBuilderStartTime(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-[#111827]"
                />
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs">
                <p className="text-[11px] text-slate-500">Combined Plan Totals</p>
                <p className="font-mono font-bold text-[#111827] tabular-nums">
                  {builderTimeline.totalCombinedMinutes}m · Est. R{' '}
                  {builderTimeline.totalTransitFareZar} transit
                </p>
              </div>
            </div>

            {builderTimeline.steps.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center text-xs text-slate-500">
                Click <strong>Add Stop</strong> on saved places to assemble a chronological multi-stop day route with transit &amp; dusk guidance.
              </p>
            ) : (
              <div className="space-y-2">
                {builderTimeline.steps.map((step, idx) => (
                  <div
                    key={step.uid}
                    className="rounded-lg border border-slate-200 bg-white p-3 text-xs space-y-1.5"
                  >
                    {step.transfer && (
                      <p className="flex items-center gap-1.5 font-mono text-[11px] text-[#1D4ED8] pb-1 border-b border-slate-100 tabular-nums">
                        <Bus className="h-3 w-3 shrink-0" aria-hidden="true" />
                        Transit {step.transfer.distanceKm} km · ~{step.transfer.estimatedMinutes}{' '}
                        min · {step.transfer.recommendedMode} (Est. R {step.transfer.estimatedFareZar})
                      </p>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-mono text-[11px] font-semibold text-slate-600 tabular-nums">
                          Stop {idx + 1}: {step.startLabel} – {step.endLabel} SAST · {step.zone}
                        </p>
                        <p className="font-semibold text-[#111827]">{step.title}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <select
                          aria-label={`Duration for ${step.title}`}
                          value={step.durationMinutes}
                          onChange={(e) => {
                            const nextVal = Number(e.target.value);
                            setQueuedStops((prev) =>
                              prev.map((s) =>
                                s.uid === step.uid ? { ...s, durationMinutes: nextVal } : s
                              )
                            );
                          }}
                          className="rounded border border-slate-300 bg-white px-2 py-1 font-mono text-[11px]"
                        >
                          <option value={60}>60 min</option>
                          <option value={90}>90 min</option>
                          <option value={120}>120 min</option>
                          <option value={180}>180 min</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleMoveQueuedStop(idx, -1)}
                          disabled={idx === 0}
                          aria-label={`Move ${step.title} earlier`}
                          className="rounded border border-slate-200 p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                        >
                          <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveQueuedStop(idx, 1)}
                          disabled={idx === builderTimeline.steps.length - 1}
                          aria-label={`Move ${step.title} later`}
                          className="rounded border border-slate-200 p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                        >
                          <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setQueuedStops((prev) => prev.filter((s) => s.uid !== step.uid))
                          }
                          aria-label={`Remove ${step.title} from builder`}
                          className="rounded border border-red-200 p-1 text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-amber-900 bg-amber-50 rounded px-2 py-1">
                      <strong>{step.guidance.timeBand}:</strong> +{step.guidance.bufferMinutes}m buffer ·{' '}
                      {step.guidance.timingTip}
                    </p>
                  </div>
                ))}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <p className="text-[11px] text-slate-600 font-mono tabular-nums">
                    Ends ~{builderTimeline.finishTimeLabel} SAST ({builderTimeline.totalStopMinutes}m activities +{' '}
                    {builderTimeline.totalTransitMinutes}m transit)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSharePayload({
                          title: builderTimeline.steps.map((s) => s.title).join(' -> '),
                          zone: builderTimeline.steps.map((s) => s.zone).join(' · '),
                          dateLabel: `Day ${builderDay} Multi-Stop Plan`,
                          timeWindowLabel: `${builderStartTime} – ${builderTimeline.finishTimeLabel} SAST`,
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#111827] hover:bg-slate-100 whitespace-nowrap"
                    >
                      <Share2 className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
                      Share Day Plan
                    </button>
                    <button
                      type="button"
                      disabled={savingBuilderPlan}
                      onClick={handleSaveMultiStopPlan}
                      className="rounded-lg bg-[#1D4ED8] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60 whitespace-nowrap"
                    >
                      {savingBuilderPlan
                        ? 'Saving Plan...'
                        : `Save Multi-Stop Plan to Day ${builderDay}`}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
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

          <div className="flex items-center gap-1 overflow-x-auto max-w-full rounded-lg border border-slate-200 bg-slate-50 p-1">
            {(['All', 'Accommodation', 'Transport', 'Activity'] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={typeFilter === t}
                onClick={() => setTypeFilter(t)}
                className={`min-h-[34px] shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
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
              className="w-28 sm:w-20 shrink-0 rounded-lg border border-slate-300 px-2 py-2 text-xs font-mono text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
            />
            <button
              type="submit"
              disabled={submittingStop}
              className="flex min-h-[40px] flex-1 items-center justify-center gap-1 rounded-lg bg-[#1D4ED8] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60 transition-colors whitespace-nowrap"
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
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-5 py-3">
                <h2 className="font-display text-sm font-bold text-[#111827]">{heading}</h2>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                    {dayItems.length} stop(s)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSharePayload({
                        title: dayItems.map((i) => `${i.time} ${i.title}`).join(' -> '),
                        zone: Array.from(new Set(dayItems.map((i) => i.zone))).join(' · '),
                        dateLabel: heading,
                        timeWindowLabel: `${dayItems[0]?.time || '08:30'} onwards SAST`,
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#111827] hover:bg-slate-100"
                  >
                    <Share2 className="h-3 w-3 text-[#1D4ED8]" aria-hidden="true" />
                    Share Day {dayNum}
                  </button>
                </div>
              </div>
              <div className="divide-y divide-slate-200">
                {dayItems.map((item) => {
                  const linkedBk = item.bookingId
                    ? bookings.find((b) => b.id === item.bookingId)
                    : undefined;
                  const pickupCode = linkedBk
                    ? derivePickupVerificationCode(linkedBk.id, linkedBk.bookingReference)
                    : null;
                  const itemGuidance = computeSmartGuidance({
                    title: item.title,
                    zone: item.zone,
                    category: item.itemType,
                    timeSlot: item.time,
                    endTime: item.endTime,
                    weather,
                  });

                  return (
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
                            {pickupCode && (
                              <span className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#1D4ED8] tabular-nums">
                                Pickup Code: {pickupCode}
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
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                            <Clock className="h-3 w-3 text-[#1D4ED8]" aria-hidden="true" />
                            <span>
                              {itemGuidance.timeBand} · +{itemGuidance.bufferMinutes}m buffer ·{' '}
                              {itemGuidance.weatherCaveat}
                            </span>
                          </p>
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
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <TripStatusShareModal
        payload={sharePayload}
        travelerName={user.name}
        userEmergencyContact={user.emergencyContact}
        trustedContacts={trustedContacts}
        onClose={() => setSharePayload(null)}
      />
    </div>
  );
};
