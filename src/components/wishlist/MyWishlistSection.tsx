import React, { useMemo, useState } from 'react';
import {
  CalendarCheck,
  Compass,
  Heart,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { ImageWithFallback } from '@/src/components/common/ImageWithFallback';
import { StatusText } from '@/src/components/common/StatusText';
import { IMG } from '@/src/data/capeTownDirectory';
import type {
  AttractionItem,
  FavouriteItem,
  NavSectionId,
  ProviderListing,
} from '@/src/types/app';

interface MyWishlistSectionProps {
  wishlist: FavouriteItem[];
  attractions: AttractionItem[];
  offerings?: ProviderListing[];
  onRemoveWishlistItem: (item: FavouriteItem) => Promise<void> | void;
  onAddToTrip?: (item: AttractionItem) => Promise<void> | void;
  onOpenExploreItem?: (listingId: string) => void;
  onNavigate: (section: NavSectionId) => void;
}

type WishlistFilter = 'All' | 'Bookable' | 'Free' | 'Step-Free';

interface ResolvedWishlistEntry {
  fav: FavouriteItem;
  catalogItem: AttractionItem;
  isMatched: boolean;
}

export const MyWishlistSection: React.FC<MyWishlistSectionProps> = ({
  wishlist,
  attractions,
  offerings = [],
  onRemoveWishlistItem,
  onAddToTrip,
  onOpenExploreItem,
  onNavigate,
}) => {
  const [filterMode, setFilterMode] = useState<WishlistFilter>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [addedToTripIds, setAddedToTripIds] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [actionError, setActionError] = useState('');

  // Build unified lookup map across curated directory & live/demo provider offerings
  const catalogMap = useMemo(() => {
    const map = new Map<string, AttractionItem>();
    attractions.forEach((item) => map.set(item.id, item));
    offerings.forEach((off) => {
      if (!map.has(off.id)) {
        map.set(off.id, {
          id: off.id,
          offeringId: off.id,
          title: off.experienceTitle,
          precinct: off.zone || 'Cape Town',
          category: off.accessible ? 'Accessibility' : 'Coastal',
          activityCategories: off.activityCategory ? [off.activityCategory] : ['Guided tours'],
          entryType: 'Activity',
          accessible: Boolean(off.accessible),
          familyFriendly: off.familyFriendly ?? true,
          ageRequirement: off.ageRequirement || 'All Ages',
          providerId: off.providerId,
          providerName: off.providerName || 'CapeSafe Partner',
          safetyStatus: off.safetyChecklistComplete ? 'Nominal' : 'Guided Recommended',
          accessibilitySummary: off.accessible
            ? 'Step-free boarding & route verified by provider'
            : 'Standard route — confirm access notes with operator',
          duration: `${off.defaultDurationValue || 1} ${off.durationUnit || 'sessions'}`,
          priceZar: off.priceZar,
          imageUrl: off.imageUrl || IMG.coast,
          description:
            off.description ||
            `${off.offeringType || 'Activity'} offered by ${off.providerName || 'CapeSafe Partner'} in ${off.zone || 'Cape Town'}.`,
          coordinates: '33.9249° S, 18.4241° E',
          lat: off.lat ?? -33.9249,
          lng: off.lng ?? 18.4241,
          dataOrigin: off.dataOrigin,
        });
      }
    });
    return map;
  }, [attractions, offerings]);

  const resolvedEntries = useMemo<ResolvedWishlistEntry[]>(() => {
    return wishlist.map((fav) => {
      const matched = catalogMap.get(fav.listingId);
      if (matched) {
        return { fav, catalogItem: matched, isMatched: true };
      }
      return {
        fav,
        isMatched: false,
        catalogItem: {
          id: fav.listingId,
          title: fav.listingTitle,
          precinct: fav.precinct || 'Cape Town',
          category: 'Coastal',
          entryType: fav.listingType === 'Activity' ? 'Activity' : 'Attraction',
          accessible: false,
          safetyStatus: 'Nominal',
          accessibilitySummary: 'Inspect listing in Discover Cape Town for route & safety details',
          duration: 'Flexible',
          priceZar: 0,
          imageUrl: IMG.coast,
          description: `Saved ${fav.listingType.toLowerCase()} in ${fav.precinct || 'Cape Town'}.`,
          coordinates: '33.9249° S, 18.4241° E',
          lat: -33.9249,
          lng: 18.4241,
          dataOrigin: fav.dataOrigin,
        },
      };
    });
  }, [wishlist, catalogMap]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return resolvedEntries.filter(({ fav, catalogItem }) => {
      if (filterMode === 'Bookable' && catalogItem.priceZar <= 0) return false;
      if (filterMode === 'Free' && catalogItem.priceZar > 0) return false;
      if (
        filterMode === 'Step-Free' &&
        !catalogItem.accessible &&
        !catalogItem.accessibilitySummary.toLowerCase().includes('step-free')
      ) {
        return false;
      }
      if (!q) return true;
      return (
        fav.listingTitle.toLowerCase().includes(q) ||
        fav.precinct.toLowerCase().includes(q) ||
        catalogItem.description.toLowerCase().includes(q) ||
        (catalogItem.activityCategories || []).some((cat) => cat.toLowerCase().includes(q))
      );
    });
  }, [resolvedEntries, filterMode, searchQuery]);

  const bookableCount = resolvedEntries.filter((e) => e.catalogItem.priceZar > 0).length;
  const freeCount = resolvedEntries.filter((e) => e.catalogItem.priceZar === 0).length;
  const totalEstimatedZar = resolvedEntries.reduce((sum, e) => sum + e.catalogItem.priceZar, 0);

  const handleRemove = async (fav: FavouriteItem) => {
    setRemovingId(fav.id);
    setActionError('');
    setStatusMessage('');
    try {
      await onRemoveWishlistItem(fav);
      setStatusMessage(`Removed "${fav.listingTitle}" from your Wishlist.`);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to remove saved item from Wishlist.'
      );
    } finally {
      setRemovingId(null);
    }
  };

  const handleAddToTrip = async (entry: ResolvedWishlistEntry) => {
    if (!onAddToTrip) return;
    setActionError('');
    setStatusMessage('');
    try {
      await onAddToTrip(entry.catalogItem);
      setAddedToTripIds((prev) =>
        prev.includes(entry.fav.listingId) ? prev : [...prev, entry.fav.listingId]
      );
      setStatusMessage(`Added "${entry.catalogItem.title}" to My Trips itinerary.`);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to add wishlisted item to My Trips.'
      );
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-5">
      {/* Header & Filter Controls */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold text-[#111827]">
              My Wishlist &amp; Saved Activities
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-600">
            Save Cape Town attractions and bookable tours while planning, then add to your itinerary or complete checkout whenever you are ready.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 overflow-x-auto max-w-full rounded-lg border border-slate-200 bg-slate-50 p-1">
            {(['All', 'Bookable', 'Free', 'Step-Free'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                aria-pressed={filterMode === tab}
                onClick={() => setFilterMode(tab)}
                className={`min-h-[36px] rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  filterMode === tab
                    ? 'bg-[#111827] text-white'
                    : 'text-slate-600 hover:text-[#111827]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onNavigate('explore')}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1E40AF] transition-colors whitespace-nowrap shrink-0"
          >
            <Compass className="h-3.5 w-3.5" aria-hidden="true" />
            Explore Activities
          </button>
        </div>
      </div>

      {/* Summary Metrics + Search Bar */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
          <p className="text-[11px] font-medium text-slate-500">Total Saved</p>
          <p className="mt-1 font-display text-xl font-bold tabular-nums text-[#111827]">
            {wishlist.length}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
          <p className="text-[11px] font-medium text-slate-500">Bookable Paid Tours</p>
          <p className="mt-1 font-display text-xl font-bold tabular-nums text-[#1D4ED8]">
            {bookableCount}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
          <p className="text-[11px] font-medium text-slate-500">Free Public Stops</p>
          <p className="mt-1 font-display text-xl font-bold tabular-nums text-[#15803D]">
            {freeCount}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
          <p className="text-[11px] font-medium text-slate-500">Est. Basket (1 guest each)</p>
          <p className="mt-1 font-display text-xl font-bold tabular-nums text-[#111827]">
            R {totalEstimatedZar.toLocaleString('en-ZA')}
          </p>
        </div>
      </div>

      {wishlist.length > 0 && (
        <div className="relative max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search saved experiences or precincts..."
            aria-label="Search wishlist items"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
          />
        </div>
      )}

      {actionError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
        >
          {actionError}
        </p>
      )}

      {statusMessage && (
        <p
          role="status"
          className="rounded-lg border border-[#15803D]/30 bg-[#F0FDF4] px-3 py-2 text-xs font-medium text-[#15803D]"
        >
          {statusMessage}
        </p>
      )}

      {/* Wishlist States: Empty vs No Filter Match vs Populated Grid */}
      {wishlist.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 sm:p-10 text-center space-y-3">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-[#1D4ED8]">
            <Heart className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h3 className="font-display text-base font-bold text-[#111827]">
              Your Cape Town Wishlist is empty
            </h3>
            <p className="mx-auto max-w-md text-xs text-slate-600 leading-relaxed">
              Save attractions, guided kayak routes, or cultural walks in Discover Cape Town without booking immediately. Your shortlist appears here ready to compare, plan, or book later.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('explore')}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] transition-colors"
          >
            <Compass className="h-4 w-4" aria-hidden="true" />
            Browse Discover Cape Town
          </button>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center space-y-2">
          <p className="font-display text-sm font-bold text-[#111827]">
            No saved wishlist items match your filter
          </p>
          <p className="text-xs text-slate-600">
            Clear your search or switch back to All saved activities.
          </p>
          <button
            type="button"
            onClick={() => {
              setFilterMode('All');
              setSearchQuery('');
            }}
            className="mt-2 inline-flex min-h-[36px] items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#111827] hover:bg-slate-100"
          >
            Reset Wishlist Filters
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredEntries.map((entry) => {
            const { fav, catalogItem } = entry;
            const isRemoving = removingId === fav.id;
            const addedToTrip = addedToTripIds.includes(fav.listingId);

            return (
              <article
                key={fav.id}
                className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                  <ImageWithFallback src={catalogItem.imageUrl} alt={catalogItem.title} />
                </div>

                <div className="flex flex-1 flex-col justify-between p-4 space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span className="truncate">
                        {fav.listingType} · {catalogItem.duration} · Saved {fav.createdAtLabel}
                      </span>
                      <StatusText
                        label={catalogItem.safetyStatus}
                        tone={catalogItem.safetyStatus === 'Nominal' ? 'nominal' : 'advisory'}
                      />
                    </div>

                    <h3 className="font-display text-base font-bold text-[#111827]">
                      {catalogItem.title}
                    </h3>

                    <p className="flex items-center gap-1 text-xs text-slate-600">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-[#1D4ED8]" aria-hidden="true" />
                      <span className="truncate">{catalogItem.precinct}</span>
                    </p>

                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                      {catalogItem.description}
                    </p>

                    <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <ShieldCheck
                        className="h-3.5 w-3.5 shrink-0 text-[#15803D]"
                        aria-hidden="true"
                      />
                      <span className="truncate">{catalogItem.accessibilitySummary}</span>
                    </p>
                  </div>

                  <div className="border-t border-slate-200 pt-3 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold tabular-nums text-[#111827]">
                        {catalogItem.priceZar === 0
                          ? 'Free Public Access'
                          : `R ${catalogItem.priceZar.toLocaleString('en-ZA')}`}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {fav.dataOrigin === 'live' ? 'Synced to Firestore' : 'Demo Session'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          onOpenExploreItem
                            ? onOpenExploreItem(fav.listingId)
                            : onNavigate(catalogItem.priceZar > 0 ? 'bookings' : 'explore')
                        }
                        className="inline-flex min-h-[38px] sm:min-h-[34px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1E40AF] transition-colors whitespace-nowrap"
                      >
                        <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        {catalogItem.priceZar > 0 ? 'Inspect & Book' : 'Open Details'}
                      </button>

                      {onAddToTrip && (
                        <button
                          type="button"
                          onClick={() => handleAddToTrip(entry)}
                          className={`inline-flex min-h-[38px] sm:min-h-[34px] items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                            addedToTrip
                              ? 'border-[#15803D]/30 bg-[#F0FDF4] text-[#15803D]'
                              : 'border-slate-300 bg-white text-[#111827] hover:bg-slate-50'
                          }`}
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                          {addedToTrip ? 'In Trip' : 'Add to Trip'}
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={isRemoving}
                        onClick={() => handleRemove(fav)}
                        aria-label={`Remove ${catalogItem.title} from wishlist`}
                        className="inline-flex min-h-[38px] sm:min-h-[34px] items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {isRemoving ? 'Removing...' : 'Remove'}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
