import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, CheckCircle2, Settings, Wallet } from 'lucide-react';
import { StatusText } from '@/src/components/common/StatusText';
import type {
  BookingItem,
  DemoUser,
  InPersonPaymentMethod,
  PaymentDueTiming,
  PaymentRecord,
  ProviderPaymentPolicy,
  ProviderPaymentSettings,
} from '@/src/types/app';
import {
  DEFAULT_PROVIDER_PAYMENT_SETTINGS,
  PAYMENT_POLICY_META,
} from '@/src/utils/bookingCalculations';

interface ProviderPaymentSettingsSectionProps {
  user: DemoUser;
  settings?: ProviderPaymentSettings | null;
  providerPayments: PaymentRecord[];
  providerBookings: BookingItem[];
  onSaveSettings: (
    settings: Omit<ProviderPaymentSettings, 'id' | 'providerId' | 'updatedAtLabel' | 'dataOrigin'>
  ) => Promise<void>;
  onMarkInPersonPaid: (
    paymentId: string,
    bookingId: string,
    methodUsed: InPersonPaymentMethod
  ) => Promise<void>;
}

const ALL_IN_PERSON_METHODS: InPersonPaymentMethod[] = [
  'Cash',
  'Card Machine',
  'EFT',
  'SnapScan',
  'Zapper',
];

const DUE_TIMING_OPTIONS: PaymentDueTiming[] = [
  'On Arrival',
  'Before Service Begins',
  'Upon Check-in',
  'Within 24 Hours Before Service',
];

export const ProviderPaymentSettingsSection: React.FC<ProviderPaymentSettingsSectionProps> = ({
  user,
  settings,
  providerPayments,
  providerBookings,
  onSaveSettings,
  onMarkInPersonPaid,
}) => {
  const effective = settings || {
    ...DEFAULT_PROVIDER_PAYMENT_SETTINGS,
    id: user.id,
    providerId: user.id,
    providerName: user.organization || user.name,
    updatedAtLabel: 'Default',
    dataOrigin: 'demo' as const,
  };

  const [payInPersonEnabled, setPayInPersonEnabled] = useState(effective.payInPersonEnabled);
  const [acceptedMethods, setAcceptedMethods] = useState<InPersonPaymentMethod[]>(
    effective.acceptedInPersonMethods
  );
  const [paymentInstructions, setPaymentInstructions] = useState(effective.paymentInstructions);
  const [paymentLocation, setPaymentLocation] = useState(effective.paymentLocation);
  const [paymentDueTiming, setPaymentDueTiming] = useState<PaymentDueTiming>(
    effective.paymentDueTiming
  );
  const [advancePaymentRequired, setAdvancePaymentRequired] = useState(
    effective.advancePaymentRequired
  );
  const [depositPercentage, setDepositPercentage] = useState(effective.depositPercentage);
  const [paymentPolicy, setPaymentPolicy] = useState<ProviderPaymentPolicy>(
    effective.paymentPolicy
  );

  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');
  const [settingsError, setSettingsError] = useState('');

  const [ledgerFilter, setLedgerFilter] = useState<
    'All' | 'Unpaid Bookings' | 'Online Payments' | 'Pay in Person'
  >('All');
  const [selectedCollectMethod, setSelectedCollectMethod] = useState<
    Record<string, InPersonPaymentMethod>
  >({});
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [reconcileMsg, setReconcileMsg] = useState('');
  const [reconcileErr, setReconcileErr] = useState('');

  useEffect(() => {
    if (!settings) return;
    setPayInPersonEnabled(settings.payInPersonEnabled);
    setAcceptedMethods(settings.acceptedInPersonMethods);
    setPaymentInstructions(settings.paymentInstructions);
    setPaymentLocation(settings.paymentLocation);
    setPaymentDueTiming(settings.paymentDueTiming);
    setAdvancePaymentRequired(settings.advancePaymentRequired);
    setDepositPercentage(settings.depositPercentage);
    setPaymentPolicy(settings.paymentPolicy);
  }, [settings]);

  const toggleAcceptedMethod = (m: InPersonPaymentMethod) => {
    setAcceptedMethods((prev) =>
      prev.includes(m) ? prev.filter((item) => item !== m) : [...prev, m]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsMsg('');
    setSettingsError('');
    setSavingSettings(true);
    try {
      await onSaveSettings({
        providerName: user.organization || user.name,
        payInPersonEnabled,
        acceptedInPersonMethods:
          acceptedMethods.length > 0 ? acceptedMethods : ['Cash', 'Card Machine'],
        paymentInstructions: paymentInstructions.trim(),
        paymentLocation: paymentLocation.trim() || 'Provider Reception Desk',
        paymentDueTiming,
        advancePaymentRequired,
        depositPercentage: Math.max(5, Math.min(95, Math.round(depositPercentage || 30))),
        paymentPolicy,
      });
      setSettingsMsg('Provider payment policy and instructions saved.');
    } catch (err) {
      setSettingsError(
        err instanceof Error ? err.message : 'Unable to save provider payment settings.'
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const filteredPayments = useMemo(() => {
    return providerPayments.filter((p) => {
      if (ledgerFilter === 'Unpaid Bookings') {
        return (
          p.paymentStatus === 'Unpaid' ||
          p.paymentStatus === 'Payment Pending' ||
          p.paymentStatus === 'Partially Paid'
        );
      }
      if (ledgerFilter === 'Online Payments') {
        return p.paymentMethod === 'PayShap' || p.paymentMethod === 'Card';
      }
      if (ledgerFilter === 'Pay in Person') {
        return p.paymentMethod === 'Pay in Person' || (p.balanceDueInPerson ?? 0) > 0;
      }
      return true;
    });
  }, [providerPayments, ledgerFilter]);

  const unpaidInPersonCount = providerPayments.filter(
    (p) => p.paymentStatus === 'Unpaid' || p.paymentStatus === 'Partially Paid'
  ).length;
  const settledOnlineTotal = providerPayments
    .filter((p) => p.paymentMethod !== 'Pay in Person' && (p.paymentStatus === 'Paid' || p.paymentStatus === 'Partially Paid'))
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-6">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold text-[#111827]">
              Payment Settings &amp; In-Person Collection Ledger
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-600">
            Configure PayShap, Card deposit rules, Pay in Person availability, and mark in-person funds received after service arrival.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 text-xs">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
            Online Settled:{' '}
            <strong className="font-mono text-[#15803D] tabular-nums">
              R {settledOnlineTotal.toLocaleString('en-ZA')}
            </strong>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
            Unpaid / Deposit Due:{' '}
            <strong className="font-mono text-amber-800 tabular-nums">{unpaidInPersonCount}</strong>
          </div>
        </div>
      </div>

      {/* Payment Policy Form */}
      <form
        onSubmit={handleSave}
        className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 lg:grid-cols-12 text-xs"
      >
        <div className="lg:col-span-6 space-y-3">
          <div>
            <label htmlFor="prov-pay-policy" className="block font-semibold text-slate-700">
              Booking Payment Policy
            </label>
            <select
              id="prov-pay-policy"
              value={paymentPolicy}
              onChange={(e) => {
                const next = e.target.value as ProviderPaymentPolicy;
                setPaymentPolicy(next);
                if (next === 'pay_full_online') {
                  setPayInPersonEnabled(false);
                  setAdvancePaymentRequired(true);
                } else if (next === 'reserve_pay_on_arrival' || next === 'pay_in_person_before_service') {
                  setPayInPersonEnabled(true);
                }
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
            >
              {(Object.keys(PAYMENT_POLICY_META) as ProviderPaymentPolicy[]).map((key) => (
                <option key={key} value={key}>
                  {PAYMENT_POLICY_META[key].label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              {PAYMENT_POLICY_META[paymentPolicy].description}
            </p>
          </div>

          {paymentPolicy === 'deposit_online_balance_in_person' && (
            <div>
              <label htmlFor="prov-dep-pct" className="block font-semibold text-slate-700">
                Online Deposit Percentage (%)
              </label>
              <input
                id="prov-dep-pct"
                type="number"
                min={5}
                max={95}
                value={depositPercentage}
                onChange={(e) => setDepositPercentage(Number(e.target.value) || 30)}
                className="mt-1 w-32 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs"
              />
            </div>
          )}

          <div className="flex flex-wrap gap-4 pt-1">
            <label className="inline-flex items-center gap-2 cursor-pointer font-medium text-[#111827]">
              <input
                type="checkbox"
                checked={payInPersonEnabled}
                onChange={(e) => setPayInPersonEnabled(e.target.checked)}
                className="rounded border-slate-300 text-[#1D4ED8]"
              />
              <span>Enable Pay in Person Option</span>
            </label>

            <label className="inline-flex items-center gap-2 cursor-pointer font-medium text-[#111827]">
              <input
                type="checkbox"
                checked={advancePaymentRequired}
                onChange={(e) => setAdvancePaymentRequired(e.target.checked)}
                className="rounded border-slate-300 text-[#1D4ED8]"
              />
              <span>Advance Online Payment Required</span>
            </label>
          </div>

          <div>
            <p className="font-semibold text-slate-700 mb-1.5">Accepted In-Person Methods</p>
            <div className="flex flex-wrap gap-2">
              {ALL_IN_PERSON_METHODS.map((m) => (
                <label
                  key={m}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={acceptedMethods.includes(m)}
                    onChange={() => toggleAcceptedMethod(m)}
                    className="rounded border-slate-300 text-[#1D4ED8]"
                  />
                  <span>{m}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="prov-pay-loc" className="block font-semibold text-slate-700">
                Where Payment Must Be Made
              </label>
              <input
                id="prov-pay-loc"
                type="text"
                value={paymentLocation}
                onChange={(e) => setPaymentLocation(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label htmlFor="prov-pay-due" className="block font-semibold text-slate-700">
                When Payment Is Due
              </label>
              <select
                id="prov-pay-due"
                value={paymentDueTiming}
                onChange={(e) => setPaymentDueTiming(e.target.value as PaymentDueTiming)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs"
              >
                {DUE_TIMING_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="prov-pay-inst" className="block font-semibold text-slate-700">
              In-Person &amp; Arrival Payment Instructions
            </label>
            <textarea
              id="prov-pay-inst"
              rows={3}
              value={paymentInstructions}
              onChange={(e) => setPaymentInstructions(e.target.value)}
              placeholder="Explain where tourists present their booking reference and pay..."
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            {settingsMsg && (
              <span role="status" className="font-medium text-[#15803D]">
                {settingsMsg}
              </span>
            )}
            {settingsError && (
              <span role="alert" className="font-medium text-red-700">
                {settingsError}
              </span>
            )}
            <button
              type="submit"
              disabled={savingSettings}
              className="ml-auto rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60"
            >
              {savingSettings ? 'Saving Settings...' : 'Save Payment Settings'}
            </button>
          </div>
        </div>
      </form>

      {/* Provider Booking Payments & In-Person Collection Ledger */}
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-[#111827]" aria-hidden="true" />
            <h3 className="font-display text-sm font-bold text-[#111827]">
              Bookings Payment Reconciliation ({filteredPayments.length})
            </h3>
          </div>

          <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            {(['All', 'Unpaid Bookings', 'Online Payments', 'Pay in Person'] as const).map(
              (tab) => (
                <button
                  key={tab}
                  type="button"
                  aria-pressed={ledgerFilter === tab}
                  onClick={() => setLedgerFilter(tab)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                    ledgerFilter === tab
                      ? 'bg-[#111827] text-white'
                      : 'text-slate-600 hover:text-[#111827]'
                  }`}
                >
                  {tab}
                </button>
              )
            )}
          </div>
        </div>

        {reconcileMsg && (
          <p role="status" className="rounded-lg bg-[#F0FDF4] px-3 py-2 text-xs font-medium text-[#15803D]">
            {reconcileMsg}
          </p>
        )}
        {reconcileErr && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {reconcileErr}
          </p>
        )}

        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">
          {filteredPayments.length === 0 ? (
            <p className="p-5 text-center text-xs text-slate-500">
              No payment records in this view.
            </p>
          ) : (
            filteredPayments.map((pay) => {
              const linkedBooking = providerBookings.find((b) => b.id === pay.bookingId);
              const canCollectInPerson =
                pay.paymentStatus === 'Unpaid' ||
                (pay.paymentStatus === 'Partially Paid' && (pay.balanceDueInPerson ?? 0) > 0);
              const methodChoice =
                selectedCollectMethod[pay.id] || acceptedMethods[0] || 'Card Machine';

              return (
                <div
                  key={pay.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-semibold text-[#1D4ED8]">
                        {pay.bookingReference}
                      </span>
                      <span className="font-mono text-slate-500">{pay.paymentReference}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
                        {pay.paymentMethod}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-[#111827]">{pay.serviceTitle}</p>
                    <p className="text-slate-600">
                      Tourist: <strong>{pay.userName || pay.userId}</strong>
                      {linkedBooking && (
                        <span>
                          {' '}
                          · Booking Status: <strong>{linkedBooking.status}</strong>
                        </span>
                      )}
                    </p>
                    {pay.inPersonConfirmedAt && (
                      <p className="inline-flex items-center gap-1 text-[11px] font-medium text-[#15803D]">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        In-person payment received ({pay.inPersonMethodUsed}) ·{' '}
                        {pay.inPersonConfirmedAt}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <div className="text-left sm:text-right">
                      <p className="font-mono text-sm font-bold text-[#111827] tabular-nums">
                        R {pay.bookingTotalZar.toLocaleString('en-ZA')} total
                        {typeof pay.balanceDueInPerson === 'number' &&
                        pay.balanceDueInPerson > 0 &&
                        pay.paymentStatus !== 'Paid'
                          ? ` (R ${pay.balanceDueInPerson.toLocaleString('en-ZA')} due)`
                          : ''}
                      </p>
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
                    </div>

                    {canCollectInPerson && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <select
                          aria-label={`Method received for ${pay.bookingReference}`}
                          value={methodChoice}
                          onChange={(e) =>
                            setSelectedCollectMethod((prev) => ({
                              ...prev,
                              [pay.id]: e.target.value as InPersonPaymentMethod,
                            }))
                          }
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                        >
                          {ALL_IN_PERSON_METHODS.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={markingId === pay.id}
                          onClick={async () => {
                            setReconcileMsg('');
                            setReconcileErr('');
                            setMarkingId(pay.id);
                            try {
                              await onMarkInPersonPaid(pay.id, pay.bookingId, methodChoice);
                              setReconcileMsg(
                                `Marked ${pay.bookingReference} settled via ${methodChoice}.`
                              );
                            } catch (err) {
                              setReconcileErr(
                                err instanceof Error
                                  ? err.message
                                  : 'Unable to mark in-person payment received.'
                              );
                            } finally {
                              setMarkingId(null);
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-md bg-[#15803D] px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 whitespace-nowrap"
                        >
                          <Banknote className="h-3.5 w-3.5" aria-hidden="true" />
                          {markingId === pay.id ? 'Recording...' : 'Mark Payment Received'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};
