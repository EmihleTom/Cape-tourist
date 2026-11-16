import React, { useState } from 'react';
import { Accessibility, Compass, MapPin, Plus, Search, ShieldCheck, Star, Store } from 'lucide-react';
import { DemoDataNotice } from '@/src/components/common/DemoDataNotice';
import { ImageWithFallback } from '@/src/components/common/ImageWithFallback';
import { StatusText } from '@/src/components/common/StatusText';
import { CapeTownMap, type MapMarkerItem } from '@/src/components/map/CapeTownMap';
import type {
  AttractionItem,
  ProviderApplication,
  ReviewItem,
  SafetyAdvisory,
} from '@/src/types/app';

interface ExplorePageProps {
  attractions: AttractionItem[];
  businesses: ProviderApplication[];
  advisories: SafetyAdvisory[];
  reviews: ReviewItem[];
  onAddToTrip: (attraction: AttractionItem) => Promise<void> | void;
  onAddReview: (targetId: string, rating: number, comment: string) => Promise<void> | void;
}

export const ExplorePage: React.FC<ExplorePageProps> = ({
  attractions,
  businesses,
  advisories,
  reviews,
  onAddToTrip,
  onAddReview,
}) => {
  const [category, setCategory] = useState<'All' | AttractionItem['category']>('All');
  const [discoveryMode, setDiscoveryMode] = useState<'all' | 'attractions' | 'businesses'>('all');
  const [stepFreeOnly, setStepFreeOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [addedIds, setAddedIds] = useState<string[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);

  const [reviewTargetId, setReviewTargetId] = useState(attractions[0]?.id || 'attr-waterfront');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewNotice, setReviewNotice] = useState('');
  const [exploreError, setExploreError] = useState('');

  const q = query.trim().toLowerCase();

  const filteredAttractions = attractions.filter((item) => {
    const matchesCategory = category === 'All' || item.category === category;
    const matchesStepFree =
      !stepFreeOnly ||
      item.category === 'Accessibility' ||
      item.accessibilitySummary.toLowerCase().includes('step-free') ||
      item.accessibilitySummary.toLowerCase().includes('wheelchair') ||
      item.accessibilitySummary.toLowerCase().includes('level');
    const matchesQuery =
      !q ||
      item.title.toLowerCase().includes(q) ||
      item.precinct.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q);
    return matchesCategory && matchesStepFree && matchesQuery;
  });

  const filteredBusinesses = businesses.filter((biz) => {
    const matchesQuery =
      !q ||
      biz.businessName.toLowerCase().includes(q) ||
      biz.zone.toLowerCase().includes(q) ||
      biz.category.toLowerCase().includes(q) ||
      (biz.description || '').toLowerCase().includes(q);
    const matchesCategory =
      category === 'All' ||
      biz.category.toLowerCase().includes(category.toLowerCase()) ||
      (category === 'Coastal' && biz.category.toLowerCase().includes('marine')) ||
      (category === 'Accessibility' && Boolean(biz.safetyChecklistComplete));
    return matchesQuery && matchesCategory;
  });

  const visibleAttractions = discoveryMode === 'businesses' ? [] : filteredAttractions;
  const visibleBusinesses = discoveryMode === 'attractions' ? [] : filteredBusinesses;

  const getRatingSummary = (targetId: string) => {
    const matching = reviews.filter((r) => r.targetId === targetId);
    if (matching.length === 0) return null;
    const avg = matching.reduce((sum, r) => sum + r.rating, 0) / matching.length;
    return { avg: avg.toFixed(1), count: matching.length };
  };

  const handleAdd = async (item: AttractionItem) => {
    setExploreError('');
    try {
      await onAddToTrip(item);
      setAddedIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
    } catch (err) {
      setExploreError(err instanceof Error ? err.message : 'Unable to add attraction to trip.');
    }
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

  const handleMarkerSelect = (marker: MapMarkerItem) => {
    setSelectedMapId(marker.id);
    if (marker.kind === 'attraction' || marker.kind === 'business') {
      setReviewTargetId(marker.id);
    }
  };

  const categories: Array<'All' | AttractionItem['category']> = [
    'All',
    'Coastal',
    'Mountain',
    'Heritage',
    'Accessibility',
  ];

  const reviewTargets = [
    ...attractions.map((a) => ({ id: a.id, label: `Attraction: ${a.title}` })),
    ...businesses.map((b) => ({ id: b.id, label: `Business: ${b.businessName}` })),
  ];

  return (
    <div className="space-y-6">
      <DemoDataNotice scope="Curated Cape Peninsula attractions & demo operators paired with live Firestore businesses, traveler reviews, and interactive map pins" />

      {/* Search & Header */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#111827]">
            Explore Cape Town &amp; Tourism Directory
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Discover verified precincts, accredited local service providers, interactive Google Maps pins, and traveler reviews.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search attractions, businesses, zones..."
            aria-label="Search Cape Town discovery"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
          />
        </div>
      </div>

      {/* Interactive Cape Town Tourism Map */}
      <CapeTownMap
        attractions={visibleAttractions}
        businesses={visibleBusinesses}
        incidents={advisories}
        selectedId={selectedMapId}
        onSelectMarker={handleMarkerSelect}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              aria-pressed={category === cat}
              onClick={() => setCategory(cat)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                category === cat
                  ? 'bg-[#111827] text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-[#111827]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-white p-1 text-xs font-semibold">
            {(
              [
                { id: 'all', label: 'All Discovery' },
                { id: 'attractions', label: 'Attractions' },
                { id: 'businesses', label: 'Businesses' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={discoveryMode === tab.id}
                onClick={() => setDiscoveryMode(tab.id)}
                className={`rounded-md px-2.5 py-1 transition-colors ${
                  discoveryMode === tab.id
                    ? 'bg-[#1D4ED8] text-white'
                    : 'text-slate-600 hover:text-[#111827]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

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
            Step-Free Priority
          </button>
        </div>
      </div>

      {exploreError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {exploreError}
        </p>
      )}

      {/* Attractions Grid */}
      {visibleAttractions.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold text-[#111827]">
              Cape Peninsula Attractions ({visibleAttractions.length})
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {visibleAttractions.map((item) => {
              const isAdded = addedIds.includes(item.id);
              const isSelected = selectedMapId === item.id;
              const ratingSummary = getRatingSummary(item.id);

              return (
                <article
                  key={item.id}
                  className={`flex flex-col overflow-hidden rounded-xl border bg-white transition-colors ${
                    isSelected ? 'border-[#1D4ED8] ring-2 ring-[#1D4ED8]/30' : 'border-slate-200'
                  }`}
                >
                  <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                    <ImageWithFallback src={item.imageUrl} alt={item.title} />
                  </div>
                  <div className="flex flex-1 flex-col justify-between p-5">
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                        <span>
                          {item.category} · {item.duration}
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
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
                          <span>{item.precinct}</span>
                        </span>
                        {ratingSummary && (
                          <span className="inline-flex items-center gap-1 font-mono font-semibold text-[#1D4ED8]">
                            <Star className="h-3 w-3 fill-[#1D4ED8]" aria-hidden="true" />
                            {ratingSummary.avg} ({ratingSummary.count})
                          </span>
                        )}
                      </div>
                      <p className="mt-2.5 text-xs text-slate-600 leading-relaxed">{item.description}</p>
                      <p className="mt-2 text-[11px] text-slate-500">
                        <strong className="font-semibold text-slate-700">Access:</strong>{' '}
                        {item.accessibilitySummary}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3.5">
                      <span className="font-mono text-xs font-semibold tabular-nums text-[#111827]">
                        {item.priceZar === 0 ? 'Free Public Access' : `R ${item.priceZar} entry`}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedMapId(item.id)}
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#111827] hover:bg-slate-50"
                        >
                          Map Pin
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdd(item)}
                          className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                            isAdded
                              ? 'bg-[#F0FDF4] text-[#15803D] border border-[#15803D]/30'
                              : 'bg-[#1D4ED8] text-white hover:bg-[#1E40AF]'
                          }`}
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                          {isAdded ? 'Added' : 'Add to Trip'}
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
      {visibleBusinesses.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-[#111827]" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold text-[#111827]">
              Accredited Cape Town Service Providers ({visibleBusinesses.length})
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {visibleBusinesses.map((biz) => {
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
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
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
                          {ratingSummary.avg} ({ratingSummary.count})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedMapId(biz.id)}
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

      {visibleAttractions.length === 0 && visibleBusinesses.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <p className="font-display text-base font-semibold text-[#111827]">
            No matching attractions or accredited businesses found
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Reset search filters or switch discovery tabs to browse all Cape Town listings.
          </p>
          <button
            type="button"
            onClick={() => {
              setCategory('All');
              setDiscoveryMode('all');
              setStepFreeOnly(false);
              setQuery('');
            }}
            className="mt-4 rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white"
          >
            Reset Discovery Filters
          </button>
        </div>
      )}

      {/* Visitor Reviews Section (Firestore `reviews` collection) */}
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
                Attraction or Tourism Business
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
          {reviews.length === 0 ? (
            <p className="text-xs text-slate-500 py-6">
              No reviews logged yet. Be the first to share a Cape Town precinct or business review.
            </p>
          ) : (
            reviews.map((rev) => {
              const targetTitle =
                attractions.find((a) => a.id === rev.targetId)?.title ||
                businesses.find((b) => b.id === rev.targetId)?.businessName ||
                rev.targetId;
              return (
                <div key={rev.id} className="py-3.5 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[#111827]">{targetTitle}</span>
                    <span className="inline-flex items-center gap-1 font-mono font-semibold text-[#1D4ED8] tabular-nums">
                      <Star className="h-3.5 w-3.5 fill-[#1D4ED8]" aria-hidden="true" />
                      {rev.rating}/5
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-700 leading-relaxed">{rev.comment}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {rev.authorName} · {rev.createdAtLabel} ·{' '}
                    {rev.dataOrigin === 'live' ? 'Verified Firestore' : 'Demo'}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};
