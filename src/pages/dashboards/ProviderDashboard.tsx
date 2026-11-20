import React, { useEffect, useMemo, useState } from 'react';
import {
  Accessibility,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Edit3,
  Image as ImageIcon,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  Star,
  Upload,
  Wallet,
  XCircle,
} from 'lucide-react';
import { DemoDataNotice } from '@/src/components/common/DemoDataNotice';
import { StatusText } from '@/src/components/common/StatusText';
import { resolveZoneCoordinates } from '@/src/components/map/CapeTownMap';
import { ProviderPaymentSettingsSection } from '@/src/components/payments/ProviderPaymentSettingsSection';
import { ACTIVITY_CATEGORIES, IMG } from '@/src/data/capeTownDirectory';
import { storageService } from '@/src/services/firebase/storageService';
import type {
  ActivityCategory,
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
  ReviewItem,
} from '@/src/types/app';
import { isAwaitingBookingStatus } from '@/src/utils/bookingCalculations';

export type ProviderDashboardTab = 'bookings' | 'offerings' | 'payments' | 'accreditation';

const OFFERING_PHOTO_PRESETS = [
  { label: 'Table Mountain Cableway', url: IMG.cableway },
  { label: 'Waterfront Harbour Cruise', url: IMG.harbour },
  { label: 'Muizenberg Surf & Kayak', url: IMG.surfKayak },
  { label: 'Cape Point Peninsula', url: IMG.capePoint },
  { label: 'Kirstenbosch Canopy', url: IMG.kirstenbosch },
  { label: 'Bo-Kaap Heritage Walk', url: IMG.bokaap },
  { label: 'Zeitz MOCAA Art', url: IMG.zeitzArt },
  { label: 'Old Biscuit Mill Food', url: IMG.biscuitMill },
];

interface ProviderDashboardProps {
  user: DemoUser;
  listings: ProviderListing[];
  bookings: BookingItem[];
  reviews?: ReviewItem[];
  paymentSettings?: ProviderPaymentSettings;
  payments: PaymentRecord[];
  initialTab?: ProviderDashboardTab;
  onTabChange?: (tab: ProviderDashboardTab) => void;
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
  onReplyToReview?: (reviewId: string, replyText: string) => Promise<void> | void;
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
  reviews = [],
  paymentSettings,
  payments,
  initialTab = 'bookings',
  onTabChange,
  onSavePaymentSettings,
  onMarkInPersonPaid,
  onToggleListingStatus,
  onCompleteChecklist,
  onCreateOffering,
  onUpdateOffering,
  onUpdateBookingStatus,
  onReplyToReview,
  onSubmitAccreditation,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<ProviderDashboardTab>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const selectTab = (tab: ProviderDashboardTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  // Offering Creator State (Availability & Provider-Defined Pricing + Marketplace Metadata)
  const [offeringType, setOfferingType] = useState<OfferingType>('Activity');
  const [activityCategory, setActivityCategory] = useState<ActivityCategory>('Guided tours');
  const [expTitle, setExpTitle] = useState('');
  const [expZone, setExpZone] = useState("Simon's Town · False Bay");
  const [expDescription, setExpDescription] = useState('');
  const [expPhotoPreset, setExpPhotoPreset] = useState<string>(IMG.surfKayak);
  const [expPhotoFile, setExpPhotoFile] = useState<File | null>(null);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('sessions');
  const [defaultDurationValue, setDefaultDurationValue] = useState(1);
  const [unitPriceZar, setUnitPriceZar] = useState(450);
  const [pricingModel, setPricingModel] = useState<PricingModel>('per_guest');
  const [capacity, setCapacity] = useState(12);
  const [nextDeparture] = useState('09:00');
  const [accessibleOffering, setAccessibleOffering] = useState(true);
  const [familyFriendlyOffering, setFamilyFriendlyOffering] = useState(true);
  const [ageRequirement, setAgeRequirement] = useState('All Ages (under 16 with adult)');
  const [includedServicesText, setIncludedServicesText] = useState(
    'Accredited local guide, safety briefing, life vest / gear'
  );
  const [whatToBringText, setWhatToBringText] = useState(
    'Sunscreen, drinking water, windbreaker, closed walking shoes'
  );
  const [cancellationPolicyText, setCancellationPolicyText] = useState(
    'Free reschedule or refund up to 24 hours before departure.'
  );
  const [safetyInfoText, setSafetyInfoText] = useState(
    'SAMSA / CATHSSETA certified operator; weather check 2 hours prior.'
  );
  const [creatingOffering, setCreatingOffering] = useState(false);
  const [offeringFeedback, setOfferingFeedback] = useState('');

  // Offering search, filter & inline rate/capacity editor
  const [offeringSearch, setOfferingSearch] = useState('');
  const [offeringTypeFilter, setOfferingTypeFilter] = useState<'All' | OfferingType>('All');
  const [editingOfferingId, setEditingOfferingId] = useState<string | null>(null);
  const [editPriceZar, setEditPriceZar] = useState(0);
  const [editCapacity, setEditCapacity] = useState(1);

  // Blackout Date Input per Listing
  const [blockDateInputs, setBlockDateInputs] = useState<Record<string, string>>({});

  // Review Reply Drafts
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [reviewFeedback, setReviewFeedback] = useState('');

  // Booking Queue Filter & Action Feedback
  const [bookingFilter, setBookingFilter] = useState<'All' | 'Awaiting Confirmation' | 'Confirmed'>(
    'All'
  );
  const [bookingSearch, setBookingSearch] = useState('');
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
  const utilizationPct = totalCapacity > 0 ? Math.round((totalSeatsBooked / totalCapacity) * 100) : 0;
  const estimatedRevenueZar = listings.reduce((sum, l) => sum + l.bookedSeats * l.priceZar, 0);
  const verifiedChecklists = listings.filter((l) => l.safetyChecklistComplete).length;

  const providerBookings = useMemo(
    () =>
      bookings.filter((b) =>
        user.authMode === 'firebase' && user.role !== 'admin'
          ? b.providerId === user.id || b.userId === user.id
          : true
      ),
    [bookings, user.authMode, user.role, user.id]
  );

  const providerPayments = useMemo(
    () =>
      payments.filter((p) =>
        user.authMode === 'firebase' && user.role !== 'admin'
          ? p.providerId === user.id || p.userId === user.id
          : true
      ),
    [payments, user.authMode, user.role, user.id]
  );

  const filteredBookings = useMemo(() => {
    const q = bookingSearch.trim().toLowerCase();
    return providerBookings.filter((b) => {
      const matchesStatus =
        bookingFilter === 'All'
          ? true
          : bookingFilter === 'Awaiting Confirmation'
          ? isAwaitingBookingStatus(b.status)
          : b.status === bookingFilter;
      if (!matchesStatus) return false;
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        (b.bookingReference || '').toLowerCase().includes(q) ||
        (b.zone || '').toLowerCase().includes(q)
      );
    });
  }, [providerBookings, bookingFilter, bookingSearch]);

  const filteredListings = useMemo(() => {
    const q = offeringSearch.trim().toLowerCase();
    return listings.filter((item) => {
      const effectiveType = item.offeringType || 'Activity';
      if (offeringTypeFilter !== 'All' && effectiveType !== offeringTypeFilter) return false;
      if (!q) return true;
      return (
        item.experienceTitle.toLowerCase().includes(q) ||
        (item.zone || '').toLowerCase().includes(q) ||
        effectiveType.toLowerCase().includes(q)
      );
    });
  }, [listings, offeringTypeFilter, offeringSearch]);

  const pendingRequestsCount = providerBookings.filter((b) =>
    isAwaitingBookingStatus(b.status)
  ).length;
  const confirmedBookings = providerBookings.filter((b) => b.status === 'Confirmed');
  const unpaidInPersonCount = providerPayments.filter(
    (p) => p.paymentStatus === 'Unpaid' || p.paymentStatus === 'Partially Paid'
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
      let resolvedImageUrl = expPhotoPreset;
      if (expPhotoFile && user.authMode === 'firebase' && user.emailVerified) {
        resolvedImageUrl = await storageService.uploadOfferingPhoto(user.id, expPhotoFile);
      }
      const zoneTrimmed = expZone.trim() || 'Cape Town';
      const coords = resolveZoneCoordinates(zoneTrimmed);
      const parseList = (raw: string) =>
        raw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 12);

      await onCreateOffering({
        offeringType,
        experienceTitle: expTitle.trim(),
        category: offeringType,
        activityCategory,
        zone: zoneTrimmed,
        description:
          expDescription.trim() ||
          `Accredited Cape Town ${activityCategory.toLowerCase()} experience operating in ${zoneTrimmed}.`,
        imageUrl: resolvedImageUrl,
        galleryImages: [resolvedImageUrl],
        ageRequirement: ageRequirement.trim() || 'All Ages',
        familyFriendly: familyFriendlyOffering,
        includedServices: parseList(includedServicesText),
        whatToBring: parseList(whatToBringText),
        cancellationPolicy: cancellationPolicyText.trim(),
        safetyInfo: safetyInfoText.trim(),
        lat: coords.lat,
        lng: coords.lng,
        nearbyTransport: [
          `MyCiTi & Verified Shuttle Corridor (${zoneTrimmed})`,
          'Verified E-Hailing Pick-Up Bay',
        ],
        availableDates: ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20'],
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
      setExpDescription('');
      setExpPhotoFile(null);
      setOfferingFeedback(
        `Added "${expTitle.trim()}" under ${activityCategory} (${durationUnit}, R ${unitPriceZar}/${durationUnit.slice(0, -1)}).`
      );
    } catch (err) {
      setOfferingError(err instanceof Error ? err.message : 'Unable to create offering.');
    } finally {
      setCreatingOffering(false);
    }
  };

  const handleSaveInlineEdit = async (listing: ProviderListing) => {
    setOfferingError('');
    setBusyActionId(`edit-${listing.id}`);
    try {
      await onUpdateOffering(listing.id, {
        priceZar: Math.max(0, Math.round(editPriceZar)),
        capacity: Math.max(listing.bookedSeats || 1, Math.round(editCapacity)),
      });
      setEditingOfferingId(null);
      setOfferingFeedback(`Updated rates & capacity for "${listing.experienceTitle}".`);
    } catch (err) {
      setOfferingError(err instanceof Error ? err.message : 'Unable to save offering updates.');
    } finally {
      setBusyActionId(null);
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
      setAppError(
        err instanceof Error ? err.message : 'Unable to submit business accreditation.'
      );
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

      {/* Executive Partner Header */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-[#15803D]">
              Accredited Service Provider · {user.location}
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold text-[#111827] 2xl:text-3xl">
              {user.organization || user.name}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Configure provider-defined rates, manage unit availability &amp; blackout dates, reconcile in-person collections, and confirm incoming tourist bookings.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => selectTab('offerings')}
              className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#111827] hover:bg-slate-50 whitespace-nowrap"
            >
              + New Offering
            </button>
            <button
              type="button"
              onClick={() => onNavigate('bookings')}
              className="min-h-[40px] rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] whitespace-nowrap"
            >
              Preview Smart Bookings
            </button>
          </div>
        </div>
      </section>

      {/* Interactive KPI Strip */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => selectTab('offerings')}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-[#1D4ED8] transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Booked Capacity</span>
            <CalendarCheck className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-[#111827]">
            {totalSeatsBooked} / {totalCapacity}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            <span className="font-mono font-semibold text-[#1D4ED8] tabular-nums">
              {utilizationPct}%
            </span>{' '}
            utilization across {listings.length} offerings
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            selectTab('bookings');
            setBookingFilter('Awaiting Confirmation');
          }}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-[#1D4ED8] transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Pending Confirmations</span>
            <ClipboardList className="h-4 w-4 text-amber-700" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-[#111827]">
            {pendingRequestsCount}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {pendingRequestsCount > 0 ? 'Click to review queue' : 'All requests triaged'}
          </p>
        </button>

        <button
          type="button"
          onClick={() => selectTab('offerings')}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-[#1D4ED8] transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Safety Checklists</span>
            <CheckCircle2 className="h-4 w-4 text-[#15803D]" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-[#111827]">
            {verifiedChecklists} / {listings.length}
          </p>
          <p className="mt-1 text-xs text-slate-600">Gear &amp; safety audits current</p>
        </button>

        <button
          type="button"
          onClick={() => selectTab('payments')}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-[#1D4ED8] transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Active Inventory Value</span>
            <Wallet className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-[#111827]">
            R {estimatedRevenueZar.toLocaleString('en-ZA')}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            <span className="font-mono tabular-nums">{unpaidInPersonCount}</span> arrival balance(s) due
          </p>
        </button>
      </section>

      {/* Workspace Segmented Tabs */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="tablist"
          aria-label="Service Provider dashboard sections"
          className="flex items-center gap-1 overflow-x-auto max-w-full rounded-lg border border-slate-200 bg-white p-1"
        >
          {[
            {
              id: 'bookings' as const,
              label: 'Operations & Bookings',
              icon: ClipboardList,
              count: providerBookings.length,
            },
            {
              id: 'offerings' as const,
              label: 'Offerings & Calendar',
              icon: CalendarCheck,
              count: listings.length,
            },
            {
              id: 'payments' as const,
              label: 'Payments & Policy',
              icon: Wallet,
              count: providerPayments.length,
            },
            {
              id: 'accreditation' as const,
              label: 'Accreditation & Manifest',
              icon: ShieldCheck,
              count: confirmedBookings.length,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`tab-provider-${tab.id}`}
                aria-selected={selected}
                aria-controls={`panel-provider-${tab.id}`}
                onClick={() => selectTab(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  selected
                    ? 'bg-[#111827] text-white'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-[#111827]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {tab.label}
                <span className="font-mono text-[11px] opacity-80 tabular-nums">
                  ({tab.count})
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-slate-500">
          Confirmed departures:{' '}
          <span className="font-mono font-semibold text-[#15803D] tabular-nums">
            {confirmedBookings.length}
          </span>
        </p>
      </div>

      {/* TAB 1: OPERATIONS & BOOKINGS */}
      {activeTab === 'bookings' && (
        <div
          id="panel-provider-bookings"
          role="tabpanel"
          aria-labelledby="tab-provider-bookings"
          className="space-y-6"
        >
          {/* Live Capacity Utilization Pulse */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
                <h2 className="font-display text-sm font-bold text-[#111827]">
                  Offering Capacity Utilization Pulse
                </h2>
              </div>
              <button
                type="button"
                onClick={() => selectTab('offerings')}
                className="text-xs font-semibold text-[#1D4ED8] hover:underline"
              >
                Manage Inventory &amp; Rates
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {listings.map((item) => {
                const pct =
                  item.capacity > 0
                    ? Math.min(100, Math.round((item.bookedSeats / item.capacity) * 100))
                    : 0;
                const remaining = Math.max(0, item.capacity - item.bookedSeats);
                return (
                  <div
                    key={item.id}
                    className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-[#111827]">
                          {item.experienceTitle}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {item.offeringType || 'Activity'} · {item.nextDeparture} SAST
                        </p>
                      </div>
                      <span className="font-mono text-xs font-semibold text-[#111827] tabular-nums shrink-0">
                        {pct}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded bg-slate-200">
                      <div
                        className={`h-full transition-all ${
                          pct >= 85
                            ? 'bg-amber-600'
                            : item.status === 'Active'
                            ? 'bg-[#1D4ED8]'
                            : 'bg-slate-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span className="font-mono tabular-nums">
                        {item.bookedSeats}/{item.capacity} booked ({remaining} left)
                      </span>
                      <span className="font-mono font-semibold text-[#111827] tabular-nums">
                        R {item.priceZar.toLocaleString('en-ZA')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Incoming Booking Confirmation & Cancellation Workflow */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-display text-base font-bold text-[#111827]">
                  Reservation Confirmation &amp; Cancellation Queue ({filteredBookings.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Reservations stay Pending Verification / Awaiting Provider Confirmation until you verify availability below.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                    placeholder="Ref or experience..."
                    aria-label="Search provider bookings"
                    className="rounded-lg border border-slate-300 bg-white py-1 pl-8 pr-2.5 text-xs text-[#111827] focus:border-[#1D4ED8] focus:outline-none"
                  />
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
                          ? 'bg-[#111827] text-white'
                          : 'text-slate-600 hover:text-[#111827]'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {providerActionError && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
              >
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
                          <span className="font-mono font-semibold text-[#111827]">
                            {bk.bookingReference}
                          </span>
                        )}
                        <span className="font-semibold text-[#1D4ED8]">
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
                        {bk.accessible && (
                          <span className="inline-flex items-center gap-1 rounded bg-[#EFF6FF] px-1.5 py-0.5 text-[10px] font-semibold text-[#1E40AF]">
                            <Accessibility className="h-3 w-3" aria-hidden="true" />
                            Step-Free
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-bold text-[#111827]">{bk.title}</p>
                      <p className="text-slate-600">
                        {bk.guests} guest(s) · Total:{' '}
                        <strong className="font-mono text-[#111827] tabular-nums">
                          R {bk.priceZar.toLocaleString('en-ZA')}
                        </strong>
                        {bk.paymentStatus && (
                          <span>
                            {' '}
                            · Payment: <strong className="text-[#111827]">{bk.paymentStatus}</strong>
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
                                  err instanceof Error
                                    ? err.message
                                    : 'Unable to confirm reservation.'
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
                                  err instanceof Error
                                    ? err.message
                                    : 'Unable to reject reservation.'
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
                                err instanceof Error
                                  ? err.message
                                  : 'Unable to mark booking completed.'
                              );
                            } finally {
                              setBusyActionId(null);
                            }
                          }}
                          className="rounded-md border border-[#1D4ED8] bg-[#EFF6FF] px-3 py-1.5 text-xs font-semibold text-[#1E40AF] hover:bg-blue-100 disabled:opacity-60 transition-colors"
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
        </div>
      )}

      {/* TAB 2: OFFERINGS, RATES & CALENDAR */}
      {activeTab === 'offerings' && (
        <div
          id="panel-provider-offerings"
          role="tabpanel"
          aria-labelledby="tab-provider-offerings"
        >
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-display text-base font-bold text-[#111827]">
                  Availability, Pricing &amp; Blackout Date Management ({filteredListings.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Adjust unit pricing or seat capacity inline, toggle Active/Paused availability, verify gear checklists, or block specific calendar dates.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={offeringSearch}
                    onChange={(e) => setOfferingSearch(e.target.value)}
                    placeholder="Filter offerings..."
                    aria-label="Filter provider offerings"
                    className="rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-[#111827] focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
                <select
                  aria-label="Filter by offering type"
                  value={offeringTypeFilter}
                  onChange={(e) => setOfferingTypeFilter(e.target.value as 'All' | OfferingType)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-[#111827]"
                >
                  <option value="All">All Types</option>
                  <option value="Activity">Activity</option>
                  <option value="Accommodation">Accommodation</option>
                  <option value="Transport">Transport</option>
                </select>
              </div>
            </div>

            {/* Add Bookable Offering Form (Full Marketplace Listing Fields) */}
            <form
              onSubmit={handleCreateOffering}
              className="grid gap-3 border-b border-slate-200 bg-slate-50/70 p-5 sm:grid-cols-12"
            >
              <div className="sm:col-span-4">
                <label
                  htmlFor="prov-off-title"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Offering Title
                </label>
                <input
                  id="prov-off-title"
                  type="text"
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  placeholder="e.g., Hout Bay Sunset Kayak & Seal Viewing"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                />
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="prov-off-type"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Booking Type
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
              <div className="sm:col-span-3">
                <label
                  htmlFor="prov-off-actcat"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Directory Category
                </label>
                <select
                  id="prov-off-actcat"
                  value={activityCategory}
                  onChange={(e) => setActivityCategory(e.target.value as ActivityCategory)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  {ACTIVITY_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-3">
                <label
                  htmlFor="prov-off-zone"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Operating Precinct
                </label>
                <input
                  id="prov-off-zone"
                  type="text"
                  value={expZone}
                  onChange={(e) => setExpZone(e.target.value)}
                  placeholder="Precinct / departure hub"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="prov-off-unit"
                  className="block text-[11px] font-semibold text-slate-700"
                >
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
                <label
                  htmlFor="prov-off-durval"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Default Duration
                </label>
                <input
                  id="prov-off-durval"
                  type="number"
                  min={1}
                  max={30}
                  value={defaultDurationValue}
                  onChange={(e) => setDefaultDurationValue(Math.max(1, Number(e.target.value) || 1))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="prov-off-price"
                  className="block text-[11px] font-semibold text-slate-700"
                >
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
              <div className="sm:col-span-2">
                <label
                  htmlFor="prov-off-model"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Pricing Model
                </label>
                <select
                  id="prov-off-model"
                  aria-label="Pricing model"
                  value={pricingModel}
                  onChange={(e) => setPricingModel(e.target.value as PricingModel)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                >
                  <option value="per_guest">/ guest</option>
                  <option value="per_unit">/ booking</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="prov-off-cap"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Max Group / Units
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
              <div className="sm:col-span-2">
                <label
                  htmlFor="prov-off-age"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Age Suitability
                </label>
                <input
                  id="prov-off-age"
                  type="text"
                  value={ageRequirement}
                  onChange={(e) => setAgeRequirement(e.target.value)}
                  placeholder="All Ages or Ages 12+"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                />
              </div>

              <div className="sm:col-span-6">
                <label
                  htmlFor="prov-off-desc"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Experience Description
                </label>
                <input
                  id="prov-off-desc"
                  type="text"
                  value={expDescription}
                  onChange={(e) => setExpDescription(e.target.value)}
                  placeholder="Describe route highlights, pace, and guide credentials..."
                  maxLength={450}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                />
              </div>
              <div className="sm:col-span-3">
                <label
                  htmlFor="prov-off-photo-preset"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Gallery Photo Preset
                </label>
                <select
                  id="prov-off-photo-preset"
                  value={expPhotoPreset}
                  onChange={(e) => setExpPhotoPreset(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  {OFFERING_PHOTO_PRESETS.map((p) => (
                    <option key={p.label} value={p.url}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-3 flex items-end">
                <label className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-[#111827] hover:bg-slate-100">
                  <ImageIcon className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
                  <span className="truncate">
                    {expPhotoFile ? expPhotoFile.name : 'Upload Photo (Storage)'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setExpPhotoFile(e.target.files?.[0] ?? null)}
                    className="sr-only"
                  />
                </label>
              </div>

              <div className="sm:col-span-6">
                <label
                  htmlFor="prov-off-included"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Included Services (comma-separated)
                </label>
                <input
                  id="prov-off-included"
                  type="text"
                  value={includedServicesText}
                  onChange={(e) => setIncludedServicesText(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                />
              </div>
              <div className="sm:col-span-6">
                <label
                  htmlFor="prov-off-bring"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  What Visitors Should Bring (comma-separated)
                </label>
                <input
                  id="prov-off-bring"
                  type="text"
                  value={whatToBringText}
                  onChange={(e) => setWhatToBringText(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                />
              </div>

              <div className="sm:col-span-6">
                <label
                  htmlFor="prov-off-cancel"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Cancellation Policy
                </label>
                <input
                  id="prov-off-cancel"
                  type="text"
                  value={cancellationPolicyText}
                  onChange={(e) => setCancellationPolicyText(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                />
              </div>
              <div className="sm:col-span-6">
                <label
                  htmlFor="prov-off-safety"
                  className="block text-[11px] font-semibold text-slate-700"
                >
                  Safety Information &amp; Gear Standard
                </label>
                <input
                  id="prov-off-safety"
                  type="text"
                  value={safetyInfoText}
                  onChange={(e) => setSafetyInfoText(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                />
              </div>

              <div className="sm:col-span-9 flex flex-wrap items-center gap-4 pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={accessibleOffering}
                    onChange={(e) => setAccessibleOffering(e.target.checked)}
                    className="rounded border-slate-300 text-[#1D4ED8]"
                  />
                  <span>Step-free / wheelchair-friendly boarding &amp; route verified</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={familyFriendlyOffering}
                    onChange={(e) => setFamilyFriendlyOffering(e.target.checked)}
                    className="rounded border-slate-300 text-[#1D4ED8]"
                  />
                  <span>Family-friendly suitability</span>
                </label>
              </div>
              <div className="sm:col-span-3 flex items-end justify-end">
                <button
                  type="submit"
                  disabled={creatingOffering}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60 whitespace-nowrap"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  {creatingOffering ? 'Publishing...' : 'Add Marketplace Offering'}
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

            {/* Mobile Offerings Cards (<768px) */}
            <div className="md:hidden divide-y divide-slate-200">
              {filteredListings.map((item) => {
                const isEditing = editingOfferingId === item.id;
                return (
                  <div key={`mob-${item.id}`} className="p-4 space-y-3 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-[#111827]">
                          {item.experienceTitle}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {item.offeringType || 'Activity'} · {item.zone || 'Cape Town'}
                          {item.accessible ? ' · Step-free' : ''}
                        </p>
                      </div>
                      <StatusText
                        label={item.status}
                        tone={item.status === 'Active' ? 'nominal' : 'advisory'}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                      <div>
                        <span className="block text-[10px] text-slate-500">Rate</span>
                        {isEditing ? (
                          <input
                            type="number"
                            min={0}
                            aria-label={`Edit ZAR rate for ${item.experienceTitle}`}
                            value={editPriceZar}
                            onChange={(e) => setEditPriceZar(Number(e.target.value))}
                            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs"
                          />
                        ) : (
                          <span className="font-mono font-semibold text-[#111827] tabular-nums">
                            R {item.priceZar.toLocaleString('en-ZA')} /{' '}
                            {(item.durationUnit || 'sessions').slice(0, -1)}
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-500">Capacity</span>
                        {isEditing ? (
                          <input
                            type="number"
                            min={Math.max(1, item.bookedSeats)}
                            aria-label={`Edit seat capacity for ${item.experienceTitle}`}
                            value={editCapacity}
                            onChange={(e) => setEditCapacity(Number(e.target.value))}
                            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs"
                          />
                        ) : (
                          <span className="font-mono font-semibold text-slate-700 tabular-nums">
                            {item.bookedSeats} / {item.capacity} seats
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {(item.blockedDates || []).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {(item.blockedDates || []).map((dt) => (
                            <button
                              key={dt}
                              type="button"
                              onClick={() => handleRemoveBlockedDate(item, dt)}
                              className="rounded bg-red-50 px-2 py-1 font-mono text-[10px] text-red-700 hover:bg-red-100"
                            >
                              {dt} ×
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={blockDateInputs[item.id] || ''}
                          onChange={(e) =>
                            setBlockDateInputs((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                          aria-label={`Block date for ${item.experienceTitle}`}
                          className="flex-1 rounded border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddBlockedDate(item)}
                          className="min-h-[36px] rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-100"
                        >
                          Block Date
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      {item.safetyChecklistComplete ? (
                        <StatusText label="Gear Verified" tone="nominal" />
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
                                err instanceof Error
                                  ? err.message
                                  : 'Unable to verify checklist.'
                              );
                            } finally {
                              setBusyActionId(null);
                            }
                          }}
                          className="min-h-[38px] rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                        >
                          Verify Gear
                        </button>
                      )}

                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              disabled={busyActionId === `edit-${item.id}`}
                              onClick={() => handleSaveInlineEdit(item)}
                              className="min-h-[38px] rounded-md bg-[#1D4ED8] px-3 py-1.5 text-xs font-semibold text-white"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingOfferingId(null)}
                              className="min-h-[38px] rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingOfferingId(item.id);
                                setEditPriceZar(item.priceZar);
                                setEditCapacity(item.capacity);
                              }}
                              className="min-h-[38px] inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-[#111827]"
                            >
                              <Edit3 className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
                              Edit Rate
                            </button>
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
                                    err instanceof Error
                                      ? err.message
                                      : 'Unable to toggle listing status.'
                                  );
                                } finally {
                                  setBusyActionId(null);
                                }
                              }}
                              className="min-h-[38px] rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-[#111827]"
                            >
                              {item.status === 'Active' ? 'Pause' : 'Activate'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden md:block overflow-x-auto">
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
                  {filteredListings.map((item) => {
                    const isEditing = editingOfferingId === item.id;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 align-top">
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-[#111827]">{item.experienceTitle}</p>
                          <p className="text-[11px] text-slate-500">
                            {item.offeringType || 'Activity'} · {item.zone || 'Cape Town'}
                            {item.accessible ? ' · Step-free' : ''}
                          </p>
                        </td>
                        <td className="px-5 py-3.5 text-xs">
                          {isEditing ? (
                            <div className="space-y-1">
                              <label className="block text-[10px] font-semibold text-slate-600">
                                Rate (ZAR)
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={editPriceZar}
                                onChange={(e) => setEditPriceZar(Number(e.target.value))}
                                className="w-24 rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                              />
                            </div>
                          ) : (
                            <>
                              <p className="font-mono font-semibold text-[#111827] tabular-nums">
                                R {item.priceZar.toLocaleString('en-ZA')} /{' '}
                                {(item.durationUnit || 'sessions').slice(0, -1)}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {item.pricingModel === 'per_unit' ? 'Flat unit rate' : 'Per guest'}
                              </p>
                            </>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs tabular-nums text-slate-700">
                          {isEditing ? (
                            <div className="space-y-1">
                              <label className="block text-[10px] font-semibold text-slate-600">
                                Max Seats
                              </label>
                              <input
                                type="number"
                                min={Math.max(1, item.bookedSeats)}
                                value={editCapacity}
                                onChange={(e) => setEditCapacity(Number(e.target.value))}
                                className="w-20 rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                              />
                            </div>
                          ) : (
                            <span>
                              {item.bookedSeats} / {item.capacity}
                            </span>
                          )}
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
                                setBlockDateInputs((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
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
                                    err instanceof Error
                                      ? err.message
                                      : 'Unable to verify checklist.'
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
                          <div className="inline-flex items-center gap-1.5">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  disabled={busyActionId === `edit-${item.id}`}
                                  onClick={() => handleSaveInlineEdit(item)}
                                  className="rounded-md bg-[#1D4ED8] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingOfferingId(null)}
                                  className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingOfferingId(item.id);
                                    setEditPriceZar(item.priceZar);
                                    setEditCapacity(item.capacity);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-[#111827] hover:bg-slate-100 whitespace-nowrap"
                                >
                                  <Edit3 className="h-3 w-3 text-[#1D4ED8]" aria-hidden="true" />
                                  Edit Rate
                                </button>
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
                                        err instanceof Error
                                          ? err.message
                                          : 'Unable to toggle listing status.'
                                      );
                                    } finally {
                                      setBusyActionId(null);
                                    }
                                  }}
                                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-[#111827] hover:bg-slate-100 disabled:opacity-60 transition-colors whitespace-nowrap"
                                >
                                  {item.status === 'Active' ? 'Pause' : 'Activate'}
                                </button>
                              </>
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

          {/* Customer Reviews & Provider Responses */}
          <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h2 className="font-display text-base font-bold text-[#111827] flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
                  Customer Reviews &amp; Provider Responses (
                  {reviews.filter((r) => r.moderationStatus !== 'Removed').length})
                </h2>
                <p className="text-xs text-slate-500">
                  Respond directly to verified visitor reviews so tourists see up-to-date operator guidance in the Discover Cape Town directory.
                </p>
              </div>
              {reviewFeedback && (
                <p role="status" className="text-xs font-medium text-[#15803D]">
                  {reviewFeedback}
                </p>
              )}
            </div>

            <div className="divide-y divide-slate-200">
              {reviews.filter((r) => r.moderationStatus !== 'Removed').length === 0 ? (
                <p className="py-4 text-xs text-slate-500">
                  No visitor reviews recorded yet.
                </p>
              ) : (
                reviews
                  .filter((r) => r.moderationStatus !== 'Removed')
                  .map((rev) => {
                    const draftVal = replyDrafts[rev.id] ?? rev.providerReply ?? '';
                    const matchingOffering = listings.find((l) => l.id === rev.targetId);
                    return (
                      <div key={rev.id} className="py-3.5 first:pt-0 last:pb-0 space-y-2 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="font-semibold text-[#111827]">{rev.authorName}</span>
                            <span className="text-slate-500">
                              {' '}
                              · Target: {matchingOffering?.experienceTitle || rev.targetId} ·{' '}
                              {rev.createdAtLabel}
                            </span>
                          </div>
                          <span className="inline-flex items-center gap-1 font-mono font-semibold text-[#1D4ED8] tabular-nums">
                            <Star className="h-3.5 w-3.5 fill-[#1D4ED8]" aria-hidden="true" />
                            {rev.rating}/5
                          </span>
                        </div>
                        <p className="text-slate-700">{rev.comment}</p>
                        {rev.providerReply && (
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                            <p className="font-semibold text-[#111827]">
                              Published Reply ({rev.providerReplyBy || user.organization || user.name})
                            </p>
                            <p className="mt-0.5 text-slate-600">{rev.providerReply}</p>
                          </div>
                        )}
                        {onReplyToReview && (
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center pt-1">
                            <input
                              type="text"
                              aria-label={`Reply to review by ${rev.authorName}`}
                              value={draftVal}
                              onChange={(e) =>
                                setReplyDrafts((prev) => ({ ...prev, [rev.id]: e.target.value }))
                              }
                              placeholder="Write a helpful operator response..."
                              maxLength={480}
                              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-[#111827] focus:border-[#1D4ED8] focus:outline-none"
                            />
                            <button
                              type="button"
                              disabled={busyActionId === `rev-${rev.id}` || draftVal.trim().length < 2}
                              onClick={async () => {
                                setReviewFeedback('');
                                setOfferingError('');
                                setBusyActionId(`rev-${rev.id}`);
                                try {
                                  await onReplyToReview(rev.id, draftVal.trim());
                                  setReviewFeedback(`Response saved for ${rev.authorName}'s review.`);
                                } catch (err) {
                                  setOfferingError(
                                    err instanceof Error
                                      ? err.message
                                      : 'Unable to publish provider response.'
                                  );
                                } finally {
                                  setBusyActionId(null);
                                }
                              }}
                              className="rounded-lg bg-[#111827] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1E293B] disabled:opacity-60 whitespace-nowrap"
                            >
                              {busyActionId === `rev-${rev.id}`
                                ? 'Saving...'
                                : rev.providerReply
                                ? 'Update Reply'
                                : 'Post Response'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: PAYMENTS & IN-PERSON LEDGER */}
      {activeTab === 'payments' && (
        <div
          id="panel-provider-payments"
          role="tabpanel"
          aria-labelledby="tab-provider-payments"
        >
          <ProviderPaymentSettingsSection
            user={user}
            settings={paymentSettings}
            providerPayments={providerPayments}
            providerBookings={providerBookings}
            onSaveSettings={onSavePaymentSettings}
            onMarkInPersonPaid={onMarkInPersonPaid}
          />
        </div>
      )}

      {/* TAB 4: ACCREDITATION & GUEST MANIFEST */}
      {activeTab === 'accreditation' && (
        <div
          id="panel-provider-accreditation"
          role="tabpanel"
          aria-labelledby="tab-provider-accreditation"
          className="grid gap-6 lg:grid-cols-12"
        >
          {/* Live + Demo Guest Boarding & Accessibility Manifest */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-6 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold text-[#111827]">
                Guest Boarding &amp; Accessibility Manifest
              </h2>
              <span className="font-mono text-xs text-[#1D4ED8] tabular-nums">
                {confirmedBookings.length} confirmed
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Confirmed tourist reservations automatically sync here with accessibility boarding flags and payment status.
            </p>
            <div className="divide-y divide-slate-200 text-xs">
              {confirmedBookings.map((bk) => (
                <div
                  key={bk.id}
                  className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-[#111827]">
                      {bk.bookingReference || bk.id} · Party of {bk.guests} ·{' '}
                      <span className="font-mono">{bk.paymentStatus || 'Pending'}</span>
                    </p>
                    <p className="text-slate-600">
                      {bk.title} · {bk.date} {bk.timeSlot} SAST
                    </p>
                  </div>
                  <StatusText
                    label={bk.accessible ? 'Step-free boarding ready' : 'Standard boarding'}
                    tone="nominal"
                  />
                </div>
              ))}
              {confirmedBookings.length === 0 && (
                <>
                  <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-[#111827]">
                        Sample Guest (Party of 2) · Digital Pass CS360-884210
                      </p>
                      <p className="text-slate-600">
                        Boulders Penguin Boardwalk &amp; Kayak Transfer · Demo Sample
                      </p>
                    </div>
                    <StatusText label="Step-free pier ramp requested" tone="nominal" />
                  </div>
                  <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-[#111827]">
                        Sample Family (Party of 4) · Booking #BK-204
                      </p>
                      <p className="text-slate-600">
                        Hout Bay Seal Island Eco-Boat · Demo Sample
                      </p>
                    </div>
                    <StatusText label="Checked in at Jetty 3" tone="nominal" />
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Submit Tourism Business Accreditation */}
          {onSubmitAccreditation && (
            <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-6">
              <h2 className="font-display text-base font-bold text-[#111827]">
                Submit Business Accreditation &amp; Compliance
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Register your Cape Town operator profile in Firestore for Tourism Administrator approval.
              </p>
              <form onSubmit={handleAccreditationSubmit} className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="prov-biz-name"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Business Name
                    </label>
                    <input
                      id="prov-biz-name"
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="prov-biz-cat"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Category
                    </label>
                    <select
                      id="prov-biz-cat"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
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
                    <label
                      htmlFor="prov-biz-zone"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Operating Precinct
                    </label>
                    <input
                      id="prov-biz-zone"
                      type="text"
                      value={zone}
                      onChange={(e) => setZone(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="prov-biz-docs"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Compliance Summary
                    </label>
                    <input
                      id="prov-biz-docs"
                      type="text"
                      value={complianceDocs}
                      onChange={(e) => setComplianceDocs(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="prov-biz-desc"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Public Experience Description (for Explore Map &amp; Directory)
                  </label>
                  <input
                    id="prov-biz-desc"
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe your guided tours, accessible boarding, or eco-certified excursions..."
                    maxLength={500}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-[#111827] hover:bg-slate-100">
                    <Upload className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
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
                    className="rounded-lg bg-[#111827] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E293B] disabled:opacity-60 transition-colors"
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
      )}
    </div>
  );
};
