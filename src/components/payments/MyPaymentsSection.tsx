import React, { useMemo, useState } from 'react';
import {
  Banknote,
  CreditCard,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Wallet,
} from 'lucide-react';
import { StatusText } from '@/src/components/common/StatusText';
import { PaymentReceiptModal } from '@/src/components/payments/PaymentReceiptModal';
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
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-[#0D9488]" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
              My Payments, Receipts &amp; Saved Cards
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-600">
            Track PayShap, tokenised card transactions, Pay in Person balances, refunds, and downloadable receipts.
          </p>
        </div>

        <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
          {(
            ['All', 'Successful', 'Pending', 'Failed', 'Refunds', 'Pay in Person'] as const
          ).map((tab) => (
            <button
              key={tab}
              type="button"
              aria-pressed={filterTab === tab}
              onClick={() => setFilterTab(tab)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                filterTab === tab
                  ? 'bg-[#0B1F3A] text-white'
                  : 'text-slate-600 hover:text-[#0B1F3A]'
              }`}
            >
              {tab}
            </button>
          ))}
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
          <p className="mt-1 font-display text-xl font-bold text-[#0B1F3A] tabular-nums">
            R {refundedTotalZar.toLocaleString('en-ZA')}
          </p>
        </div>
      </div>

      {/* Transactions List */}
      <div className="divide-y divide-slate-200">
        {filteredPayments.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500">
            No payment records match the "{filterTab}" filter.
          </p>
        ) : (
          filteredPayments.map((pay) => {
            const hasReceipt =
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
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold text-[#0D9488]">
                      {pay.bookingReference}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-slate-500">{pay.paymentReference}</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                      {pay.paymentMethod}
                      {pay.cardLastFour ? ` •••• ${pay.cardLastFour}` : ''}
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                      {pay.paymentMode === 'live' ? 'Live' : 'Demo'}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-[#0B1F3A]">{pay.serviceTitle}</p>
                  <p className="text-slate-600">
                    {pay.providerName} · Updated {pay.paidAtLabel || pay.updatedAtLabel}
                  </p>
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

                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <div className="text-left sm:text-right">
                    <p className="font-mono text-base font-bold text-[#0B1F3A] tabular-nums">
                      R {pay.amount.toLocaleString('en-ZA')}
                    </p>
                    <StatusText label={pay.paymentStatus} tone={getTone(pay.paymentStatus)} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveReceipt(pay)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-[#0B1F3A] hover:bg-slate-50"
                    >
                      <Receipt className="h-3.5 w-3.5 text-[#0D9488]" aria-hidden="true" />
                      {hasReceipt ? 'View Receipt' : 'View Slip'}
                    </button>
                    {(pay.paymentStatus === 'Failed' ||
                      pay.paymentStatus === 'Payment Pending') &&
                      onNavigate && (
                        <button
                          type="button"
                          onClick={() => onNavigate('bookings')}
                          className="inline-flex items-center gap-1 rounded-md bg-[#0D9488] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#0F766E]"
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
            <CreditCard className="h-4 w-4 text-[#0B1F3A]" aria-hidden="true" />
            <h3 className="font-display text-sm font-bold text-[#0B1F3A]">
              Saved Tokenised Cards ({savedCards.length})
            </h3>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-[#0D9488]" aria-hidden="true" />
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
                  <p className="font-semibold text-[#0B1F3A]">
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
