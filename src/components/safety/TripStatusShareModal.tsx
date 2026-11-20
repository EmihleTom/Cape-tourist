import React, { useMemo, useState } from 'react';
import { Check, Copy, KeyRound, Mail, Share2, ShieldCheck, Users, X } from 'lucide-react';
import type { TrustedContact } from '@/src/types/app';
import { buildTripShareSummary } from '@/src/utils/safetyGuidance';

export interface TripSharePayload {
  title: string;
  zone: string;
  dateLabel: string;
  timeWindowLabel: string;
  pickupCode?: string;
  providerName?: string;
  providerVerified?: boolean;
}

interface TripStatusShareModalProps {
  payload: TripSharePayload | null;
  travelerName: string;
  userEmergencyContact?: string;
  trustedContacts?: TrustedContact[];
  onClose: () => void;
}

export const TripStatusShareModal: React.FC<TripStatusShareModalProps> = ({
  payload,
  travelerName,
  userEmergencyContact,
  trustedContacts = [],
  onClose,
}) => {
  const [selectedContactId, setSelectedContactId] = useState<string>(
    trustedContacts.find((c) => c.notifyByDefault)?.id || trustedContacts[0]?.id || 'all'
  );
  const [customNote, setCustomNote] = useState('');
  const [copied, setCopied] = useState(false);
  const [shareFeedback, setShareFeedback] = useState('');

  const selectedContact = useMemo(
    () => trustedContacts.find((c) => c.id === selectedContactId) || null,
    [trustedContacts, selectedContactId]
  );

  const shareText = useMemo(() => {
    if (!payload) return '';
    return buildTripShareSummary({
      travelerName,
      title: payload.title,
      zone: payload.zone,
      dateLabel: payload.dateLabel,
      timeWindowLabel: payload.timeWindowLabel,
      pickupCode: payload.pickupCode,
      providerName: payload.providerName,
      providerVerified: payload.providerVerified,
      emergencyContact: userEmergencyContact,
      customNote,
    });
  }, [payload, travelerName, userEmergencyContact, customNote]);

  if (!payload) return null;

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setShareFeedback(
        selectedContact
          ? `Trip status copied — paste to ${selectedContact.name} (${selectedContact.phone}).`
          : 'Live trip status copied to clipboard.'
      );
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setShareFeedback('Unable to access clipboard automatically — select and copy text above.');
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `KaapConnect Trip Status: ${payload.title}`,
          text: shareText,
        });
        setShareFeedback('Shared trip status using device share sheet.');
      } catch {
        // User cancelled share sheet
      }
    } else {
      await handleCopySummary();
    }
  };

  const recipientEmail = selectedContact?.email || '';
  const mailtoHref = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(
    `KaapConnect Live Trip Status: ${payload.title}`
  )}&body=${encodeURIComponent(shareText)}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="trip-share-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#090D16]/70 p-2 sm:p-4 overflow-y-auto"
    >
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex items-start gap-2.5">
            <Share2 className="mt-0.5 h-5 w-5 text-[#1D4ED8] shrink-0" aria-hidden="true" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#1D4ED8]">
                Live Trip &amp; Pickup Status Share
              </p>
              <h2 id="trip-share-modal-title" className="font-display text-lg font-bold text-[#111827]">
                {payload.title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share trip status modal"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#111827]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 p-5 text-xs">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-[#111827]">{payload.zone}</span>
              <span className="font-mono text-[11px] text-slate-600 tabular-nums">
                {payload.dateLabel} · {payload.timeWindowLabel}
              </span>
            </div>
            {payload.pickupCode && (
              <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-[#EFF6FF] px-3 py-2 text-[#1E40AF]">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                  Booking / Pickup Verification Code
                </span>
                <span className="font-mono text-sm font-bold tracking-wider tabular-nums">
                  {payload.pickupCode}
                </span>
              </div>
            )}
            {payload.providerName && (
              <p className="inline-flex items-center gap-1.5 text-[11px] text-slate-700">
                <ShieldCheck className="h-3.5 w-3.5 text-[#15803D]" aria-hidden="true" />
                Operator: <strong>{payload.providerName}</strong> (
                {payload.providerVerified ? 'Safety Verified' : 'Audit Pending'})
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="share-trusted-recipient"
              className="flex items-center gap-1.5 font-semibold text-slate-700"
            >
              <Users className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
              Share With Trusted Contact
            </label>
            <select
              id="share-trusted-recipient"
              value={selectedContactId}
              onChange={(e) => setSelectedContactId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#111827] focus:border-[#1D4ED8] focus:outline-none"
            >
              {trustedContacts.map((tc) => (
                <option key={tc.id} value={tc.id}>
                  {tc.name} ({tc.relationship}) · {tc.phone}
                </option>
              ))}
              <option value="all">
                General Copy ({trustedContacts.length > 0 ? 'Any Companion / WhatsApp' : 'Copy Link / SMS Summary'})
              </option>
            </select>
          </div>

          <div>
            <label htmlFor="share-custom-note" className="block font-semibold text-slate-700">
              Optional Status Note (e.g. Gate, Vehicle Reg, ETA)
            </label>
            <input
              id="share-custom-note"
              type="text"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="e.g., Boarding verified shuttle at Clock Tower bay, back by 16:30"
              maxLength={160}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-[#111827] focus:border-[#1D4ED8] focus:outline-none"
            />
          </div>

          <div>
            <p className="mb-1 font-semibold text-slate-700">Shareable Trip Brief Preview</p>
            <pre className="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] text-slate-800 leading-relaxed">
              {shareText}
            </pre>
          </div>

          {shareFeedback && (
            <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-[#15803D]">
              {shareFeedback}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopySummary()}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] whitespace-nowrap"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {copied ? 'Copied Status' : 'Copy Trip Status'}
            </button>
            {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
              <button
                type="button"
                onClick={() => void handleNativeShare()}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#1D4ED8] bg-[#EFF6FF] px-3 py-2 text-xs font-semibold text-[#1E40AF] hover:bg-blue-100 whitespace-nowrap"
              >
                <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                Share
              </button>
            )}
            <a
              href={mailtoHref}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#111827] hover:bg-slate-50 whitespace-nowrap"
            >
              <Mail className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
              Email Contact
            </a>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
