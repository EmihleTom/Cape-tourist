import React, { useEffect, useMemo, useState } from 'react';
import {
  Accessibility,
  CalendarCheck,
  Compass,
  Heart,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Users,
} from 'lucide-react';
import { DemoDataNotice } from '@/src/components/common/DemoDataNotice';
import { ImageWithFallback } from '@/src/components/common/ImageWithFallback';
import { StatusText } from '@/src/components/common/StatusText';
import { ExperienceDetailModal } from '@/src/components/explore/ExperienceDetailModal';
import { CapeTownMap, resolveZoneCoordinates, type MapMarkerItem } from '@/src/components/map/CapeTownMap';
import type { CheckoutCompletionPayload } from '@/src/components/payments/CheckoutPaymentStep';
import {
  ACTIVITY_CATEGORIES,
  CAPE_TOWN_PRECINCTS,
  DEFAULT_ACTIVITY_CATEGORIES,
  IMG,
} from '@/src/data/capeTownDirectory';
import { aiService, buildSafeAiContext } from '@/src/services/aiService';
import { computeSmartGuidance } from '@/src/utils/safetyGuidance';
import type {
  ActivityCategory,
  AiExperienceRecommendation,
  AiExperienceRecommendationResponse,
  AttractionItem,
  BookingItem,
  CapeTownWeather,
  DemoUser,
  DestinationAnnouncement,
  DirectoryCategoryConfig,
  FavouriteItem,
  PaymentRecord,
  ProviderApplication,
  ProviderListing,
  ProviderPaymentSettings,
  ReviewItem,
  SafetyAdvisory,
  SavedPaymentMethod,
  TripActivity,
} from '@/src/types/app';

interface ExplorePageProps {
  user?: DemoUser;
  attractions: AttractionItem[];
  offerings?: ProviderListing[];
  businesses: ProviderApplication[];
  advisories: SafetyAdvisory[];
  announcements?: DestinationAnnouncement[];
  weather?: CapeTownWeather;
  bookings?: BookingItem[];
  activities?: TripActivity[];
  reviews: ReviewItem[];
  categories?: DirectoryCategoryConfig[];
  favourites?: FavouriteItem[];
  savedCards?: SavedPaymentMethod[];
  providerPaymentSettings?: ProviderPaymentSettings[];
  initialDetailId?: string | null;
  onClearInitialDetail?: () => void;
  onOpenWishlist?: () => void;
  onToggleFavourite?: (item: AttractionItem) => Promise<void> | void;
  onAddToTrip: (attraction: AttractionItem) => Promise<void> | void;
  onAddAiRecommendationToTrip?: (rec: AiExperienceRecommendation) => Promise<void> | void;
  onAddReview: (targetId: string, rating: number, comment: string) => Promise<void> | void;
  onRemoveSavedCard?: (cardId: string) => Promise<void> | void;
  onCompleteCheckout?: (payload: CheckoutCompletionPayload) => Promise<PaymentRecord>;
}

const DEFAULT_FALLBACK_WEATHER: CapeTownWeather = {
  temperatureC: 21,
  windSpeedKmh: 19,
  windGustsKmh: 31,
  conditionLabel: 'Partly Cloudy · Atlantic Breeze',
  cablewayRisk: 'Moderate',
  observedAtLabel: 'Snapshot',
  dataOrigin: 'demo',
};

function parseDurationHours(durationStr: string, defaultHours = 2): number {
  const lower = durationStr.toLowerCase();
  if (lower.includes('full day') || lower.includes('7 hrs')) return 7;
  const minMatch = lower.match(/(\d+)\s*min/);
  if (minMatch) return Math.max(0.5, Number(minMatch[1]) / 60);
  const hrMatch = lower.match(/(\d+(?:\.\d+)?)/);
  return hrMatch ? Number(hrMatch[1]) : defaultHours;
}

export const ExplorePage: React.FC<ExplorePageProps> = ({
  user,
  attractions,
  offerings = [],
  businesses,
  advisories,
  announcements = [],
  weather = DEFAULT_FALLBACK_WEATHER,
  bookings = [],
  activities = [],
  reviews,
  categories = DEFAULT_ACTIVITY_CATEGORIES,
  favourites = [],
  savedCards = [],
  providerPaymentSettings = [],
  initialDetailId = null,
  onClearInitialDetail,
  onOpenWishlist,
  onToggleFavourite,
  onAddToTrip,
  onAddAiRecommendationToTrip,
  onAddReview,
  onRemoveSavedCard,
  onCompleteCheckout,
}) => {
  const [selectedActivityCategory, setSelectedActivityCategory] = useState<'All' | ActivityCategory>(
    'All'
  );
  const [discoveryMode, setDiscoveryMode] = useState<
    'all' | 'attractions' | 'activities' | 'businesses'
  >('all');
  const [precinctFilter, setPrecinctFilter] = useState<string>('All Precincts');
  const [priceFilter, setPriceFilter] = useState<'all' | 'free' | 'under500' | '500to1000' | 'over1000'>(
    'all'
  );
  const [durationFilter, setDurationFilter] = useState<'all' | 'short' | 'medium' | 'long'>('all');
  const [ratingFilter, setRatingFilter] = useState<'all' | '4' | '4.5'>('all');
  const [familyFriendlyOnly, setFamilyFriendlyOnly] = useState(false);
  const [stepFreeOnly, setStepFreeOnly] = useState(false);
  const [availableTodayOnly, setAvailableTodayOnly] = useState(false);
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [showcaseTab, setShowcaseTab] = useState<'featured' | 'popular' | 'recent' | 'recommended'>(
    'featured'
  );

  const [query, setQuery] = useState('');
  const [addedIds, setAddedIds] = useState<string[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [activeDetailId, setActiveDetailId] = useState<string | null>(null);
  const [mobileViewMode, setMobileViewMode] = useState<'list' | 'map' | 'both'>('both');
  const [desktopShowMap, setDesktopShowMap] = useState(true);

  // Reviews Section State
  const [reviewTargetId, setReviewTargetId] = useState(attractions[0]?.id || 'attr-waterfront');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewNotice, setReviewNotice] = useState('');
  const [wishlistNotice, setWishlistNotice] = useState('');
  const [exploreError, setExploreError] = useState('');

  useEffect(() => {
    if (initialDetailId) {
      setActiveDetailId(initialDetailId);
      onClearInitialDetail?.();
    }
  }, [initialDetailId, onClearInitialDetail]);

  // Smart AI Experience Recommender State
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiTripDays, setAiTripDays] = useState(3);
  const [aiBudgetZar, setAiBudgetZar] = useState(3500);
  const [aiLocation, setAiLocation] = useState('All Precincts');
  const [aiTimeWindow, setAiTimeWindow] = useState('Morning (08:00–12:00)');
  const [aiGroupProfile, setAiGroupProfile] = useState('Family with Children');
  const [aiMinChildAge, setAiMinChildAge] = useState(8);
  const [aiAccessNeeds, setAiAccessNeeds] = useState(Boolean(user?.accessibilityPriority));
  const [aiInterests, setAiInterests] = useState<ActivityCategory[]>([
    'Attractions and sightseeing',
    'Nature and wildlife',
    'Culture and heritage',
  ]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiResult, setAiResult] = useState<AiExperienceRecommendationResponse | null>(null);
  const [savedAiRecIds, setSavedAiRecIds] = useState<string[]>([]);

  const enabledCategorySet = useMemo(() => {
    const enabled = categories.filter((c) => c.enabled !== false).map((c) => c.name);
    return new Set<ActivityCategory>(enabled.length > 0 ? enabled : ACTIVITY_CATEGORIES);
  }, [categories]);

  const favouriteIdSet = useMemo(() => new Set(favourites.map((f) => f.listingId)), [favourites]);

  // Merge live/provider offerings into discoverable items alongside curated directory
  const allDirectoryItems = useMemo(() => {
    const existingOfferingIds = new Set(
      attractions.map((a) => a.offeringId).filter(Boolean) as string[]
    );
    const dynamicOfferings: AttractionItem[] = offerings
      .filter(
        (off) =>
          off.status === 'Active' &&
          !existingOfferingIds.has(off.id) &&
          !attractions.some((a) => a.title.toLowerCase() === off.experienceTitle.toLowerCase())
      )
      .map((off) => {
        const coords =
          typeof off.lat === 'number' && typeof off.lng === 'number'
            ? { lat: off.lat, lng: off.lng }
            : resolveZoneCoordinates(off.zone || 'Cape Town');
        return {
          id: off.id,
          offeringId: off.id,
          title: off.experienceTitle,
          precinct: off.zone || 'Cape Town',
          category: off.accessible ? 'Accessibility' : 'Coastal',
          activityCategories: off.activityCategory
            ? [off.activityCategory]
            : ['Guided tours', 'Day trips and excursions'],
          entryType: 'Activity',
          recentlyAdded: true,
          familyFriendly: off.familyFriendly ?? true,
          accessible: Boolean(off.accessible),
          ageRequirement: off.ageRequirement || 'All Ages',
          minAge: 0,
          groupSizeMax: off.capacity,
          availableToday: off.status === 'Active' && off.bookedSeats < off.capacity,
          availableDates: off.availableDates?.length
            ? off.availableDates
            : ['2026-11-18', '2026-11-19', '2026-11-20'],
          durationUnit: off.durationUnit || 'sessions',
          defaultDurationValue: off.defaultDurationValue || 1,
          pricingModel: off.pricingModel || 'per_guest',
          includedServices: off.includedServices,
          whatToBring: off.whatToBring,
          cancellationPolicy:
            off.cancellationPolicy || 'Standard 24h provider cancellation window.',
          safetyInfo:
            off.safetyInfo ||
            (off.safetyChecklistComplete
              ? 'Provider gear & safety audit verified.'
              : 'Safety checklist pending verification.'),
          nearbyTransport: off.nearbyTransport,
          providerId: off.providerId,
          providerName: off.providerName || 'Tourism Partner',
          verifiedProvider: Boolean(off.verifiedListing || off.safetyChecklistComplete),
          supportedPaymentMethods: ['PayShap', 'Card', 'Pay in Person'],
          safetyStatus: off.safetyChecklistComplete ? 'Nominal' : 'Guided Recommended',
          accessibilitySummary: off.accessible
            ? 'Step-free boarding & route verified by provider'
            : 'Standard route — contact provider for assistance',
          duration: `${off.defaultDurationValue || 1} ${off.durationUnit || 'sessions'}`,
          priceZar: off.priceZar,
          imageUrl: off.imageUrl || IMG.coast,
          galleryImages: off.galleryImages?.length ? off.galleryImages : [off.imageUrl || IMG.coast],
          description:
            off.description ||
            `${off.offeringType || 'Activity'} offered by ${off.providerName || 'CapeSafe Partner'} in ${off.zone || 'Cape Town'}.`,
          coordinates: `${Math.abs(coords.lat).toFixed(4)}° S, ${coords.lng.toFixed(4)}° E`,
          lat: coords.lat,
          lng: coords.lng,
          dataOrigin: off.dataOrigin,
        };
      });

    return [...dynamicOfferings, ...attractions];
  }, [attractions, offerings]);

  const approvedReviews = useMemo(
    () => reviews.filter((r) => (r.moderationStatus || 'Approved') !== 'Removed'),
    [reviews]
  );

  const getRatingSummary = (targetId: string) => {
    const matching = approvedReviews.filter((r) => r.targetId === targetId);
    if (matching.length === 0) return null;
    const avg = matching.reduce((sum, r) => sum + r.rating, 0) / matching.length;
    return { avg, avgStr: avg.toFixed(1), count: matching.length };
  };

  const q = query.trim().toLowerCase();

  const filteredDirectory = useMemo(() => {
    return allDirectoryItems.filter((item) => {
      if (discoveryMode === 'businesses') return false;
      if (discoveryMode === 'attractions' && item.entryType === 'Activity') return false;
      if (discoveryMode === 'activities' && item.entryType !== 'Activity') return false;

      const cats = item.activityCategories || [];
      if (cats.length > 0 && !cats.some((c) => enabledCategorySet.has(c))) {
        return false;
      }
      if (selectedActivityCategory !== 'All' && !cats.includes(selectedActivityCategory)) {
        return false;
      }

      if (precinctFilter !== 'All Precincts') {
        const pLower = precinctFilter.toLowerCase();
        const itemPrecinctLower = item.precinct.toLowerCase();
        const prefix = pLower.split('(')[0].trim();
        if (!itemPrecinctLower.includes(prefix) && itemPrecinctLower !== pLower) {
          return false;
        }
      }

      if (priceFilter === 'free' && item.priceZar > 0) return false;
      if (priceFilter === 'under500' && (item.priceZar === 0 || item.priceZar >= 500)) return false;
      if (priceFilter === '500to1000' && (item.priceZar < 500 || item.priceZar > 1000)) return false;
      if (priceFilter === 'over1000' && item.priceZar <= 1000) return false;

      if (durationFilter !== 'all') {
        const hrs = parseDurationHours(item.duration);
        if (durationFilter === 'short' && hrs >= 2) return false;
        if (durationFilter === 'medium' && (hrs < 2 || hrs > 4)) return false;
        if (durationFilter === 'long' && hrs <= 4) return false;
      }

      if (ratingFilter !== 'all') {
        const summary = getRatingSummary(item.id);
        const minThreshold = ratingFilter === '4.5' ? 4.5 : 4.0;
        if (!summary || summary.avg < minThreshold) return false;
      }

      if (familyFriendlyOnly && item.familyFriendly === false) return false;
      if (
        stepFreeOnly &&
        !item.accessible &&
        item.category !== 'Accessibility' &&
        !item.accessibilitySummary.toLowerCase().includes('step-free')
      ) {
        return false;
      }
      if (availableTodayOnly && item.availableToday === false) return false;
      if (favouritesOnly && !favouriteIdSet.has(item.id)) return false;
      if (verifiedOnly && item.verifiedProvider === false && item.dataOrigin !== 'live') {
        return false;
      }

      if (q) {
        const matchesText =
          item.title.toLowerCase().includes(q) ||
          item.precinct.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          (item.providerName || '').toLowerCase().includes(q) ||
          cats.some((c) => c.toLowerCase().includes(q));
        if (!matchesText) return false;
      }

      return true;
    });
  }, [
    allDirectoryItems,
    discoveryMode,
    selectedActivityCategory,
    precinctFilter,
    priceFilter,
    durationFilter,
    ratingFilter,
    familyFriendlyOnly,
    stepFreeOnly,
    availableTodayOnly,
    favouritesOnly,
    verifiedOnly,
    favouriteIdSet,
    q,
    approvedReviews,
  ]);

  const filteredBusinesses = useMemo(() => {
    if (discoveryMode === 'attractions' || discoveryMode === 'activities') return [];
    return businesses.filter((biz) => {
      const matchesQuery =
        !q ||
        biz.businessName.toLowerCase().includes(q) ||
        biz.zone.toLowerCase().includes(q) ||
        biz.category.toLowerCase().includes(q) ||
        (biz.description || '').toLowerCase().includes(q);
      const matchesStepFree = !stepFreeOnly || Boolean(biz.safetyChecklistComplete);
      const matchesVerified = !verifiedOnly || biz.status === 'Approved';
      const matchesPrecinct =
        precinctFilter === 'All Precincts' ||
        biz.zone.toLowerCase().includes(precinctFilter.split('(')[0].trim().toLowerCase());
      return matchesQuery && matchesStepFree && matchesVerified && matchesPrecinct;
    });
  }, [businesses, discoveryMode, q, stepFreeOnly, verifiedOnly, precinctFilter]);

  const showcaseItems = useMemo(() => {
    if (showcaseTab === 'featured') return allDirectoryItems.filter((i) => i.featured).slice(0, 4);
    if (showcaseTab === 'popular') return allDirectoryItems.filter((i) => i.popular).slice(0, 4);
    if (showcaseTab === 'recent')
      return allDirectoryItems.filter((i) => i.recentlyAdded).slice(0, 4);
    return allDirectoryItems.filter((i) => i.recommended).slice(0, 4);
  }, [allDirectoryItems, showcaseTab]);

  const activeDetailItem = useMemo(
    () => allDirectoryItems.find((i) => i.id === activeDetailId) || null,
    [allDirectoryItems, activeDetailId]
  );

  const handleAdd = async (item: AttractionItem) => {
    setExploreError('');
    try {
      await onAddToTrip(item);
      setAddedIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
    } catch (err) {
      setExploreError(err instanceof Error ? err.message : 'Unable to add attraction to trip.');
    }
  };

  const handleToggleFav = async (item: AttractionItem) => {
    if (!onToggleFavourite) return;
    setExploreError('');
    const wasInWishlist = favouriteIdSet.has(item.id);
    try {
      await onToggleFavourite(item);
      setWishlistNotice(
        wasInWishlist
          ? `Removed "${item.title}" from your Wishlist.`
          : `Saved "${item.title}" to your Wishlist — view anytime in Tourist Dashboard -> My Wishlist.`
      );
    } catch (err) {
      setExploreError(err instanceof Error ? err.message : 'Unable to update wishlist.');
    }
  };

  const handleToggleFavById = (id: string) => {
    const matched = allDirectoryItems.find((a) => a.id === id);
    if (matched) void handleToggleFav(matched);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewNotice('');
    setExploreError('');
    if (reviewComment.trim().length < 4) {
      setExploreError('Please write at least 4 characters before submitting a review.');
      return;
    }
    setSubmittingReview(true);
    try {
      await onAddReview(reviewTargetId, reviewRating, reviewComment.trim());
      setReviewComment('');
      setReviewNotice('Review published.');
    } catch (err) {
      setExploreError(err instanceof Error ? err.message : 'Unable to submit review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleRunAiRecommender = async (e: React.FormEvent) => {
    e.preventDefault();
    setAiError('');
    setAiLoading(true);
    try {
      const effectiveUser: DemoUser = user || {
        id: 'guest',
        name: 'Cape Town Explorer',
        email: '',
        role: 'tourist',
        roleTitle: 'Tourist',
        organization: '',
        location: 'Cape Town',
        dataOrigin: 'demo',
      };
      const context = buildSafeAiContext({
        user: effectiveUser,
        weather,
        advisories,
        announcements,
        attractions: allDirectoryItems,
        bookings,
        activities,
      });

      const catalogSummary = allDirectoryItems.map((item) => ({
        id: item.id,
        title: item.title,
        precinct: item.precinct,
        categories: item.activityCategories || [item.category],
        priceZar: item.priceZar,
        duration: item.duration,
        minAge: item.minAge ?? 0,
        accessible: Boolean(item.accessible),
        familyFriendly: item.familyFriendly !== false,
        safetyStatus: item.safetyStatus,
      }));

      const res = await aiService.recommendExperiences({
        tripLengthDays: aiTripDays,
        interests: aiInterests,
        budgetZar: aiBudgetZar,
        preferredLocation: aiLocation,
        availableTime: aiTimeWindow,
        groupProfile: aiGroupProfile,
        minChildAge: aiMinChildAge,
        accessibilityNeeds: aiAccessNeeds,
        preferredLanguage: effectiveUser.preferredLanguage || 'English',
        catalogSummary,
        context,
      });
      setAiResult(res);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unable to fetch AI recommendations.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleMarkerSelect = (marker: MapMarkerItem) => {
    setSelectedMapId(marker.id);
    if (marker.kind === 'attraction' || marker.kind === 'business') {
      setReviewTargetId(marker.id);
    }
  };

  const resetAllFilters = () => {
    setSelectedActivityCategory('All');
    setDiscoveryMode('all');
    setPrecinctFilter('All Precincts');
    setPriceFilter('all');
    setDurationFilter('all');
    setRatingFilter('all');
    setFamilyFriendlyOnly(false);
    setStepFreeOnly(false);
    setAvailableTodayOnly(false);
    setFavouritesOnly(false);
    setVerifiedOnly(false);
    setQuery('');
  };

  const reviewTargets = [
    ...allDirectoryItems.map((a) => ({ id: a.id, label: `${a.entryType || 'Attraction'}: ${a.title}` })),
    ...businesses.map((b) => ({ id: b.id, label: `Provider: ${b.businessName}` })),
  ];

  const availableCategories = ACTIVITY_CATEGORIES.filter((cat) => enabledCategorySet.has(cat));

  return (
    <div className="space-y-6">
      <DemoDataNotice scope="Comprehensive Cape Town Directory (24 curated attractions + 16 bookable activity types in Demo/Curated mode) merged with live Firestore provider offerings, favourites, reviews, and Google Maps pins" />

      {/* Header, Search & Smart AI Trigger */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold text-[#1D4ED8]">
              Cape Town Tourism Directory &amp; Marketplace · {allDirectoryItems.length} Experiences
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold text-[#111827]">
              Discover Cape Town Attractions &amp; Bookable Activities
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Filter by activity category, precinct, ZAR budget, age suitability, step-free accessibility, and verified availability — then book securely with PayShap, Card, or Pay in Person.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="relative w-full sm:w-64">
              <Search
                className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search Table Mountain, kayaking, Bo-Kaap..."
                aria-label="Search Cape Town discovery"
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>

            {onOpenWishlist && (
              <button
                type="button"
                onClick={onOpenWishlist}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#111827] hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
              >
                <Heart
                  className={`h-3.5 w-3.5 ${favourites.length > 0 ? 'fill-red-600 text-red-600' : 'text-[#1D4ED8]'}`}
                  aria-hidden="true"
                />
                My Wishlist ({favourites.length})
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowAiPanel((prev) => !prev)}
              aria-expanded={showAiPanel}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                showAiPanel
                  ? 'bg-[#111827] text-white'
                  : 'bg-[#1D4ED8] text-white hover:bg-[#1E40AF]'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {showAiPanel ? 'Hide AI Matcher' : 'AI Experience Matcher'}
            </button>
          </div>
        </div>

        {wishlistNotice && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#15803D]/30 bg-[#F0FDF4] px-3.5 py-2.5 text-xs text-[#15803D]"
          >
            <span className="font-medium">{wishlistNotice}</span>
            <div className="flex items-center gap-2 shrink-0">
              {onOpenWishlist && (
                <button
                  type="button"
                  onClick={onOpenWishlist}
                  className="font-semibold text-[#1D4ED8] hover:underline whitespace-nowrap"
                >
                  Open My Wishlist
                </button>
              )}
              <button
                type="button"
                onClick={() => setWishlistNotice('')}
                className="text-[11px] font-semibold text-slate-600 hover:text-[#111827]"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Smart AI Experience Recommendation Engine */}
        {showAiPanel && (
          <div className="rounded-xl border border-[#1D4ED8]/30 bg-[#EFF6FF]/60 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-bold text-[#111827] flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
                  Smart Cape Town Experience Recommendations (Gemini AI)
                </h2>
                <p className="text-xs text-slate-600">
                  Matches attractions and activities to your trip length, budget, age profile, accessibility needs, and live peninsula wind conditions ({weather.windSpeedKmh} km/h).
                </p>
              </div>
              <span className="font-mono text-[11px] font-semibold text-[#1E40AF]">
                Server-Side Gemini Proxy
              </span>
            </div>

            <form onSubmit={handleRunAiRecommender} className="grid gap-3 sm:grid-cols-12">
              <div className="sm:col-span-2">
                <label htmlFor="ai-days" className="block text-[11px] font-semibold text-slate-700">
                  Trip Length (days)
                </label>
                <input
                  id="ai-days"
                  type="number"
                  min={1}
                  max={14}
                  value={aiTripDays}
                  onChange={(e) => setAiTripDays(Math.max(1, Number(e.target.value) || 1))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="ai-budget" className="block text-[11px] font-semibold text-slate-700">
                  Budget (ZAR)
                </label>
                <input
                  id="ai-budget"
                  type="number"
                  min={0}
                  step={100}
                  value={aiBudgetZar}
                  onChange={(e) => setAiBudgetZar(Math.max(0, Number(e.target.value) || 0))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs"
                />
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="ai-loc" className="block text-[11px] font-semibold text-slate-700">
                  Preferred Location
                </label>
                <select
                  id="ai-loc"
                  value={aiLocation}
                  onChange={(e) => setAiLocation(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  {CAPE_TOWN_PRECINCTS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="ai-group" className="block text-[11px] font-semibold text-slate-700">
                  Visitor Group Profile
                </label>
                <select
                  id="ai-group"
                  value={aiGroupProfile}
                  onChange={(e) => setAiGroupProfile(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="Family with Children">Family with Children</option>
                  <option value="Couple / Friends">Couple / Friends</option>
                  <option value="Solo Explorer">Solo Explorer</option>
                  <option value="Accessible / Senior Group">Accessible / Senior Group</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="ai-min-age" className="block text-[11px] font-semibold text-slate-700">
                  Youngest Age (yrs)
                </label>
                <input
                  id="ai-min-age"
                  type="number"
                  min={0}
                  max={99}
                  value={aiMinChildAge}
                  onChange={(e) => setAiMinChildAge(Math.max(0, Number(e.target.value) || 0))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs"
                />
              </div>

              <div className="sm:col-span-4">
                <label htmlFor="ai-time" className="block text-[11px] font-semibold text-slate-700">
                  Available Time Window
                </label>
                <select
                  id="ai-time"
                  value={aiTimeWindow}
                  onChange={(e) => setAiTimeWindow(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="Morning (08:00–12:00)">Morning (08:00–12:00)</option>
                  <option value="Afternoon (12:00–17:00)">Afternoon (12:00–17:00)</option>
                  <option value="Sunset & Evening (17:00–20:00)">Sunset &amp; Evening (17:00–20:00)</option>
                  <option value="Full Day Flexible">Full Day Flexible</option>
                </select>
              </div>

              <div className="sm:col-span-5 flex items-end">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer pb-1.5">
                  <input
                    type="checkbox"
                    checked={aiAccessNeeds}
                    onChange={(e) => setAiAccessNeeds(e.target.checked)}
                    className="rounded border-slate-300 text-[#1D4ED8]"
                  />
                  <span>Require verified step-free / wheelchair-accessible venues only</span>
                </label>
              </div>

              <div className="sm:col-span-3 flex items-end justify-end">
                <button
                  type="submit"
                  disabled={aiLoading}
                  className="w-full rounded-lg bg-[#111827] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E293B] disabled:opacity-60"
                >
                  {aiLoading ? 'Matching Experiences...' : 'Generate Smart Matches'}
                </button>
              </div>

              <div className="sm:col-span-12">
                <p className="text-[11px] font-semibold text-slate-700 mb-1.5">
                  Interests (select categories):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {availableCategories.map((cat) => {
                    const active = aiInterests.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() =>
                          setAiInterests((prev) =>
                            prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
                          )
                        }
                        className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                          active
                            ? 'border-[#1D4ED8] bg-[#1D4ED8] text-white'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>
            </form>

            {aiError && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
              >
                {aiError}
              </p>
            )}

            {aiResult && (
              <div className="space-y-3 border-t border-slate-200 pt-4">
                <div className="rounded-lg border border-slate-200 bg-white p-3.5 text-xs space-y-1">
                  <p className="font-semibold text-[#111827]">{aiResult.summary}</p>
                  <p className="text-slate-600">{aiResult.advisoryNote}</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {aiResult.recommendations.map((rec) => {
                    const isSaved = savedAiRecIds.includes(rec.listingId);
                    const matchedItem = allDirectoryItems.find(
                      (i) => i.id === rec.listingId || i.title === rec.title
                    );
                    return (
                      <div
                        key={`${rec.listingId}-${rec.title}`}
                        className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 text-xs space-y-2.5"
                      >
                        <div className="space-y-1">
                          <p className="font-mono text-[11px] font-semibold text-[#1D4ED8]">
                            Day {rec.suggestedDay} · {rec.suggestedTimeWindow}
                          </p>
                          <h3 className="font-display text-sm font-bold text-[#111827]">
                            {rec.title}
                          </h3>
                          <p className="text-[11px] text-slate-500">
                            {rec.precinct} · {rec.ageSuitability}
                          </p>
                          <p className="text-slate-700 leading-relaxed">{rec.matchedReason}</p>
                          <p className="text-[11px] text-slate-600">
                            <strong>Transit:</strong> {rec.transportTip}
                          </p>
                          <p className="text-[11px] text-amber-800">
                            <strong>Safety:</strong> {rec.safetyNote}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-2.5">
                          <span className="font-mono font-bold text-[#111827] tabular-nums">
                            {rec.estimatedZar === 0 ? 'Free' : `R ${rec.estimatedZar}`}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {matchedItem && onToggleFavourite && (
                              <button
                                type="button"
                                aria-pressed={favouriteIdSet.has(matchedItem.id)}
                                onClick={() => handleToggleFav(matchedItem)}
                                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors ${
                                  favouriteIdSet.has(matchedItem.id)
                                    ? 'border-red-200 bg-red-50 text-red-700'
                                    : 'border-slate-300 bg-white text-[#111827] hover:bg-slate-50'
                                }`}
                              >
                                <Heart
                                  className={`h-3 w-3 ${
                                    favouriteIdSet.has(matchedItem.id) ? 'fill-red-600 text-red-600' : ''
                                  }`}
                                  aria-hidden="true"
                                />
                                {favouriteIdSet.has(matchedItem.id) ? 'Wishlisted' : 'Wishlist'}
                              </button>
                            )}
                            {matchedItem && (
                              <button
                                type="button"
                                onClick={() => setActiveDetailId(matchedItem.id)}
                                className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#111827] hover:bg-slate-50"
                              >
                                Details &amp; Book
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={async () => {
                                if (onAddAiRecommendationToTrip) {
                                  await onAddAiRecommendationToTrip(rec);
                                } else if (matchedItem) {
                                  await handleAdd(matchedItem);
                                }
                                setSavedAiRecIds((prev) =>
                                  prev.includes(rec.listingId) ? prev : [...prev, rec.listingId]
                                );
                              }}
                              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                                isSaved
                                  ? 'border border-[#15803D]/30 bg-[#F0FDF4] text-[#15803D]'
                                  : 'bg-[#1D4ED8] text-white hover:bg-[#1E40AF]'
                              }`}
                            >
                              {isSaved ? 'Saved to Itinerary' : 'Save to Itinerary'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Featured / Popular / Recently Added / Recommended Showcase */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-bold text-[#111827]">
            Curated Cape Town Highlights
          </h2>
          <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-semibold">
            {(
              [
                { id: 'featured', label: 'Featured Experiences' },
                { id: 'popular', label: 'Popular Attractions' },
                { id: 'recent', label: 'Recently Added' },
                { id: 'recommended', label: 'Recommended' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={showcaseTab === tab.id}
                onClick={() => setShowcaseTab(tab.id)}
                className={`rounded-md px-3 py-1 transition-colors whitespace-nowrap ${
                  showcaseTab === tab.id
                    ? 'bg-[#111827] text-white'
                    : 'text-slate-600 hover:text-[#111827]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 2xl:gap-5">
          {showcaseItems.map((item) => (
            <button
              key={`show-${item.id}`}
              type="button"
              onClick={() => setActiveDetailId(item.id)}
              className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left hover:border-[#1D4ED8] transition-colors"
            >
              <div className="aspect-[16/10] sm:aspect-[4/3] 2xl:aspect-[16/10] w-full overflow-hidden bg-slate-100">
                <ImageWithFallback src={item.imageUrl} alt={item.title} />
              </div>
              <div className="p-3.5 sm:p-4 space-y-1">
                <p className="text-[11px] font-semibold text-[#1D4ED8] truncate">
                  {item.activityCategories?.[0] || item.category}
                </p>
                <p className="font-display text-sm 2xl:text-base font-bold text-[#111827] group-hover:text-[#1D4ED8] line-clamp-1">
                  {item.title}
                </p>
                <p className="text-[11px] text-slate-500 truncate">{item.precinct}</p>
                <div className="flex items-center justify-between pt-1 text-xs font-mono font-semibold text-[#111827] tabular-nums">
                  <span>{item.priceZar === 0 ? 'Free' : `R ${item.priceZar}`}</span>
                  <span className="text-[11px] text-slate-500 font-sans font-normal">
                    {item.duration}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 12 Activity Categories + Multi-Faceted Filter Bar */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-sm font-bold text-[#111827]">
            Filter by Activity Category ({availableCategories.length} categories enabled)
          </h2>
          <button
            type="button"
            onClick={resetAllFilters}
            className="text-xs font-semibold text-[#1D4ED8] hover:underline"
          >
            Reset All Filters
          </button>
        </div>

        {/* 12 Category Buttons */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            aria-pressed={selectedActivityCategory === 'All'}
            onClick={() => setSelectedActivityCategory('All')}
            className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              selectedActivityCategory === 'All'
                ? 'border-[#111827] bg-[#111827] text-white'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            All Categories
          </button>
          {availableCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              aria-pressed={selectedActivityCategory === cat}
              onClick={() => setSelectedActivityCategory(cat)}
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                selectedActivityCategory === cat
                  ? 'border-[#1D4ED8] bg-[#1D4ED8] text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Secondary Select & Toggle Filters */}
        <div className="grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label htmlFor="flt-precinct" className="block text-[11px] font-semibold text-slate-600">
              Location / Precinct
            </label>
            <select
              id="flt-precinct"
              value={precinctFilter}
              onChange={(e) => setPrecinctFilter(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-[#111827]"
            >
              {CAPE_TOWN_PRECINCTS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="flt-price" className="block text-[11px] font-semibold text-slate-600">
              Price Range (ZAR)
            </label>
            <select
              id="flt-price"
              value={priceFilter}
              onChange={(e) =>
                setPriceFilter(
                  e.target.value as 'all' | 'free' | 'under500' | '500to1000' | 'over1000'
                )
              }
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-[#111827]"
            >
              <option value="all">All Prices</option>
              <option value="free">Free Public Access (R 0)</option>
              <option value="under500">Under R 500</option>
              <option value="500to1000">R 500 – R 1,000</option>
              <option value="over1000">Above R 1,000</option>
            </select>
          </div>

          <div>
            <label htmlFor="flt-duration" className="block text-[11px] font-semibold text-slate-600">
              Duration
            </label>
            <select
              id="flt-duration"
              value={durationFilter}
              onChange={(e) =>
                setDurationFilter(e.target.value as 'all' | 'short' | 'medium' | 'long')
              }
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-[#111827]"
            >
              <option value="all">Any Duration</option>
              <option value="short">Quick (&lt; 2 hours)</option>
              <option value="medium">Half-Day (2 – 4 hours)</option>
              <option value="long">Extended / Full Day (&gt; 4 hours)</option>
            </select>
          </div>

          <div>
            <label htmlFor="flt-rating" className="block text-[11px] font-semibold text-slate-600">
              Minimum Rating
            </label>
            <select
              id="flt-rating"
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value as 'all' | '4' | '4.5')}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-[#111827]"
            >
              <option value="all">All Ratings</option>
              <option value="4">4.0+ Stars</option>
              <option value="4.5">4.5+ Stars</option>
            </select>
          </div>

          <div>
            <label htmlFor="flt-mode" className="block text-[11px] font-semibold text-slate-600">
              Listing Type
            </label>
            <select
              id="flt-mode"
              value={discoveryMode}
              onChange={(e) =>
                setDiscoveryMode(
                  e.target.value as 'all' | 'attractions' | 'activities' | 'businesses'
                )
              }
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-[#111827]"
            >
              <option value="all">All Listings</option>
              <option value="attractions">Cape Town Attractions</option>
              <option value="activities">Bookable Activities</option>
              <option value="businesses">Accredited Providers</option>
            </select>
          </div>
        </div>

        {/* Toggle Filter Switches */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            aria-pressed={familyFriendlyOnly}
            onClick={() => setFamilyFriendlyOnly((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              familyFriendlyOnly
                ? 'border-[#1D4ED8] bg-[#EFF6FF] text-[#1E40AF]'
                : 'border-slate-200 bg-white text-slate-600 hover:text-[#111827]'
            }`}
          >
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            Family-Friendly
          </button>

          <button
            type="button"
            aria-pressed={stepFreeOnly}
            onClick={() => setStepFreeOnly((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              stepFreeOnly
                ? 'border-[#1D4ED8] bg-[#EFF6FF] text-[#1E40AF]'
                : 'border-slate-200 bg-white text-slate-600 hover:text-[#111827]'
            }`}
          >
            <Accessibility className="h-3.5 w-3.5" aria-hidden="true" />
            Step-Free / Accessible
          </button>

          <button
            type="button"
            aria-pressed={availableTodayOnly}
            onClick={() => setAvailableTodayOnly((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              availableTodayOnly
                ? 'border-[#15803D] bg-[#F0FDF4] text-[#15803D]'
                : 'border-slate-200 bg-white text-slate-600 hover:text-[#111827]'
            }`}
          >
            <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Available Today
          </button>

          <button
            type="button"
            aria-pressed={favouritesOnly}
            onClick={() => setFavouritesOnly((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              favouritesOnly
                ? 'border-red-300 bg-red-50 text-red-700'
                : 'border-slate-200 bg-white text-slate-600 hover:text-[#111827]'
            }`}
          >
            <Heart
              className={`h-3.5 w-3.5 ${favouritesOnly ? 'fill-red-600 text-red-600' : ''}`}
              aria-hidden="true"
            />
            Wishlist Only ({favourites.length})
          </button>

          <button
            type="button"
            aria-pressed={verifiedOnly}
            onClick={() => setVerifiedOnly((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              verifiedOnly
                ? 'border-[#15803D] bg-[#F0FDF4] text-[#15803D]'
                : 'border-slate-200 bg-white text-slate-600 hover:text-[#111827]'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Verified Operators Only
          </button>
        </div>
      </section>

      {exploreError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
        >
          {exploreError}
        </p>
      )}

      {/* Workspace View Switchers (Mobile/Tablet List vs Map, Desktop Split Map Toggle) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
          <h2 className="font-display text-base font-bold text-[#111827]">
            Cape Town Experiences ({filteredDirectory.length}) &amp; Providers ({filteredBusinesses.length})
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile/Tablet View Mode (< 1024px) */}
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1 lg:hidden">
            {(
              [
                { id: 'both', label: 'List + Map' },
                { id: 'list', label: 'List Only' },
                { id: 'map', label: 'Map Only' },
              ] as const
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                aria-pressed={mobileViewMode === mode.id}
                onClick={() => setMobileViewMode(mode.id)}
                className={`min-h-[36px] rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                  mobileViewMode === mode.id
                    ? 'bg-[#111827] text-white'
                    : 'text-slate-600 hover:text-[#111827]'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* Desktop/Large Desktop Side-by-Side Map Toggle (1024px+) */}
          <button
            type="button"
            aria-pressed={desktopShowMap}
            onClick={() => setDesktopShowMap((prev) => !prev)}
            className="hidden lg:inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#111827] hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <MapPin className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
            {desktopShowMap ? 'Hide Side Map' : 'Show Map Alongside Listings'}
          </button>
        </div>
      </div>

      {/* Main Responsive Explore Workspace: Split Map Alongside Listings on Desktop/Large Desktop, Adaptive Stack on Tablet/Mobile */}
      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        {/* Listings Column */}
        <div
          className={`space-y-6 ${
            mobileViewMode === 'map' ? 'hidden lg:block' : 'block'
          } ${desktopShowMap ? 'lg:col-span-7 2xl:col-span-7' : 'lg:col-span-12'}`}
        >
          {/* Attractions & Bookable Activities Grid */}
          {filteredDirectory.length > 0 && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  Click any experience for full gallery, safety specs, age requirements &amp; checkout
                </p>
              </div>

              <div
                className={`grid gap-5 md:grid-cols-2 ${
                  desktopShowMap ? 'lg:grid-cols-2 2xl:grid-cols-2' : 'lg:grid-cols-3 2xl:grid-cols-4'
                }`}
              >
                {filteredDirectory.map((item) => {
                  const isAdded = addedIds.includes(item.id);
                  const isFav = favouriteIdSet.has(item.id);
                  const isSelected = selectedMapId === item.id;
                  const ratingSummary = getRatingSummary(item.id);
                  const isVerifiedOp = item.dataOrigin === 'live' || item.verifiedProvider !== false;
                  const cardGuidance = computeSmartGuidance({
                    title: item.title,
                    zone: item.precinct,
                    category: item.activityCategories?.[0] || item.category,
                    weather,
                  });

                  return (
                    <article
                      key={item.id}
                      className={`flex flex-col overflow-hidden rounded-xl border bg-white transition-colors ${
                        isSelected ? 'border-[#1D4ED8] ring-2 ring-[#1D4ED8]/30' : 'border-slate-200'
                      }`}
                    >
                      <div className="relative aspect-[16/10] md:aspect-[4/3] overflow-hidden bg-slate-100">
                        <ImageWithFallback src={item.imageUrl} alt={item.title} />
                        {onToggleFavourite && (
                          <button
                            type="button"
                            onClick={() => handleToggleFav(item)}
                            aria-pressed={isFav}
                            aria-label={
                              isFav
                                ? `Remove ${item.title} from wishlist`
                                : `Save ${item.title} to wishlist`
                            }
                            className="absolute right-3 top-3 flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full bg-white/95 p-2 text-slate-700 shadow-sm hover:text-red-600"
                          >
                            <Heart
                              className={`h-4 w-4 ${isFav ? 'fill-red-600 text-red-600' : ''}`}
                              aria-hidden="true"
                            />
                          </button>
                        )}
                      </div>

                      <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
                        <div>
                          <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                            <span className="truncate">
                              {item.entryType || 'Attraction'} · {item.duration} ·{' '}
                              {isVerifiedOp ? 'Verified Operator' : 'Audit Pending'}
                            </span>
                            <StatusText
                              label={item.safetyStatus}
                              tone={item.safetyStatus === 'Nominal' ? 'nominal' : 'advisory'}
                            />
                          </div>

                          <h3 className="mt-2 font-display text-lg font-bold text-[#111827]">
                            {item.title}
                          </h3>

                          <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500">
                            <span className="flex items-center gap-1 truncate">
                              <MapPin
                                className="h-3.5 w-3.5 shrink-0 text-[#1D4ED8]"
                                aria-hidden="true"
                              />
                              <span className="truncate">{item.precinct}</span>
                            </span>
                            {ratingSummary && (
                              <span className="inline-flex items-center gap-1 font-mono font-semibold text-[#1D4ED8] shrink-0">
                                <Star className="h-3 w-3 fill-[#1D4ED8]" aria-hidden="true" />
                                {ratingSummary.avgStr} ({ratingSummary.count})
                              </span>
                            )}
                          </div>

                          <p className="mt-2.5 text-xs text-slate-600 leading-relaxed line-clamp-3">
                            {item.description}
                          </p>

                          <div className="mt-2.5 space-y-1 text-[11px] text-slate-500">
                            <p>
                              <strong className="font-semibold text-slate-700">Category:</strong>{' '}
                              {(item.activityCategories || [item.category]).slice(0, 2).join(' · ')}
                            </p>
                            <p>
                              <strong className="font-semibold text-slate-700">Age Policy:</strong>{' '}
                              {item.ageRequirement || 'All Ages'}
                            </p>
                            <p>
                              <strong className="font-semibold text-slate-700">Access:</strong>{' '}
                              {item.accessibilitySummary}
                            </p>
                            <p className="text-[#1E40AF]">
                              <strong>Weather &amp; Buffer:</strong> +{cardGuidance.bufferMinutes}m buffer · {cardGuidance.weatherCaveat}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3.5">
                          <span className="font-mono text-xs font-bold tabular-nums text-[#111827]">
                            {item.priceZar === 0 ? 'Free Public Access' : `R ${item.priceZar}`}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedMapId(item.id);
                                if (mobileViewMode === 'list') setMobileViewMode('both');
                              }}
                              className="min-h-[38px] sm:min-h-[32px] rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#111827] hover:bg-slate-50 whitespace-nowrap"
                            >
                              Map Pin
                            </button>
                            {onToggleFavourite && (
                              <button
                                type="button"
                                aria-pressed={isFav}
                                onClick={() => handleToggleFav(item)}
                                className={`inline-flex min-h-[38px] sm:min-h-[32px] items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                                  isFav
                                    ? 'border-red-200 bg-red-50 text-red-700'
                                    : 'border-slate-300 bg-white text-[#111827] hover:bg-slate-50'
                                }`}
                              >
                                <Heart
                                  className={`h-3.5 w-3.5 ${isFav ? 'fill-red-600 text-red-600' : ''}`}
                                  aria-hidden="true"
                                />
                                {isFav ? 'Wishlisted' : 'Wishlist'}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleAdd(item)}
                              className={`inline-flex min-h-[38px] sm:min-h-[32px] items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                                isAdded
                                  ? 'border-[#15803D]/30 bg-[#F0FDF4] text-[#15803D]'
                                  : 'border-slate-300 bg-white text-[#111827] hover:bg-slate-50'
                              }`}
                            >
                              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                              {isAdded ? 'In Trip' : 'Add to Trip'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveDetailId(item.id)}
                              className="min-h-[38px] sm:min-h-[32px] rounded-lg bg-[#1D4ED8] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1E40AF] transition-colors whitespace-nowrap"
                            >
                              View Details &amp; Book
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* Accredited Tourism Businesses Directory */}
          {filteredBusinesses.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-[#111827]" aria-hidden="true" />
                <h2 className="font-display text-lg font-bold text-[#111827]">
                  Accredited Cape Town Service Providers ({filteredBusinesses.length})
                </h2>
              </div>

              <div
                className={`grid gap-4 md:grid-cols-2 ${
                  desktopShowMap ? '' : 'lg:grid-cols-3'
                }`}
              >
                {filteredBusinesses.map((biz) => {
                  const isSelected = selectedMapId === biz.id;
                  const ratingSummary = getRatingSummary(biz.id);

                  return (
                    <article
                      key={biz.id}
                      className={`rounded-xl border bg-white p-5 space-y-2.5 transition-colors ${
                        isSelected ? 'border-[#1D4ED8] ring-2 ring-[#1D4ED8]/30' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display text-base font-bold text-[#111827]">
                              {biz.businessName}
                            </h3>
                            <span className="text-[11px] font-semibold text-slate-500">
                              {biz.dataOrigin === 'live' ? 'Live Firestore' : 'Demo Operator'}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {biz.category} · {biz.zone}
                          </p>
                        </div>
                        <StatusText
                          label={biz.status}
                          tone={
                            biz.status === 'Approved'
                              ? 'nominal'
                              : biz.status === 'Pending Review'
                              ? 'advisory'
                              : 'alert'
                          }
                        />
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        {biz.description || biz.complianceDocs}
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 text-xs">
                        <div className="flex items-center gap-3 text-[11px] text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <ShieldCheck className="h-3.5 w-3.5 text-[#15803D]" aria-hidden="true" />
                            {biz.complianceDocs}
                          </span>
                          {ratingSummary && (
                            <span className="inline-flex items-center gap-1 font-mono font-semibold text-[#1D4ED8]">
                              <Star className="h-3 w-3 fill-[#1D4ED8]" aria-hidden="true" />
                              {ratingSummary.avgStr} ({ratingSummary.count})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMapId(biz.id);
                              if (mobileViewMode === 'list') setMobileViewMode('both');
                            }}
                            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-[#111827] hover:bg-slate-50"
                          >
                            Show on Map
                          </button>
                          <button
                            type="button"
                            onClick={() => setReviewTargetId(biz.id)}
                            className="rounded-md bg-[#111827] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#1E293B]"
                          >
                            Review
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {filteredDirectory.length === 0 && filteredBusinesses.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
              <p className="font-display text-base font-semibold text-[#111827]">
                No matching Cape Town attractions or activities found
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Reset discovery filters or broaden your price, category, or duration selection.
              </p>
              <button
                type="button"
                onClick={resetAllFilters}
                className="mt-4 rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white"
              >
                Reset Discovery Filters
              </button>
            </div>
          )}
        </div>

        {/* Interactive Map Column — Sticky Alongside Listings on Desktop (1024px+) & Large Desktop (1440px+) */}
        <aside
          className={`${
            mobileViewMode === 'list' ? 'hidden' : 'block'
          } ${
            desktopShowMap ? 'lg:block lg:col-span-5 2xl:col-span-5 lg:sticky lg:top-20' : 'lg:hidden'
          }`}
        >
          <CapeTownMap
            attractions={filteredDirectory}
            businesses={filteredBusinesses}
            incidents={advisories}
            selectedId={selectedMapId}
            favouriteIds={Array.from(favouriteIdSet)}
            onToggleFavourite={handleToggleFavById}
            onOpenDetails={(id) => setActiveDetailId(id)}
            onSelectMarker={handleMarkerSelect}
            heightClassName="h-[340px] sm:h-[420px] lg:h-[600px] 2xl:h-[700px]"
          />
        </aside>
      </div>

      {/* Visitor Reviews Section (Firestore `reviews` collection + Provider Responses) */}
      <section className="grid gap-6 rounded-xl border border-slate-200 bg-white p-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <h2 className="font-display text-lg font-bold text-[#111827]">
            Precinct &amp; Operator Reviews
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Share safety, accessibility, or service quality feedback for Cape Town attractions and accredited operators.
          </p>
          <form onSubmit={handleSubmitReview} className="mt-4 space-y-3">
            <div>
              <label htmlFor="rev-target" className="block text-xs font-semibold text-slate-700">
                Attraction, Activity, or Tourism Business
              </label>
              <select
                id="rev-target"
                value={reviewTargetId}
                onChange={(e) => setReviewTargetId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
              >
                {reviewTargets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="rev-rating" className="block text-xs font-semibold text-slate-700">
                Rating (1–5)
              </label>
              <select
                id="rev-rating"
                value={reviewRating}
                onChange={(e) => setReviewRating(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
              >
                <option value={5}>5 — Excellent safety &amp; access</option>
                <option value={4}>4 — Good</option>
                <option value={3}>3 — Fair</option>
                <option value={2}>2 — Needs improvement</option>
                <option value={1}>1 — Poor</option>
              </select>
            </div>
            <div>
              <label htmlFor="rev-comment" className="block text-xs font-semibold text-slate-700">
                Review Comment
              </label>
              <textarea
                id="rev-comment"
                rows={3}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share trail conditions, crowd timing, or operator safety observations..."
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>
            {reviewNotice && (
              <p role="status" className="text-xs font-medium text-[#15803D]">
                {reviewNotice}
              </p>
            )}
            <button
              type="submit"
              disabled={submittingReview}
              className="w-full rounded-lg bg-[#1D4ED8] py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60 transition-colors"
            >
              {submittingReview ? 'Submitting...' : 'Submit Review'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-7 divide-y divide-slate-200">
          {approvedReviews.length === 0 ? (
            <p className="text-xs text-slate-500 py-6">
              No reviews logged yet. Be the first to share a Cape Town precinct or business review.
            </p>
          ) : (
            approvedReviews.map((rev) => {
              const targetTitle =
                allDirectoryItems.find((a) => a.id === rev.targetId)?.title ||
                businesses.find((b) => b.id === rev.targetId)?.businessName ||
                rev.targetId;
              return (
                <div key={rev.id} className="py-3.5 first:pt-0 last:pb-0 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[#111827]">{targetTitle}</span>
                    <span className="inline-flex items-center gap-1 font-mono font-semibold text-[#1D4ED8] tabular-nums">
                      <Star className="h-3.5 w-3.5 fill-[#1D4ED8]" aria-hidden="true" />
                      {rev.rating}/5
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">{rev.comment}</p>
                  <p className="text-[11px] text-slate-500">
                    {rev.authorName} · {rev.createdAtLabel} ·{' '}
                    {rev.dataOrigin === 'live' ? 'Verified Firestore' : 'Demo Review'}
                  </p>
                  {rev.providerReply && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs">
                      <p className="font-semibold text-[#111827]">
                        Provider Response · {rev.providerReplyBy || 'Service Provider'}
                      </p>
                      <p className="mt-0.5 text-slate-600">{rev.providerReply}</p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Detailed Activity & Booking Modal */}
      {activeDetailItem && user && onCompleteCheckout && onRemoveSavedCard && (
        <ExperienceDetailModal
          item={activeDetailItem}
          user={user}
          reviews={approvedReviews}
          isFavourite={favouriteIdSet.has(activeDetailItem.id)}
          weather={weather}
          providerSettings={
            providerPaymentSettings.find((s) => s.providerId === activeDetailItem.providerId) ||
            providerPaymentSettings[0]
          }
          savedCards={savedCards}
          onToggleFavourite={handleToggleFav}
          onAddToTrip={onAddToTrip}
          onAddReview={onAddReview}
          onRemoveSavedCard={onRemoveSavedCard}
          onCompleteCheckout={onCompleteCheckout}
          onClose={() => setActiveDetailId(null)}
        />
      )}
    </div>
  );
};
