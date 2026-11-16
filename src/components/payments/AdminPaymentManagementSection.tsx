import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  CreditCard,
  History,
  Receipt,
  RotateCcw,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { StatusText } from '@/src/components/common/StatusText';
import { PaymentReceiptModal } from '@/src/components/payments/PaymentReceiptModal';
import type {
  PaymentAuditLog,
  PaymentMethodType,
  PaymentRecord,
  PaymentStatus,
} from '@/src/types/app';

interface AdminPaymentManagementSectionProps {
  payments: PaymentRecord[];
  auditLogs: PaymentAuditLog[];
  onIssueRefund: (
    paymentId: string,
    refundAmountZar: number,
    reason: string
  ) => Promise<void>;
}

export const AdminPaymentManagementSection: React.FC<AdminPaymentManagementSectionProps> = ({
  payments,
  auditLogs,
  onIssueRefund,
}) => {
  const [methodFilter, setMethodFilter] = useState<'All' | PaymentMethodType>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | PaymentStatus>('All');
  const [providerFilter, setProviderFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeReceipt, setActiveReceipt] = useState<PaymentRecord | null>(null);

  // Refund controls
  const [refundTarget, setRefundTarget] = useState<PaymentRecord | null>(null);
  const [refundAmountInput, setRefundAmountInput] = useState('');
  const [refundReason, setRefundReason] = useState('Service cancellation / policy refund');
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundMsg, setRefundMsg] = useState('');
  const [refundErr, setRefundErr] = useState('');

  const uniqueProviders = useMemo(
    () => Array.from(new Set(payments.map((p) => p.providerName).filter(Boolean))).sort(),
    [payments]
  );

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const matchesMethod = methodFilter === 'All' || p.paymentMethod === methodFilter;
      const matchesStatus = statusFilter === 'All' || p.paymentStatus === statusFilter;
      const matchesProvider = providerFilter === 'All' || p.providerName === providerFilter;
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !q ||
        p.bookingReference.toLowerCase().includes(q) ||
        p.paymentReference.toLowerCase().includes(q) ||
        p.serviceTitle.toLowerCase().includes(q) ||
        (p.userName || '').toLowerCase().includes(q);
      return matchesMethod && matchesStatus && matchesProvider && matchesSearch;
    });
  }, [payments, methodFilter, statusFilter, providerFilter, searchTerm]);

  // KPIs
  const settledPayments = payments.filter(
    (p) => p.paymentStatus === 'Paid' || p.paymentStatus === 'Partially Paid'
  );
  const totalVolumeZar = settledPayments.reduce((s, p) => s + p.amount, 0);
  const pendingCount = payments.filter(
    (p) => p.paymentStatus === 'Payment Pending' || p.paymentStatus === 'Processing'
  ).length;
  const failedCount = payments.filter((p) => p.paymentStatus === 'Failed').length;
  const refundedZar = payments.reduce((s, p) => s + (p.refundedAmount || 0), 0);
  const outstandingInPersonZar = payments
    .filter((p) => p.paymentStatus === 'Unpaid' || p.paymentStatus === 'Partially Paid')
    .reduce(
      (s, p) =>
        s + (p.balanceDueInPerson ?? (p.paymentStatus === 'Unpaid' ? p.amount : 0)),
      0
    );

  // Analytics Breakdowns (Revenue by Payment Method + by Service Provider)
  const methodTotals = useMemo(() => {
    const map: Record<PaymentMethodType, number> = {
      PayShap: 0,
      Card: 0,
      'Pay in Person': 0,
    };
    settledPayments.forEach((p) => {
      map[p.paymentMethod] = (map[p.paymentMethod] || 0) + p.amount;
    });
    const maxVal = Math.max(1, ...Object.values(map));
    return (['PayShap', 'Card', 'Pay in Person'] as PaymentMethodType[]).map((method) => ({
      method,
      totalZar: map[method],
      pct: Math.round((map[method] / maxVal) * 100),
    }));
  }, [settledPayments]);

  const providerTotals = useMemo(() => {
    const map = new Map<string, number>();
    settledPayments.forEach((p) => {
      map.set(p.providerName, (map.get(p.providerName) || 0) + p.amount);
    });
    const sorted = Array.from(map.entries())
      .map(([name, totalZar]) => ({ name, totalZar }))
      .sort((a, b) => b.totalZar - a.totalZar)
      .slice(0, 5);
    const maxVal = Math.max(1, ...sorted.map((r) => r.totalZar));
    return sorted.map((r) => ({ ...r, pct: Math.round((r.totalZar / maxVal) * 100) }));
  }, [settledPayments]);

  const handleConfirmRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundTarget) return;
    setRefundMsg('');
    setRefundErr('');
    const maxRefundable = Math.max(0, refundTarget.amount - (refundTarget.refundedAmount || 0));
    const amt = Math.round(Number(refundAmountInput));
    if (!Number.isFinite(amt) || amt <= 0 || amt > maxRefundable) {
      setRefundErr(`Enter a refund amount between R 1 and R ${maxRefundable.toLocaleString('en-ZA')}.`);
      return;
    }

    setRefundBusy(true);
    try {
      await onIssueRefund(
        refundTarget.id,
        amt,
        refundReason.trim() || 'Authorized admin refund'
      );
      setRefundMsg(
        `Processed R ${amt.toLocaleString('en-ZA')} refund for ${refundTarget.paymentReference}.`
      );
      setRefundTarget(null);
    } catch (err) {
      setRefundErr(err instanceof Error ? err.message : 'Unable to process refund.');
    } finally {
      setRefundBusy(false);
    }
  };

  return (
    <section className="space-y-6 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold text-[#111827]">
              Payment Operations, Revenue Analytics &amp; Audit Ledger
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-600">
            Monitor PayShap, tokenised card, and Pay in Person collections across Cape Town providers, issue policy refunds, and inspect the immutable payment audit log.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-md border border-[#1D4ED8]/30 bg-[#EFF6FF] px-2.5 py-1 text-[11px] font-semibold text-[#1E40AF]">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          PSP Verification Enforced
        </span>
      </div>

      {/* Security Rule Banner */}
      <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#111827]" aria-hidden="true" />
        <p>
          <strong>Governance Control:</strong> Administrators may review transactions, verify references, and issue refunds. Online PayShap and Card payments cannot be manually marked as <strong>Paid</strong> without verified payment gateway confirmation.
        </p>
      </div>

      {/* 6 KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Settled Volume</span>
            <Wallet className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
          </div>
          <p className="mt-1 font-display text-lg font-bold text-[#111827] tabular-nums">
            R {totalVolumeZar.toLocaleString('en-ZA')}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Successful</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-[#15803D]" aria-hidden="true" />
          </div>
          <p className="mt-1 font-display text-lg font-bold text-[#15803D] tabular-nums">
            {settledPayments.length}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Pending Online</span>
            <CreditCard className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
          </div>
          <p className="mt-1 font-display text-lg font-bold text-amber-800 tabular-nums">
            {pendingCount}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Failed</span>
            <AlertCircle className="h-3.5 w-3.5 text-red-700" aria-hidden="true" />
          </div>
          <p className="mt-1 font-display text-lg font-bold text-red-700 tabular-nums">
            {failedCount}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Refunded</span>
            <RotateCcw className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" />
          </div>
          <p className="mt-1 font-display text-lg font-bold text-[#111827] tabular-nums">
            R {refundedZar.toLocaleString('en-ZA')}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Due In Person</span>
            <Banknote className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
          </div>
          <p className="mt-1 font-display text-lg font-bold text-amber-800 tabular-nums">
            R {outstandingInPersonZar.toLocaleString('en-ZA')}
          </p>
        </div>
      </div>

      {/* Revenue Analytics Bar Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4 space-y-3">
          <h3 className="font-display text-sm font-bold text-[#111827]">
            Settled Revenue by Payment Method
          </h3>
          <div className="space-y-2.5 text-xs">
            {methodTotals.map((row) => (
              <div key={row.method} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">{row.method}</span>
                  <span className="font-mono font-semibold text-[#111827] tabular-nums">
                    R {row.totalZar.toLocaleString('en-ZA')}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#1D4ED8] transition-all"
                    style={{ width: `${row.totalZar === 0 ? 0 : Math.max(4, row.pct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-4 space-y-3">
          <h3 className="font-display text-sm font-bold text-[#111827]">
            Top Providers by Settled Revenue (ZAR)
          </h3>
          <div className="space-y-2.5 text-xs">
            {providerTotals.length === 0 ? (
              <p className="text-slate-500">No settled provider transactions yet.</p>
            ) : (
              providerTotals.map((row) => (
                <div key={row.name} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-700 truncate">{row.name}</span>
                    <span className="font-mono font-semibold text-[#111827] tabular-nums shrink-0">
                      R {row.totalZar.toLocaleString('en-ZA')}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#111827] transition-all"
                      style={{ width: `${row.totalZar === 0 ? 0 : Math.max(4, row.pct)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 sm:grid-cols-4 text-xs">
        <div>
          <label htmlFor="adm-pay-search" className="block font-semibold text-slate-600">
            Search Ref / Service
          </label>
          <input
            id="adm-pay-search"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="PAY-PS-, CS-BK-, tourist..."
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5"
          />
        </div>
        <div>
          <label htmlFor="adm-pay-method" className="block font-semibold text-slate-600">
            Payment Method
          </label>
          <select
            id="adm-pay-method"
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value as 'All' | PaymentMethodType)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5"
          >
            <option value="All">All Methods</option>
            <option value="PayShap">PayShap</option>
            <option value="Card">Card</option>
            <option value="Pay in Person">Pay in Person</option>
          </select>
        </div>
        <div>
          <label htmlFor="adm-pay-status" className="block font-semibold text-slate-600">
            Payment Status
          </label>
          <select
            id="adm-pay-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'All' | PaymentStatus)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5"
          >
            <option value="All">All Statuses</option>
            <option value="Paid">Paid</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Payment Pending">Payment Pending</option>
            <option value="Unpaid">Unpaid</option>
            <option value="Failed">Failed</option>
            <option value="Refunded">Refunded</option>
            <option value="Partially Refunded">Partially Refunded</option>
          </select>
        </div>
        <div>
          <label htmlFor="adm-pay-prov" className="block font-semibold text-slate-600">
            Service Provider
          </label>
          <select
            id="adm-pay-prov"
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5"
          >
            <option value="All">All Providers</option>
            {uniqueProviders.map((prov) => (
              <option key={prov} value={prov}>
                {prov}
              </option>
            ))}
          </select>
        </div>
      </div>

      {refundMsg && (
        <p role="status" className="rounded-lg bg-[#F0FDF4] px-3 py-2 text-xs font-medium text-[#15803D]">
          {refundMsg}
        </p>
      )}
      {refundErr && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {refundErr}
        </p>
      )}

      {/* Refund Drawer */}
      {refundTarget && (
        <form
          onSubmit={handleConfirmRefund}
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3 text-xs"
        >
          <div className="flex items-center justify-between">
            <p className="font-bold text-[#111827]">
              Issue Policy Refund — {refundTarget.paymentReference} ({refundTarget.serviceTitle})
            </p>
            <button
              type="button"
              onClick={() => setRefundTarget(null)}
              className="text-slate-600 hover:text-[#111827] font-semibold"
            >
              Cancel
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="refund-amt" className="block font-semibold text-slate-700">
                Refund Amount (ZAR)
              </label>
              <input
                id="refund-amt"
                type="number"
                min={1}
                max={Math.max(1, refundTarget.amount - (refundTarget.refundedAmount || 0))}
                value={refundAmountInput}
                onChange={(e) => setRefundAmountInput(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 font-mono"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="refund-reason" className="block font-semibold text-slate-700">
                Refund Justification
              </label>
              <input
                id="refund-reason"
                type="text"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={refundBusy}
            className="rounded-lg bg-[#111827] px-4 py-1.5 font-semibold text-white hover:bg-[#1E293B] disabled:opacity-60"
          >
            {refundBusy ? 'Processing Refund...' : 'Confirm Refund'}
          </button>
        </form>
      )}

      {/* Transactions Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
            <tr>
              <th className="px-4 py-3">Booking / Ref</th>
              <th className="px-4 py-3">Service &amp; Provider</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Amount (ZAR)</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredPayments.map((pay) => {
              const canRefund =
                pay.paymentStatus === 'Paid' ||
                pay.paymentStatus === 'Partially Paid' ||
                pay.paymentStatus === 'Partially Refunded';
              return (
                <tr key={pay.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <p className="font-mono font-semibold text-[#111827]">{pay.bookingReference}</p>
                    <p className="font-mono text-[11px] text-slate-500">{pay.paymentReference}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#111827]">{pay.serviceTitle}</p>
                    <p className="text-[11px] text-slate-500">
                      {pay.providerName} · {pay.userName || pay.userId}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span>{pay.paymentMethod}</span>
                    {pay.cardLastFour && (
                      <p className="font-mono text-[11px] text-slate-500">
                        {pay.cardBrand} •••• {pay.cardLastFour}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-[#111827] tabular-nums">
                    R {pay.amount.toLocaleString('en-ZA')}
                    {pay.refundedAmount ? (
                      <p className="text-[10px] font-normal text-slate-500">
                        Refunded R {pay.refundedAmount.toLocaleString('en-ZA')}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <StatusText
                      label={pay.paymentStatus}
                      tone={
                        pay.paymentStatus === 'Paid' || pay.paymentStatus === 'Partially Paid'
                          ? 'nominal'
                          : pay.paymentStatus === 'Failed'
                          ? 'alert'
                          : 'advisory'
                      }
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setActiveReceipt(pay)}
                        className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-[#111827] hover:bg-slate-50"
                      >
                        <Receipt className="h-3 w-3 text-[#1D4ED8]" aria-hidden="true" />
                        Inspect
                      </button>
                      {canRefund && (
                        <button
                          type="button"
                          onClick={() => {
                            setRefundTarget(pay);
                            setRefundAmountInput(
                              String(Math.max(1, pay.amount - (pay.refundedAmount || 0)))
                            );
                            setRefundErr('');
                            setRefundMsg('');
                          }}
                          className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
                        >
                          <RotateCcw className="h-3 w-3" aria-hidden="true" />
                          Refund
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Immutable Audit Ledger */}
      <div className="space-y-3 border-t border-slate-200 pt-4">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-[#111827]" aria-hidden="true" />
          <h3 className="font-display text-sm font-bold text-[#111827]">
            Immutable Payment Audit Ledger ({auditLogs.length})
          </h3>
        </div>
        <div className="max-h-60 overflow-y-auto divide-y divide-slate-200 rounded-xl border border-slate-200 text-xs">
          {auditLogs.slice(0, 15).map((log) => (
            <div key={log.id} className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="font-mono font-semibold text-[#1D4ED8]">{log.action}</span>
                <span className="text-slate-600">
                  {' '}
                  · {log.actorRole} · {log.notes}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0 font-mono text-[11px] text-slate-500">
                <span>R {log.amountZar.toLocaleString('en-ZA')}</span>
                <span>{log.newStatus}</span>
                <span>{log.timestampLabel}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <PaymentReceiptModal payment={activeReceipt} onClose={() => setActiveReceipt(null)} />
    </section>
  );
};
