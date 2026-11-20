import React, { useMemo, useState } from 'react';
import {
  Accessibility,
  BedDouble,
  Bus,
  CalendarCheck,
  Clock,
  Compass,
  CreditCard,
  Info,
  Receipt,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
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
import type {
  BookingItem,
  DemoUser,
  DurationUnit,
  NavSectionId,
  OfferingType,
  PaymentRecord,
  ProviderListing,
  ProviderPaymentSettings,
  SavedPaymentMethod,
} from '@/src/types/app';
import {
  calculateBookingEndDateTime,
  calculateBookingPriceZar,
  checkOfferingAvailability,
  isAwaitingBookingStatus,
} from '@/src/utils/bookingCalculations';

interface BookingsPageProps {
  user: DemoUser;
  bookings: BookingItem[];
  offerings: ProviderListing[];
  payments: PaymentRecord[];
  savedCards: SavedPaymentMethod[];
  providerPaymentSettings: ProviderPaymentSettings[];
  onCreateBooking: (
    booking: Omit<BookingItem, 'id' | 'status' | 'dataOrigin'>
  ) => Promise<void> | void;
  onCompleteCheckout: (payload: CheckoutCompletionPayload) => Promise<PaymentRecord>;
  onRemoveSavedCard: (cardId: string) => Promise<void> | void;
  onCancelBooking: (bookingId: string, reason?: string) => Promise<void> | void;
  onNavigate?: (section: NavSectionId) => void;
}

const OFFERING_ICONS: Record<OfferingType, React.ReactNode> = {
  Accommodation: <BedDouble className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />,
  Transport: <Bus className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />,
  Activity: <Compass className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />,
};

export const BookingsPage: React.FC<BookingsPageProps> = ({
  user,
  bookings,
  offerings,
  payments,
  savedCards,
  providerPaymentSettings,
  onCompleteCheckout,
  onRemoveSavedCard,
  onCancelBooking,
  onNavigate,
}) => {
  const [statusFilter, setStatusFilter] = useState<
    | 'All'
    | 'Pending Verification'
    | 'Awaiting Provider Confirmation'
    | 'Confirmed'
    | 'Completed'
    | 'Cancelled'
  >('All');
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
  const [bookingFeedback, setBookingFeedback] = useState('');
  const [bookingError, setBookingError] = useState('');

  // Secure Checkout & Receipt State
  const [checkoutDraft, setCheckoutDraft] = useState<CheckoutDraft | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<PaymentRecord | null>(null);

  // Cancellation Note & Error State
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancellingBusy, setCancellingBusy] = useState(false);
  const [cancelError, setCancelError] = useState('');

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

  const handleProceedToCheckout = (e: React.FormEvent) => {
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

    setCheckoutDraft({
      offeringId: selectedOffering.id,
      offeringType: selectedOffering.offeringType || 'Activity',
      title: selectedOffering.experienceTitle,
      providerId: selectedOffering.providerId || user.id,
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
      totalZar: calculatedTotalZar,
      safetyVerified: selectedOffering.safetyChecklistComplete,
      accessible: Boolean(selectedOffering.accessible),
    });
  };

  const handleOpenRetryCheckout = (booking: BookingItem, matchedPayment?: PaymentRecord) => {
    setBookingError('');
    setBookingFeedback('');
    setCheckoutDraft({
      existingBookingId: booking.id,
      existingPaymentId: matchedPayment?.id || booking.paymentId,
      existingBookingReference: booking.bookingReference,
      offeringId: booking.offeringId,
      offeringType: booking.offeringType || 'Activity',
      title: booking.title,
      providerId: booking.providerId || user.id,
      providerName: booking.providerName,
      category: booking.category,
      zone: booking.zone || 'Cape Town',
      date: booking.date,
      timeSlot: booking.timeSlot,
      durationUnit: booking.durationUnit || 'sessions',
      durationValue: booking.durationValue || 1,
      endDate: booking.endDate || booking.date,
      endTime: booking.endTime || booking.timeSlot,
      unitPriceZar: booking.unitPriceZar ?? booking.priceZar,
      pricingModel: booking.pricingModel || 'per_guest',
      guests: booking.guests,
      totalZar: booking.priceZar,
      safetyVerified: booking.safetyVerified,
      accessible: booking.accessible,
    });
  };

  const activeProviderPolicy = useMemo(() => {
    if (!checkoutDraft) return null;
    return (
      providerPaymentSettings.find((s) => s.providerId === checkoutDraft.providerId) ||
      providerPaymentSettings.find(
        (s) =>
          s.providerName.toLowerCase() === checkoutDraft.providerName.toLowerCase()
      ) ||
      providerPaymentSettings[0] ||
      null
    );
  }, [checkoutDraft, providerPaymentSettings]);

  const handleConfirmCancel = async (bookingId: string) => {
    setCancelError('');
    setCancellingBusy(true);
    try {
      await onCancelBooking(bookingId, cancelReason.trim() || 'Cancelled by tourist');
      setCancellingId(null);
      setCancelReason('');
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Unable to cancel reservation.');
    } finally {
      setCancellingBusy(false);
    }
  };

  const confirmedCount = bookings.filter((b) => b.status === 'Confirmed').length;
  const pendingCount = bookings.filter((b) => isAwaitingBookingStatus(b.status)).length;

  return (
    <div className="space-y-6">
      <DemoDataNotice
        scope={
          user.authMode === 'firebase' && user.emailVerified
            ? 'Live Firestore Booking & Payment Ledger · Reservations stay Pending Verification / Awaiting Provider Confirmation until accredited operator approval'
            : 'Demonstration Booking & Checkout System — Sign in with Firebase to persist live reservations, tokenised cards & provider confirmations'
        }
      />

      {/* Header + Category Switcher */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#111827]">
            Smart Bookings &amp; Secure Checkout
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Book accommodation, transport, and guided activities in hours, days, nights, or sessions, then pay via PayShap, Credit/Debit Card, or Pay in Person.
          </p>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full rounded-lg border border-slate-200 bg-slate-50 p-1 self-start lg:self-auto">
          {(['All', 'Accommodation', 'Transport', 'Activity'] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={typeFilter === t}
              onClick={() => setTypeFilter(t)}
              className={`min-h-[38px] rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                typeFilter === t
                  ? 'bg-[#1D4ED8] text-white'
                  : 'text-slate-600 hover:text-[#111827]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Strict Confirmation Policy Notice */}
      <div className="flex items-start gap-2.5 rounded-xl border border-[#1D4ED8]/30 bg-[#EFF6FF] px-4 py-3 text-xs text-[#111827]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#1D4ED8]" aria-hidden="true" />
        <p>
          <strong>Provider Verification Rule:</strong> Online payments settle via verified SA gateway checks while Pay in Person reserves with <strong className="text-amber-800">Unpaid</strong> status. New bookings enter{' '}
          <strong className="text-amber-800">Pending Verification</strong> or{' '}
          <strong className="text-amber-800">Awaiting Provider Confirmation</strong> until the tourism service provider confirms availability.
        </p>
      </div>

      {checkoutDraft ? (
        <CheckoutPaymentStep
          user={user}
          draft={checkoutDraft}
          providerSettings={activeProviderPolicy}
          savedCards={savedCards}
          onRemoveSavedCard={onRemoveSavedCard}
          onCompleteCheckout={async (payload) => {
            const savedRecord = await onCompleteCheckout(payload);
            setBookingFeedback(
              `Checkout recorded (${payload.bookingReference}): Payment Status is ${payload.paymentStatus}.`
            );
            return savedRecord;
          }}
          onBack={() => setCheckoutDraft(null)}
        />
      ) : (
        /* Provider Offerings Catalog + Interactive Reservation Builder */
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Catalog */}
          <section className="space-y-3 lg:col-span-7">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-[#111827]">
                Available Provider Offerings ({filteredOfferings.length})
              </h2>
              <span className="text-xs text-slate-500">Select an offering to calculate dates &amp; ZAR total</span>
            </div>

            <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
              {filteredOfferings.map((offering) => {
                const isSelected = selectedOffering?.id === offering.id;
                const avail = checkOfferingAvailability(offering, startDate, guests);
                const unitName = (offering.durationUnit || 'sessions').slice(0, -1);

                return (
                  <article
                    key={offering.id}
                    className={`rounded-xl border p-4 transition-colors ${
                      isSelected
                        ? 'border-[#1D4ED8] bg-[#EFF6FF]/50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="inline-flex items-center gap-1 font-semibold text-[#1D4ED8]">
                            {OFFERING_ICONS[offering.offeringType || 'Activity']}
                            {offering.offeringType || 'Activity'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-600">{offering.zone || 'Cape Town'}</span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                            {offering.dataOrigin === 'live' ? 'Live' : 'Demo'}
                          </span>
                        </div>
                        <h3 className="font-display text-base font-bold text-[#111827]">
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
                            <span className="inline-flex items-center gap-1 font-medium text-[#1D4ED8]">
                              <Accessibility className="h-3.5 w-3.5" aria-hidden="true" />
                              Step-Free
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2 sm:flex-col sm:items-end sm:border-t-0 sm:pt-0">
                        <div className="text-left sm:text-right">
                          <p className="font-mono text-base font-bold text-[#111827] tabular-nums">
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
                              ? 'bg-[#111827] text-white'
                              : 'border border-slate-300 bg-white text-[#111827] hover:bg-slate-50'
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

          {/* Smart Booking Calculator & Checkout Trigger */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 lg:col-span-5 lg:sticky lg:top-20 h-fit space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="font-display text-base font-bold text-[#111827]">
                Smart Reservation Calculator
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {selectedOffering
                  ? selectedOffering.experienceTitle
                  : 'Select an offering on the left'}
              </p>
            </div>

            <form onSubmit={handleProceedToCheckout} className="space-y-3.5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="bk-start-date" className="block text-xs font-semibold text-slate-700">
                    Start Date
                  </label>
                  <input
                    id="bk-start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
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
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                    onChange={(e) =>
                      setDurationValue(Math.max(1, Math.min(30, Number(e.target.value) || 1)))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
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
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
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
                    onChange={(e) =>
                      setGuests(Math.max(1, Math.min(20, Number(e.target.value) || 1)))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
              </div>

              {/* Automatic End-Date & Pricing Summary */}
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-slate-600">
                    <Clock className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
                    Calculated End
                  </span>
                  <span className="font-mono font-semibold text-[#111827] tabular-nums">
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
                    <p className="font-semibold text-[#111827]">Total Provider Quote</p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      R {unitPriceZar.toLocaleString('en-ZA')} × {durationValue} {durationUnit}
                      {pricingModel === 'per_guest' ? ` × ${guests} guests` : ' (unit rate)'}
                    </p>
                  </div>
                  <p className="font-display text-xl font-bold text-[#111827] tabular-nums">
                    R {calculatedTotalZar.toLocaleString('en-ZA')}
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={!availability.available}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-50 transition-colors"
              >
                <CreditCard className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Proceed to Secure Payment</span>
              </button>

              {bookingFeedback && (
                <p role="status" className="text-xs font-medium text-[#15803D]">
                  {bookingFeedback}
                </p>
              )}
              {bookingError && (
                <p role="alert" className="text-xs font-medium text-red-700">
                  {bookingError}
                </p>
              )}
            </form>
          </section>
        </div>
      )}

      {/* My Reservations Ledger */}
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-[#111827]">
              My Reservations ({bookings.length})
            </h2>
            <p className="text-xs text-slate-500">
              {confirmedCount} Confirmed · {pendingCount} Pending Provider Confirmation
            </p>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto max-w-full rounded-lg border border-slate-200 bg-slate-50 p-1">
            {(
              [
                'All',
                'Pending Verification',
                'Awaiting Provider Confirmation',
                'Confirmed',
                'Completed',
                'Cancelled',
              ] as const
            ).map((tab) => (
              <button
                key={tab}
                type="button"
                aria-pressed={statusFilter === tab}
                onClick={() => setStatusFilter(tab)}
                className={`min-h-[36px] rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === tab
                    ? 'bg-[#111827] text-white'
                    : 'text-slate-600 hover:text-[#111827]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {cancelError && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {cancelError}
          </p>
        )}

        <div className="grid gap-3">
          {filteredBookings.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">
              No reservations match the selected filter.
            </p>
          ) : (
            filteredBookings.map((booking) => {
              const matchedPayment = payments.find(
                (p) => p.id === booking.paymentId || p.bookingId === booking.id
              );
              const paymentStatus = matchedPayment?.paymentStatus || booking.paymentStatus;
              const paymentMethod = matchedPayment?.paymentMethod || booking.paymentMethod;
              const balanceDue =
                matchedPayment?.balanceDueInPerson ?? booking.balanceDueInPersonZar ?? 0;
              const canRetryPayment =
                (paymentStatus === 'Failed' ||
                  paymentStatus === 'Payment Pending' ||
                  paymentStatus === 'Unpaid') &&
                booking.status !== 'Cancelled' &&
                booking.status !== 'Rejected' &&
                booking.status !== 'Completed';

              return (
                <article
                  key={booking.id}
                  className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {booking.bookingReference && (
                        <span className="font-mono font-semibold text-[#111827]">
                          {booking.bookingReference}
                        </span>
                      )}
                      <span className="font-semibold text-[#1D4ED8]">
                        {booking.offeringType || booking.category}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        Start: {booking.date} {booking.timeSlot}
                      </span>
                      {booking.endDate && (
                        <>
                          <span aria-hidden="true">→</span>
                          <span className="font-mono tabular-nums text-[#111827] font-medium">
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

                    <h3 className="font-display text-base font-bold text-[#111827]">
                      {booking.title}
                    </h3>
                    <p className="text-xs text-slate-600">
                      Provider: <strong className="text-slate-800">{booking.providerName}</strong>
                      <span aria-hidden="true"> · </span>
                      <span className="tabular-nums">{booking.guests} guest(s)</span>
                      {paymentMethod && (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span>Method: {paymentMethod}</span>
                        </>
                      )}
                      {booking.confirmedBy && (
                        <span className="text-[#15803D]"> · Verified by {booking.confirmedBy}</span>
                      )}
                    </p>
                    {balanceDue > 0 && paymentStatus !== 'Paid' && (
                      <p className="text-[11px] font-medium text-amber-800">
                        Balance due directly to provider: R {balanceDue.toLocaleString('en-ZA')}
                      </p>
                    )}
                    {booking.cancellationReason && (
                      <p className="text-xs text-red-700">
                        Cancellation note: {booking.cancellationReason}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-start gap-2 border-t border-slate-200 pt-3 sm:items-end sm:border-t-0 sm:pt-0">
                    <div className="flex flex-col items-start gap-1 sm:items-end">
                      <p className="font-mono text-base font-bold tabular-nums text-[#111827]">
                        R {booking.priceZar.toLocaleString('en-ZA')}
                      </p>
                      <StatusText
                        label={booking.status}
                        tone={
                          booking.status === 'Confirmed' || booking.status === 'Completed'
                            ? 'nominal'
                            : isAwaitingBookingStatus(booking.status)
                            ? 'advisory'
                            : 'alert'
                        }
                      />
                      {paymentStatus && (
                        <StatusText
                          label={`Payment: ${paymentStatus}`}
                          tone={
                            paymentStatus === 'Paid' || paymentStatus === 'Partially Paid'
                              ? 'nominal'
                              : paymentStatus === 'Failed'
                              ? 'alert'
                              : 'advisory'
                          }
                        />
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {matchedPayment && (
                        <button
                          type="button"
                          onClick={() => setActiveReceipt(matchedPayment)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-[#111827] hover:bg-slate-50 transition-colors"
                        >
                          <Receipt className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
                          {paymentStatus === 'Paid' || paymentStatus === 'Partially Paid'
                            ? 'View Receipt'
                            : 'Payment Slip'}
                        </button>
                      )}

                      {canRetryPayment && (
                        <button
                          type="button"
                          onClick={() => handleOpenRetryCheckout(booking, matchedPayment)}
                          className="inline-flex items-center gap-1 rounded-md bg-[#1D4ED8] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#1E40AF] transition-colors"
                        >
                          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                          {paymentStatus === 'Unpaid' ? 'Pay Now' : 'Retry Payment'}
                        </button>
                      )}

                      {booking.status === 'Confirmed' && onNavigate && (
                        <button
                          type="button"
                          onClick={() => onNavigate('trips')}
                          className="inline-flex items-center gap-1 rounded-md border border-[#1D4ED8] bg-[#EFF6FF] px-2.5 py-1 text-xs font-semibold text-[#1E40AF] hover:bg-blue-100 transition-colors"
                        >
                          <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          Combine in My Trips
                        </button>
                      )}

                      {(isAwaitingBookingStatus(booking.status) ||
                        booking.status === 'Confirmed') &&
                        (cancellingId === booking.id ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <input
                              type="text"
                              aria-label="Cancellation reason"
                              value={cancelReason}
                              onChange={(e) => setCancelReason(e.target.value)}
                              placeholder="Reason (optional)"
                              className="w-36 rounded border border-slate-300 px-2 py-1 text-xs"
                            />
                            <button
                              type="button"
                              disabled={cancellingBusy}
                              onClick={() => handleConfirmCancel(booking.id)}
                              className="rounded bg-red-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-60"
                            >
                              {cancellingBusy ? 'Cancelling...' : 'Confirm Cancel'}
                            </button>
                            <button
                              type="button"
                              disabled={cancellingBusy}
                              onClick={() => {
                                setCancellingId(null);
                                setCancelError('');
                              }}
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
              );
            })
          )}
        </div>
      </section>

      <PaymentReceiptModal payment={activeReceipt} onClose={() => setActiveReceipt(null)} />
    </div>
  );
};
