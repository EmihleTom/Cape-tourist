import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Flag,
  Lock,
  MessageSquarePlus,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { DemoDataNotice } from '@/src/components/common/DemoDataNotice';
import { StatusText } from '@/src/components/common/StatusText';
import { aiService } from '@/src/services/aiService';
import type { CommunityPost, DemoUser, ModerationStatus } from '@/src/types/app';

interface CommunityHubPageProps {
  user: DemoUser;
  posts: CommunityPost[];
  onAddPost: (post: Omit<CommunityPost, 'id' | 'timestamp' | 'dataOrigin'>) => Promise<void> | void;
  onFlagPost: (postId: string, reason: string) => Promise<void> | void;
  onModeratePost: (
    postId: string,
    status: ModerationStatus,
    verifiedGuide?: boolean
  ) => Promise<void> | void;
  onDeletePost: (postId: string) => Promise<void> | void;
}

export function formatAuthorByVisibility(user: DemoUser): string {
  const mode = user.profileVisibility || 'public_guides';
  if (mode === 'private') return 'CapeSafe Traveler';
  if (mode === 'initials_only') {
    const parts = user.name.trim().split(/\s+/).filter(Boolean);
    return parts.map((p) => `${p[0].toUpperCase()}.`).join(' ') || 'C. T.';
  }
  return user.name;
}

export const CommunityHubPage: React.FC<CommunityHubPageProps> = ({
  user,
  posts,
  onAddPost,
  onFlagPost,
  onModeratePost,
  onDeletePost,
}) => {
  const [zone, setZone] = useState('Sea Point & Atlantic Seaboard');
  const [content, setContent] = useState('');
  const [zoneFilter, setZoneFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null);
  const [flaggingId, setFlaggingId] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState('');

  const isModerator = user.role === 'admin' || user.role === 'safety';
  const displayedAuthor = useMemo(() => formatAuthorByVisibility(user), [user]);

  const approvedPosts = useMemo(() => {
    return posts.filter((post) => {
      const status = post.moderationStatus || 'Approved';
      if (status !== 'Approved' && post.authorId !== user.id) return false;
      if (zoneFilter !== 'All' && !post.zone.toLowerCase().includes(zoneFilter.toLowerCase())) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          post.content.toLowerCase().includes(q) ||
          post.zone.toLowerCase().includes(q) ||
          post.author.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [posts, user.id, zoneFilter, searchQuery]);

  const moderationQueue = useMemo(() => {
    return posts.filter((post) => {
      const status = post.moderationStatus || 'Approved';
      return status === 'Under Review' || status === 'Removed';
    });
  }, [posts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (trimmed.length < 6) {
      setFeedback({ tone: 'warn', text: 'Please share at least 6 characters for fellow travelers.' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const mod = await aiService.moderateCommunityPost({ content: trimmed, zone });
      if (!mod.allowed || mod.moderationStatus === 'Removed') {
        setFeedback({
          tone: 'warn',
          text: `Post could not be published: ${mod.reasons.join(' ')}`,
        });
        return;
      }

      await onAddPost({
        authorId: user.id,
        author: displayedAuthor,
        roleLabel: user.roleTitle,
        zone,
        content: trimmed,
        verifiedGuide: false,
        moderationStatus: mod.moderationStatus,
        ...(mod.moderationStatus === 'Under Review'
          ? { flagReason: mod.reasons.join(' ') }
          : {}),
      });

      setContent('');
      setFeedback(
        mod.moderationStatus === 'Under Review'
          ? {
              tone: 'warn',
              text: `Submitted for moderator review (${mod.reasons.join(' ')}).`,
            }
          : {
              tone: 'ok',
              text: 'Field note published to the CapeSafe Community Hub.',
            }
      );
    } catch (err) {
      setFeedback({
        tone: 'warn',
        text: err instanceof Error ? err.message : 'Unable to submit community note.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmFlag = async (postId: string) => {
    const reason = flagReason.trim() || 'Flagged by community member for safety or accuracy review';
    await onFlagPost(postId, reason);
    setFlaggingId(null);
    setFlagReason('');
    setFeedback({
      tone: 'warn',
      text: 'Post flagged and moved to Safety/Admin moderation queue.',
    });
  };

  return (
    <div className="space-y-6">
      <DemoDataNotice
        scope="Community Hub field reports with automatic PII/safety pre-moderation, traveler privacy controls, and Admin/Safety review queue"
      />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Compose Form */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MessageSquarePlus className="h-4 w-4 text-[#0D9488]" aria-hidden="true" />
              <h1 className="font-display text-lg font-bold text-[#0B1F3A]">
                Share Field Note
              </h1>
            </div>
            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
              <Lock className="h-3 w-3 text-[#0D9488]" aria-hidden="true" />
              {displayedAuthor}
            </span>
          </div>

          <p className="text-xs text-slate-600">
            Post trail visibility, accessibility tips, or coastal updates. Posts are screened for personal contact info and unsafe content before appearing publicly.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="com-zone" className="block text-xs font-semibold text-slate-700">
                Cape Town Precinct
              </label>
              <select
                id="com-zone"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#0D9488] focus:outline-none"
              >
                <option>Sea Point &amp; Atlantic Seaboard</option>
                <option>Bo-Kaap</option>
                <option>Kirstenbosch</option>
                <option>Hout Bay &amp; Llandudno</option>
                <option>Simon&apos;s Town</option>
                <option>Table Mountain &amp; City Bowl</option>
              </select>
            </div>
            <div>
              <label htmlFor="com-note" className="block text-xs font-semibold text-slate-700">
                Field Observation
              </label>
              <textarea
                id="com-note"
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Share current trail conditions, accessibility notes, or visitor etiquette..."
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#0D9488] focus:outline-none"
              />
            </div>

            {feedback && (
              <div
                className={`rounded-lg border px-3 py-2 text-xs ${
                  feedback.tone === 'ok'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-amber-200 bg-amber-50 text-amber-900'
                }`}
              >
                {feedback.text}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-[#0D9488] py-2 text-xs font-semibold text-white hover:bg-[#0F766E] disabled:opacity-60 transition-colors"
            >
              {submitting ? 'Screening & Publishing...' : 'Publish Field Note'}
            </button>
          </form>
        </section>

        {/* Feed & Moderation Queue */}
        <section className="space-y-4 lg:col-span-7">
          {isModerator && moderationQueue.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-amber-800" aria-hidden="true" />
                  <h2 className="font-display text-sm font-bold text-[#0B1F3A]">
                    Moderation Queue ({moderationQueue.length})
                  </h2>
                </div>
                <span className="text-[11px] font-semibold text-amber-900">
                  Admin / Safety Review
                </span>
              </div>

              <div className="space-y-2.5">
                {moderationQueue.map((post) => (
                  <div
                    key={post.id}
                    className="rounded-lg border border-amber-200 bg-white p-3.5 text-xs space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-[#0B1F3A]">
                        {post.author} · {post.zone}
                      </span>
                      <StatusText
                        label={post.moderationStatus || 'Under Review'}
                        tone={post.moderationStatus === 'Removed' ? 'alert' : 'advisory'}
                      />
                    </div>
                    <p className="text-slate-700">{post.content}</p>
                    {post.flagReason && (
                      <p className="text-[11px] text-amber-900">
                        <AlertTriangle className="mr-1 inline h-3 w-3" aria-hidden="true" />
                        Flag note: {post.flagReason}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => void onModeratePost(post.id, 'Approved', post.verifiedGuide)}
                        className="rounded bg-[#15803D] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => void onModeratePost(post.id, 'Approved', true)}
                        className="rounded border border-[#0D9488] px-2.5 py-1 text-[11px] font-semibold text-[#0D9488] hover:bg-[#F0FDFA]"
                      >
                        Approve + Verified Guide
                      </button>
                      <button
                        type="button"
                        onClick={() => void onModeratePost(post.id, 'Removed')}
                        className="rounded border border-amber-400 px-2.5 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
                      >
                        Hide / Remove
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDeletePost(post.id)}
                        className="rounded border border-red-300 px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3.5 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search field observations..."
                className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 text-xs focus:border-[#0D9488] focus:outline-none"
              />
            </div>
            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              aria-label="Filter community posts by zone"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800"
            >
              <option value="All">All Zones</option>
              <option value="Sea Point">Sea Point</option>
              <option value="Bo-Kaap">Bo-Kaap</option>
              <option value="Kirstenbosch">Kirstenbosch</option>
              <option value="Hout Bay">Hout Bay</option>
              <option value="Simon's Town">Simon&apos;s Town</option>
              <option value="Table Mountain">Table Mountain</option>
            </select>
          </div>

          {approvedPosts.map((post) => {
            const isAuthor = post.authorId === user.id;
            const status = post.moderationStatus || 'Approved';
            return (
              <article key={post.id} className="rounded-xl border border-slate-200 bg-white p-5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[#0B1F3A]">{post.author}</span>
                    <span aria-hidden="true">·</span>
                    <span>{post.roleLabel}</span>
                    {post.verifiedGuide && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 text-[#15803D] font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Verified Partner
                        </span>
                      </>
                    )}
                    {status !== 'Approved' && (
                      <StatusText label={status} tone="advisory" />
                    )}
                  </div>
                  <span>
                    {post.zone} · {post.timestamp}
                  </span>
                </div>

                <p className="text-sm text-slate-700 leading-relaxed">{post.content}</p>

                <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-2 text-[11px]">
                  {status === 'Approved' && (
                    <button
                      type="button"
                      onClick={() => {
                        setFlaggingId(flaggingId === post.id ? null : post.id);
                        setFlagReason('');
                      }}
                      className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-amber-800"
                    >
                      <Flag className="h-3 w-3" aria-hidden="true" />
                      Flag for review
                    </button>
                  )}
                  {(isAuthor || isModerator) && (
                    <button
                      type="button"
                      onClick={() => void onDeletePost(post.id)}
                      className="inline-flex items-center gap-1 font-medium text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                      Delete
                    </button>
                  )}
                </div>

                {flaggingId === post.id && (
                  <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:flex-row">
                    <input
                      type="text"
                      value={flagReason}
                      onChange={(e) => setFlagReason(e.target.value)}
                      placeholder="Reason for moderation review..."
                      className="flex-1 rounded border border-amber-300 bg-white px-2.5 py-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => void handleConfirmFlag(post.id)}
                      className="rounded bg-amber-800 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-900"
                    >
                      Submit Flag
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
};
