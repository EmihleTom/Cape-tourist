import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CheckCircle2,
  CreditCard,
  Info,
  Lock,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { StatusText } from '@/src/components/common/StatusText';
import {
  paymentService,
  type InitiatedPaymentSession,
  type PaymentGatewayConfig,
} from '@/src/services/paymentService';
import type {
  DemoUser,
  PaymentMethodType,
  PaymentRecord,
  PaymentStatus,
  ProviderPaymentSettings,
  SavedPaymentMethod,
} from '@/src/types/app';
import {
  calculateCheckoutAmounts,
  DEFAULT_PROVIDER_PAYMENT_SETTINGS,
  generateBookingReference,
  generatePaymentReference,
} from '@/src/utils/bookingCalculations';

export interface CheckoutDraft {
  existingBookingId?: string;
  existingPaymentId?: string;
  existingBookingReference?: string;
  offeringId?: string;
  offeringType: 'Accommodation' | 'Transport' | 'Activity';
  title: string;
  providerId: string;
  providerName: string;
  category: string;
  zone: string;
  date: string;
  timeSlot: string;
  durationUnit: 'hours' | 'days' | 'nights' | 'sessions';
  durationValue: number;
  endDate: string;
  endTime: string;
  unitPriceZar: number;
  pricingModel: 'per_guest' | 'per_unit';
  guests: number;
  totalZar: number;
  safetyVerified: boolean;
  accessible: boolean;
}

export interface CheckoutCompletionPayload {
  draft: CheckoutDraft;
  bookingReference: string;
  paymentMethod: PaymentMethodType;
  paymentStatus: PaymentStatus;
  paymentReference: string;
  paymentProviderReference?: string;
  providerVerified: boolean;
  paymentMode: 'live' | 'demo';
  amountZar: number;
  depositAmountZar?: number;
  balanceDueInPersonZar: number;
  paymentPolicy: ProviderPaymentSettings['paymentPolicy'];
  failureReason?: string;
  receiptNumber?: string;
  cardBrand?: string;
  cardLastFour?: string;
  savedCardTokenId?: string;
  cardToSave?: Omit<SavedPaymentMethod, 'id' | 'userId' | 'createdAtLabel' | 'dataOrigin'>;
}

interface CheckoutPaymentStepProps {
  user: DemoUser;
  draft: CheckoutDraft;
  providerSettings?: ProviderPaymentSettings | null;
  savedCards: SavedPaymentMethod[];
  onRemoveSavedCard: (cardId: string) => Promise<void> | void;
  onCompleteCheckout: (payload: CheckoutCompletionPayload) => Promise<PaymentRecord | void>;
  onBack: () => void;
}

export const CheckoutPaymentStep: React.FC<CheckoutPaymentStepProps> = ({
  user,
  draft,
  providerSettings,
  savedCards,
  onRemoveSavedCard,
  onCompleteCheckout,
  onBack,
}) => {
  const effectiveSettings = useMemo(() => {
    if (providerSettings) return providerSettings;
    return {
      ...DEFAULT_PROVIDER_PAYMENT_SETTINGS,
      id: draft.providerId,
      providerId: draft.providerId,
      providerName: draft.providerName,
      updatedAtLabel: 'Default Policy',
      dataOrigin: 'demo' as const,
    };
  }, [providerSettings, draft.providerId, draft.providerName]);

  const breakdown = useMemo(
    () => calculateCheckoutAmounts(draft.totalZar, effectiveSettings),
    [draft.totalZar, effectiveSettings]
  );

  const [gatewayConfig, setGatewayConfig] = useState<PaymentGatewayConfig | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>('PayShap');
  const [bookingReference] = useState(
    () => draft.existingBookingReference || generateBookingReference()
  );

  // PayShap state
  const [payshapSession, setPayshapSession] = useState<InitiatedPaymentSession | null>(null);
  const [payshapBusy, setPayshapBusy] = useState(false);

  // Card state (kept strictly local & cleared immediately after transient tokenization)
  const [selectedSavedCardId, setSelectedSavedCardId] = useState<string>(
    savedCards[0]?.id || 'new'
  );
  const [cardholderName, setCardholderName] = useState(user.name);
  const [cardNumber, setCardNumber] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('08');
  const [expiryYear, setExpiryYear] = useState('2028');
  const [cvv, setCvv] = useState('');
  const [saveCardForFuture, setSaveCardForFuture] = useState(false);
  const [cardDemoOutcome, setCardDemoOutcome] = useState<'Paid' | 'Payment Pending' | 'Failed'>(
    'Paid'
  );
  const [cardBusy, setCardBusy] = useState(false);

  // Pay in Person state
  const [inPersonBusy, setInPersonBusy] = useState(false);

  // Outcome Banner
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [completedRecord, setCompletedRecord] = useState<PaymentRecord | null>(null);

  useEffect(() => {
    let active = true;
    void paymentService.getConfig().then((cfg) => {
      if (active) setGatewayConfig(cfg);
    });
    return () => {
      active = false;
    };
  }, []);

  const isLivePsp = gatewayConfig?.mode === 'live';

  const handleInitiatePayShap = async () => {
    setErrorMessage('');
    setStatusMessage('');
    setPayshapBusy(true);
    try {
      const session = await paymentService.initiateOnlinePayment({
        bookingId: draft.existingBookingId || `draft-${bookingReference}`,
        bookingReference,
        amount: breakdown.onlinePayableZar,
        bookingTotalZar: draft.totalZar,
        paymentMethod: 'PayShap',
        customerEmail: user.email,
        idempotencyKey: `ps-${bookingReference}-${draft.existingPaymentId || 'new'}`,
        policy: effectiveSettings.paymentPolicy,
        depositPercentage: effectiveSettings.depositPercentage,
      });
      setPayshapSession(session);
      setStatusMessage(
        session.mode === 'live'
          ? `PayShap request ${session.paymentReference} initiated with gateway. Complete payment in your South African banking app, then verify status.`
          : `Demo Mode PayShap reference ${session.paymentReference} generated. Use your banking instructions preview or choose a sandbox verification outcome below.`
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to initiate PayShap payment.');
    } finally {
      setPayshapBusy(false);
    }
  };

  const handleVerifyPayShap = async (
    simulatedOutcome: 'Paid' | 'Payment Pending' | 'Failed' | 'Expired' | 'Cancelled'
  ) => {
    if (!payshapSession) return;
    setErrorMessage('');
    setStatusMessage('');
    setPayshapBusy(true);
    try {
      const verification = await paymentService.verifyOnlinePayment({
        paymentReference: payshapSession.paymentReference,
        ...(payshapSession.mode === 'demo' ? { simulatedOutcome } : {}),
      });

      const resolvedStatus: PaymentStatus =
        verification.verified && verification.paymentStatus === 'Paid'
          ? breakdown.isDepositOnly
            ? 'Partially Paid'
            : 'Paid'
          : verification.paymentStatus;

      if (resolvedStatus === 'Payment Pending') {
        setStatusMessage(
          verification.message ||
            'PayShap confirmation is still pending from your bank. Your booking stays in Payment Pending until verified.'
        );
      } else if (resolvedStatus === 'Failed') {
        setErrorMessage(
          verification.failureReason ||
            'PayShap payment was declined, expired, or cancelled. No booking confirmation was issued.'
        );
      }

      const saved = await onCompleteCheckout({
        draft,
        bookingReference,
        paymentMethod: 'PayShap',
        paymentStatus: resolvedStatus,
        paymentReference: payshapSession.paymentReference,
        paymentProviderReference: verification.paymentProviderReference,
        providerVerified: Boolean(verification.verified),
        paymentMode: verification.mode,
        amountZar: breakdown.onlinePayableZar,
        depositAmountZar: breakdown.isDepositOnly ? breakdown.onlinePayableZar : undefined,
        balanceDueInPersonZar: breakdown.balanceDueInPersonZar,
        paymentPolicy: effectiveSettings.paymentPolicy,
        failureReason: verification.failureReason,
      });
      if (saved) setCompletedRecord(saved);
      if (resolvedStatus === 'Paid' || resolvedStatus === 'Partially Paid') {
        setStatusMessage(
          `PayShap verified (${payshapSession.paymentReference}). Booking ${bookingReference} submitted for ${draft.providerName} confirmation.`
        );
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'PayShap verification failed.');
    } finally {
      setPayshapBusy(false);
    }
  };

  const handlePayWithCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setStatusMessage('');
    setCardBusy(true);

    try {
      const useSaved = selectedSavedCardId !== 'new';
      const chosenSaved = savedCards.find((c) => c.id === selectedSavedCardId);
      let tokenised: {
        providerToken: string;
        cardBrand: SavedPaymentMethod['cardBrand'];
        lastFourDigits: string;
        expiryMonth: string;
        expiryYear: string;
        cardholderName: string;
        paymentMode: 'live' | 'demo';
      } | null = null;

      if (useSaved && chosenSaved) {
        tokenised = {
          providerToken: chosenSaved.providerToken,
          cardBrand: chosenSaved.cardBrand,
          lastFourDigits: chosenSaved.lastFourDigits,
          expiryMonth: chosenSaved.expiryMonth,
          expiryYear: chosenSaved.expiryYear,
          cardholderName: chosenSaved.cardholderName,
          paymentMode: chosenSaved.paymentMode,
        };
      } else {
        tokenised = await paymentService.tokenizeCard({
          cardNumber,
          expiryMonth,
          expiryYear,
          cvv,
          cardholderName: cardholderName.trim(),
        });
        // Immediately purge raw PAN and CVV from local state after transient tokenization
        setCardNumber('');
        setCvv('');
      }

      const session = await paymentService.initiateOnlinePayment({
        bookingId: draft.existingBookingId || `draft-${bookingReference}`,
        bookingReference,
        amount: breakdown.onlinePayableZar,
        bookingTotalZar: draft.totalZar,
        paymentMethod: 'Card',
        customerEmail: user.email,
        idempotencyKey: `cd-${bookingReference}-${Date.now()}`,
        policy: effectiveSettings.paymentPolicy,
        depositPercentage: effectiveSettings.depositPercentage,
      });

      const outcome = session.mode === 'demo' ? cardDemoOutcome : undefined;
      const verification = await paymentService.verifyOnlinePayment({
        paymentReference: session.paymentReference,
        ...(outcome ? { simulatedOutcome: outcome } : {}),
        cardToken: tokenised.providerToken,
      });

      const resolvedStatus: PaymentStatus =
        verification.verified && verification.paymentStatus === 'Paid'
          ? breakdown.isDepositOnly
            ? 'Partially Paid'
            : 'Paid'
          : verification.paymentStatus;

      const saved = await onCompleteCheckout({
        draft,
        bookingReference,
        paymentMethod: 'Card',
        paymentStatus: resolvedStatus,
        paymentReference: session.paymentReference,
        paymentProviderReference: verification.paymentProviderReference,
        providerVerified: Boolean(verification.verified),
        paymentMode: verification.mode,
        amountZar: breakdown.onlinePayableZar,
        depositAmountZar: breakdown.isDepositOnly ? breakdown.onlinePayableZar : undefined,
        balanceDueInPersonZar: breakdown.balanceDueInPersonZar,
        paymentPolicy: effectiveSettings.paymentPolicy,
        failureReason: verification.failureReason,
        cardBrand: tokenised.cardBrand,
        cardLastFour: tokenised.lastFourDigits,
        savedCardTokenId: useSaved && chosenSaved ? chosenSaved.id : undefined,
        ...(saveCardForFuture && !useSaved && verification.verified
          ? {
              cardToSave: {
                providerToken: tokenised.providerToken,
                cardBrand: tokenised.cardBrand,
                cardholderName: tokenised.cardholderName,
                lastFourDigits: tokenised.lastFourDigits,
                expiryMonth: tokenised.expiryMonth,
                expiryYear: tokenised.expiryYear,
                paymentMode: verification.mode,
              },
            }
          : {}),
      });
      if (saved) setCompletedRecord(saved);

      if (resolvedStatus === 'Paid' || resolvedStatus === 'Partially Paid') {
        setStatusMessage(
          `${tokenised.cardBrand} •••• ${tokenised.lastFourDigits} payment verified (${session.paymentReference}). Booking ${bookingReference} is awaiting provider confirmation.`
        );
      } else if (resolvedStatus === 'Payment Pending') {
        setStatusMessage(
          verification.message ||
            'Card authorization is pending 3D Secure verification. Check My Payments for updates.'
        );
      } else {
        setErrorMessage(
          verification.failureReason ||
            'Card payment declined by issuer. Please retry or choose PayShap / Pay in Person.'
        );
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to process card payment.');
    } finally {
      setCardBusy(false);
    }
  };

  const handleReservePayInPerson = async () => {
    if (!breakdown.payInPersonAllowed) return;
    setErrorMessage('');
    setStatusMessage('');
    setInPersonBusy(true);
    try {
      const payRef = generatePaymentReference('Pay in Person');
      const saved = await onCompleteCheckout({
        draft,
        bookingReference,
        paymentMethod: 'Pay in Person',
        paymentStatus: 'Unpaid',
        paymentReference: payRef,
        providerVerified: false,
        paymentMode: isLivePsp ? 'live' : 'demo',
        amountZar: draft.totalZar,
        balanceDueInPersonZar: draft.totalZar,
        paymentPolicy: effectiveSettings.paymentPolicy,
      });
      if (saved) setCompletedRecord(saved);
      setStatusMessage(
        `Reservation ${bookingReference} submitted without online charge. Payment Status: Unpaid · Booking Status: Awaiting Provider Confirmation.`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to submit Pay in Person reservation.'
      );
    } finally {
      setInPersonBusy(false);
    }
  };

  return (
    <section
      aria-label="Secure Checkout & Payment Selection"
      className="space-y-5 rounded-xl border border-[#1D4ED8]/40 bg-white p-5 sm:p-6"
    >
      {/* Top Bar */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1D4ED8] hover:text-[#1E40AF]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to Reservation Details
          </button>
          <h2 className="mt-1 font-display text-xl font-bold text-[#111827]">
            Secure Checkout — {draft.title}
          </h2>
          <p className="text-xs text-slate-600">
            Choose how you want to pay. Your booking and payment information are handled securely.
          </p>
        </div>

        <div className="flex flex-col items-start sm:items-end gap-1">
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] font-semibold text-[#111827]">
            Ref: {bookingReference}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
            <Lock className="h-3 w-3 text-[#1D4ED8]" aria-hidden="true" />
            {gatewayConfig
              ? gatewayConfig.mode === 'live'
                ? `Live PSP: ${gatewayConfig.providerName}`
                : 'Sandbox / Demo Mode PSP (ZAR)'
              : 'Connecting payment gateway...'}
          </span>
        </div>
      </div>

      {/* Mode & Policy Summary */}
      <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-12">
        <div className="md:col-span-7 space-y-1.5 text-xs">
          <p className="font-semibold text-[#111827]">
            Provider Payment Policy: <span className="text-[#1D4ED8]">{breakdown.policyLabel}</span>
          </p>
          <p className="text-slate-600">{breakdown.policyDescription}</p>
          <p className="text-[11px] text-slate-500">
            {draft.date} {draft.timeSlot} → {draft.endDate} {draft.endTime} · {draft.guests} guest(s) · Provider:{' '}
            <strong>{draft.providerName}</strong>
          </p>
        </div>
        <div className="md:col-span-5 flex flex-col justify-center items-start md:items-end border-t border-slate-200 pt-3 md:border-t-0 md:pt-0">
          <p className="text-[11px] text-slate-500">
            {breakdown.isDepositOnly ? 'Online Deposit Due Now' : 'Booking Total (ZAR)'}
          </p>
          <p className="font-display text-2xl font-bold text-[#111827] tabular-nums">
            R {(breakdown.isDepositOnly ? breakdown.onlinePayableZar : draft.totalZar).toLocaleString('en-ZA')}
          </p>
          {breakdown.isDepositOnly && (
            <p className="text-[11px] text-amber-800 font-medium tabular-nums">
              Total R {draft.totalZar.toLocaleString('en-ZA')} · Remaining R{' '}
              {breakdown.balanceDueInPersonZar.toLocaleString('en-ZA')} due in person
            </p>
          )}
        </div>
      </div>

      {gatewayConfig?.mode === 'demo' && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-950">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
          <p>
            <strong>Sandbox / Demo Checkout Active:</strong> Live South African PSP keys are not configured in this preview environment. Test PayShap, Tokenised Cards, and Pay in Person workflows safely without real charges. No live production confirmation is faked.
          </p>
        </div>
      )}

      {/* Three Clearly Separated Payment Option Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Option A: PayShap */}
        <button
          type="button"
          aria-pressed={selectedMethod === 'PayShap'}
          onClick={() => {
            setSelectedMethod('PayShap');
            setErrorMessage('');
          }}
          className={`flex flex-col justify-between rounded-xl border p-4 text-left transition-all ${
            selectedMethod === 'PayShap'
              ? 'border-[#1D4ED8] bg-[#EFF6FF]/60 ring-1 ring-[#1D4ED8]'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#1D4ED8]/10 text-[#1D4ED8]">
                <Smartphone className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="font-mono text-[11px] font-semibold text-[#1D4ED8]">Option A</span>
            </div>
            <h3 className="font-display text-base font-bold text-[#111827]">PayShap</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Instant South African EFT / ShapID payment via your banking app in ZAR with real-time reference tracking.
            </p>
          </div>
          <p className="mt-3 pt-2 border-t border-slate-200 font-mono text-xs font-bold text-[#111827] tabular-nums">
            Pay R {breakdown.onlinePayableZar.toLocaleString('en-ZA')}
          </p>
        </button>

        {/* Option B: Credit or Debit Card */}
        <button
          type="button"
          aria-pressed={selectedMethod === 'Card'}
          onClick={() => {
            setSelectedMethod('Card');
            setErrorMessage('');
          }}
          className={`flex flex-col justify-between rounded-xl border p-4 text-left transition-all ${
            selectedMethod === 'Card'
              ? 'border-[#1D4ED8] bg-[#EFF6FF]/60 ring-1 ring-[#1D4ED8]'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#111827]/10 text-[#111827]">
                <CreditCard className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="font-mono text-[11px] font-semibold text-[#111827]">Option B</span>
            </div>
            <h3 className="font-display text-base font-bold text-[#111827]">Credit or Debit Card</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Visa, Mastercard &amp; supported networks with secure PSP tokenisation and optional saved-card checkout.
            </p>
          </div>
          <p className="mt-3 pt-2 border-t border-slate-200 font-mono text-xs font-bold text-[#111827] tabular-nums">
            Pay R {breakdown.onlinePayableZar.toLocaleString('en-ZA')}
          </p>
        </button>

        {/* Option C: Pay in Person */}
        {breakdown.payInPersonAllowed ? (
          <button
            type="button"
            aria-pressed={selectedMethod === 'Pay in Person'}
            onClick={() => {
              setSelectedMethod('Pay in Person');
              setErrorMessage('');
            }}
            className={`flex flex-col justify-between rounded-xl border p-4 text-left transition-all ${
              selectedMethod === 'Pay in Person'
                ? 'border-[#1D4ED8] bg-[#EFF6FF]/60 ring-1 ring-[#1D4ED8]'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-[#15803D]">
                  <Banknote className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="font-mono text-[11px] font-semibold text-[#15803D]">Option C</span>
              </div>
              <h3 className="font-display text-base font-bold text-[#111827]">Pay in Person</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Reserve without paying online now. Pay directly to {draft.providerName} on arrival or before service.
              </p>
            </div>
            <p className="mt-3 pt-2 border-t border-slate-200 font-mono text-xs font-bold text-[#15803D] tabular-nums">
              R 0 Online · R {draft.totalZar.toLocaleString('en-ZA')} in person
            </p>
          </button>
        ) : (
          <div className="flex flex-col justify-between rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-left opacity-80">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200 text-slate-500">
                  <Banknote className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="font-mono text-[11px] font-semibold text-slate-500">Unavailable</span>
              </div>
              <h3 className="font-display text-base font-bold text-slate-600">Pay in Person</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Disabled by {draft.providerName} ({breakdown.policyLabel}). Choose PayShap or Card to settle the required online amount.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Feedback & Completion Banner */}
      {statusMessage && (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-[#F0FDF4] p-4 text-xs text-emerald-950 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#15803D]" aria-hidden="true" />
            <div>
              <p className="font-semibold">{statusMessage}</p>
              {completedRecord && (
                <p className="mt-0.5 font-mono text-[11px] text-emerald-800">
                  Payment Status: {completedRecord.paymentStatus} · Ref: {completedRecord.paymentReference}
                </p>
              )}
            </div>
          </div>
          {completedRecord && (
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg bg-[#15803D] px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap"
            >
              View Reservations
            </button>
          )}
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-900"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
          <p className="font-medium">{errorMessage}</p>
        </div>
      )}

      {/* Active Option Detail Panel */}
      {selectedMethod === 'PayShap' && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-display text-base font-bold text-[#111827]">
                PayShap Instant Payment (ZAR)
              </h3>
              <p className="text-xs text-slate-600">
                Amount to pay:{' '}
                <strong className="font-mono text-[#111827] tabular-nums">
                  R {breakdown.onlinePayableZar.toLocaleString('en-ZA')}
                </strong>
              </p>
            </div>
            {!payshapSession && (
              <button
                type="button"
                disabled={payshapBusy}
                onClick={handleInitiatePayShap}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60"
              >
                <Smartphone className="h-4 w-4" aria-hidden="true" />
                {payshapBusy ? 'Generating PayShap Request...' : 'Initiate PayShap Payment'}
              </button>
            )}
          </div>

          {payshapSession && (
            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 text-xs">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] text-slate-500">Unique Payment Reference</p>
                  <p className="font-mono text-sm font-bold text-[#111827]">
                    {payshapSession.paymentReference}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">PayShap Destination / ShapID</p>
                  <p className="font-mono font-semibold text-[#1D4ED8]">
                    {payshapSession.payshapInstructions?.shapId || 'capesafe@payshap.co.za'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">Settlement Bank</p>
                  <p className="font-medium text-slate-800">
                    {payshapSession.payshapInstructions?.bankName || 'South African Participating Bank'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">Request Window</p>
                  <p className="font-medium text-slate-800">
                    Expires in {payshapSession.payshapInstructions?.expiresInMinutes || 15} minutes
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-700">
                1. Open your South African banking app and select <strong>PayShap (Pay by ShapID)</strong>.
                <br />
                2. Enter ShapID <strong>{payshapSession.payshapInstructions?.shapId || 'capesafe@payshap.co.za'}</strong> and reference{' '}
                <strong className="font-mono">{payshapSession.paymentReference}</strong> for{' '}
                <strong>R {breakdown.onlinePayableZar.toLocaleString('en-ZA')}</strong>.
                <br />
                3. Confirm in your banking app, then click verification below. Payment confirms only upon PSP verification.
              </div>

              {payshapSession.mode === 'live' ? (
                <div className="flex flex-wrap items-center gap-2">
                  {payshapSession.authorizationUrl && (
                    <a
                      href={payshapSession.authorizationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-[#111827] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E293B]"
                    >
                      Open PSP PayShap Authorization
                    </a>
                  )}
                  <button
                    type="button"
                    disabled={payshapBusy}
                    onClick={() => handleVerifyPayShap('Paid')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    {payshapBusy ? 'Verifying...' : 'Check PayShap Confirmation'}
                  </button>
                </div>
              ) : (
                <div className="space-y-2 border-t border-slate-200 pt-3">
                  <p className="font-semibold text-[#111827]">
                    Sandbox Outcome Controls (Demo Mode — Not Live Banking):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={payshapBusy}
                      onClick={() => handleVerifyPayShap('Paid')}
                      className="rounded-lg bg-[#15803D] px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                    >
                      Verify PayShap Paid
                    </button>
                    <button
                      type="button"
                      disabled={payshapBusy}
                      onClick={() => handleVerifyPayShap('Payment Pending')}
                      className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
                    >
                      Keep Pending
                    </button>
                    <button
                      type="button"
                      disabled={payshapBusy}
                      onClick={() => handleVerifyPayShap('Failed')}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                    >
                      Simulate Failed
                    </button>
                    <button
                      type="button"
                      disabled={payshapBusy}
                      onClick={() => handleVerifyPayShap('Expired')}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                    >
                      Simulate Expired
                    </button>
                    <button
                      type="button"
                      disabled={payshapBusy}
                      onClick={() => handleVerifyPayShap('Cancelled')}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                    >
                      Cancel Request
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {selectedMethod === 'Card' && (
        <form
          onSubmit={handlePayWithCard}
          className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-4 text-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-bold text-[#111827]">
                Credit or Debit Card Checkout
              </h3>
              <p className="text-slate-600">
                Supported networks: <strong>Visa</strong> · <strong>Mastercard</strong> · <strong>Amex</strong>
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded bg-white px-2.5 py-1 border border-slate-200 font-medium text-[#1E40AF]">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              PSP Tokenised (Zero PAN/CVV Storage)
            </span>
          </div>

          {savedCards.length > 0 && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3.5">
              <p className="font-semibold text-[#111827]">Saved Tokenised Cards</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {savedCards.map((card) => (
                  <div
                    key={card.id}
                    className={`flex items-center justify-between rounded-lg border p-2.5 ${
                      selectedSavedCardId === card.id
                        ? 'border-[#1D4ED8] bg-[#EFF6FF]'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <label className="flex items-center gap-2 cursor-pointer flex-1">
                      <input
                        type="radio"
                        name="saved-card-choice"
                        checked={selectedSavedCardId === card.id}
                        onChange={() => setSelectedSavedCardId(card.id)}
                        className="text-[#1D4ED8]"
                      />
                      <div>
                        <p className="font-semibold text-[#111827]">
                          {card.cardBrand} •••• {card.lastFourDigits}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Exp {card.expiryMonth}/{card.expiryYear} · {card.cardholderName}
                        </p>
                      </div>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedSavedCardId === card.id) setSelectedSavedCardId('new');
                        void onRemoveSavedCard(card.id);
                      }}
                      aria-label={`Remove saved ${card.cardBrand} ending ${card.lastFourDigits}`}
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}

                <label
                  className={`flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer ${
                    selectedSavedCardId === 'new'
                      ? 'border-[#1D4ED8] bg-[#EFF6FF]'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="saved-card-choice"
                    checked={selectedSavedCardId === 'new'}
                    onChange={() => setSelectedSavedCardId('new')}
                    className="text-[#1D4ED8]"
                  />
                  <span className="font-semibold text-[#111827]">Use a new Visa / Mastercard</span>
                </label>
              </div>
            </div>
          )}

          {selectedSavedCardId === 'new' && (
            <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-12">
              <div className="sm:col-span-6">
                <label htmlFor="card-holder" className="block font-semibold text-slate-700">
                  Cardholder Name
                </label>
                <input
                  id="card-holder"
                  type="text"
                  required
                  value={cardholderName}
                  onChange={(e) => setCardholderName(e.target.value)}
                  placeholder="Name as printed on card"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>
              <div className="sm:col-span-6">
                <label htmlFor="card-number" className="block font-semibold text-slate-700">
                  Card Number (Transiently Tokenised)
                </label>
                <input
                  id="card-number"
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  required
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="4242 4242 4242 4242"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>
              <div className="sm:col-span-4">
                <label htmlFor="card-exp-month" className="block font-semibold text-slate-700">
                  Expiry Month
                </label>
                <input
                  id="card-exp-month"
                  type="text"
                  maxLength={2}
                  required
                  value={expiryMonth}
                  onChange={(e) => setExpiryMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  placeholder="08"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>
              <div className="sm:col-span-4">
                <label htmlFor="card-exp-year" className="block font-semibold text-slate-700">
                  Expiry Year
                </label>
                <input
                  id="card-exp-year"
                  type="text"
                  maxLength={4}
                  required
                  value={expiryYear}
                  onChange={(e) => setExpiryYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="2028"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>
              <div className="sm:col-span-4">
                <label htmlFor="card-cvv" className="block font-semibold text-slate-700">
                  Security Code (CVV)
                </label>
                <input
                  id="card-cvv"
                  type="password"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  maxLength={4}
                  required
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="•••"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>

              <div className="sm:col-span-12 pt-1">
                <label className="inline-flex items-center gap-2 cursor-pointer text-slate-700">
                  <input
                    type="checkbox"
                    checked={saveCardForFuture}
                    onChange={(e) => setSaveCardForFuture(e.target.checked)}
                    className="rounded border-slate-300 text-[#1D4ED8]"
                  />
                  <span>
                    Save card token securely for future CapeSafe bookings (stores token, card brand &amp; last 4 digits only)
                  </span>
                </label>
              </div>
            </div>
          )}

          {!isLivePsp && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5">
              <span className="font-semibold text-[#111827]">Demo Card Gateway Outcome:</span>
              {(['Paid', 'Payment Pending', 'Failed'] as const).map((outcome) => (
                <label key={outcome} className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="demo-card-outcome"
                    checked={cardDemoOutcome === outcome}
                    onChange={() => setCardDemoOutcome(outcome)}
                    className="text-[#1D4ED8]"
                  />
                  <span>
                    {outcome === 'Paid'
                      ? 'Authorized Paid'
                      : outcome === 'Payment Pending'
                      ? '3DS Pending'
                      : 'Declined / Failed'}
                  </span>
                </label>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-200 pt-3">
            <p className="text-slate-600">
              Total charged now:{' '}
              <strong className="font-mono text-sm text-[#111827] tabular-nums">
                R {breakdown.onlinePayableZar.toLocaleString('en-ZA')} ZAR
              </strong>
            </p>
            <button
              type="submit"
              disabled={cardBusy}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60"
            >
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              {cardBusy
                ? 'Processing Card Authorization...'
                : `Pay R ${breakdown.onlinePayableZar.toLocaleString('en-ZA')} Now`}
            </button>
          </div>
        </form>
      )}

      {selectedMethod === 'Pay in Person' && breakdown.payInPersonAllowed && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-4 text-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-bold text-[#111827]">
                Pay Directly to {draft.providerName}
              </h3>
              <p className="mt-0.5 text-slate-600">
                No online card or PayShap payment is charged now. Your booking will enter{' '}
                <strong>My Trips / Reservations</strong> as <strong>Unpaid</strong> and{' '}
                <strong>Awaiting Provider Confirmation</strong>.
              </p>
            </div>
            <StatusText label="Unpaid at Checkout" tone="advisory" />
          </div>

          <dl className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] text-slate-500">Provider-Confirmed In-Person Methods</dt>
              <dd className="mt-0.5 font-semibold text-[#111827]">
                {effectiveSettings.acceptedInPersonMethods.length > 0
                  ? effectiveSettings.acceptedInPersonMethods.join(' · ')
                  : 'Confirmed on arrival by provider'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-500">When Payment Is Due</dt>
              <dd className="mt-0.5 font-semibold text-[#111827]">
                {effectiveSettings.paymentDueTiming}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[11px] text-slate-500">Where Payment Must Be Made</dt>
              <dd className="mt-0.5 font-semibold text-[#111827]">
                {effectiveSettings.paymentLocation}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[11px] text-slate-500">Provider Payment Instructions</dt>
              <dd className="mt-0.5 text-slate-700 leading-relaxed">
                {effectiveSettings.paymentInstructions}
              </dd>
            </div>
          </dl>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-200 pt-3">
            <p className="text-slate-600">
              Due in person to provider:{' '}
              <strong className="font-mono text-sm text-[#111827] tabular-nums">
                R {draft.totalZar.toLocaleString('en-ZA')} ZAR
              </strong>
            </p>
            <button
              type="button"
              disabled={inPersonBusy}
              onClick={handleReservePayInPerson}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#111827] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#1E293B] disabled:opacity-60"
            >
              <Banknote className="h-4 w-4" aria-hidden="true" />
              {inPersonBusy ? 'Submitting Reservation...' : 'Confirm Booking Request (Pay in Person)'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
