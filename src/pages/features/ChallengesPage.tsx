import React, { useMemo } from 'react';
import { Award, CheckCircle2, ShieldCheck, Trophy } from 'lucide-react';
import { DemoDataNotice } from '@/src/components/common/DemoDataNotice';
import type {
  BookingItem,
  ChallengeItem,
  CheckInSession,
  DemoUser,
  TripActivity,
} from '@/src/types/app';

interface ChallengesPageProps {
  user: DemoUser;
  challenges: ChallengeItem[];
  bookings: BookingItem[];
  checkIns: CheckInSession[];
  activities: TripActivity[];
  onIncrementChallenge: (id: string) => Promise<void> | void;
}

export const ChallengesPage: React.FC<ChallengesPageProps> = ({
  user,
  challenges,
  bookings,
  checkIns,
  activities,
  onIncrementChallenge,
}) => {
  const isLive = user.authMode === 'firebase' && Boolean(user.emailVerified);

  const earnedBadges = useMemo(() => {
    const challengeBadges = challenges
      .filter((c) => c.progress >= c.target)
      .map((c) => ({
        id: `badge-${c.id}`,
        title: c.badgeTitle || `${c.title} Finisher`,
        description: c.badgeDescription || c.rewardNote,
        origin: 'Challenge Milestone',
      }));

    const activityBadges: Array<{
      id: string;
      title: string;
      description: string;
      origin: string;
    }> = [];

    if (checkIns.some((c) => c.status === 'Completed')) {
      activityBadges.push({
        id: 'badge-safe-return',
        title: 'Verified Safe Hiker',
        description: 'Completed a timed CapeSafe Tourist Check-In and confirmed safe return.',
        origin: 'Activity Milestone',
      });
    }
    if (bookings.some((b) => b.status === 'Confirmed')) {
      activityBadges.push({
        id: 'badge-accredited-supporter',
        title: 'Accredited Operator Patron',
        description: 'Confirmed a safety-verified Cape Town accommodation, tour, or shuttle.',
        origin: 'Booking Milestone',
      });
    }
    if (activities.some((a) => a.itemType === 'Transport')) {
      activityBadges.push({
        id: 'badge-transit-planner',
        title: 'Low-Carbon Route Planner',
        description: 'Integrated MyCiTi or electric transit into your Cape Town trip itinerary.',
        origin: 'Itinerary Milestone',
      });
    }

    return [...challengeBadges, ...activityBadges];
  }, [challenges, checkIns, bookings, activities]);

  return (
    <div className="space-y-6">
      <DemoDataNotice
        scope={
          isLive
            ? 'Challenge progress and unlocked achievement badges persist to your Cloud Firestore traveler profile'
            : 'Challenge milestones & badge showcases run in local demonstration mode until signed in with verified Firebase'
        }
      />

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-[#0D9488]" aria-hidden="true" />
            <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">
              Discover Cape Town Challenges &amp; Badges
            </h1>
          </div>
          <span className="font-mono text-xs font-semibold text-[#15803D]">
            {earnedBadges.length} Badge{earnedBadges.length === 1 ? '' : 's'} Unlocked
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Complete low-carbon transit rides, timed trail safety check-ins, inclusive exploration, and accredited local guide experiences to unlock achievement badges.
        </p>
      </div>

      {/* Achievement Badges Showcase */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <Award className="h-4 w-4 text-[#0D9488]" aria-hidden="true" />
          <h2 className="font-display text-base font-bold text-[#0B1F3A]">
            Earned Achievement Badges
          </h2>
        </div>

        {earnedBadges.length === 0 ? (
          <p className="text-xs text-slate-500">
            Log challenge progress or complete a verified check-in/booking to earn your first CapeSafe achievement badge.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {earnedBadges.map((badge) => (
              <div
                key={badge.id}
                className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3.5"
              >
                <ShieldCheck className="h-5 w-5 text-[#15803D] shrink-0 mt-0.5" aria-hidden="true" />
                <div className="text-xs">
                  <p className="font-bold text-[#0B1F3A]">{badge.title}</p>
                  <p className="mt-0.5 text-slate-700 leading-relaxed">{badge.description}</p>
                  <p className="mt-1 font-mono text-[10px] font-semibold text-[#15803D]">
                    {badge.origin}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Active Challenge Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {challenges.map((ch) => {
          const pct = Math.min(100, Math.round((ch.progress / ch.target) * 100));
          const complete = ch.progress >= ch.target;
          return (
            <article key={ch.id} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[#0D9488]">{ch.category}</p>
                  {complete && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#15803D]">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Badge Unlocked
                    </span>
                  )}
                </div>
                <h2 className="mt-1.5 font-display text-lg font-bold text-[#0B1F3A]">{ch.title}</h2>
                {ch.badgeTitle && (
                  <p className="mt-1 text-xs font-medium text-slate-600">
                    Unlocks badge: <strong className="text-[#0B1F3A]">{ch.badgeTitle}</strong>
                  </p>
                )}
                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">{ch.unit}</span>
                    <span className="font-mono font-semibold tabular-nums text-[#0B1F3A]">
                      {ch.progress} / {ch.target}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all ${complete ? 'bg-[#15803D]' : 'bg-[#0D9488]'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-600">{ch.rewardNote}</p>
              </div>

              <button
                type="button"
                disabled={complete}
                onClick={() => void onIncrementChallenge(ch.id)}
                className="mt-5 w-full rounded-lg border border-slate-300 bg-slate-50 py-2 text-xs font-semibold text-[#0B1F3A] hover:border-[#0D9488] hover:bg-[#F0FDFA] disabled:opacity-60 transition-colors"
              >
                {complete
                  ? `Completed · ${ch.badgeTitle || 'Badge Earned'}`
                  : isLive
                  ? 'Log Verified Milestone (Save to Cloud)'
                  : 'Log Milestone'}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
};
