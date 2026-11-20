import React, { useState } from 'react';
import { Check, Copy, Mountain, Phone, ShieldAlert, Users, Waves, X } from 'lucide-react';
import type { DemoUser, NavSectionId, TrustedContact } from '@/src/types/app';
import { EMERGENCY_CONTACTS } from '@/src/utils/safetyGuidance';

interface EmergencyContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: DemoUser;
  trustedContacts?: TrustedContact[];
  onNavigate?: (section: NavSectionId) => void;
}

export const EmergencyContactsModal: React.FC<EmergencyContactsModalProps> = ({
  isOpen,
  onClose,
  user,
  trustedContacts = [],
  onNavigate,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = async (id: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 1800);
    } catch {
      setCopiedId(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="emergency-contacts-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#090D16]/70 p-2 sm:p-4 overflow-y-auto"
    >
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-[#111827] px-5 py-4 text-white">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-red-400 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-300">
                Cape Town &amp; Western Cape Emergency Directory
              </p>
              <h2
                id="emergency-contacts-modal-title"
                className="font-display text-lg font-bold text-white"
              >
                10111 &amp; Rapid Rescue Contacts
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close emergency contacts modal"
            className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-5 p-5 text-xs">
          {/* Primary National / Metro Response */}
          <div className="grid gap-2.5 sm:grid-cols-3">
            {EMERGENCY_CONTACTS.filter((c) => c.priority === 'primary').map((contact) => (
              <div
                key={contact.id}
                className="flex flex-col justify-between rounded-xl border border-red-200 bg-red-50/70 p-3.5"
              >
                <div>
                  <p className="font-bold text-red-950">{contact.service}</p>
                  <p className="mt-1 font-mono text-2xl font-bold text-red-700 tabular-nums">
                    {contact.number}
                  </p>
                  <p className="mt-1 text-[11px] text-red-900/90 leading-snug">{contact.scope}</p>
                </div>
                <div className="mt-3 flex items-center gap-1.5">
                  <a
                    href={contact.telHref}
                    className="inline-flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-800 whitespace-nowrap"
                  >
                    <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                    Call {contact.number}
                  </a>
                  <button
                    type="button"
                    onClick={() => void handleCopy(contact.id, contact.number)}
                    aria-label={`Copy ${contact.service} number`}
                    className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-red-200 bg-white px-2.5 text-red-800 hover:bg-red-100"
                  >
                    {copiedId === contact.id ? (
                      <Check className="h-3.5 w-3.5 text-[#15803D]" aria-hidden="true" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Specialized Mountain, Sea, Medical & Visitor Support */}
          <div className="space-y-2">
            <h3 className="font-display text-sm font-bold text-[#111827]">
              Mountain, Sea, Medical &amp; Visitor Rescue Units
            </h3>
            <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
              {EMERGENCY_CONTACTS.filter((c) => c.priority !== 'primary').map((contact) => (
                <div
                  key={contact.id}
                  className="flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {contact.id === 'emg-wsar' && (
                        <Mountain className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
                      )}
                      {contact.id === 'emg-nsri' && (
                        <Waves className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
                      )}
                      <span className="font-bold text-[#111827]">{contact.service}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                        {contact.availability}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">{contact.scope}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={contact.telHref}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[#111827] px-3 py-1.5 font-mono text-xs font-semibold text-white hover:bg-[#1E293B] whitespace-nowrap tabular-nums"
                    >
                      <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                      {contact.number}
                    </a>
                    <button
                      type="button"
                      onClick={() => void handleCopy(contact.id, contact.number)}
                      aria-label={`Copy ${contact.service} number`}
                      className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-slate-300 bg-white px-2.5 text-slate-700 hover:bg-slate-50"
                    >
                      {copiedId === contact.id ? (
                        <Check className="h-3.5 w-3.5 text-[#15803D]" aria-hidden="true" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Personal Trusted Contacts / ICE */}
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
                <h3 className="font-display text-sm font-bold text-[#111827]">
                  Your Personal &amp; Trusted Contacts
                </h3>
              </div>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigate('check-in');
                  }}
                  className="text-xs font-semibold text-[#1D4ED8] hover:underline"
                >
                  Manage in Check-In &amp; ICE
                </button>
              )}
            </div>

            {user?.emergencyContact && (
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                Primary Profile ICE: <strong className="text-[#111827]">{user.emergencyContact}</strong>
              </div>
            )}

            {trustedContacts.length === 0 ? (
              <p className="text-[11px] text-slate-600">
                No extra trusted contacts saved yet. Add family or group companions inside Safe Check-In for 1-click trip status sharing.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {trustedContacts.map((tc) => (
                  <div
                    key={tc.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#111827]">{tc.name}</p>
                      <p className="truncate text-[11px] text-slate-500">{tc.relationship}</p>
                    </div>
                    <a
                      href={`tel:${tc.phone.replace(/[^+\d]/g, '')}`}
                      className="inline-flex items-center gap-1 rounded border border-[#1D4ED8] bg-[#EFF6FF] px-2 py-1 font-mono text-[11px] font-semibold text-[#1E40AF] hover:bg-blue-100 whitespace-nowrap tabular-nums"
                    >
                      <Phone className="h-3 w-3" aria-hidden="true" />
                      {tc.phone}
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-3.5">
          {onNavigate ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate('safety');
              }}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#111827] hover:bg-slate-50"
            >
              Open Full Safety Centre
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#111827] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E293B]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
