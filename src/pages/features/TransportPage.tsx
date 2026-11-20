import React, { useMemo, useState } from 'react';
import {
  Accessibility,
  Banknote,
  Briefcase,
  Bus,
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  CreditCard,
  Info,
  KeyRound,
  MapPin,
  PhoneCall,
  PlayCircle,
  PlusCircle,
  Receipt,
  Search,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  SunMoon,
  Users,
  Wind,
  XCircle,
} from 'lucide-react';
import { DemoDataNotice } from '@/src/components/common/DemoDataNotice';
import { StatusText } from '@/src/components/common/StatusText';
import {
  CheckoutPaymentStep,
  type CheckoutCompletionPayload,
  type CheckoutDraft,
} from '@/src/components/payments/CheckoutPaymentStep';
import { PaymentReceiptModal } from '@/src/components/payments/PaymentReceiptModal';
import {
  TripStatusShareModal,
  type TripSharePayload,
} from '@/src/components/safety/TripStatusShareModal';
import { AnimatedRoutePreview } from '@/src/components/transport/AnimatedRoutePreview';
import {
  TripIncidentReportModal,
  type TripIncidentDraft,
} from '@/src/components/transport/TripIncidentReportModal';
import { VehiclePhoto } from '@/src/components/transport/VehiclePhoto';
import {
  buildRouteWaypointsForTrip,
  buildRouteWaypointsFromZoneText,
  calculateVisitorTransportQuote,
  inferVehicleTierFromText,
  type TransportDurationOption,
  type VehicleTierId,
  VISITOR_PICKUP_POINTS,
  VISITOR_TRAVEL_PILLARS,
  VISITOR_VEHICLE_TIERS,
  type VisitorTravelPillar,
  type VisitorVehicleTier,
} from '@/src/data/transportPillars';
import type {
  BookingItem,
  CapeTownWeather,
  DemoUser,
  NavSectionId,
  PaymentMethodType,
  PaymentRecord,
  ProviderListing,
  ProviderPaymentSettings,
  SafetyAdvisory,
  SavedPaymentMethod,
  TransportRoute,
  TrustedContact,
} from '@/src/types/app';
import {
  derivePickupVerificationCode,
  generateBookingReference,
  isAwaitingBookingStatus,
  isPaymentSettledStatus,
} from '@/src/utils/bookingCalculations';
import { computeSmartGuidance } from '@/src/utils/safetyGuidance';

interface TransportPageProps {
  user?: DemoUser;
  routes: TransportRoute[];
  transportOfferings?: ProviderListing[];
  bookings?: BookingItem[];
  payments?: PaymentRecord[];
  savedCards?: SavedPaymentMethod[];
  providerPaymentSettings?: ProviderPaymentSettings[];
  weather?: CapeTownWeather;
  trustedContacts?: TrustedContact[];
  onAddRouteToTrip?: (route: TransportRoute) => Promise<void> | void;
  onCompleteCheckout?: (payload: CheckoutCompletionPayload) => Promise<PaymentRecord>;
  onRemoveSavedCard?: (cardId: string) => Promise<void> | void;
  onCancelBooking?: (bookingId: string, reason?: string) => Promise<void> | void;
  onReportIncident?: (
    advisory: Omit<SafetyAdvisory, 'id' | 'updatedAt' | 'dataOrigin'>
  ) => Promise<void> | void;
  onNavigate?: (section: NavSectionId) => void;
}

type PaymentPreferenceChoice = 'arrival_cash' | 'arrival_card' | 'online_checkout';
type RideBucketFilter = 'All' | 'Upcoming' | 'Active' | 'Past';

function classifyTransportBookingBucket(
  status: BookingItem['status']
): 'Upcoming' | 'Active' | 'Past' {
  if (status === 'Completed' || status === 'Cancelled' || status === 'Rejected') {
    return 'Past';
  }
  if (status === 'Confirmed') {
    return 'Active';
  }
  return 'Upcoming';
}

export const TransportPage: React.FC<TransportPageProps> = ({
  user,
  routes,
  transportOfferings = [],
  bookings = [],
  payments = [],
  savedCards = [],
  providerPaymentSettings = [],
  weather,
  trustedContacts = [],
  onAddRouteToTrip,
  onCompleteCheckout,
  onRemoveSavedCard,
  onCancelBooking,
  onReportIncident,
  onNavigate,
}) => {
  const effectiveUser: DemoUser = user || {
    id: 'demo-tourist-1',
    name: 'Cape Town Visitor',
    email: 'visitor@capesafe.demo',
    role: 'tourist',
    roleTitle: 'Visitor',
    organization: 'Cape Town Itinerary',
    location: 'Cape Town',
    dataOrigin: 'demo',
  };

  // --- Visitor Duration & Trip Planner State ---
  const [selectedPickupId, setSelectedPickupId] = useState<string>(VISITOR_PICKUP_POINTS[0].id);
  const [pickupNote, setPickupNote] = useState('');
  const [selectedPillarId, setSelectedPillarId] = useState<string>(VISITOR_TRAVEL_PILLARS[0].id);
  const [selectedTierId, setSelectedTierId] = useState<VehicleTierId>('comfort-suv');
  const [startDate, setStartDate] = useState('2026-11-18');
  const [startTime, setStartTime] = useState('09:00');
  const [durationOption, setDurationOption] = useState<TransportDurationOption>('half_day');
  const [hourlyCount, setHourlyCount] = useState(3);
  const [passengers, setPassengers] = useState(2);
  const [requireAccessible, setRequireAccessible] = useState(false);
  const [paymentChoice, setPaymentChoice] = useState<PaymentPreferenceChoice>('arrival_card');
  const [previewRefSeed, setPreviewRefSeed] = useState(() => generateBookingReference());

  // Checkout / Confirmation state
  const [checkoutDraft, setCheckoutDraft] = useState<CheckoutDraft | null>(null);
  const [checkoutInitialMethod, setCheckoutInitialMethod] =
    useState<PaymentMethodType>('Pay in Person');
  const [recentPaymentReceipt, setRecentPaymentReceipt] = useState<PaymentRecord | null>(null);
  const [plannerFeedback, setPlannerFeedback] = useState('');
  const [confirmedRideSummary, setConfirmedRideSummary] = useState<{
    bookingReference: string;
    pickupCode: string;
    tierName: string;
    imageUrl: string;
    passengers: number;
    luggageSummary: string;
    endLabel: string;
    totalZar: number;
    paymentSummary: string;
  } | null>(null);
  const [plannerError, setPlannerError] = useState('');

  // Playback Override (when user clicks "Playback Route" from My Rides)
  const [inspectedRidePlayback, setInspectedRidePlayback] = useState<{
    title: string;
    zone: string;
    pickupCode?: string;
    driverName?: string;
  } | null>(null);

  // My Rides Filter & Actions State
  const [rideBucket, setRideBucket] = useState<RideBucketFilter>('All');
  const [cancellingRideId, setCancellingRideId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);

  // Public Transit Corridors Filter State (preserved)
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const [verifiedDriversOnly, setVerifiedDriversOnly] = useState(false);
  const [serviceFilter, setServiceFilter] = useState<'All' | TransportRoute['service']>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [addedId, setAddedId] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [transportError, setTransportError] = useState('');

  // Modals: Share Trip, Receipt, Linked Incident Report
  const [sharePayload, setSharePayload] = useState<TripSharePayload | null>(null);
  const [incidentDraft, setIncidentDraft] = useState<TripIncidentDraft | null>(null);

  // Mobile Quick Jump
  const [mobileSectionFocus, setMobileSectionFocus] = useState<'all' | 'planner' | 'rides' | 'transit'>('all');

  const selectedPickup = useMemo(
    () => VISITOR_PICKUP_POINTS.find((p) => p.id === selectedPickupId) || VISITOR_PICKUP_POINTS[0],
    [selectedPickupId]
  );

  const selectedPillar = useMemo(
    () => VISITOR_TRAVEL_PILLARS.find((p) => p.id === selectedPillarId) || VISITOR_TRAVEL_PILLARS[0],
    [selectedPillarId]
  );

  const selectedTier = useMemo(
    () => VISITOR_VEHICLE_TIERS.find((t) => t.id === selectedTierId) || VISITOR_VEHICLE_TIERS[1],
    [selectedTierId]
  );

  const quote = useMemo(
    () =>
      calculateVisitorTransportQuote({
        pillar: selectedPillar,
        startDate,
        startTime,
        durationOption,
        hourlyCount,
        vehicleTier: selectedTier,
      }),
    [selectedPillar, startDate, startTime, durationOption, hourlyCount, selectedTier]
  );

  const plannedGuidance = useMemo(
    () =>
      computeSmartGuidance({
        title: selectedPillar.title,
        zone: selectedPillar.destinationZone,
        category: 'Transport',
        timeSlot: startTime,
        endTime: quote.endTime,
        durationUnit: quote.durationUnit,
        durationValue: quote.durationValue,
        weather,
      }),
    [selectedPillar, startTime, quote, weather]
  );

  const routePreview = useMemo(() => {
    if (inspectedRidePlayback) {
      return buildRouteWaypointsFromZoneText(
        inspectedRidePlayback.title,
        inspectedRidePlayback.zone
      );
    }
    return buildRouteWaypointsForTrip(selectedPickup, selectedPillar);
  }, [inspectedRidePlayback, selectedPickup, selectedPillar]);

  const draftPickupCode = useMemo(
    () => derivePickupVerificationCode(`draft-${selectedPillar.id}`, previewRefSeed),
    [selectedPillar.id, previewRefSeed]
  );

  // Transport Bookings scoped cleanly
  const visitorTransportBookings = useMemo(() => {
    const filtered = bookings.filter(
      (b) =>
        (b.offeringType || 'Activity') === 'Transport' ||
        /transport|shuttle|transfer|charter/i.test(`${b.category} ${b.title}`)
    );
    return filtered;
  }, [bookings]);

  const rideBucketCounts = useMemo(() => {
    const counts = { All: visitorTransportBookings.length, Upcoming: 0, Active: 0, Past: 0 };
    visitorTransportBookings.forEach((b) => {
      const bucket = classifyTransportBookingBucket(b.status);
      counts[bucket] += 1;
    });
    return counts;
  }, [visitorTransportBookings]);

  const visibleRides = useMemo(() => {
    if (rideBucket === 'All') return visitorTransportBookings;
    return visitorTransportBookings.filter(
      (b) => classifyTransportBookingBucket(b.status) === rideBucket
    );
  }, [visitorTransportBookings, rideBucket]);

  const activeProviderPolicy = useMemo(() => {
    if (!checkoutDraft) return null;
    return (
      providerPaymentSettings.find((s) => s.providerId === checkoutDraft.providerId) ||
      providerPaymentSettings.find(
        (s) => s.providerName.toLowerCase() === checkoutDraft.providerName.toLowerCase()
      ) ||
      null
    );
  }, [checkoutDraft, providerPaymentSettings]);

  const handleSelectPillar = (pillar: VisitorTravelPillar) => {
    setSelectedPillarId(pillar.id);
    setInspectedRidePlayback(null);
    setPlannerFeedback('');
    setPlannerError('');
    if (durationOption === 'night_session') {
      setStartTime('19:00');
    }
  };

  const handleSelectVehicleTier = (tier: VisitorVehicleTier) => {
    setSelectedTierId(tier.id);
    if (passengers > tier.maxPassengers) {
      setPassengers(tier.maxPassengers);
    }
    setPlannerError('');
  };

  const handlePassengersChange = (nextCount: number) => {
    const safeCount = Math.max(1, Math.min(7, nextCount));
    setPassengers(safeCount);
    if (safeCount > selectedTier.maxPassengers) {
      const fittingTier = VISITOR_VEHICLE_TIERS.find((t) => t.maxPassengers >= safeCount);
      if (fittingTier) setSelectedTierId(fittingTier.id);
    }
  };

  const handleSelectDuration = (option: TransportDurationOption) => {
    setDurationOption(option);
    if (option === 'night_session' && startTime < '18:00') {
      setStartTime('19:00');
    } else if (option === 'full_day' && startTime > '11:00') {
      setStartTime('08:30');
    }
  };

  const handleStartReservation = () => {
    setPlannerError('');
    setPlannerFeedback('');
    setConfirmedRideSummary(null);

    const zoneString = `${selectedPickup.precinct} → ${selectedPillar.destinationZone}${
      pickupNote.trim() ? ` (${pickupNote.trim().slice(0, 32)})` : ''
    }`.slice(0, 120);

    const methodToPreselect: PaymentMethodType =
      paymentChoice === 'online_checkout' ? 'PayShap' : 'Pay in Person';

    setCheckoutInitialMethod(methodToPreselect);
    setCheckoutDraft({
      existingBookingReference: previewRefSeed,
      offeringType: 'Transport',
      title: `${selectedTier.name} · ${selectedPillar.title} (${quote.durationLabel})`.slice(0, 155),
      providerId: selectedPillar.providerId,
      providerName: selectedPillar.providerName,
      category: 'Accredited Visitor Transport',
      zone: zoneString,
      date: startDate,
      timeSlot: startTime,
      durationUnit: quote.durationUnit,
      durationValue: quote.durationValue,
      endDate: quote.endDate,
      endTime: quote.endTime,
      unitPriceZar: quote.unitPriceZar,
      pricingModel: quote.pricingModel,
      guests: passengers,
      totalZar: quote.totalZar,
      safetyVerified: selectedPillar.safetyVerified,
      accessible: requireAccessible || selectedTier.accessibleFriendly,
      imageUrl: selectedTier.imageUrl,
      vehicleTierName: selectedTier.name,
      luggageNote: selectedTier.luggageSummary,
    });
  };

  const handleOpenBookingCheckout = (booking: BookingItem, matchedPayment?: PaymentRecord) => {
    const inferredTier = inferVehicleTierFromText(booking.title);
    setCheckoutInitialMethod('PayShap');
    setCheckoutDraft({
      existingBookingId: booking.id,
      existingPaymentId: matchedPayment?.id || booking.paymentId,
      existingBookingReference: booking.bookingReference,
      offeringId: booking.offeringId,
      offeringType: 'Transport',
      title: booking.title,
      providerId: booking.providerId || effectiveUser.id,
      providerName: booking.providerName,
      category: booking.category,
      zone: booking.zone || 'Cape Town',
      date: booking.date,
      timeSlot: booking.timeSlot,
      durationUnit: booking.durationUnit || 'hours',
      durationValue: booking.durationValue || 2,
      endDate: booking.endDate || booking.date,
      endTime: booking.endTime || booking.timeSlot,
      unitPriceZar: booking.unitPriceZar ?? booking.priceZar,
      pricingModel: booking.pricingModel || 'per_unit',
      guests: booking.guests,
      totalZar: booking.priceZar,
      safetyVerified: booking.safetyVerified,
      accessible: booking.accessible,
      imageUrl: inferredTier.imageUrl,
      vehicleTierName: inferredTier.name,
      luggageNote: inferredTier.luggageSummary,
    });
  };

  const handleConfirmCancelRide = async (bookingId: string) => {
    if (!onCancelBooking) return;
    setCancelBusy(true);
    try {
      await onCancelBooking(
        bookingId,
        cancelReason.trim() || 'Cancelled by visitor on Transport Planner'
      );
      setCancellingRideId(null);
      setCancelReason('');
    } catch (err) {
      setTransportError(err instanceof Error ? err.message : 'Unable to cancel transport booking.');
    } finally {
      setCancelBusy(false);
    }
  };

  const visiblePublicRoutes = routes.filter((r) => {
    const matchesAccessible = !accessibleOnly || r.accessible;
    const matchesService = serviceFilter === 'All' || r.service === serviceFilter;
    const matchesQuery =
      !searchQuery.trim() ||
      r.routeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.corridor.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesAccessible && matchesService && matchesQuery;
  });

  const handleAddToTrip = async (route: TransportRoute) => {
    if (!onAddRouteToTrip) return;
    setTransportError('');
    setAddingId(route.id);
    try {
      await onAddRouteToTrip(route);
      setAddedId(route.id);
    } catch (err) {
      setTransportError(
        err instanceof Error ? err.message : 'Unable to add transport route to My Trips.'
      );
    } finally {
      setAddingId(null);
    }
  };

  const showPlannerSection =
    mobileSectionFocus === 'all' || mobileSectionFocus === 'planner';
  const showRidesSection =
    mobileSectionFocus === 'all' || mobileSectionFocus === 'rides';
  const showTransitSection =
    mobileSectionFocus === 'all' || mobileSectionFocus === 'transit';

  return (
    <div className="space-y-6 pb-8">
      <DemoDataNotice scope="Visitor Charter Planner creates tracked reservations; public MyCiTi/rail intervals combine demo schedules with live weather advisories" />

      {/* Clean Visitor Transport Header */}
      <header className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold text-[#1D4ED8]">
              Visitor Safe Mobility &amp; Route Planner · Western Cape
            </p>
            <h1 className="mt-0.5 font-display text-2xl font-bold text-[#111827]">
              Plan &amp; Book Cape Town Rides
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-2xl">
              Compare durations across Table Mountain, Cape Point, Stellenbosch &amp; Franschhoek Winelands, and Langa Heritage corridors with animated stop previews, vetted drivers, pickup codes, and pay-on-arrival flexibility.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href="tel:10111"
              className="inline-flex min-h-[44px] sm:min-h-[38px] items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-900 hover:bg-red-100 whitespace-nowrap"
            >
              <PhoneCall className="h-3.5 w-3.5 text-red-700" aria-hidden="true" />
              Emergency 10111
            </a>
            <button
              type="button"
              onClick={() =>
                setIncidentDraft({
                  tripTitle: selectedPillar.title,
                  zone: selectedPillar.destinationZone,
                  pickupCode: draftPickupCode,
                  driverOrProvider: `${selectedPillar.driverName} (${selectedPillar.providerName})`,
                })
              }
              className="inline-flex min-h-[44px] sm:min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#111827] hover:bg-slate-50 whitespace-nowrap"
            >
              <ShieldAlert className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
              Report Transport Concern
            </button>
          </div>
        </div>

        {/* Weather & Daylight Travel Strip */}
        <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {weather ? (
              <>
                <Wind className="h-4 w-4 text-[#1D4ED8] shrink-0" aria-hidden="true" />
                <span>
                  <strong className="text-[#111827]">Live Wind &amp; Corridor Check:</strong>{' '}
                  {weather.temperatureC}°C · {weather.windSpeedKmh} km/h (Gusts {weather.windGustsKmh} km/h)
                </span>
              </>
            ) : (
              <>
                <SunMoon className="h-4 w-4 text-[#1D4ED8] shrink-0" aria-hidden="true" />
                <span>
                  <strong className="text-[#111827]">Day &amp; Evening Transit:</strong> Lit Waterfront/CBD bays and verified drivers available after dusk.
                </span>
              </>
            )}
          </div>
          {weather && (
            <StatusText
              label={`Cableway Wind Risk: ${weather.cablewayRisk}`}
              tone={
                weather.cablewayRisk === 'Low'
                  ? 'nominal'
                  : weather.cablewayRisk === 'Moderate'
                  ? 'advisory'
                  : 'alert'
              }
            />
          )}
        </div>

        {/* Mobile Quick View Switcher */}
        <div
          role="tablist"
          aria-label="Transport page sections"
          className="grid grid-cols-4 gap-1.5 rounded-xl bg-slate-100 p-1 sm:hidden"
        >
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'planner', label: 'Plan Ride' },
              { id: 'rides', label: `Rides (${visitorTransportBookings.length})` },
              { id: 'transit', label: 'Transit' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={mobileSectionFocus === tab.id}
              onClick={() => setMobileSectionFocus(tab.id)}
              className={`min-h-[40px] rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                mobileSectionFocus === tab.id
                  ? 'bg-[#111827] text-white'
                  : 'text-slate-600 hover:text-[#111827]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {transportError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800"
        >
          {transportError}
        </div>
      )}

      {plannerFeedback && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-200 bg-[#F0FDF4] p-4 text-xs text-emerald-950 space-y-3"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#15803D]" aria-hidden="true" />
              {plannerFeedback}
            </span>
            {recentPaymentReceipt && (
              <button
                type="button"
                onClick={() => setRecentPaymentReceipt(recentPaymentReceipt)}
                className="inline-flex items-center gap-1 font-semibold text-[#15803D] underline whitespace-nowrap"
              >
                <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
                View Confirmation Ref
              </button>
            )}
          </div>

          {confirmedRideSummary && (
            <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-white p-3 sm:flex-row sm:items-center">
              <div className="w-full sm:w-36 shrink-0">
                <VehiclePhoto
                  src={confirmedRideSummary.imageUrl}
                  alt={`${confirmedRideSummary.tierName} reserved vehicle`}
                  tierName={confirmedRideSummary.tierName}
                  className="rounded-lg border border-slate-200"
                />
              </div>
              <div className="min-w-0 flex-1 grid gap-2 sm:grid-cols-2 text-xs text-slate-700">
                <div>
                  <p className="font-bold text-[#111827]">
                    {confirmedRideSummary.tierName} · {confirmedRideSummary.bookingReference}
                  </p>
                  <p className="mt-0.5">
                    {confirmedRideSummary.passengers} passenger(s) · {confirmedRideSummary.luggageSummary}
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className="font-mono font-bold text-[#1D4ED8] tabular-nums">
                    Pickup Code: {confirmedRideSummary.pickupCode}
                  </p>
                  <p className="mt-0.5 tabular-nums">
                    Ends {confirmedRideSummary.endLabel} · R {confirmedRideSummary.totalZar.toLocaleString('en-ZA')} ({confirmedRideSummary.paymentSummary})
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Checkout Step Modal/Section when Visitor clicks Reserve Safe Ride */}
      {checkoutDraft && onCompleteCheckout && (
        <CheckoutPaymentStep
          user={effectiveUser}
          draft={checkoutDraft}
          providerSettings={activeProviderPolicy}
          savedCards={savedCards}
          initialMethod={checkoutInitialMethod}
          preferredInPersonMethod={
            paymentChoice === 'arrival_cash'
              ? 'Cash'
              : paymentChoice === 'arrival_card'
              ? 'Card Machine'
              : undefined
          }
          onRemoveSavedCard={onRemoveSavedCard || (async () => {})}
          onBack={() => setCheckoutDraft(null)}
          onCompleteCheckout={async (payload) => {
            const record = await onCompleteCheckout(payload);
            const code = derivePickupVerificationCode(
              record.bookingId,
              record.bookingReference
            );
            const chosenPayText =
              record.paymentMethod === 'Pay in Person'
                ? paymentChoice === 'arrival_cash'
                  ? 'Pay on Arrival · Cash'
                  : 'Pay on Arrival · Card Machine'
                : `${record.paymentMethod} (${record.paymentStatus})`;
            setConfirmedRideSummary({
              bookingReference: record.bookingReference,
              pickupCode: code,
              tierName: payload.draft.vehicleTierName || selectedTier.name,
              imageUrl: payload.draft.imageUrl || selectedTier.imageUrl,
              passengers: payload.draft.guests,
              luggageSummary: payload.draft.luggageNote || selectedTier.luggageSummary,
              endLabel: `${payload.draft.endDate} ${payload.draft.endTime}`,
              totalZar: payload.draft.totalZar,
              paymentSummary: chosenPayText,
            });
            setPlannerFeedback(
              `Ride reserved (${record.bookingReference}). Pickup Code: ${code} · ${chosenPayText}. View below in My Rides.`
            );
            setPreviewRefSeed(generateBookingReference());
            setCheckoutDraft(null);
            return record;
          }}
        />
      )}

      {/* 1. Simple Duration & Trip Planner */}
      {showPlannerSection && (
        <section
          aria-label="Simple Duration and Trip Planner"
          className="grid gap-5 lg:grid-cols-12"
        >
          {/* Left Form Controls (7 cols) */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="font-display text-base sm:text-lg font-bold text-[#111827]">
                  1. Simple Duration &amp; Trip Planner
                </h2>
                <p className="text-xs text-slate-500">
                  Choose a vehicle tier, pickup point, KaapConnect destination pillar, and duration window.
                </p>
              </div>
              <span className="font-mono text-xs font-semibold text-[#1D4ED8] tabular-nums">
                ZAR Pricing
              </span>
            </div>

            {/* Step 0: Fleet Vehicle Tier Cards with Photos */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="block text-xs font-semibold text-[#111827]">
                  Vehicle Tier &amp; Fleet Preview
                </label>
                <span className="text-[11px] text-slate-500">
                  GPS-monitored · Vetted PrDP drivers · Everyday comfort
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {VISITOR_VEHICLE_TIERS.map((tier) => {
                  const selected = tier.id === selectedTier.id;
                  const tierQuote = calculateVisitorTransportQuote({
                    pillar: selectedPillar,
                    startDate,
                    startTime,
                    durationOption,
                    hourlyCount,
                    vehicleTier: tier,
                  });
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => handleSelectVehicleTier(tier)}
                      className={`group flex flex-col overflow-hidden rounded-xl border text-left transition-colors ${
                        selected
                          ? 'border-[#1D4ED8] bg-[#EFF6FF]/50 ring-1 ring-[#1D4ED8]'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <VehiclePhoto
                        src={tier.imageUrl}
                        alt={`${tier.name} — ${tier.tagline}`}
                        tierName={tier.name}
                        className="w-full border-b border-slate-100"
                      />
                      <div className="flex flex-1 flex-col justify-between p-3 space-y-2">
                        <div>
                          <div className="flex items-center justify-between gap-1.5">
                            <h3 className="font-display text-sm font-bold text-[#111827]">
                              {tier.name}
                            </h3>
                            <span className="font-mono text-xs font-bold text-[#1D4ED8] tabular-nums whitespace-nowrap">
                              R {tierQuote.totalZar.toLocaleString('en-ZA')}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] font-medium text-slate-600 line-clamp-1">
                            {tier.tagline}
                          </p>
                          <p className="mt-1.5 text-[11px] text-slate-500 leading-snug line-clamp-2">
                            {tier.description}
                          </p>
                        </div>

                        <div className="space-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-700">
                          <p className="inline-flex items-center gap-1.5 font-medium">
                            <Users className="h-3.5 w-3.5 text-[#1D4ED8] shrink-0" aria-hidden="true" />
                            Up to {tier.maxPassengers} passengers
                          </p>
                          <p className="inline-flex items-center gap-1.5 text-slate-600">
                            <Briefcase className="h-3.5 w-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                            <span className="truncate">{tier.luggageSummary}</span>
                          </p>
                          <p className="text-[10px] font-medium text-[#15803D]">
                            {tier.highlights.join(' · ')}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step A: KaapConnect Travel Pillars with Destination Thumbnails */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#111827]">
                Destination or Experience Pillar
              </label>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {VISITOR_TRAVEL_PILLARS.map((pillar) => {
                  const selected = pillar.id === selectedPillar.id;
                  const scaledHourly = Math.round(
                    pillar.hourlyRateZar * selectedTier.rateMultiplier
                  );
                  return (
                    <button
                      key={pillar.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => handleSelectPillar(pillar)}
                      className={`min-h-[64px] flex items-center gap-3 rounded-xl border p-2.5 text-left transition-colors ${
                        selected
                          ? 'border-[#1D4ED8] bg-[#EFF6FF]/60 ring-1 ring-[#1D4ED8]'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="w-16 shrink-0">
                        <VehiclePhoto
                          src={pillar.imageUrl}
                          alt={`${pillar.pillarTag} route preview`}
                          tierName={pillar.pillarTag}
                          variant="thumb"
                          className="rounded-lg border border-slate-200"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-[#1D4ED8] truncate">
                            {pillar.pillarTag}
                          </span>
                          <span className="font-mono font-bold text-[#111827] tabular-nums whitespace-nowrap">
                            R {scaledHourly}/hr
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs font-bold text-[#111827] line-clamp-1">
                          {pillar.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-1">
                          {pillar.destinationZone}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step B: Pickup Point + Optional Landmark */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="visitor-pickup-point"
                  className="block text-xs font-semibold text-[#111827]"
                >
                  Pickup Point
                </label>
                <div className="relative mt-1">
                  <MapPin
                    className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#1D4ED8]"
                    aria-hidden="true"
                  />
                  <select
                    id="visitor-pickup-point"
                    value={selectedPickupId}
                    onChange={(e) => {
                      setSelectedPickupId(e.target.value);
                      setInspectedRidePlayback(null);
                    }}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs font-medium text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                  >
                    {VISITOR_PICKUP_POINTS.map((pu) => (
                      <option key={pu.id} value={pu.id}>
                        {pu.label}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">{selectedPickup.bayDetail}</p>
              </div>

              <div>
                <label
                  htmlFor="visitor-pickup-note"
                  className="block text-xs font-semibold text-[#111827]"
                >
                  Hotel / Gate Note (Optional)
                </label>
                <input
                  id="visitor-pickup-note"
                  type="text"
                  value={pickupNote}
                  onChange={(e) => setPickupNote(e.target.value)}
                  placeholder="e.g. Radisson Red Main Entrance"
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                />
                <label className="mt-2 inline-flex items-center gap-2 text-[11px] font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireAccessible}
                    onChange={(e) => setRequireAccessible(e.target.checked)}
                    className="rounded border-slate-300 text-[#1D4ED8]"
                  />
                  Request step-free wheelchair-lift vehicle
                </label>
              </div>
            </div>

            {/* Step C: Start Date, Start Time, Passengers */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="visitor-start-date"
                  className="block text-xs font-semibold text-[#111827]"
                >
                  Ride Date
                </label>
                <div className="relative mt-1">
                  <Calendar
                    className="pointer-events-none absolute left-3 top-3.5 h-3.5 w-3.5 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="visitor-start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 pl-9 pr-3 py-2 font-mono text-xs text-slate-900 tabular-nums focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="visitor-start-time"
                  className="block text-xs font-semibold text-[#111827]"
                >
                  Start Time (SAST)
                </label>
                <div className="relative mt-1">
                  <Clock
                    className="pointer-events-none absolute left-3 top-3.5 h-3.5 w-3.5 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="visitor-start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 pl-9 pr-3 py-2 font-mono text-xs text-slate-900 tabular-nums focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="visitor-passengers"
                  className="block text-xs font-semibold text-[#111827]"
                >
                  Passengers (max {selectedTier.maxPassengers} in {selectedTier.name})
                </label>
                <div className="relative mt-1">
                  <Users
                    className="pointer-events-none absolute left-3 top-3.5 h-3.5 w-3.5 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="visitor-passengers"
                    type="number"
                    min={1}
                    max={7}
                    value={passengers}
                    onChange={(e) => handlePassengersChange(Number(e.target.value) || 1)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 pl-9 pr-3 py-2 font-mono text-xs text-slate-900 tabular-nums focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Step D: Duration Option Selector */}
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold text-[#111827]">
                  Duration Option ({selectedTier.name} Rates)
                </label>
                <span className="font-mono text-xs font-semibold text-[#1D4ED8] tabular-nums">
                  Ends {quote.endLabel}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  [
                    {
                      id: 'hourly',
                      title: 'Hourly',
                      sub: `R ${Math.round(selectedPillar.hourlyRateZar * selectedTier.rateMultiplier)}/hr`,
                    },
                    {
                      id: 'half_day',
                      title: 'Half-Day (4h)',
                      sub: `R ${Math.round(selectedPillar.halfDayRateZar * selectedTier.rateMultiplier)}`,
                    },
                    {
                      id: 'full_day',
                      title: 'Full-Day (8h)',
                      sub: `R ${Math.round(selectedPillar.fullDayRateZar * selectedTier.rateMultiplier)}`,
                    },
                    {
                      id: 'night_session',
                      title: 'Night / Session',
                      sub: `R ${Math.round(selectedPillar.nightSessionRateZar * selectedTier.rateMultiplier)} (2h)`,
                    },
                  ] as const
                ).map((opt) => {
                  const active = durationOption === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => handleSelectDuration(opt.id)}
                      className={`min-h-[54px] rounded-xl border px-3 py-2 text-left transition-colors ${
                        active
                          ? 'border-[#111827] bg-[#111827] text-white'
                          : 'border-slate-300 bg-white text-[#111827] hover:bg-slate-50'
                      }`}
                    >
                      <p className="text-xs font-bold whitespace-nowrap">{opt.title}</p>
                      <p
                        className={`mt-0.5 font-mono text-[11px] tabular-nums ${
                          active ? 'text-blue-300' : 'text-slate-500'
                        }`}
                      >
                        {opt.sub}
                      </p>
                    </button>
                  );
                })}
              </div>

              {durationOption === 'hourly' && (
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs">
                  <span className="font-semibold text-[#111827]">Select Charter Hours (1–12h)</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Decrease hours"
                      onClick={() => setHourlyCount((h) => Math.max(1, h - 1))}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white font-bold text-[#111827] hover:bg-slate-100"
                    >
                      −
                    </button>
                    <span className="w-14 text-center font-mono font-bold text-[#111827] tabular-nums">
                      {hourlyCount} hrs
                    </span>
                    <button
                      type="button"
                      aria-label="Increase hours"
                      onClick={() => setHourlyCount((h) => Math.min(12, h + 1))}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white font-bold text-[#111827] hover:bg-slate-100"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Helpful Local Notes (Daylight/Evening + Weather + Buffer) */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-bold text-[#111827]">
                  <SunMoon className="h-4 w-4 text-[#1D4ED8] shrink-0" aria-hidden="true" />
                  Local Timing, Weather &amp; Corridor Notes
                </span>
                <StatusText
                  label={`${plannedGuidance.timeBand} Window`}
                  tone={plannedGuidance.tone}
                />
              </div>
              <p className="text-slate-700 leading-relaxed">{selectedPillar.localGuidanceNote}</p>
              <p className="text-slate-600 leading-relaxed">
                <strong>Daylight / Evening Tip:</strong> {plannedGuidance.timingTip}
              </p>
              <p className="text-[11px] text-slate-500">
                <strong>Weather &amp; Buffer:</strong> {plannedGuidance.weatherCaveat} · {plannedGuidance.bufferNote}
              </p>
            </div>
          </div>

          {/* Right Live Reservation Summary, Pickup Code, Payment Choice & Safety (5 cols) */}
          <aside className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <p className="text-xs font-semibold text-[#15803D] inline-flex items-center gap-1">
                    <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Safety Verified Driver &amp; Vehicle
                  </p>
                  <h3 className="mt-0.5 font-display text-lg font-bold text-[#111827]">
                    Reservation Summary
                  </h3>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] text-slate-500">Pickup Code</p>
                  <p className="font-mono text-base font-bold text-[#1D4ED8] tabular-nums inline-flex items-center gap-1">
                    <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                    {draftPickupCode}
                  </p>
                </div>
              </div>

              {/* Selected Vehicle Photo + Driver Details */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70">
                <VehiclePhoto
                  src={selectedTier.imageUrl}
                  alt={`${selectedTier.name} — ${selectedPillar.title}`}
                  tierName={selectedTier.name}
                  className="w-full border-b border-slate-200"
                />
                <div className="p-3.5 space-y-1.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-[#111827] flex items-center gap-1.5">
                      <Car className="h-4 w-4 text-[#1D4ED8] shrink-0" aria-hidden="true" />
                      {selectedTier.name} · {selectedPillar.driverName}
                    </p>
                    <span className="font-mono text-[11px] font-semibold text-slate-600 tabular-nums">
                      Max {selectedTier.maxPassengers} seats
                    </span>
                  </div>
                  <p className="text-slate-600">
                    {selectedPillar.providerName} · {selectedTier.tagline}
                  </p>
                  <p className="text-[11px] font-semibold text-[#15803D]">
                    {selectedPillar.pdpBadge} · GPS Monitored
                    {(requireAccessible || selectedTier.accessibleFriendly) && ' · Step-Free Ready'}
                  </p>
                </div>
              </div>

              {/* Calculated Time, Passengers & Luggage Breakdown */}
              <dl className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 p-3.5 text-xs">
                <div>
                  <dt className="text-[11px] text-slate-500">Pickup Time</dt>
                  <dd className="mt-0.5 font-mono font-semibold text-[#111827] tabular-nums">
                    {startDate} · {startTime}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-500">Calculated End Time</dt>
                  <dd className="mt-0.5 font-mono font-semibold text-[#111827] tabular-nums">
                    {quote.endDate} · {quote.endTime}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-500">Passengers &amp; Route</dt>
                  <dd className="mt-0.5 font-semibold text-slate-700 tabular-nums">
                    {passengers} of {selectedTier.maxPassengers} seats · {routePreview.totalDistanceKm} km
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-500">Luggage Space</dt>
                  <dd className="mt-0.5 font-semibold text-slate-700">
                    {selectedTier.luggageSummary}
                  </dd>
                </div>
              </dl>

              {/* Payment Preference */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#111827]">
                  How would you like to pay?
                </label>
                <div className="space-y-2 text-xs">
                  {(
                    [
                      {
                        id: 'arrival_card',
                        label: 'Pay on Arrival — Card Machine',
                        detail: 'Reserve at R 0 now · Tap Visa/Mastercard on driver terminal at pickup.',
                        icon: <CreditCard className="h-4 w-4 text-[#15803D]" aria-hidden="true" />,
                      },
                      {
                        id: 'arrival_cash',
                        label: 'Pay on Arrival — Cash (ZAR)',
                        detail: 'Reserve at R 0 now · Settle ZAR cash directly with driver at pickup.',
                        icon: <Banknote className="h-4 w-4 text-[#15803D]" aria-hidden="true" />,
                      },
                      {
                        id: 'online_checkout',
                        label: 'Pay Online Now — PayShap or Card',
                        detail: 'Instant ZAR receipt before pickup via verified South African checkout.',
                        icon: <Smartphone className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />,
                      },
                    ] as const
                  ).map((pref) => {
                    const active = paymentChoice === pref.id;
                    return (
                      <button
                        key={pref.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setPaymentChoice(pref.id)}
                        className={`w-full min-h-[48px] flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors ${
                          active
                            ? 'border-[#1D4ED8] bg-[#EFF6FF]/60 ring-1 ring-[#1D4ED8]'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <span className="mt-0.5 shrink-0">{pref.icon}</span>
                        <div className="min-w-0">
                          <p className="font-bold text-[#111827]">{pref.label}</p>
                          <p className="text-[11px] text-slate-600">{pref.detail}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Total Cost + Primary CTA + Share / Report Actions */}
            <div className="space-y-3 border-t border-slate-200 pt-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Estimated Total Cost</p>
                  <p className="text-[11px] text-slate-500">
                    {paymentChoice === 'online_checkout'
                      ? 'Settled at online checkout'
                      : 'R 0 online now · Pay driver on arrival'}
                  </p>
                </div>
                <p className="font-display text-2xl font-bold text-[#111827] tabular-nums">
                  R {quote.totalZar.toLocaleString('en-ZA')}
                </p>
              </div>

              {plannerError && (
                <p role="alert" className="text-xs font-medium text-red-700">
                  {plannerError}
                </p>
              )}

              <button
                type="button"
                onClick={handleStartReservation}
                className="w-full min-h-[48px] rounded-xl bg-[#1D4ED8] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1E40AF] transition-colors"
              >
                {paymentChoice === 'online_checkout'
                  ? `Proceed to Secure Checkout (R ${quote.totalZar.toLocaleString('en-ZA')})`
                  : 'Reserve Ride (Pay on Arrival)'}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSharePayload({
                      title: `${selectedPillar.title} (${quote.durationLabel})`,
                      zone: `${selectedPickup.precinct} → ${selectedPillar.destinationZone}`,
                      dateLabel: startDate,
                      timeWindowLabel: `${startTime} – ${quote.endTime} SAST`,
                      pickupCode: draftPickupCode,
                      providerName: `${selectedPillar.driverName} · ${selectedPillar.providerName}`,
                      providerVerified: selectedPillar.safetyVerified,
                    })
                  }
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#111827] hover:bg-slate-50"
                >
                  <Share2 className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
                  Share Trip Plan
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setIncidentDraft({
                      tripTitle: `${selectedPillar.title} (${selectedPickup.precinct})`,
                      zone: selectedPillar.destinationZone,
                      bookingReference: previewRefSeed,
                      pickupCode: draftPickupCode,
                      driverOrProvider: `${selectedPillar.driverName} · ${selectedPillar.vehicleLabel}`,
                    })
                  }
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-50"
                >
                  <ShieldAlert className="h-3.5 w-3.5 text-red-700" aria-hidden="true" />
                  Report Concern
                </button>
              </div>
            </div>
          </aside>
        </section>
      )}

      {/* 2. Animated Route Playback & Stop Preview */}
      {showPlannerSection && (
        <div className="space-y-2">
          {inspectedRidePlayback && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#1D4ED8]/30 bg-[#EFF6FF] px-4 py-2 text-xs text-[#1E40AF]">
              <span>
                Previewing booked corridor: <strong>{inspectedRidePlayback.title}</strong>
                {inspectedRidePlayback.pickupCode ? ` · Code ${inspectedRidePlayback.pickupCode}` : ''}
              </span>
              <button
                type="button"
                onClick={() => setInspectedRidePlayback(null)}
                className="font-semibold underline whitespace-nowrap"
              >
                Return to Planned Route
              </button>
            </div>
          )}

          <AnimatedRoutePreview
            routeTitle={
              inspectedRidePlayback
                ? inspectedRidePlayback.title
                : `${selectedPickup.precinct} → ${selectedPillar.title}`
            }
            waypoints={routePreview.waypoints}
            totalDistanceKm={routePreview.totalDistanceKm}
            totalDriveMinutes={routePreview.totalDriveMinutes}
            driverName={
              inspectedRidePlayback?.driverName || selectedPillar.driverName
            }
            vehicleLabel={
              inspectedRidePlayback ? 'Accredited CapeSafe Charter Vehicle' : selectedPillar.vehicleLabel
            }
            pickupCode={
              inspectedRidePlayback?.pickupCode || draftPickupCode
            }
            timeBandLabel={`${plannedGuidance.timeBand} · ${quote.endTime} End`}
            googleMapsUrl={routePreview.googleMapsUrl}
          />
        </div>
      )}

      {/* 3. My Visitor Transport Bookings (Upcoming, Active, Past) */}
      {showRidesSection && (
        <section
          aria-label="My Visitor Transport Bookings"
          className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="font-display text-base sm:text-lg font-bold text-[#111827]">
                My Rides &amp; Transport Bookings ({visitorTransportBookings.length})
              </h2>
              <p className="text-xs text-slate-500">
                Quick-scan pickup codes, driver verification, payment status, live sharing, and trip-linked safety reporting.
              </p>
            </div>

            <div
              role="tablist"
              aria-label="Filter transport bookings by status"
              className="flex items-center gap-1.5 overflow-x-auto pb-0.5"
            >
              {(['All', 'Upcoming', 'Active', 'Past'] as const).map((bucket) => (
                <button
                  key={bucket}
                  type="button"
                  role="tab"
                  aria-selected={rideBucket === bucket}
                  onClick={() => setRideBucket(bucket)}
                  className={`min-h-[40px] shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    rideBucket === bucket
                      ? 'bg-[#111827] text-white'
                      : 'bg-slate-100 text-slate-600 hover:text-[#111827]'
                  }`}
                >
                  {bucket} ({rideBucketCounts[bucket]})
                </button>
              ))}
            </div>
          </div>

          {visibleRides.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-600 space-y-2">
              <p className="font-semibold text-[#111827]">
                No {rideBucket === 'All' ? '' : `${rideBucket.toLowerCase()} `}transport bookings yet
              </p>
              <p>
                Use the Duration &amp; Trip Planner above to reserve a safe Table Mountain, Cape Point, Winelands, or Langa transfer.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {visibleRides.map((ride) => {
                const bucket = classifyTransportBookingBucket(ride.status);
                const pickupCode = derivePickupVerificationCode(ride.id, ride.bookingReference);
                const matchedPayment = payments.find(
                  (p) => p.id === ride.paymentId || p.bookingId === ride.id
                );
                const settled = isPaymentSettledStatus(ride.paymentStatus);
                const canPayNow =
                  !settled &&
                  ride.status !== 'Cancelled' &&
                  ride.status !== 'Rejected' &&
                  onCompleteCheckout;
                const canCancel =
                  (ride.status === 'Confirmed' || isAwaitingBookingStatus(ride.status)) &&
                  onCancelBooking;

                const rideTier = inferVehicleTierFromText(ride.title);

                return (
                  <article
                    key={ride.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 text-xs flex flex-col justify-between"
                  >
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-[#1D4ED8] flex items-center gap-1.5">
                          <Bus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          {bucket} Ride · {ride.bookingReference || ride.id.toUpperCase()}
                        </span>
                        <StatusText
                          label={ride.status}
                          tone={
                            ride.status === 'Confirmed' || ride.status === 'Completed'
                              ? 'nominal'
                              : ride.status === 'Cancelled' || ride.status === 'Rejected'
                              ? 'alert'
                              : 'advisory'
                          }
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-24 shrink-0">
                          <VehiclePhoto
                            src={rideTier.imageUrl}
                            alt={`${rideTier.name} — ${ride.title}`}
                            tierName={rideTier.name}
                            variant="thumb"
                            className="rounded-lg border border-slate-200"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-display text-base font-bold text-[#111827] line-clamp-2">
                            {ride.title}
                          </h3>
                          <p className="mt-0.5 text-slate-600 truncate">
                            {ride.providerName} · {ride.zone || 'Cape Peninsula'}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500 truncate">
                            {rideTier.name} · {ride.guests} guest(s) · {rideTier.luggageSummary}
                          </p>
                        </div>
                      </div>

                      {/* Core Mobile-First Info Strip */}
                      <div className="grid grid-cols-2 gap-2.5 rounded-xl bg-slate-50 p-3">
                        <div>
                          <p className="text-[11px] text-slate-500">Schedule</p>
                          <p className="font-mono font-semibold text-[#111827] tabular-nums">
                            {ride.date} · {ride.timeSlot}
                            {ride.endTime ? ` → ${ride.endTime}` : ''}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-500">Pickup Handoff Code</p>
                          <p className="font-mono text-sm font-bold text-[#1D4ED8] tabular-nums inline-flex items-center gap-1">
                            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                            {pickupCode}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-500">Driver &amp; Vehicle</p>
                          <p className="font-semibold text-[#15803D] inline-flex items-center gap-1">
                            <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            {ride.safetyVerified ? 'Safety Verified Driver' : 'Audit Pending'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-500">Payment Choice &amp; Total</p>
                          <p className="font-mono font-bold text-[#111827] tabular-nums">
                            R {ride.priceZar.toLocaleString('en-ZA')} ·{' '}
                            <span className="font-sans font-medium text-slate-600">
                              {ride.paymentMethod === 'Pay in Person'
                                ? 'Pay on Arrival (Cash / Card)'
                                : `${ride.paymentMethod || 'Arrival'} (${ride.paymentStatus || 'Unpaid'})`}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Action Row (>= 44px touch targets) */}
                    <div className="space-y-2 border-t border-slate-100 pt-3">
                      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            setInspectedRidePlayback({
                              title: ride.title,
                              zone: ride.zone || 'Cape Point',
                              pickupCode,
                              driverName: ride.providerName,
                            });
                            setMobileSectionFocus('all');
                          }}
                          className="inline-flex min-h-[44px] sm:min-h-[38px] items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold text-[#111827] hover:bg-slate-50"
                        >
                          <PlayCircle className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
                          Route Playback
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setSharePayload({
                              title: ride.title,
                              zone: ride.zone || ride.providerName,
                              dateLabel: ride.date,
                              timeWindowLabel: `${ride.timeSlot}${ride.endTime ? ` → ${ride.endTime}` : ''}`,
                              pickupCode,
                              providerName: ride.providerName,
                              providerVerified: ride.safetyVerified,
                            })
                          }
                          className="inline-flex min-h-[44px] sm:min-h-[38px] items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold text-[#111827] hover:bg-slate-50"
                        >
                          <Share2 className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
                          Share Trip
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setIncidentDraft({
                              tripTitle: ride.title,
                              zone: ride.zone || 'Cape Town',
                              bookingReference: ride.bookingReference,
                              pickupCode,
                              driverOrProvider: ride.providerName,
                            })
                          }
                          className="inline-flex min-h-[44px] sm:min-h-[38px] items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold text-red-800 hover:bg-red-50"
                        >
                          <ShieldAlert className="h-3.5 w-3.5 text-red-700" aria-hidden="true" />
                          Report Concern
                        </button>

                        {matchedPayment && isPaymentSettledStatus(matchedPayment.paymentStatus) && (
                          <button
                            type="button"
                            onClick={() => setRecentPaymentReceipt(matchedPayment)}
                            className="inline-flex min-h-[44px] sm:min-h-[38px] items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-[#F0FDF4] px-3 py-2 font-semibold text-[#15803D] hover:bg-emerald-100"
                          >
                            <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
                            Receipt
                          </button>
                        )}

                        {canPayNow && (
                          <button
                            type="button"
                            onClick={() => handleOpenBookingCheckout(ride, matchedPayment)}
                            className="inline-flex min-h-[44px] sm:min-h-[38px] items-center justify-center gap-1.5 rounded-xl bg-[#1D4ED8] px-3 py-2 font-semibold text-white hover:bg-[#1E40AF]"
                          >
                            Pay Online
                          </button>
                        )}

                        {canCancel && cancellingRideId !== ride.id && (
                          <button
                            type="button"
                            onClick={() => setCancellingRideId(ride.id)}
                            className="inline-flex min-h-[44px] sm:min-h-[38px] items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 font-semibold text-red-700 hover:bg-red-50"
                          >
                            <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                            Cancel Ride
                          </button>
                        )}
                      </div>

                      {cancellingRideId === ride.id && (
                        <div className="rounded-xl border border-red-200 bg-red-50/70 p-3 space-y-2">
                          <label className="block font-semibold text-red-900">
                            Confirm ride cancellation?
                          </label>
                          <input
                            type="text"
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            placeholder="Optional reason (e.g. flight change)"
                            className="w-full min-h-[40px] rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={cancelBusy}
                              onClick={() => void handleConfirmCancelRide(ride.id)}
                              className="min-h-[40px] rounded-lg bg-red-700 px-3 py-1.5 font-semibold text-white hover:bg-red-800 disabled:opacity-50"
                            >
                              {cancelBusy ? 'Cancelling...' : 'Confirm Cancel'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCancellingRideId(null);
                                setCancelReason('');
                              }}
                              className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700"
                            >
                              Keep Ride
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* 4. Cape Town Public Transit Corridors & Accredited Listings */}
      {showTransitSection && (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search
                className="pointer-events-none absolute left-3 top-3.5 h-3.5 w-3.5 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="text"
                aria-label="Search Cape Town transport routes"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search MyCiTi, rail or airport corridor..."
                className="w-full min-h-[44px] rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-pressed={accessibleOnly}
                onClick={() => setAccessibleOnly((v) => !v)}
                className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  accessibleOnly
                    ? 'border-[#1D4ED8] bg-[#EFF6FF] text-[#1D4ED8]'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Accessibility className="h-4 w-4" aria-hidden="true" />
                {accessibleOnly ? 'Step-Free Only: On' : 'Step-Free Transit'}
              </button>

              <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-0.5">
                {(
                  [
                    'All',
                    'MyCiTi Rapid Bus',
                    'Table Mountain Shuttle',
                    'Metrorail Southern Line',
                    'Verified E-Hailing Zone',
                  ] as const
                ).map((svc) => (
                  <button
                    key={svc}
                    type="button"
                    aria-pressed={serviceFilter === svc}
                    onClick={() => setServiceFilter(svc)}
                    className={`min-h-[40px] shrink-0 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                      serviceFilter === svc
                        ? 'bg-[#111827] text-white'
                        : 'bg-slate-100 text-slate-600 hover:text-[#111827]'
                    }`}
                  >
                    {svc === 'All' ? 'All Services' : svc}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-3.5 flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold text-[#111827]">
                Cape Town Public Transit Corridors
              </h2>
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                <Info className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
                Add any public route to My Trips or share live status
              </span>
            </div>

            <div className="md:hidden divide-y divide-slate-200">
              {visiblePublicRoutes.map((route) => (
                <div key={route.id} className="p-4 space-y-2.5 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[#1D4ED8]">
                      <Bus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {route.service}
                    </span>
                    <StatusText
                      label={route.status}
                      tone={route.status === 'On Schedule' ? 'nominal' : 'advisory'}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#111827]">{route.routeName}</p>
                    <p className="text-slate-600">{route.corridor}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2.5">
                    <div>
                      <p className="text-[10px] text-slate-500">Frequency</p>
                      <p className="font-mono font-semibold text-[#111827] tabular-nums">
                        {route.frequency}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">Fare</p>
                      <p className="font-mono font-semibold text-[#111827] tabular-nums">
                        {route.fareZar}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">Access</p>
                      <p className="font-medium text-slate-700">
                        {route.accessible ? 'Level' : 'Steps'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSharePayload({
                          title: `${route.service}: ${route.routeName}`,
                          zone: route.corridor,
                          dateLabel: 'Planned Transit',
                          timeWindowLabel: `${route.frequency} · Fare ${route.fareZar}`,
                          providerName: route.service,
                          providerVerified: true,
                        })
                      }
                      className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#111827] hover:bg-slate-50"
                    >
                      <Share2 className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
                      Share Route
                    </button>
                    {onAddRouteToTrip && (
                      <button
                        type="button"
                        disabled={addingId === route.id}
                        onClick={() => void handleAddToTrip(route)}
                        className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#1D4ED8] bg-[#EFF6FF] px-3 py-2 text-xs font-semibold text-[#1E40AF] hover:bg-blue-100 disabled:opacity-50"
                      >
                        <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        {addingId === route.id
                          ? 'Adding...'
                          : addedId === route.id
                          ? 'Added'
                          : 'Add to Trips'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-5 py-3">Service</th>
                    <th className="px-5 py-3">Route &amp; Corridor</th>
                    <th className="px-5 py-3">Frequency</th>
                    <th className="px-5 py-3">Fare (ZAR)</th>
                    <th className="px-5 py-3">Access</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Trip &amp; Safety</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {visiblePublicRoutes.map((route) => {
                    const routeGuidance = computeSmartGuidance({
                      title: `${route.service} ${route.routeName}`,
                      zone: route.corridor,
                      category: 'Transport',
                      weather,
                    });
                    return (
                      <tr key={route.id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-2 font-semibold text-[#111827] whitespace-nowrap">
                            <Bus className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
                            {route.service}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-[#111827]">{route.routeName}</p>
                          <p className="text-xs text-slate-500">{route.corridor}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {routeGuidance.bufferNote}
                          </p>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs tabular-nums text-slate-700">
                          {route.frequency}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs tabular-nums text-slate-800">
                          {route.fareZar}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-600">
                          {route.accessible ? 'Level Boarding' : 'Steps at Platform'}
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusText
                            label={route.status}
                            tone={route.status === 'On Schedule' ? 'nominal' : 'advisory'}
                          />
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setSharePayload({
                                  title: `${route.service}: ${route.routeName}`,
                                  zone: route.corridor,
                                  dateLabel: 'Planned Transit',
                                  timeWindowLabel: `${route.frequency} · Fare ${route.fareZar}`,
                                  providerName: route.service,
                                  providerVerified: true,
                                })
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#111827] hover:bg-slate-50 whitespace-nowrap"
                            >
                              <Share2 className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
                              Share
                            </button>
                            {onAddRouteToTrip && (
                              <button
                                type="button"
                                disabled={addingId === route.id}
                                onClick={() => void handleAddToTrip(route)}
                                className="inline-flex items-center gap-1 rounded-lg border border-[#1D4ED8] bg-[#EFF6FF] px-2.5 py-1.5 text-xs font-semibold text-[#1E40AF] hover:bg-blue-100 disabled:opacity-50 transition-colors whitespace-nowrap"
                              >
                                <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />
                                {addingId === route.id
                                  ? 'Adding...'
                                  : addedId === route.id
                                  ? 'Added to Trips'
                                  : 'Add to Trips'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {transportOfferings.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-display text-base font-bold text-[#111827]">
                    Bookable Accredited Transport Operators
                  </h2>
                  <p className="text-xs text-slate-500">
                    Direct partner fleet listings synced with Provider Operations &amp; Smart Bookings.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    aria-pressed={verifiedDriversOnly}
                    onClick={() => setVerifiedDriversOnly((v) => !v)}
                    className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                      verifiedDriversOnly
                        ? 'border-[#15803D] bg-[#F0FDF4] text-[#15803D]'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    {verifiedDriversOnly ? 'Vetted Drivers: On' : 'Vetted Drivers Only'}
                  </button>
                  {onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate('bookings')}
                      className="min-h-[40px] rounded-xl bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] transition-colors whitespace-nowrap"
                    >
                      Open Smart Bookings
                    </button>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {transportOfferings
                  .filter((item) => !verifiedDriversOnly || Boolean(item.safetyChecklistComplete))
                  .map((item) => {
                    const matchedTier = inferVehicleTierFromText(item.experienceTitle);
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3.5 text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-20 shrink-0">
                            <VehiclePhoto
                              src={item.imageUrl || matchedTier.imageUrl}
                              alt={`${item.experienceTitle} vehicle preview`}
                              tierName={matchedTier.name}
                              variant="thumb"
                              className="rounded-lg border border-slate-200"
                            />
                          </div>
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="font-semibold text-[#111827]">{item.experienceTitle}</p>
                              {item.safetyChecklistComplete ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#15803D]">
                                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                                  Driver Verified
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800">
                                  <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                                  Audit Pending
                                </span>
                              )}
                            </div>
                            <p className="text-slate-600 truncate">
                              {item.providerName} · {item.zone} · {item.nextDeparture}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {matchedTier.name} · {matchedTier.luggageSummary}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono font-bold text-[#111827] tabular-nums">
                            R {item.priceZar.toLocaleString('en-ZA')}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            per {(item.durationUnit || 'days').slice(0, -1)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Trip Share Modal */}
      <TripStatusShareModal
        payload={sharePayload}
        travelerName={effectiveUser.name}
        userEmergencyContact={effectiveUser.emergencyContact}
        trustedContacts={trustedContacts}
        onClose={() => setSharePayload(null)}
      />

      {/* Linked Safety Concern Modal */}
      <TripIncidentReportModal
        draft={incidentDraft}
        user={effectiveUser}
        onSubmitIncident={
          onReportIncident ||
          (async () => {
            /* fallback no-op when unmounted */
          })
        }
        onClose={() => setIncidentDraft(null)}
      />

      {/* Receipt Modal */}
      {recentPaymentReceipt && (
        <PaymentReceiptModal
          payment={recentPaymentReceipt}
          onClose={() => setRecentPaymentReceipt(null)}
        />
      )}
    </div>
  );
};
