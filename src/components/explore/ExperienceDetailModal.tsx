import React, { useMemo, useState } from 'react';
import {
  Accessibility,
  AlertTriangle,
  Bus,
  Calendar,
  CheckCircle2,
  Clock,
  Heart,
  MapPin,
  Navigation,
  PackageCheck,
  Plus,
  ShieldCheck,
  Star,
  Users,
  X,
} from 'lucide-react';
import { ImageWithFallback } from '@/src/components/common/ImageWithFallback';
import { StatusText } from '@/src/components/common/StatusText';
import {
  CheckoutPaymentStep,
  type CheckoutCompletionPayload,
  type CheckoutDraft,
} from '@/src/components/payments/CheckoutPaymentStep';
import { PaymentReceiptModal } from '@/src/components/payments/PaymentReceiptModal';
import type {
  AttractionItem,
  DemoUser,
  DurationUnit,
  PaymentRecord,
  ProviderPaymentSettings,
  ReviewItem,
  SavedPaymentMethod,
} from '@/src/types/app';
import {
  calculateBookingEndDateTime,
  calculateBookingPriceZar,
} from '@/src/utils/bookingCalculations';

interface ExperienceDetailModalProps {
  item: AttractionItem;
  user: DemoUser;
  reviews: ReviewItem[];
  isFavourite: boolean;
  providerSettings?: ProviderPaymentSettings | null;
  savedCards: SavedPaymentMethod[];
  onToggleFavourite: (item: AttractionItem) => Promise<void> | void;
  onAddToTrip: (item: AttractionItem) => Promise<void> | void;
  onAddReview: (targetId: string, rating: number, comment: string) => Promise<void> | void;
  onRemoveSavedCard: (cardId: string) => Promise<void> | void;
  onCompleteCheckout: (payload: CheckoutCompletionPayload) => Promise<PaymentRecord>;
  onClose: () => void;
}

export const ExperienceDetailModal: React.FC<ExperienceDetailModalProps> = ({
  item,
  user,
  reviews,
  isFavourite,
  providerSettings,
  savedCards,
  onToggleFavourite,
  onAddToTrip,
  onAddReview,
  onRemoveSavedCard,
  onCompleteCheckout,
  onClose,
}) => {
  const photos = item.galleryImages?.length ? item.galleryImages : [item.imageUrl];
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // Schedule & Reserve State
  const defaultDate = item.availableDates?.[0] || '2026-11-18';
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [durationUnit] = useState<DurationUnit>(item.durationUnit || 'hours');
  const [durationValue, setDurationValue] = useState<number>(item.defaultDurationValue || 1);
  const [participants, setParticipants] = useState<number>(2);
  const [checkoutDraft, setCheckoutDraft] = useState<CheckoutDraft | null>(null);
  const [completedReceipt, setCompletedReceipt] = useState<PaymentRecord | null>(null);
  const [tripAdded, setTripAdded] = useState(false);
  const [actionError, setActionError] = useState('');

  // Inline Review Form State
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewMsg, setReviewMsg] = useState('');

  const itemReviews = useMemo(
    () =>
      reviews.filter(
        (r) => r.targetId === item.id && (r.moderationStatus || 'Approved') !== 'Removed'
      ),
    [reviews, item.id]
  );

  const avgRating = useMemo(() => {
    if (itemReviews.length === 0) return null;
    const sum = itemReviews.reduce((acc, r) => acc + r.rating, 0);
    return (sum / itemReviews.length).toFixed(1);
  }, [itemReviews]);

  const maxGuests = item.groupSizeMax || 20;
  const pricingModel = item.pricingModel || 'per_guest';
  const totalZar = useMemo(() => {
    if (item.priceZar === 0) return 0;
    const effectiveUnits =
      durationUnit === 'hours' || durationUnit === 'days' || durationUnit === 'nights'
        ? Math.max(1, durationValue)
        : 1;
    // Standard attraction entry / session prices cover listed duration unless hourly/multi-day rate
    const unitFactor =
      item.defaultDurationValue && item.defaultDurationValue > 1
        ? Math.max(1, Math.round(durationValue / item.defaultDurationValue))
        : effectiveUnits;
    return calculateBookingPriceZar(
      item.priceZar,
      durationUnit === 'sessions' ? 1 : unitFactor,
      participants,
      pricingModel
    );
  }, [item.priceZar, item.defaultDurationValue, durationUnit, durationValue, participants, pricingModel]);

  const calculatedEnd = useMemo(
    () => calculateBookingEndDateTime(selectedDate, selectedTime, durationUnit, durationValue),
    [selectedDate, selectedTime, durationUnit, durationValue]
  );

  const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`;

  const handleStartCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    if (item.priceZar === 0) {
      void handleSaveToTrip();
      return;
    }

    setCheckoutDraft({
      offeringId: item.offeringId || item.id,
      offeringType: 'Activity',
      title: item.title,
      providerId: item.providerId || 'demo-provider-1',
      providerName: item.providerName || 'CapeSafe Accredited Operator',
      category: item.activityCategories?.[0] || item.category,
      zone: item.precinct,
      date: selectedDate,
      timeSlot: selectedTime,
      durationUnit,
      durationValue,
      endDate: calculatedEnd.endDate,
      endTime: calculatedEnd.endTime,
      unitPriceZar: item.priceZar,
      pricingModel,
      guests: participants,
      totalZar,
      safetyVerified: true,
      accessible: Boolean(item.accessible),
    });
  };

  const handleSaveToTrip = async () => {
    setActionError('');
    try {
      await onAddToTrip(item);
      setTripAdded(true);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to add experience to itinerary.');
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewMsg('');
    setActionError('');
    if (comment.trim().length < 4) {
      setActionError('Please enter at least 4 characters for your review.');
      return;
    }
    setSubmittingReview(true);
    try {
      await onAddReview(item.id, rating, comment.trim());
      setComment('');
      setReviewMsg('Review published to Verified Directory.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to submit review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="exp-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/70 p-0 sm:p-4 lg:p-6 overflow-y-auto"
    >
      <div className="relative w-full max-w-5xl h-full sm:h-auto sm:max-h-[92vh] overflow-y-auto rounded-none sm:rounded-2xl border-0 sm:border sm:border-slate-200 bg-white shadow-2xl">
        {/* Sticky Top Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-[#1D4ED8] truncate">
              {item.entryType || 'Experience'} ·{' '}
              {(item.activityCategories || [item.category]).slice(0, 2).join(' · ')}
            </p>
            <h2
              id="exp-detail-title"
              className="font-display text-lg font-bold text-[#111827] truncate"
            >
              {item.title}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onToggleFavourite(item)}
              aria-pressed={isFavourite}
              className={`inline-flex min-h-[40px] sm:min-h-[32px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                isFavourite
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-slate-300 bg-white text-[#111827] hover:bg-slate-50'
              }`}
            >
              <Heart
                className={`h-3.5 w-3.5 ${isFavourite ? 'fill-red-600 text-red-600' : ''}`}
                aria-hidden="true"
              />
              <span>{isFavourite ? 'In Wishlist' : 'Save to Wishlist'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close experience details"
              className="flex min-h-[40px] min-w-[40px] sm:min-h-[32px] sm:min-w-[32px] items-center justify-center rounded-lg border border-slate-300 bg-white p-1.5 text-slate-600 hover:bg-slate-100 hover:text-[#111827]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Receipt View if checkout finished */}
        {completedReceipt ? (
          <div className="p-6 space-y-4">
            <div className="rounded-xl border border-[#15803D]/30 bg-[#F0FDF4] p-5 text-xs text-[#15803D] space-y-2">
              <div className="flex items-center gap-2 font-display text-base font-bold text-[#111827]">
                <CheckCircle2 className="h-5 w-5 text-[#15803D]" aria-hidden="true" />
                Booking Submitted — Reference {completedReceipt.bookingReference}
              </div>
              <p className="text-slate-700">
                Payment method: <strong>{completedReceipt.paymentMethod}</strong> · Status:{' '}
                <strong>{completedReceipt.paymentStatus}</strong>. View your reservation anytime under{' '}
                <strong>Bookings &amp; Passes</strong> or <strong>My Trips</strong>.
              </p>
            </div>
            <PaymentReceiptModal
              payment={completedReceipt}
              onClose={() => {
                setCompletedReceipt(null);
                onClose();
              }}
            />
          </div>
        ) : checkoutDraft ? (
          <div className="p-5 sm:p-6">
            <CheckoutPaymentStep
              user={user}
              draft={checkoutDraft}
              providerSettings={providerSettings}
              savedCards={savedCards}
              onRemoveSavedCard={onRemoveSavedCard}
              onBack={() => setCheckoutDraft(null)}
              onCompleteCheckout={async (payload) => {
                const rec = await onCompleteCheckout(payload);
                setCheckoutDraft(null);
                setCompletedReceipt(rec);
                return rec;
              }}
            />
          </div>
        ) : (
          <div className="p-5 sm:p-6 space-y-6">
            {actionError && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
              >
                {actionError}
              </p>
            )}

            {/* Gallery & Booking Grid */}
            <div className="grid gap-6 lg:grid-cols-12">
              {/* Left 7 cols: Multi-Photo Gallery & Details */}
              <div className="lg:col-span-7 space-y-5">
                <div className="space-y-2">
                  <div className="aspect-[16/10] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                    <ImageWithFallback
                      src={photos[activePhotoIdx] || item.imageUrl}
                      alt={item.title}
                    />
                  </div>
                  {photos.length > 1 && (
                    <div className="grid grid-cols-3 gap-2">
                      {photos.slice(0, 3).map((src, idx) => (
                        <button
                          key={`${src}-${idx}`}
                          type="button"
                          onClick={() => setActivePhotoIdx(idx)}
                          className={`aspect-[16/9] overflow-hidden rounded-lg border-2 transition-all ${
                            activePhotoIdx === idx
                              ? 'border-[#1D4ED8]'
                              : 'border-transparent opacity-80 hover:opacity-100'
                          }`}
                        >
                          <ImageWithFallback
                            src={src}
                            alt={`${item.title} gallery view ${idx + 1}`}
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Key Info Strip */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1.5 font-medium text-[#111827]">
                    <MapPin className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
                    {item.precinct}
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-mono">
                    <Clock className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
                    {item.duration}
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-mono">
                    <Users className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
                    Max {maxGuests} guests
                  </span>
                  <StatusText
                    label={item.safetyStatus}
                    tone={item.safetyStatus === 'Nominal' ? 'nominal' : 'advisory'}
                  />
                </div>

                <p className="text-sm text-slate-700 leading-relaxed">{item.description}</p>

                {/* Provider, Verification & Age Suitability */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs space-y-1">
                    <p className="font-semibold text-[#111827] flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-[#15803D]" aria-hidden="true" />
                      Provider &amp; Verification
                    </p>
                    <p className="font-medium text-slate-800">
                      {item.providerName || 'CapeSafe Accredited Operator'}
                    </p>
                    <p className="text-slate-600">
                      {item.dataOrigin === 'live'
                        ? 'Live Firestore Verified Listing'
                        : item.verifiedProvider
                        ? 'Pre-vetted Directory Partner (Demo)'
                        : 'Community Listing (Unverified Demo)'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs space-y-1">
                    <p className="font-semibold text-[#111827] flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-amber-700" aria-hidden="true" />
                      Age Suitability &amp; Group Policy
                    </p>
                    <p className="font-medium text-slate-800">
                      {item.ageRequirement || 'All Ages'}
                    </p>
                    <p className="text-slate-600">
                      {item.familyFriendly !== false
                        ? 'Family-friendly experience'
                        : 'Recommended for older youth & adults'}
                    </p>
                  </div>
                </div>

                {/* Accessibility & Safety Info */}
                <div className="rounded-xl border border-slate-200 bg-[#EFF6FF]/60 p-4 text-xs space-y-2">
                  <p className="font-semibold text-[#111827] flex items-center gap-1.5">
                    <Accessibility className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
                    Accessibility &amp; Safety Briefing
                  </p>
                  <p className="text-slate-700">
                    <strong>Access:</strong> {item.accessibilitySummary}
                  </p>
                  {item.safetyInfo && (
                    <p className="text-slate-700">
                      <strong>Safety Protocol:</strong> {item.safetyInfo}
                    </p>
                  )}
                  {item.cancellationPolicy && (
                    <p className="text-slate-700">
                      <strong>Cancellation Policy:</strong> {item.cancellationPolicy}
                    </p>
                  )}
                </div>

                {/* Included Services & What to Bring */}
                <div className="grid gap-4 sm:grid-cols-2 text-xs">
                  {item.includedServices && item.includedServices.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                      <p className="font-semibold text-[#111827] flex items-center gap-1.5">
                        <PackageCheck className="h-4 w-4 text-[#15803D]" aria-hidden="true" />
                        Included Services
                      </p>
                      <ul className="list-disc pl-4 space-y-1 text-slate-600">
                        {item.includedServices.map((inc) => (
                          <li key={inc}>{inc}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {item.whatToBring && item.whatToBring.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                      <p className="font-semibold text-[#111827] flex items-center gap-1.5">
                        <Calendar className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
                        What Visitors Should Bring
                      </p>
                      <ul className="list-disc pl-4 space-y-1 text-slate-600">
                        {item.whatToBring.map((bring) => (
                          <li key={bring}>{bring}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Location, Google Maps Directions & Nearby Transport */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[#111827]">
                        Coordinates &amp; Transit Connections
                      </p>
                      <p className="font-mono text-slate-500 tabular-nums">{item.coordinates}</p>
                    </div>
                    <a
                      href={directionsHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#111827] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1E293B] whitespace-nowrap"
                    >
                      <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
                      Get Directions
                    </a>
                  </div>
                  {item.nearbyTransport && item.nearbyTransport.length > 0 && (
                    <div className="border-t border-slate-200 pt-2.5">
                      <p className="font-semibold text-slate-700 flex items-center gap-1.5 mb-1">
                        <Bus className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
                        Nearby Verified Transport
                      </p>
                      <ul className="space-y-1 text-slate-600">
                        {item.nearbyTransport.map((t) => (
                          <li key={t}>· {t}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Right 5 cols: Booking Builder -> PayShap / Card / Pay in Person */}
              <div className="lg:col-span-5 space-y-4">
                <form
                  onSubmit={handleStartCheckout}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4"
                >
                  <div className="flex items-baseline justify-between border-b border-slate-200 pb-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {item.priceZar === 0 ? 'Public Access' : 'Rate (ZAR)'}
                      </p>
                      <p className="font-display text-2xl font-bold tabular-nums text-[#111827]">
                        {item.priceZar === 0
                          ? 'Free Access'
                          : `R ${item.priceZar.toLocaleString('en-ZA')}`}
                      </p>
                    </div>
                    {item.priceZar > 0 && (
                      <span className="text-xs text-slate-600">
                        {pricingModel === 'per_unit' ? 'per booking' : 'per participant'}
                      </span>
                    )}
                  </div>

                  {item.availableDates && item.availableDates.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-slate-600 mb-1.5">
                        Available Dates (
                        {item.dataOrigin === 'live' ? 'Live Schedule' : 'Demo Schedule'})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {item.availableDates.slice(0, 6).map((dt) => (
                          <button
                            key={dt}
                            type="button"
                            onClick={() => setSelectedDate(dt)}
                            className={`rounded-md border px-2 py-1 font-mono text-[11px] font-semibold transition-colors ${
                              selectedDate === dt
                                ? 'border-[#1D4ED8] bg-[#1D4ED8] text-white'
                                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {dt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="exp-date"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Date
                      </label>
                      <input
                        id="exp-date"
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs text-slate-900"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="exp-time"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Start Time
                      </label>
                      <select
                        id="exp-time"
                        value={selectedTime}
                        onChange={(e) => setSelectedTime(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs text-slate-900"
                      >
                        <option value="08:30">08:30 SAST</option>
                        <option value="09:00">09:00 SAST</option>
                        <option value="11:00">11:00 SAST</option>
                        <option value="14:00">14:00 SAST</option>
                        <option value="16:30">16:30 SAST</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="exp-participants"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Participants
                      </label>
                      <input
                        id="exp-participants"
                        type="number"
                        min={1}
                        max={maxGuests}
                        value={participants}
                        onChange={(e) =>
                          setParticipants(Math.max(1, Math.min(maxGuests, Number(e.target.value) || 1)))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs text-slate-900"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="exp-duration"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Duration ({durationUnit})
                      </label>
                      <input
                        id="exp-duration"
                        type="number"
                        min={1}
                        max={12}
                        value={durationValue}
                        onChange={(e) =>
                          setDurationValue(Math.max(1, Math.min(12, Number(e.target.value) || 1)))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Total Estimated Charge</span>
                      <span className="font-mono text-sm font-bold tabular-nums text-[#111827]">
                        {totalZar === 0 ? 'Free' : `R ${totalZar.toLocaleString('en-ZA')}`}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Ends {calculatedEnd.endDate} · {calculatedEnd.endTime} SAST
                    </p>
                    <p className="text-[11px] text-slate-600">
                      Supported methods:{' '}
                      <strong>
                        {(item.supportedPaymentMethods || ['PayShap', 'Card', 'Pay in Person']).join(
                          ', '
                        )}
                      </strong>
                    </p>
                  </div>

                  {item.priceZar > 0 ? (
                    <button
                      type="submit"
                      className="min-h-[44px] w-full rounded-lg bg-[#1D4ED8] py-2.5 text-xs font-semibold text-white hover:bg-[#1E40AF] transition-colors"
                    >
                      Book &amp; Choose Payment Method
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => onToggleFavourite(item)}
                    aria-pressed={isFavourite}
                    className={`flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition-colors ${
                      isFavourite
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : 'border-slate-300 bg-white text-[#111827] hover:bg-slate-100'
                    }`}
                  >
                    <Heart
                      className={`h-3.5 w-3.5 ${isFavourite ? 'fill-red-600 text-red-600' : ''}`}
                      aria-hidden="true"
                    />
                    {isFavourite ? 'Saved in My Wishlist (Book Later)' : 'Save to Wishlist (Book Later)'}
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveToTrip}
                    className={`flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition-colors ${
                      tripAdded
                        ? 'border-[#15803D]/30 bg-[#F0FDF4] text-[#15803D]'
                        : 'border-slate-300 bg-white text-[#111827] hover:bg-slate-100'
                    }`}
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    {tripAdded ? 'Saved to My Trips Itinerary' : 'Save to My Trips Itinerary'}
                  </button>
                </form>
              </div>
            </div>

            {/* Verified Reviews & Provider Replies */}
            <section className="border-t border-slate-200 pt-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-base font-bold text-[#111827]">
                  Visitor Reviews ({itemReviews.length})
                </h3>
                {avgRating && (
                  <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-[#1D4ED8] tabular-nums">
                    <Star className="h-3.5 w-3.5 fill-[#1D4ED8]" aria-hidden="true" />
                    {avgRating} / 5.0
                  </span>
                )}
              </div>

              <div className="grid gap-5 lg:grid-cols-12">
                <div className="lg:col-span-7 divide-y divide-slate-200">
                  {itemReviews.length === 0 ? (
                    <p className="text-xs text-slate-500 py-3">
                      No reviews yet for this listing. Share your experience on the right.
                    </p>
                  ) : (
                    itemReviews.map((rev) => (
                      <div key={rev.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[#111827]">
                            {rev.authorName}
                            {rev.verifiedBooking ? ' · Verified Booking' : ''}
                          </span>
                          <span className="inline-flex items-center gap-1 font-mono font-semibold text-[#1D4ED8] tabular-nums">
                            <Star className="h-3 w-3 fill-[#1D4ED8]" aria-hidden="true" />
                            {rev.rating}/5
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed">{rev.comment}</p>
                        <p className="text-[11px] text-slate-500">
                          {rev.createdAtLabel} ·{' '}
                          {rev.dataOrigin === 'live' ? 'Live Firestore' : 'Demo Review'}
                        </p>
                        {rev.providerReply && (
                          <div className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs">
                            <p className="font-semibold text-[#111827]">
                              Provider Response · {rev.providerReplyBy || item.providerName}
                            </p>
                            <p className="mt-0.5 text-slate-600">{rev.providerReply}</p>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <form
                  onSubmit={handleSubmitReview}
                  className="lg:col-span-5 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2.5 h-fit"
                >
                  <p className="text-xs font-bold text-[#111827]">Leave a Review</p>
                  <select
                    aria-label="Select rating"
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                  >
                    <option value={5}>5 — Outstanding experience</option>
                    <option value={4}>4 — Very good</option>
                    <option value={3}>3 — Fair</option>
                    <option value={2}>2 — Below expectations</option>
                    <option value={1}>1 — Poor</option>
                  </select>
                  <textarea
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share safety, accessibility, or guide quality feedback..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                  />
                  {reviewMsg && (
                    <p role="status" className="text-[11px] font-medium text-[#15803D]">
                      {reviewMsg}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="w-full rounded-lg bg-[#111827] py-2 text-xs font-semibold text-white hover:bg-[#1E293B] disabled:opacity-60"
                  >
                    {submittingReview ? 'Submitting...' : 'Publish Review'}
                  </button>
                </form>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};
