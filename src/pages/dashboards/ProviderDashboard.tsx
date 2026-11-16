import React, { useState } from 'react';
import {
  Accessibility,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Plus,
  Upload,
  XCircle,
} from 'lucide-react';
import { DemoDataNotice } from '@/src/components/common/DemoDataNotice';
import { StatusText } from '@/src/components/common/StatusText';
import { resolveZoneCoordinates } from '@/src/components/map/CapeTownMap';
import { ProviderPaymentSettingsSection } from '@/src/components/payments/ProviderPaymentSettingsSection';
import { storageService } from '@/src/services/firebase/storageService';
import type {
  BookingItem,
  DemoUser,
  DurationUnit,
  InPersonPaymentMethod,
  NavSectionId,
  OfferingType,
  PaymentRecord,
  PricingModel,
  ProviderListing,
  ProviderPaymentSettings,
} from '@/src/types/app';
import { isAwaitingBookingStatus } from '@/src/utils/bookingCalculations';

interface ProviderDashboardProps {
  user: DemoUser;
  listings: ProviderListing[];
  bookings: BookingItem[];
  paymentSettings?: ProviderPaymentSettings;
  payments: PaymentRecord[];
  onSavePaymentSettings: (
    settings: Omit<ProviderPaymentSettings, 'id' | 'providerId' | 'updatedAtLabel' | 'dataOrigin'>
  ) => Promise<void>;
  onMarkInPersonPaid: (
    paymentId: string,
    bookingId: string,
    methodUsed: InPersonPaymentMethod
  ) => Promise<void>;
  onToggleListingStatus: (id: string) => Promise<void> | void;
  onCompleteChecklist: (id: string) => Promise<void> | void;
  onCreateOffering: (
    offering: Omit<ProviderListing, 'id' | 'providerId' | 'providerName' | 'dataOrigin'>
  ) => Promise<void> | void;
  onUpdateOffering: (id: string, updates: Partial<ProviderListing>) => Promise<void> | void;
  onUpdateBookingStatus: (
    bookingId: string,
    status: BookingItem['status'],
    meta?: { confirmedBy?: string; cancellationReason?: string }
  ) => Promise<void> | void;
  onSubmitAccreditation?: (payload: {
    businessName: string;
    category: string;
    zone: string;
    complianceDocs: string;
    description?: string;
    lat?: number;
    lng?: number;
    imageUrl?: string;
    safetyChecklistComplete: boolean;
  }) => Promise<void>;
  onNavigate: (section: NavSectionId) => void;
}

export const ProviderDashboard: React.FC<ProviderDashboardProps> = ({
  user,
  listings,
  bookings,
  paymentSettings,
  payments,
  onSavePaymentSettings,
  onMarkInPersonPaid,
  onToggleListingStatus,
  onCompleteChecklist,
  onCreateOffering,
  onUpdateOffering,
  onUpdateBookingStatus,
  onSubmitAccreditation,
  onNavigate,
}) => {
  // Offering Creator State (Availability & Provider-Defined Pricing)
  const [offeringType, setOfferingType] = useState<OfferingType>('Activity');
  const [expTitle, setExpTitle] = useState('');
  const [expZone, setExpZone] = useState("Simon's Town · False Bay");
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('sessions');
  const [defaultDurationValue, setDefaultDurationValue] = useState(1);
  const [unitPriceZar, setUnitPriceZar] = useState(450);
  const [pricingModel, setPricingModel] = useState<PricingModel>('per_guest');
  const [capacity, setCapacity] = useState(12);
  const [nextDeparture, setNextDeparture] = useState('09:00');
  const [accessibleOffering, setAccessibleOffering] = useState(true);
  const [creatingOffering, setCreatingOffering] = useState(false);
  const [offeringFeedback, setOfferingFeedback] = useState('');

  // Blackout Date Input per Listing
  const [blockDateInputs, setBlockDateInputs] = useState<Record<string, string>>({});

  // Booking Queue Filter & Action Feedback
  const [bookingFilter, setBookingFilter] = useState<'All' | 'Awaiting Confirmation' | 'Confirmed'>('All');
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [providerActionError, setProviderActionError] = useState('');
  const [offeringError, setOfferingError] = useState('');

  // Accreditation Form State
  const [businessName, setBusinessName] = useState(user.organization || '');
  const [category, setCategory] = useState('Marine & Coastal');
  const [zone, setZone] = useState("Simon's Town & False Bay");
  const [complianceDocs, setComplianceDocs] = useState('SAMSA Passenger Safety + Public Liability');
  const [description, setDescription] = useState('');
  const [complianceFile, setComplianceFile] = useState<File | null>(null);
  const [submittingApp, setSubmittingApp] = useState(false);
  const [appFeedback, setAppFeedback] = useState('');
  const [appError, setAppError] = useState('');

  const totalSeatsBooked = listings.reduce((sum, l) => sum + l.bookedSeats, 0);
  const totalCapacity = listings.reduce((sum, l) => sum + l.capacity, 0);
  const estimatedRevenueZar = listings.reduce((sum, l) => sum + l.bookedSeats * l.priceZar, 0);
  const verifiedChecklists = listings.filter((l) => l.safetyChecklistComplete).length;

  const providerBookings = bookings.filter((b) =>
    user.authMode === 'firebase' && user.role !== 'admin'
      ? b.providerId === user.id || b.userId === user.id
      : true
  );
  const providerPayments = payments.filter((p) =>
    user.authMode === 'firebase' && user.role !== 'admin'
      ? p.providerId === user.id || p.userId === user.id
      : true
  );
  const filteredBookings = providerBookings.filter((b) =>
    bookingFilter === 'All'
      ? true
      : bookingFilter === 'Awaiting Confirmation'
      ? isAwaitingBookingStatus(b.status)
      : b.status === bookingFilter
  );
  const pendingRequestsCount = providerBookings.filter((b) =>
    isAwaitingBookingStatus(b.status)
  ).length;

  const handleCreateOffering = async (e: React.FormEvent) => {
    e.preventDefault();
    setOfferingFeedback('');
    setOfferingError('');
    if (expTitle.trim().length < 3) {
      setOfferingError('Enter an offering title (min 3 characters).');
      return;
    }
    setCreatingOffering(true);
    try {
      await onCreateOffering({
        offeringType,
        experienceTitle: expTitle.trim(),
        category: offeringType,
        zone: expZone.trim() || 'Cape Town',
        durationUnit,
        defaultDurationValue: Math.max(1, defaultDurationValue),
        pricingModel,
        nextDeparture: nextDeparture || '09:00',
        bookedSeats: 0,
        capacity: Math.max(1, capacity),
        priceZar: Math.max(0, unitPriceZar),
        accessible: accessibleOffering,
        safetyChecklistComplete: true,
        status: 'Active',
        blockedDates: [],
      });
      setExpTitle('');
      setOfferingFeedback(
        `Added "${expTitle.trim()}" (${durationUnit}, R ${unitPriceZar}/${durationUnit.slice(0, -1)}).`
      );
    } catch (err) {
      setOfferingError(err instanceof Error ? err.message : 'Unable to create offering.');
    } finally {
      setCreatingOffering(false);
    }
  };

  const handleAddBlockedDate = async (listing: ProviderListing) => {
    const dateVal = blockDateInputs[listing.id]?.trim();
    if (!dateVal) return;
    const existing = listing.blockedDates || [];
    if (existing.includes(dateVal)) return;
    setOfferingError('');
    setBusyActionId(`block-${listing.id}`);
    try {
      await onUpdateOffering(listing.id, {
        blockedDates: [...existing, dateVal],
      });
      setBlockDateInputs((prev) => ({ ...prev, [listing.id]: '' }));
    } catch (err) {
      setOfferingError(err instanceof Error ? err.message : 'Unable to block date.');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleRemoveBlockedDate = async (listing: ProviderListing, dateToRemove: string) => {
    setOfferingError('');
    setBusyActionId(`block-${listing.id}`);
    try {
      await onUpdateOffering(listing.id, {
        blockedDates: (listing.blockedDates || []).filter((d) => d !== dateToRemove),
      });
    } catch (err) {
      setOfferingError(err instanceof Error ? err.message : 'Unable to remove blocked date.');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleAccreditationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSubmitAccreditation) return;
    setAppFeedback('');
    setAppError('');
    if (businessName.trim().length < 2) {
      setAppError('Enter your registered tourism business name.');
      return;
    }

    setSubmittingApp(true);
    try {
      let uploadedUrl: string | undefined;
      if (complianceFile) {
        if (user.authMode === 'firebase' && user.emailVerified) {
          uploadedUrl = await storageService.uploadBusinessComplianceDoc(user.id, complianceFile);
        }
      }
      const coords = resolveZoneCoordinates(zone);
      await onSubmitAccreditation({
        businessName: businessName.trim(),
        category,
        zone,
        complianceDocs: complianceDocs.trim() || 'CATHSSETA Compliance Record',
        ...(description.trim() ? { description: description.trim() } : {}),
        lat: coords.lat,
        lng: coords.lng,
        imageUrl: uploadedUrl,
        safetyChecklistComplete: true,
      });
      setDescription('');
      setComplianceFile(null);
      setAppFeedback(
        user.authMode === 'firebase' && user.emailVerified
          ? 'Accreditation application saved to Cloud Firestore for Administrator review.'
          : 'Accreditation application added to demonstration queue.'
      );
    } catch (err) {
      setAppError(err instanceof Error ? err.message : 'Unable to submit business accreditation.');
    } finally {
      setSubmittingApp(false);
    }
  };

  return (
    <div className="space-y-6">
      <DemoDataNotice
        scope={
          user.authMode === 'firebase' && user.emailVerified
            ? 'Live Tourism Provider Operations — manage availability, unit pricing, blackout dates & booking confirmations'
            : 'Tourism provider operations workspace — manage availability, pricing, blackout dates & confirmation workflows'
        }
      />

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-[#15803D]">
            Accredited Service Provider · {user.location}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-[#0B1F3A]">
            {user.organization || user.name}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Configure provider-defined rates, manage unit availability &amp; blackout dates, and confirm or decline incoming tourist bookings.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('bookings')}
          className="rounded-lg bg-[#0D9488] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0F766E] whitespace-nowrap shrink-0"
        >
          Preview Smart Bookings
        </button>
      </div>

      {/* KPI Strip */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Booked Capacity</span>
            <CalendarCheck className="h-4 w-4 text-[#0D9488]" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-[#0B1F3A]">
            {totalSeatsBooked} / {totalCapacity}
          </p>
          <p className="mt-1 text-xs text-slate-600">Across {listings.length} offerings</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Pending Confirmations</span>
            <ClipboardList className="h-4 w-4 text-amber-700" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-[#0B1F3A]">
            {pendingRequestsCount}
          </p>
          <p className="mt-1 text-xs text-slate-600">Require provider verification</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Safety Checklists</span>
            <CheckCircle2 className="h-4 w-4 text-[#15803D]" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-[#0B1F3A]">
            {verifiedChecklists} / {listings.length}
          </p>
          <p className="mt-1 text-xs text-slate-600">Gear &amp; safety audits current</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Active Inventory Value</span>
            <Accessibility className="h-4 w-4 text-[#0D9488]" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-[#0B1F3A]">
            R {estimatedRevenueZar.toLocaleString('en-ZA')}
          </p>
          <p className="mt-1 text-xs text-slate-600">Based on provider unit rates</p>
        </div>
      </section>

      {/* Incoming Booking Confirmation & Cancellation Workflow */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-[#0B1F3A]">
              Reservation Confirmation &amp; Cancellation Queue ({filteredBookings.length})
            </h2>
            <p className="text-xs text-slate-500">
              Reservations stay Pending Verification / Awaiting Provider Confirmation until you verify availability below.
            </p>
          </div>
          <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            {(['All', 'Awaiting Confirmation', 'Confirmed'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                aria-pressed={bookingFilter === tab}
                onClick={() => setBookingFilter(tab)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                  bookingFilter === tab
                    ? 'bg-[#0B1F3A] text-white'
                    : 'text-slate-600 hover:text-[#0B1F3A]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {providerActionError && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {providerActionError}
          </p>
        )}

        <div className="divide-y divide-slate-200">
          {filteredBookings.length === 0 ? (
            <p className="py-4 text-xs text-slate-500">No reservations in this queue.</p>
          ) : (
            filteredBookings.map((bk) => (
              <div
                key={bk.id}
                className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    {bk.bookingReference && (
                      <span className="font-mono font-semibold text-[#0B1F3A]">
                        {bk.bookingReference}
                      </span>
                    )}
                    <span className="font-semibold text-[#0D9488]">
                      {bk.offeringType || bk.category}
                    </span>
                    <span className="font-mono text-slate-600 tabular-nums">
                      {bk.date} {bk.timeSlot}
                      {bk.endDate ? ` → ${bk.endDate} ${bk.endTime || ''}` : ''}
                    </span>
                    {bk.durationValue && bk.durationUnit && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px]">
                        {bk.durationValue} {bk.durationUnit}
                      </span>
                    )}
                    {bk.paymentMethod && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
                        {bk.paymentMethod}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-[#0B1F3A]">{bk.title}</p>
                  <p className="text-slate-600">
                    {bk.guests} guest(s) · Total:{' '}
                    <strong className="font-mono text-[#0B1F3A]">
                      R {bk.priceZar.toLocaleString('en-ZA')}
                    </strong>
                    {bk.paymentStatus && (
                      <span>
                        {' '}
                        · Payment: <strong className="text-[#0B1F3A]">{bk.paymentStatus}</strong>
                      </span>
                    )}
                    {typeof bk.balanceDueInPersonZar === 'number' &&
                      bk.balanceDueInPersonZar > 0 &&
                      bk.paymentStatus !== 'Paid' && (
                        <span className="text-amber-800 font-medium">
                          {' '}
                          (R {bk.balanceDueInPersonZar.toLocaleString('en-ZA')} due in person)
                        </span>
                      )}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <StatusText
                    label={bk.status}
                    tone={
                      bk.status === 'Confirmed' || bk.status === 'Completed'
                        ? 'nominal'
                        : isAwaitingBookingStatus(bk.status)
                        ? 'advisory'
                        : 'alert'
                    }
                  />

                  {isAwaitingBookingStatus(bk.status) && (
                    <>
                      <button
                        type="button"
                        disabled={busyActionId === `bk-${bk.id}`}
                        onClick={async () => {
                          setProviderActionError('');
                          setBusyActionId(`bk-${bk.id}`);
                          try {
                            await onUpdateBookingStatus(bk.id, 'Confirmed', {
                              confirmedBy: user.organization || user.name,
                            });
                          } catch (err) {
                            setProviderActionError(
                              err instanceof Error ? err.message : 'Unable to confirm reservation.'
                            );
                          } finally {
                            setBusyActionId(null);
                          }
                        }}
                        className="rounded-md bg-[#15803D] px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 transition-colors"
                      >
                        {busyActionId === `bk-${bk.id}` ? 'Updating...' : 'Confirm Booking'}
                      </button>
                      <button
                        type="button"
                        disabled={busyActionId === `bk-${bk.id}`}
                        onClick={async () => {
                          setProviderActionError('');
                          setBusyActionId(`bk-${bk.id}`);
                          try {
                            await onUpdateBookingStatus(bk.id, 'Rejected', {
                              cancellationReason: 'Declined by tourism service provider',
                            });
                          } catch (err) {
                            setProviderActionError(
                              err instanceof Error ? err.message : 'Unable to reject reservation.'
                            );
                          } finally {
                            setBusyActionId(null);
                          }
                        }}
                        className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60 transition-colors"
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {bk.status === 'Confirmed' && (
                    <button
                      type="button"
                      disabled={busyActionId === `bk-${bk.id}`}
                      onClick={async () => {
                        setProviderActionError('');
                        setBusyActionId(`bk-${bk.id}`);
                        try {
                          await onUpdateBookingStatus(bk.id, 'Completed', {
                            confirmedBy: user.organization || user.name,
                          });
                        } catch (err) {
                          setProviderActionError(
                            err instanceof Error ? err.message : 'Unable to mark booking completed.'
                          );
                        } finally {
                          setBusyActionId(null);
                        }
                      }}
                      className="rounded-md border border-[#0D9488] bg-[#F0FDFA] px-3 py-1.5 text-xs font-semibold text-[#0F766E] hover:bg-teal-100 disabled:opacity-60 transition-colors"
                    >
                      Mark Completed
                    </button>
                  )}

                  {(isAwaitingBookingStatus(bk.status) || bk.status === 'Confirmed') && (
                    <button
                      type="button"
                      disabled={busyActionId === `bk-${bk.id}`}
                      onClick={async () => {
                        setProviderActionError('');
                        setBusyActionId(`bk-${bk.id}`);
                        try {
                          await onUpdateBookingStatus(bk.id, 'Cancelled', {
                            cancellationReason: 'Declined / cancelled by service provider',
                          });
                        } catch (err) {
                          setProviderActionError(
                            err instanceof Error ? err.message : 'Unable to cancel booking.'
                          );
                        } finally {
                          setBusyActionId(null);
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60 transition-colors"
                    >
                      <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Provider Payment Settings & In-Person Collection Ledger */}
      <ProviderPaymentSettingsSection
        user={user}
        settings={paymentSettings}
        providerPayments={providerPayments}
        providerBookings={providerBookings}
        onSaveSettings={onSavePaymentSettings}
        onMarkInPersonPaid={onMarkInPersonPaid}
      />

      {/* Availability & Provider-Defined Pricing Table + New Offering Creator */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-display text-base font-bold text-[#0B1F3A]">
            Availability, Pricing &amp; Blackout Date Management
          </h2>
          <p className="text-xs text-slate-500">
            Adjust capacity, toggle Active/Paused availability, verify gear checklists, or block specific calendar dates.
          </p>
        </div>

        {/* Add Bookable Offering Form */}
        <form
          onSubmit={handleCreateOffering}
          className="grid gap-3 border-b border-slate-200 bg-slate-50/70 p-5 sm:grid-cols-12"
        >
          <div className="sm:col-span-3">
            <label htmlFor="prov-off-title" className="block text-[11px] font-semibold text-slate-700">
              Offering Title
            </label>
            <input
              id="prov-off-title"
              type="text"
              value={expTitle}
              onChange={(e) => setExpTitle(e.target.value)}
              placeholder="e.g., Camps Bay Ocean Villa"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="prov-off-type" className="block text-[11px] font-semibold text-slate-700">
              Type
            </label>
            <select
              id="prov-off-type"
              value={offeringType}
              onChange={(e) => setOfferingType(e.target.value as OfferingType)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
            >
              <option value="Activity">Activity</option>
              <option value="Accommodation">Accommodation</option>
              <option value="Transport">Transport</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="prov-off-unit" className="block text-[11px] font-semibold text-slate-700">
              Duration Unit
            </label>
            <select
              id="prov-off-unit"
              value={durationUnit}
              onChange={(e) => setDurationUnit(e.target.value as DurationUnit)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
            >
              <option value="sessions">Sessions (2h)</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
              <option value="nights">Nights</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="prov-off-price" className="block text-[11px] font-semibold text-slate-700">
              Rate (ZAR / unit)
            </label>
            <input
              id="prov-off-price"
              type="number"
              min={0}
              value={unitPriceZar}
              onChange={(e) => setUnitPriceZar(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
            />
          </div>
          <div className="sm:col-span-1">
            <label htmlFor="prov-off-cap" className="block text-[11px] font-semibold text-slate-700">
              Units
            </label>
            <input
              id="prov-off-cap"
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(Math.max(1, Number(e.target.value)))}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono"
            />
          </div>
          <div className="sm:col-span-2 flex items-end gap-2">
            <select
              aria-label="Pricing model"
              value={pricingModel}
              onChange={(e) => setPricingModel(e.target.value as PricingModel)}
              className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
            >
              <option value="per_guest">/ guest</option>
              <option value="per_unit">/ booking</option>
            </select>
            <button
              type="submit"
              disabled={creatingOffering}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#0D9488] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0F766E] disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add
            </button>
          </div>
        </form>
        {offeringFeedback && (
          <p role="status" className="px-5 py-2 text-xs font-medium text-[#15803D]">
            {offeringFeedback}
          </p>
        )}
        {offeringError && (
          <p role="alert" className="px-5 py-2 text-xs font-medium text-red-700">
            {offeringError}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-5 py-3">Offering</th>
                <th className="px-5 py-3">Duration &amp; Rate</th>
                <th className="px-5 py-3">Capacity</th>
                <th className="px-5 py-3">Blocked Dates</th>
                <th className="px-5 py-3">Safety Audit</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {listings.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70 align-top">
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-[#0B1F3A]">{item.experienceTitle}</p>
                    <p className="text-[11px] text-slate-500">
                      {item.offeringType || 'Activity'} · {item.zone || 'Cape Town'}
                    </p>
                  </td>
                  <td className="px-5 py-3.5 text-xs">
                    <p className="font-mono font-semibold text-[#0B1F3A] tabular-nums">
                      R {item.priceZar.toLocaleString('en-ZA')} / {(item.durationUnit || 'sessions').slice(0, -1)}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {item.pricingModel === 'per_unit' ? 'Flat unit rate' : 'Per guest'}
                    </p>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs tabular-nums text-slate-700">
                    {item.bookedSeats} / {item.capacity}
                  </td>
                  <td className="px-5 py-3.5 text-xs">
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {(item.blockedDates || []).map((dt) => (
                        <button
                          key={dt}
                          type="button"
                          onClick={() => handleRemoveBlockedDate(item, dt)}
                          title="Click to unblock date"
                          className="rounded bg-red-50 px-1.5 py-0.5 font-mono text-[10px] text-red-700 hover:bg-red-100"
                        >
                          {dt} ×
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="date"
                        value={blockDateInputs[item.id] || ''}
                        onChange={(e) =>
                          setBlockDateInputs((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        aria-label={`Block date for ${item.experienceTitle}`}
                        className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px] font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddBlockedDate(item)}
                        className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium hover:bg-slate-100"
                      >
                        Block
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {item.safetyChecklistComplete ? (
                      <StatusText label="Verified" tone="nominal" />
                    ) : (
                      <button
                        type="button"
                        disabled={busyActionId === `check-${item.id}`}
                        onClick={async () => {
                          setOfferingError('');
                          setBusyActionId(`check-${item.id}`);
                          try {
                            await onCompleteChecklist(item.id);
                          } catch (err) {
                            setOfferingError(
                              err instanceof Error ? err.message : 'Unable to verify checklist.'
                            );
                          } finally {
                            setBusyActionId(null);
                          }
                        }}
                        className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60 transition-colors whitespace-nowrap"
                      >
                        Verify Gear Now
                      </button>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusText
                      label={item.status}
                      tone={item.status === 'Active' ? 'nominal' : 'advisory'}
                    />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      disabled={busyActionId === `toggle-${item.id}`}
                      onClick={async () => {
                        setOfferingError('');
                        setBusyActionId(`toggle-${item.id}`);
                        try {
                          await onToggleListingStatus(item.id);
                        } catch (err) {
                          setOfferingError(
                            err instanceof Error ? err.message : 'Unable to toggle listing status.'
                          );
                        } finally {
                          setBusyActionId(null);
                        }
                      }}
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-[#0B1F3A] hover:bg-slate-100 disabled:opacity-60 transition-colors whitespace-nowrap"
                    >
                      {item.status === 'Active' ? 'Pause' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Manifest & Accessibility Notes */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-6">
          <h3 className="font-display text-base font-bold text-[#0B1F3A]">
            Guest Boarding &amp; Accessibility Notes (Demonstration Manifest)
          </h3>
          <div className="mt-3 divide-y divide-slate-200 text-xs">
            <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-[#0B1F3A]">
                  Maya van der Merwe (Party of 2) · Digital Pass CS360-884210
                </p>
                <p className="text-slate-600">
                  Boulders Penguin Boardwalk &amp; Kayak Transfer · Tomorrow 09:00 SAST
                </p>
              </div>
              <StatusText label="Step-free pier ramp requested" tone="nominal" />
            </div>
            <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-[#0B1F3A]">
                  K. Osei &amp; Family (Party of 4) · Booking #BK-204
                </p>
                <p className="text-slate-600">Hout Bay Seal Island Eco-Boat · Today 11:00 SAST</p>
              </div>
              <StatusText label="Checked in at Jetty 3" tone="nominal" />
            </div>
          </div>
        </section>

        {/* Submit Tourism Business Accreditation */}
        {onSubmitAccreditation && (
          <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-6">
            <h3 className="font-display text-base font-bold text-[#0B1F3A]">
              Submit Business Accreditation &amp; Compliance
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Register your Cape Town operator profile in Firestore for Tourism Administrator approval.
            </p>
            <form onSubmit={handleAccreditationSubmit} className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="prov-biz-name" className="block text-xs font-semibold text-slate-700">
                    Business Name
                  </label>
                  <input
                    id="prov-biz-name"
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#0D9488] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="prov-biz-cat" className="block text-xs font-semibold text-slate-700">
                    Category
                  </label>
                  <select
                    id="prov-biz-cat"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#0D9488] focus:outline-none"
                  >
                    <option>Marine &amp; Coastal</option>
                    <option>Guided Hiking &amp; Nature</option>
                    <option>Cultural &amp; Heritage</option>
                    <option>Accessible Mobility &amp; Shuttle</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="prov-biz-zone" className="block text-xs font-semibold text-slate-700">
                    Operating Precinct
                  </label>
                  <input
                    id="prov-biz-zone"
                    type="text"
                    value={zone}
                    onChange={(e) => setZone(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#0D9488] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="prov-biz-docs" className="block text-xs font-semibold text-slate-700">
                    Compliance Summary
                  </label>
                  <input
                    id="prov-biz-docs"
                    type="text"
                    value={complianceDocs}
                    onChange={(e) => setComplianceDocs(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#0D9488] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="prov-biz-desc" className="block text-xs font-semibold text-slate-700">
                  Public Experience Description (for Explore Map &amp; Directory)
                </label>
                <input
                  id="prov-biz-desc"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your guided tours, accessible boarding, or eco-certified excursions..."
                  maxLength={500}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#0D9488] focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-[#0B1F3A] hover:bg-slate-100">
                  <Upload className="h-3.5 w-3.5 text-[#0D9488]" aria-hidden="true" />
                  {complianceFile ? complianceFile.name : 'Attach Certificate (Firebase Storage)'}
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setComplianceFile(e.target.files?.[0] ?? null)}
                    className="sr-only"
                  />
                </label>

                <button
                  type="submit"
                  disabled={submittingApp}
                  className="rounded-lg bg-[#0B1F3A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102A43] disabled:opacity-60 transition-colors"
                >
                  {submittingApp ? 'Submitting...' : 'Submit for Accreditation'}
                </button>
              </div>

              {appFeedback && <p className="text-xs font-medium text-[#15803D]">{appFeedback}</p>}
              {appError && <p className="text-xs font-medium text-red-700">{appError}</p>}
            </form>
          </section>
        )}
      </div>
    </div>
  );
};
