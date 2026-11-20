import React from 'react';
import { CheckCircle2, Clock, Download, Printer, ShieldCheck, X } from 'lucide-react';
import { StatusText } from '@/src/components/common/StatusText';
import { paymentService } from '@/src/services/paymentService';
import type { PaymentRecord } from '@/src/types/app';
import { derivePickupVerificationCode } from '@/src/utils/bookingCalculations';

interface PaymentReceiptModalProps {
  payment: PaymentRecord | null;
  onClose: () => void;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  payment,
  onClose,
}) => {
  if (!payment) return null;

  const isReceiptEligible =
    payment.paymentStatus === 'Paid' ||
    payment.paymentStatus === 'Partially Paid' ||
    payment.paymentStatus === 'Refunded' ||
    payment.paymentStatus === 'Partially Refunded';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-receipt-heading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#090D16]/60 p-2 sm:p-4 overflow-y-auto"
    >
      <div className="w-full max-w-lg max-h-[94vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#1D4ED8]">
              {isReceiptEligible ? 'Verified Transaction Receipt' : 'Booking Payment Slip'}
            </p>
            <h2
              id="payment-receipt-heading"
              className="mt-0.5 font-display text-lg font-bold text-[#111827]"
            >
              {payment.receiptNumber || payment.paymentReference}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close receipt modal"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#111827]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 p-5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              {isReceiptEligible ? (
                <CheckCircle2 className="h-4 w-4 text-[#15803D]" aria-hidden="true" />
              ) : (
                <Clock className="h-4 w-4 text-amber-700" aria-hidden="true" />
              )}
              <StatusText
                label={payment.paymentStatus}
                tone={
                  payment.paymentStatus === 'Paid' || payment.paymentStatus === 'Partially Paid'
                    ? 'nominal'
                    : payment.paymentStatus === 'Failed'
                    ? 'alert'
                    : 'advisory'
                }
              />
            </div>
            <span className="rounded bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700 border border-slate-200">
              {payment.paymentMode === 'live' ? 'Live SA PSP' : 'Demo Sandbox Mode'}
            </span>
          </div>

          {!isReceiptEligible && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
              This record is currently <strong>{payment.paymentStatus}</strong>. Official payment receipts are issued only once verified settlement or provider in-person collection is confirmed.
            </div>
          )}

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 rounded-lg border border-slate-200 p-4">
            <div>
              <dt className="text-[11px] text-slate-500">Booking Reference</dt>
              <dd className="font-mono font-semibold text-[#111827]">{payment.bookingReference}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-500">Pickup / Handoff Verification Code</dt>
              <dd className="font-mono font-bold text-[#1D4ED8] tabular-nums">
                {derivePickupVerificationCode(payment.bookingId, payment.bookingReference)}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[11px] text-slate-500">Transaction Reference</dt>
              <dd className="font-mono font-semibold text-[#111827] break-all">
                {payment.paymentReference}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[11px] text-slate-500">Experience / Service</dt>
              <dd className="font-semibold text-[#111827]">{payment.serviceTitle}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-500">Tourism Provider</dt>
              <dd className="font-medium text-slate-800">{payment.providerName}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-500">Payment Method</dt>
              <dd className="font-medium text-slate-800">
                {payment.paymentMethod}
                {payment.cardLastFour ? ` (${payment.cardBrand || 'Card'} •••• ${payment.cardLastFour})` : ''}
                {payment.inPersonMethodUsed ? ` · ${payment.inPersonMethodUsed}` : ''}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-500">Booking Total</dt>
              <dd className="font-mono font-semibold text-[#111827] tabular-nums">
                R {payment.bookingTotalZar.toLocaleString('en-ZA')}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-500">
                {payment.paymentStatus === 'Unpaid' ? 'Amount Due' : 'Amount Settled'}
              </dt>
              <dd className="font-mono text-base font-bold text-[#111827] tabular-nums">
                R {payment.amount.toLocaleString('en-ZA')}
              </dd>
            </div>
            {typeof payment.balanceDueInPerson === 'number' && payment.balanceDueInPerson > 0 && (
              <div className="sm:col-span-2 rounded bg-amber-50 px-2.5 py-1.5 text-amber-900">
                Remaining Balance Due in Person:{' '}
                <strong className="font-mono tabular-nums">
                  R {payment.balanceDueInPerson.toLocaleString('en-ZA')}
                </strong>
              </div>
            )}
            {typeof payment.refundedAmount === 'number' && payment.refundedAmount > 0 && (
              <div className="sm:col-span-2 rounded bg-slate-100 px-2.5 py-1.5 text-slate-800">
                Refunded Amount:{' '}
                <strong className="font-mono tabular-nums">
                  R {payment.refundedAmount.toLocaleString('en-ZA')}
                </strong>
              </div>
            )}
            {payment.paymentProviderReference && (
              <div className="sm:col-span-2">
                <dt className="text-[11px] text-slate-500">Gateway Verification Ref</dt>
                <dd className="font-mono text-[11px] text-slate-700 break-all">
                  {payment.paymentProviderReference}
                </dd>
              </div>
            )}
            <div className="sm:col-span-2">
              <dt className="text-[11px] text-slate-500">Updated</dt>
              <dd className="text-slate-700">{payment.paidAtLabel || payment.updatedAtLabel}</dd>
            </div>
          </dl>

          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="h-4 w-4 text-[#1D4ED8] shrink-0" aria-hidden="true" />
            <span>No complete card numbers or CVV security codes are stored by CapeSafe Connect 360.</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-3.5">
          {isReceiptEligible && (
            <>
              <button
                type="button"
                onClick={() => paymentService.printReceipt(payment)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#111827] hover:bg-slate-50"
              >
                <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                Print Receipt
              </button>
              <button
                type="button"
                onClick={() => paymentService.downloadReceipt(payment)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1E40AF]"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Download Receipt
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#111827] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1E293B]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
