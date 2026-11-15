import type {
  BookingItem,
  DurationUnit,
  OfferingType,
  PricingModel,
  ProviderListing,
  TripActivity,
} from '@/src/types/app';

export interface EndDateTimeResult {
  endDate: string;
  endTime: string;
  durationSummary: string;
  endLabel: string;
}

export interface AvailabilityCheckResult {
  available: boolean;
  remainingUnits: number;
  reason?: string;
}

/**
 * Extracts HH:mm (24h) from flexible slot strings such as "09:00", "08:30 SAST", or "Check-in 14:00".
 */
export function parseTimeHHMM(timeSlot: string): { hours: number; minutes: number } {
  const match = timeSlot.match(/(\d{1,2}):(\d{2})/);
  if (!match) return { hours: 9, minutes: 0 };
  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const minutes = Math.min(59, Math.max(0, Number(match[2])));
  return { hours, minutes };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatUtcDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function formatUtcTime(d: Date): string {
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

/**
 * Calculates deterministic end date and end time using UTC calendar arithmetic
 * so browser timezone offsets never cause off-by-one-day shifts.
 */
export function calculateBookingEndDateTime(
  startDate: string,
  startTime: string,
  durationUnit: DurationUnit,
  durationValue: number
): EndDateTimeResult {
  const safeDuration = Math.max(1, Math.min(60, Math.round(durationValue || 1)));
  const dateParts = startDate.split('-').map((p) => Number(p));
  const validDate =
    dateParts.length === 3 &&
    Number.isFinite(dateParts[0]) &&
    Number.isFinite(dateParts[1]) &&
    Number.isFinite(dateParts[2]);

  const baseYear = validDate ? dateParts[0] : 2026;
  const baseMonth = validDate ? dateParts[1] - 1 : 10;
  const baseDay = validDate ? dateParts[2] : 16;
  const { hours, minutes } = parseTimeHHMM(startTime);

  const unitLabel =
    safeDuration === 1 ? durationUnit.slice(0, -1) : durationUnit;
  const durationSummary = `${safeDuration} ${unitLabel}`;

  if (durationUnit === 'hours') {
    const startUtcMs = Date.UTC(baseYear, baseMonth, baseDay, hours, minutes);
    const endUtc = new Date(startUtcMs + safeDuration * 60 * 60 * 1000);
    const endDate = formatUtcDate(endUtc);
    const endTime = formatUtcTime(endUtc);
    return {
      endDate,
      endTime,
      durationSummary,
      endLabel: `${endDate} · ${endTime} SAST`,
    };
  }

  if (durationUnit === 'sessions') {
    // Standard CapeSafe guided session = 2 hours
    const totalHours = safeDuration * 2;
    const startUtcMs = Date.UTC(baseYear, baseMonth, baseDay, hours, minutes);
    const endUtc = new Date(startUtcMs + totalHours * 60 * 60 * 1000);
    const endDate = formatUtcDate(endUtc);
    const endTime = formatUtcTime(endUtc);
    return {
      endDate,
      endTime,
      durationSummary: `${durationSummary} (${totalHours}h)`,
      endLabel: `${endDate} · ${endTime} SAST`,
    };
  }

  if (durationUnit === 'nights') {
    const endUtc = new Date(Date.UTC(baseYear, baseMonth, baseDay + safeDuration, 10, 0));
    const endDate = formatUtcDate(endUtc);
    const endTime = '10:00';
    return {
      endDate,
      endTime,
      durationSummary,
      endLabel: `${endDate} · ${endTime} SAST checkout`,
    };
  }

  // 'days': inclusive multi-day schedule ending at 17:00 SAST on the final day
  const endUtc = new Date(Date.UTC(baseYear, baseMonth, baseDay + (safeDuration - 1), 17, 0));
  const endDate = formatUtcDate(endUtc);
  const endTime = '17:00';
  return {
    endDate,
    endTime,
    durationSummary,
    endLabel: `${endDate} · ${endTime} SAST`,
  };
}

/**
 * Calculates total ZAR price from provider-defined unit pricing, duration, and guest count.
 */
export function calculateBookingPriceZar(
  unitPriceZar: number,
  durationValue: number,
  guests: number,
  pricingModel: PricingModel = 'per_guest'
): number {
  const safePrice = Math.max(0, Number(unitPriceZar) || 0);
  const safeDuration = Math.max(1, Math.round(durationValue || 1));
  const safeGuests = Math.max(1, Math.round(guests || 1));

  if (pricingModel === 'per_unit') {
    return Math.round(safePrice * safeDuration);
  }
  return Math.round(safePrice * safeDuration * safeGuests);
}

/**
 * Evaluates live/demo availability for a provider offering on a given start date and party size.
 */
export function checkOfferingAvailability(
  offering: ProviderListing,
  startDate: string,
  guests: number
): AvailabilityCheckResult {
  const remainingUnits = Math.max(0, offering.capacity - offering.bookedSeats);

  if (offering.status !== 'Active') {
    return {
      available: false,
      remainingUnits,
      reason: 'Paused by tourism provider',
    };
  }

  if (!offering.safetyChecklistComplete) {
    return {
      available: false,
      remainingUnits,
      reason: 'Awaiting provider pre-departure safety audit',
    };
  }

  if (startDate && offering.blockedDates?.includes(startDate)) {
    return {
      available: false,
      remainingUnits,
      reason: `Unavailable on ${startDate} (provider blackout date)`,
    };
  }

  const unitsNeeded = offering.pricingModel === 'per_unit' ? 1 : Math.max(1, Math.round(guests || 1));
  if (remainingUnits < unitsNeeded) {
    return {
      available: false,
      remainingUnits,
      reason:
        remainingUnits === 0
          ? 'Sold out / zero remaining capacity'
          : `Only ${remainingUnits} unit(s) available for requested party`,
    };
  }

  return {
    available: true,
    remainingUnits,
  };
}

/**
 * Maps a confirmed Accommodation, Transport, or Activity booking into a unified My Trips itinerary item.
 */
export function buildItineraryFromConfirmedBooking(
  booking: BookingItem,
  dayNumber: number
): Omit<TripActivity, 'id' | 'completed' | 'dataOrigin'> {
  const inferredType: OfferingType =
    booking.offeringType ||
    (booking.category.toLowerCase().includes('accom') || booking.category.toLowerCase().includes('stay')
      ? 'Accommodation'
      : booking.category.toLowerCase().includes('transport') ||
        booking.category.toLowerCase().includes('shuttle') ||
        booking.category.toLowerCase().includes('transfer')
      ? 'Transport'
      : 'Activity');

  const safeDay = Math.max(1, Math.min(30, Math.round(dayNumber || 1)));
  const startTime = booking.timeSlot.replace(/\s*SAST$/i, '').slice(0, 16) || '09:00';
  const endDetail = booking.endDate
    ? `Ends ${booking.endDate}${booking.endTime ? ` ${booking.endTime}` : ''}`
    : `${booking.guests} guest(s)`;

  return {
    day: safeDay,
    dayLabel: `Day ${safeDay} · ${booking.date}`,
    time: startTime,
    title: `${booking.title} (${inferredType})`,
    zone: booking.zone || booking.providerName,
    transportNote: `${booking.providerName} · ${endDetail}`,
    safetyNote: booking.accessible
      ? 'Confirmed · Step-Free Accredited'
      : 'Confirmed · Provider Verified',
    itemType: inferredType,
    bookingId: booking.id,
    date: booking.date,
    endDate: booking.endDate,
    endTime: booking.endTime,
  };
}
