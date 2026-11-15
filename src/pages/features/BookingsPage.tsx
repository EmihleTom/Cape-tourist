import React, { useMemo, useState } from 'react';
import {
  Accessibility,
  BedDouble,
  Bus,
  CalendarCheck,
  Clock,
  Compass,
  Info,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { DemoDataNotice } from '@/src/components/common/DemoDataNotice';
import { StatusText } from '@/src/components/common/StatusText';
import type {
  BookingItem,
  DemoUser,
  DurationUnit,
  NavSectionId,
  OfferingType,
  ProviderListing,
} from '@/src/types/app';
import {
  calculateBookingEndDateTime,
  calculateBookingPriceZar,
  checkOfferingAvailability,
} from '@/src/utils/bookingCalculations';

interface BookingsPageProps {
  user: DemoUser;
  bookings: BookingItem[];
  offerings: ProviderListing[];
  onCreateBooking: (
    booking: Omit<BookingItem, 'id' | 'status' | 'dataOrigin'>
  ) => Promise<void> | void;
  onCancelBooking: (bookingId: string, reason?: string) => Promise<void> | void;
  onNavigate?: (section: NavSectionId) => void;
}

const OFFERING_ICONS: Record<OfferingType, React.ReactNode> = {
  Accommodation: <BedDouble className="h-3.5 w-3.5 text-[#0D9488]" aria-hidden="true" />,
  Transport: <Bus className="h-3.5 w-3.5 text-[#0D9488]" aria-hidden="true" />,
  Activity: <Compass className="h-3.5 w-3.5 text-[#0D9488]" aria-hidden="true" />,
};

export const BookingsPage: React.FC<BookingsPageProps> = ({
  user,
  bookings,
  offerings,
  onCreateBooking,
  onCancelBooking,
  onNavigate,
}) => {
  const [statusFilter, setStatusFilter] = useState<'All' | BookingItem['status']>('All');
  const [typeFilter, setTypeFilter] = useState<'All' | OfferingType>('All');

  // Smart Booking Builder State
  const [selectedOfferingId, setSelectedOfferingId] = useState<string>(
    offerings.find((o) => o.status === 'Active')?.id || offerings[0]?.id || ''
  );
  const [startDate, setStartDate] = useState('2026-11-18');
  const [startTime, setStartTime] = useState('09:00');
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('sessions');
  const [durationValue, setDurationValue] = useState(1);
  const [guests, setGuests] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [bookingFeedback, setBookingFeedback] = useState('');
  const [bookingError, setBookingError] = useState('');

  // Cancellation Note State
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const selectedOffering = useMemo(
    () => offerings.find((o) => o.id === selectedOfferingId) || offerings[0] || null,
    [offerings, selectedOfferingId]
  );

  const handleSelectOffering = (offering: ProviderListing) => {
    setSelectedOfferingId(offering.id);
    setDurationUnit(offering.durationUnit || 'sessions');
    setDurationValue(offering.defaultDurationValue || 1);
    const defaultTime = offering.nextDeparture.match(/(\d{1,2}:\d{2})/)?.[1] || '09:00';
    setStartTime(defaultTime);
    setBookingError('');
    setBookingFeedback('');
  };

  const calculatedEnd = useMemo(
    () => calculateBookingEndDateTime(startDate, startTime, durationUnit, durationValue),
    [startDate, startTime, durationUnit, durationValue]
  );

  const pricingModel = selectedOffering?.pricingModel || 'per_guest';
  const unitPriceZar = selectedOffering?.priceZar ?? 0;
  const calculatedTotalZar = useMemo(
    () => calculateBookingPriceZar(unitPriceZar, durationValue, guests, pricingModel),
    [unitPriceZar, durationValue, guests, pricingModel]
  );

  const availability = useMemo(() => {
    if (!selectedOffering) {
      return { available: false, remainingUnits: 0, reason: 'Select a provider offering' };
    }
    return checkOfferingAvailability(selectedOffering, startDate, guests);
  }, [selectedOffering, startDate, guests]);

  const filteredOfferings = offerings.filter(
    (o) => typeFilter === 'All' || (o.offeringType || 'Activity') === typeFilter
  );

  const filteredBookings = bookings.filter((b) => {
    const matchesStatus = statusFilter === 'All' || b.status === statusFilter;
    const matchesType =
      typeFilter === 'All' || (b.offeringType || 'Activity') === typeFilter;
    return matchesStatus && matchesType;
  });

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingFeedback('');
    setBookingError('');

    if (!selectedOffering) {
      setBookingError('Please select a Cape Town provider offering first.');
      return;
    }
    if (!availability.available) {
      setBookingError(availability.reason || 'Selected offering is currently unavailable.');
      return;
    }

    setSubmitting(true);
    try {
      await onCreateBooking({
        userId: user.id,
        providerId: selectedOffering.providerId || user.id,
        offeringId: selectedOffering.id,
        offeringType: selectedOffering.offeringType || 'Activity',
        title: selectedOffering.experienceTitle,
        providerName: selectedOffering.providerName || 'Accredited CapeSafe Partner',
        category: selectedOffering.category || selectedOffering.offeringType || 'Experience',
        zone: selectedOffering.zone || 'Cape Town',
        date: startDate,
        timeSlot: startTime,
        durationUnit,
        durationValue,
        endDate: calculatedEnd.endDate,
        endTime: calculatedEnd.endTime,
        unitPriceZar,
        pricingModel,
        guests,
        priceZar: calculatedTotalZar,
        safetyVerified: selectedOffering.safetyChecklistComplete,
        accessible: Boolean(selectedOffering.accessible),
      });
      setBookingFeedback(
        `Reservation request submitted for "${selectedOffering.experienceTitle}" (${calculatedEnd.durationSummary}). Status is Pending Verification until confirmed by the provider.`
      );
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : 'Unable to submit booking request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmCancel = async (bookingId: string) => {
    await onCancelBooking(bookingId, cancelReason.trim() || 'Cancelled by tourist');
    setCancellingId(null);
    setCancelReason('');
  };

  const confirmedCount = bookings.filter((b) => b.status === 'Confirmed').length;
  const pendingCount = bookings.filter((b) => b.status === 'Pending Verification').length;

  return (
    <div className="space-y-6">
      <DemoDataNotice
        scope={
          user.authMode === 'firebase' && user.emailVerified
            ? 'Live Firestore Booking System · Requests persist as Pending Verification until confirmed by an accredited provider'
            : 'Demonstration Booking System — Sign in with Firebase to persist live reservations & provider confirmations'
        }
      />

      {/* Header + Category Switcher */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">
            Smart Bookings &amp; Reservations
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Book accommodation, transport, and guided activities in hours, days, nights, or sessions with automatic end-date and provider pricing calculations.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-1">
          {(['All', 'Accommodation', 'Transport', 'Activity'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                typeFilter === t
                  ? 'bg-[#0D9488] text-white'
                  : 'text-slate-600 hover:text-[#0B1F3A]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Strict Confirmation Policy Notice */}
      <div className="flex items-start gap-2.5 rounded-xl border border-[#0D9488]/30 bg-[#F0FDFA] px-4 py-3 text-xs text-[#0B1F3A]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#0D9488]" aria-hidden="true" />
        <p>
          <strong>Provider Verification Rule:</strong> New bookings always start as{' '}
          <strong className="text-amber-800">Pending Verification</strong>. No reservation is shown as{' '}
          <strong className="text-[#15803D]">Confirmed</strong> until the relevant tourism service provider or authorized administrator verifies availability.
        </p>
      </div>

      {/* Provider Offerings Catalog + Interactive Reservation Builder */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Catalog */}
        <section className="space-y-3 lg:col-span-7">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[#0B1F3A]">
              Available Provider Offerings ({filteredOfferings.length})
            </h2>
            <span className="text-xs text-slate-500">Select an offering to calculate dates &amp; ZAR total</span>
          </div>

          <div className="grid gap-3">
            {filteredOfferings.map((offering) => {
              const isSelected = selectedOffering?.id === offering.id;
              const avail = checkOfferingAvailability(offering, startDate, guests);
              const unitName = (offering.durationUnit || 'sessions').slice(0, -1);

              return (
                <article
                  key={offering.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    isSelected
                      ? 'border-[#0D9488] bg-[#F0FDFA]/50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 font-semibold text-[#0D9488]">
                          {OFFERING_ICONS[offering.offeringType || 'Activity']}
                          {offering.offeringType || 'Activity'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="text-slate-600">{offering.zone || 'Cape Town'}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                          {offering.dataOrigin === 'live' ? 'Live' : 'Demo'}
                        </span>
                      </div>
                      <h3 className="font-display text-base font-bold text-[#0B1F3A]">
                        {offering.experienceTitle}
                      </h3>
                      <p className="text-xs text-slate-600">
                        Provider: <strong className="text-slate-800">{offering.providerName || 'CapeSafe Partner'}</strong>
                        {offering.description ? ` · ${offering.description}` : ''}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px]">
                        <span className="font-mono text-slate-700 tabular-nums">
                          Capacity left: {avail.remainingUnits}/{offering.capacity}
                        </span>
                        {offering.safetyChecklistComplete ? (
                          <span className="inline-flex items-center gap-1 font-medium text-[#15803D]">
                            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                            Safety Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-medium text-amber-800">
                            <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                            Audit Pending
                          </span>
                        )}
                        {offering.accessible && (
                          <span className="inline-flex items-center gap-1 font-medium text-[#0D9488]">
                            <Accessibility className="h-3.5 w-3.5" aria-hidden="true" />
                            Step-Free
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2 sm:flex-col sm:items-end sm:border-t-0 sm:pt-0">
                      <div className="text-left sm:text-right">
                        <p className="font-mono text-base font-bold text-[#0B1F3A] tabular-nums">
                          R {offering.priceZar.toLocaleString('en-ZA')}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          per {unitName} · {offering.pricingModel === 'per_unit' ? 'per booking' : 'per guest'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectOffering(offering)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                          isSelected
                            ? 'bg-[#0B1F3A] text-white'
                            : 'border border-slate-300 bg-white text-[#0B1F3A] hover:bg-slate-50'
                        }`}
                      >
                        {isSelected ? 'Selected' : 'Select Offering'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Smart Booking Calculator & Request Form */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5 h-fit space-y-4">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="font-display text-base font-bold text-[#0B1F3A]">
              Smart Reservation Calculator
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {selectedOffering
                ? selectedOffering.experienceTitle
                : 'Select an offering on the left'}
            </p>
          </div>

          <form onSubmit={handleSubmitBooking} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="bk-start-date" className="block text-xs font-semibold text-slate-700">
                  Start Date
                </label>
                <input
                  id="bk-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 focus:border-[#0D9488] focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="bk-start-time" className="block text-xs font-semibold text-slate-700">
                  Start / Check-In Time
                </label>
                <input
                  id="bk-start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 focus:border-[#0D9488] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="bk-dur-val" className="block text-xs font-semibold text-slate-700">
                  Duration
                </label>
                <input
                  id="bk-dur-val"
                  type="number"
                  min={1}
                  max={30}
                  value={durationValue}
                  onChange={(e) => setDurationValue(Math.max(1, Number(e.target.value)))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 focus:border-[#0D9488] focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="bk-dur-unit" className="block text-xs font-semibold text-slate-700">
                  Unit
                </label>
                <select
                  id="bk-dur-unit"
                  value={durationUnit}
                  onChange={(e) => setDurationUnit(e.target.value as DurationUnit)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-[#0D9488] focus:outline-none"
                >
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                  <option value="nights">Nights</option>
                  <option value="sessions">Sessions (2h)</option>
                </select>
              </div>
              <div>
                <label htmlFor="bk-guests" className="block text-xs font-semibold text-slate-700">
                  Guests
                </label>
                <input
                  id="bk-guests"
                  type="number"
                  min={1}
                  max={20}
                  value={guests}
                  onChange={(e) => setGuests(Math.max(1, Number(e.target.value)))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 focus:border-[#0D9488] focus:outline-none"
                />
              </div>
            </div>

            {/* Automatic End-Date & Pricing Summary */}
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-slate-600">
                  <Clock className="h-3.5 w-3.5 text-[#0D9488]" aria-hidden="true" />
                  Calculated End
                </span>
                <span className="font-mono font-semibold text-[#0B1F3A] tabular-nums">
                  {calculatedEnd.endLabel}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">Provider Availability</span>
                <StatusText
                  label={
                    availability.available
                      ? `${availability.remainingUnits} unit(s) open`
                      : availability.reason || 'Unavailable'
                  }
                  tone={availability.available ? 'nominal' : 'alert'}
                />
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                <div>
                  <p className="font-semibold text-[#0B1F3A]">Total Provider Quote</p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    R {unitPriceZar.toLocaleString('en-ZA')} × {durationValue} {durationUnit}
                    {pricingModel === 'per_guest' ? ` × ${guests} guests` : ' (unit rate)'}
                  </p>
                </div>
                <p className="font-display text-xl font-bold text-[#0B1F3A] tabular-nums">
                  R {calculatedTotalZar.toLocaleString('en-ZA')}
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !availability.available}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0D9488] py-2.5 text-xs font-semibold text-white hover:bg-[#0F766E] disabled:opacity-50 transition-colors"
            >
              <CalendarCheck className="h-4 w-4" aria-hidden="true" />
              {submitting ? 'Submitting Request...' : 'Request Reservation (Pending Verification)'}
            </button>

            {bookingFeedback && (
              <p className="text-xs font-medium text-[#15803D]">{bookingFeedback}</p>
            )}
            {bookingError && <p className="text-xs font-medium text-red-700">{bookingError}</p>}
          </form>
        </section>
      </div>

      {/* My Reservations Ledger */}
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
              My Reservations ({bookings.length})
            </h2>
            <p className="text-xs text-slate-500">
              {confirmedCount} Confirmed · {pendingCount} Pending Provider Verification
            </p>
          </div>

          <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            {(['All', 'Pending Verification', 'Confirmed', 'Completed', 'Cancelled'] as const).map(
              (tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusFilter(tab)}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                    statusFilter === tab
                      ? 'bg-[#0B1F3A] text-white'
                      : 'text-slate-600 hover:text-[#0B1F3A]'
                  }`}
                >
                  {tab}
                </button>
              )
            )}
          </div>
        </div>

        <div className="grid gap-3">
          {filteredBookings.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">
              No reservations match the selected filter.
            </p>
          ) : (
            filteredBookings.map((booking) => (
              <article
                key={booking.id}
                className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-[#0D9488]">
                      {booking.offeringType || booking.category}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      Start: {booking.date} {booking.timeSlot}
                    </span>
                    {booking.endDate && (
                      <>
                        <span aria-hidden="true">→</span>
                        <span className="font-mono tabular-nums text-[#0B1F3A] font-medium">
                          End: {booking.endDate} {booking.endTime || ''}
                        </span>
                      </>
                    )}
                    {booking.durationValue && booking.durationUnit && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
                        {booking.durationValue} {booking.durationUnit}
                      </span>
                    )}
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                      {booking.dataOrigin === 'live' ? 'Live' : 'Demo'}
                    </span>
                  </div>

                  <h3 className="font-display text-base font-bold text-[#0B1F3A]">
                    {booking.title}
                  </h3>
                  <p className="text-xs text-slate-600">
                    Provider: <strong className="text-slate-800">{booking.providerName}</strong>
                    <span aria-hidden="true"> · </span>
                    <span className="tabular-nums">{booking.guests} guest(s)</span>
                    {booking.confirmedBy && (
                      <span className="text-[#15803D]"> · Verified by {booking.confirmedBy}</span>
                    )}
                  </p>
                  {booking.cancellationReason && (
                    <p className="text-xs text-red-700">
                      Cancellation note: {booking.cancellationReason}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-start gap-2 border-t border-slate-200 pt-3 sm:items-end sm:border-t-0 sm:pt-0">
                  <div className="text-left sm:text-right">
                    <p className="font-mono text-base font-bold tabular-nums text-[#0B1F3A]">
                      R {booking.priceZar.toLocaleString('en-ZA')}
                    </p>
                    <StatusText
                      label={booking.status}
                      tone={
                        booking.status === 'Confirmed' || booking.status === 'Completed'
                          ? 'nominal'
                          : booking.status === 'Pending Verification'
                          ? 'advisory'
                          : 'alert'
                      }
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {booking.status === 'Confirmed' && onNavigate && (
                      <button
                        type="button"
                        onClick={() => onNavigate('trips')}
                        className="rounded-md border border-[#0D9488] bg-[#F0FDFA] px-2.5 py-1 text-xs font-semibold text-[#0F766E] hover:bg-teal-100 transition-colors"
                      >
                        Combine in My Trips
                      </button>
                    )}

                    {(booking.status === 'Pending Verification' ||
                      booking.status === 'Confirmed') &&
                      (cancellingId === booking.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            placeholder="Reason (optional)"
                            className="w-36 rounded border border-slate-300 px-2 py-1 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleConfirmCancel(booking.id)}
                            className="rounded bg-red-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-800"
                          >
                            Confirm Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => setCancellingId(null)}
                            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600"
                          >
                            Keep
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setCancellingId(booking.id);
                            setCancelReason('');
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors"
                        >
                          <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          Cancel
                        </button>
                      ))}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
};
