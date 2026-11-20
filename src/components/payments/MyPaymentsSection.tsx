import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  CreditCard,
  Download,
  ExternalLink,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Wallet,
} from 'lucide-react';
import { StatusText } from '@/src/components/common/StatusText';
import { PaymentReceiptModal } from '@/src/components/payments/PaymentReceiptModal';
import { paymentService } from '@/src/services/paymentService';
import type {
  NavSectionId,
  PaymentRecord,
  ProviderPaymentSettings,
  SavedPaymentMethod,
} from '@/src/types/app';

interface MyPaymentsSectionProps {
  payments: PaymentRecord[];
  savedCards: SavedPaymentMethod[];
  providerSettingsList: ProviderPaymentSettings[];
  loading?: boolean;
  error?: string;
  onRefresh?: () => Promise<void> | void;
  onRemoveSavedCard: (cardId: string) => Promise<void> | void;
  onNavigate?: (section: NavSectionId) => void;
}

type PaymentFilterTab =
  | 'All'
  | 'Successful'
  | 'Pending'
  | 'Failed'
  | 'Refunds'
  | 'Pay in Person';

export const MyPaymentsSection: React.FC<MyPaymentsSectionProps> = ({
  payments,
  savedCards,
  providerSettingsList,
  loading = false,
  error = '',
  onRefresh,
  onRemoveSavedCard,
  onNavigate,
}) => {
  const [filterTab, setFilterTab] = useState<PaymentFilterTab>('All');
  const [activeReceipt, setActiveReceipt] = useState<PaymentRecord | null>(null);
  const [removingCardId, setRemovingCardId] = useState<string | null>(null);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (filterTab === 'Successful') {
        return p.paymentStatus === 'Paid' || p.paymentStatus === 'Partially Paid';
      }
      if (filterTab === 'Pending') {
        return p.paymentStatus === 'Payment Pending' || p.paymentStatus === 'Processing';
      }
      if (filterTab === 'Failed') {
        return p.paymentStatus === 'Failed';
      }
      if (filterTab === 'Refunds') {
        return p.paymentStatus === 'Refunded' || p.paymentStatus === 'Partially Refunded';
      }
      if (filterTab === 'Pay in Person') {
        return p.paymentMethod === 'Pay in Person' || (p.balanceDueInPerson ?? 0) > 0;
      }
      return true;
    });
  }, [payments, filterTab]);

  const totalSettledZar = payments
    .filter((p) => p.paymentStatus === 'Paid' || p.paymentStatus === 'Partially Paid')
    .reduce((sum, p) => sum + p.amount, 0);

  const outstandingInPersonZar = payments
    .filter((p) => p.paymentStatus === 'Unpaid' || p.paymentStatus === 'Partially Paid')
    .reduce((sum, p) => sum + (p.balanceDueInPerson ?? (p.paymentStatus === 'Unpaid' ? p.amount : 0)), 0);

  const refundedTotalZar = payments.reduce((sum, p) => sum + (p.refundedAmount || 0), 0);

  const getTone = (status: PaymentRecord['paymentStatus']) => {
    if (status === 'Paid' || status === 'Partially Paid') return 'nominal' as const;
    if (status === 'Failed') return 'alert' as const;
    return 'advisory' as const;
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold text-[#111827]">
              My Payments, Receipts &amp; Saved Cards
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-600">
            Track PayShap, tokenised card transactions, Pay in Person balances, refunds, and downloadable receipts for settled transactions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 overflow-x-auto max-w-full rounded-lg border border-slate-200 bg-slate-50 p-1">
            {(
              ['All', 'Successful', 'Pending', 'Failed', 'Refunds', 'Pay in Person'] as const
            ).map((tab) => (
              <button
                key={tab}
                type="button"
                aria-pressed={filterTab === tab}
                onClick={() => setFilterTab(tab)}
                className={`min-h-[36px] rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  filterTab === tab
                    ? 'bg-[#111827] text-white'
                    : 'text-slate-600 hover:text-[#111827]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {onRefresh && (
            <button
              type="button"
              disabled={loading}
              onClick={() => void onRefresh()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#111827] hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-[#1D4ED8] ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              {loading ? 'Refreshing...' : 'Refresh History'}
            </button>
          )}
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <p className="text-xs text-slate-500">Verified Payments Settled</p>
          <p className="mt-1 font-display text-xl font-bold text-[#15803D] tabular-nums">
            R {totalSettledZar.toLocaleString('en-ZA')}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <p className="text-xs text-slate-500">Outstanding Pay in Person</p>
          <p className="mt-1 font-display text-xl font-bold text-amber-800 tabular-nums">
            R {outstandingInPersonZar.toLocaleString('en-ZA')}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <p className="text-xs text-slate-500">Refunds Credited</p>
          <p className="mt-1 font-display text-xl font-bold text-[#111827] tabular-nums">
            R {refundedTotalZar.toLocaleString('en-ZA')}
          </p>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-red-700 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={() => void onRefresh()}
              className="rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-semibold text-red-800 hover:bg-red-100 self-start sm:self-auto"
            >
              Retry Fetch
            </button>
          )}
        </div>
      )}

      {/* Transactions List */}
      <div className="divide-y divide-slate-200">
        {loading && payments.length === 0 ? (
          <div className="space-y-3 py-4" aria-label="Loading payment history">
            {[1, 2, 3].map((row) => (
              <div
                key={row}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4 animate-pulse"
              >
                <div className="space-y-2">
                  <div className="h-3 w-48 rounded bg-slate-200" />
                  <div className="h-4 w-64 rounded bg-slate-200" />
                </div>
                <div className="h-5 w-24 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="py-8 text-center space-y-3">
            <p className="text-xs text-slate-500">
              {payments.length === 0
                ? 'No transactions have been recorded for your account yet.'
                : `No payment records match the "${filterTab}" filter.`}
            </p>
            {payments.length === 0 && onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('bookings')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] whitespace-nowrap"
              >
                Browse Bookable Experiences
              </button>
            )}
          </div>
        ) : (
          filteredPayments.map((pay) => {
            const isSettled =
              pay.paymentStatus === 'Paid' ||
              pay.paymentStatus === 'Partially Paid' ||
              pay.paymentStatus === 'Refunded' ||
              pay.paymentStatus === 'Partially Refunded';
            const provSettings = providerSettingsList.find(
              (s) => s.providerId === pay.providerId
            );

            return (
              <article
                key={pay.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1 text-xs">
                  <div className="flex flex-wrap items-center gap-2 text-slate-500">
                    <span className="font-mono font-semibold text-[#1D4ED8]">
                      {pay.bookingReference}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{pay.paymentReference}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-slate-700">
                      {pay.paymentMethod}
                      {pay.cardLastFour ? ` •••• ${pay.cardLastFour}` : ''}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-[11px]">
                      {pay.paymentMode === 'live' ? 'Live SA PSP' : 'Demo Sandbox'}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-[#111827]">{pay.serviceTitle}</p>
                  <p className="text-slate-600">
                    {pay.providerName} · Updated {pay.paidAtLabel || pay.updatedAtLabel}
                  </p>
                  {isSettled && pay.receiptNumber && (
                    <p className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setActiveReceipt(pay)}
                        className="inline-flex items-center gap-1 font-mono font-semibold text-[#1D4ED8] underline underline-offset-2 hover:text-[#1E40AF]"
                      >
                        <Receipt className="h-3 w-3" aria-hidden="true" />
                        Receipt #{pay.receiptNumber}
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </button>
                      <span aria-hidden="true" className="text-slate-400">·</span>
                      <button
                        type="button"
                        onClick={() => paymentService.downloadReceipt(pay)}
                        className="inline-flex items-center gap-1 font-semibold text-[#111827] underline underline-offset-2 hover:text-[#1D4ED8]"
                      >
                        <Download className="h-3 w-3" aria-hidden="true" />
                        Download (.txt)
                      </button>
                    </p>
                  )}
                  {pay.paymentMethod === 'Pay in Person' && pay.paymentStatus === 'Unpaid' && provSettings && (
                    <p className="inline-flex items-center gap-1 text-[11px] text-amber-800">
                      <Banknote className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      Due {provSettings.paymentDueTiming} at {provSettings.paymentLocation} (
                      {provSettings.acceptedInPersonMethods.join(', ')})
                    </p>
                  )}
                  {typeof pay.balanceDueInPerson === 'number' &&
                    pay.balanceDueInPerson > 0 &&
                    pay.paymentStatus === 'Partially Paid' && (
                      <p className="text-[11px] font-medium text-amber-800">
                        Deposit paid · Remaining balance due in person: R{' '}
                        {pay.balanceDueInPerson.toLocaleString('en-ZA')}
                      </p>
                    )}
                  {pay.failureReason && (
                    <p className="text-[11px] font-medium text-red-700">
                      Reason: {pay.failureReason}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-start gap-2 sm:items-end shrink-0">
                  <div className="text-left sm:text-right">
                    <p className="font-mono text-base font-bold text-[#111827] tabular-nums">
                      R {pay.amount.toLocaleString('en-ZA')}
                    </p>
                    <StatusText label={pay.paymentStatus} tone={getTone(pay.paymentStatus)} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveReceipt(pay)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-[#111827] hover:bg-slate-50 whitespace-nowrap"
                    >
                      <Receipt className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
                      {isSettled ? 'View Receipt' : 'View Payment Slip'}
                    </button>
                    {(pay.paymentStatus === 'Failed' ||
                      pay.paymentStatus === 'Payment Pending') &&
                      onNavigate && (
                        <button
                          type="button"
                          onClick={() => onNavigate('bookings')}
                          className="inline-flex items-center gap-1 rounded-md bg-[#1D4ED8] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#1E40AF] whitespace-nowrap"
                        >
                          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                          Retry in Bookings
                        </button>
                      )}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Saved Payment Methods */}
      <div className="border-t border-slate-200 pt-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-[#111827]" aria-hidden="true" />
            <h3 className="font-display text-sm font-bold text-[#111827]">
              Saved Tokenised Cards ({savedCards.length})
            </h3>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
            Tokenised only · Full PAN &amp; CVV never stored
          </span>
        </div>

        {savedCards.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs text-slate-500">
            No saved cards on file. You may save a Visa or Mastercard token during checkout.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {savedCards.map((card) => (
              <div
                key={card.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs"
              >
                <div>
                  <p className="font-semibold text-[#111827]">
                    {card.cardBrand} •••• {card.lastFourDigits}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {card.cardholderName} · Exp {card.expiryMonth}/{card.expiryYear} ·{' '}
                    {card.paymentMode === 'live' ? 'Live Token' : 'Sandbox Token'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={removingCardId === card.id}
                  onClick={async () => {
                    setRemovingCardId(card.id);
                    try {
                      await onRemoveSavedCard(card.id);
                    } finally {
                      setRemovingCardId(null);
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded border border-red-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <PaymentReceiptModal payment={activeReceipt} onClose={() => setActiveReceipt(null)} />
    </section>
  );
};
