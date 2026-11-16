import type {
  PaymentRecord,
  PaymentStatus,
  ProviderPaymentPolicy,
  SavedPaymentMethod,
} from '@/src/types/app';

export interface PaymentGatewayConfig {
  mode: 'live' | 'demo';
  liveProviderConfigured: boolean;
  providerName: string;
  supportedCurrencies: string[];
  supportedMethods: string[];
  webhookConfigured: boolean;
}

export interface TokenisedCardResult {
  providerToken: string;
  cardBrand: SavedPaymentMethod['cardBrand'];
  lastFourDigits: string;
  expiryMonth: string;
  expiryYear: string;
  cardholderName: string;
  paymentMode: 'live' | 'demo';
}

export interface InitiatedPaymentSession {
  duplicateProtected?: boolean;
  paymentReference: string;
  paymentProviderReference: string;
  bookingId: string;
  bookingReference: string;
  amount: number;
  bookingTotalZar: number;
  currency: 'ZAR';
  paymentMethod: 'PayShap' | 'Card';
  status: PaymentStatus;
  mode: 'live' | 'demo';
  authorizationUrl?: string;
  payshapInstructions?: {
    shapId: string;
    bankName: string;
    reference: string;
    expiresInMinutes: number;
  };
}

export interface VerifyPaymentOutcome {
  verified: boolean;
  paymentStatus: PaymentStatus;
  paymentReference: string;
  paymentProviderReference?: string;
  mode: 'live' | 'demo';
  expired?: boolean;
  cancelled?: boolean;
  failureReason?: string;
  message?: string;
}

export interface RefundResponse {
  success: boolean;
  paymentStatus: 'Refunded' | 'Partially Refunded';
  refundedAmount: number;
  mode: 'live' | 'demo';
  refundReference: string;
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `Payment service error (${response.status})`);
  }
  return payload;
}

export const paymentService = {
  async getConfig(): Promise<PaymentGatewayConfig> {
    try {
      const res = await fetch('/api/payments/config');
      if (!res.ok) throw new Error('Payment config endpoint unavailable');
      return (await res.json()) as PaymentGatewayConfig;
    } catch {
      return {
        mode: 'demo',
        liveProviderConfigured: false,
        providerName: 'CapeSafe Sandbox PSP (Demo Mode)',
        supportedCurrencies: ['ZAR'],
        supportedMethods: ['PayShap', 'Card', 'Pay in Person'],
        webhookConfigured: false,
      };
    }
  },

  tokenizeCard(payload: {
    cardNumber: string;
    expiryMonth: string;
    expiryYear: string;
    cvv: string;
    cardholderName: string;
  }): Promise<TokenisedCardResult> {
    return postJson<TokenisedCardResult>('/api/payments/tokenize-card', payload);
  },

  initiateOnlinePayment(payload: {
    bookingId: string;
    bookingReference: string;
    amount: number;
    bookingTotalZar: number;
    paymentMethod: 'PayShap' | 'Card';
    customerEmail?: string;
    idempotencyKey?: string;
    policy?: ProviderPaymentPolicy;
    depositPercentage?: number;
  }): Promise<InitiatedPaymentSession> {
    return postJson<InitiatedPaymentSession>('/api/payments/initiate', {
      ...payload,
      currency: 'ZAR',
    });
  },

  verifyOnlinePayment(payload: {
    paymentReference: string;
    simulatedOutcome?: 'Paid' | 'Failed' | 'Payment Pending' | 'Expired' | 'Cancelled';
    cardToken?: string;
  }): Promise<VerifyPaymentOutcome> {
    return postJson<VerifyPaymentOutcome>('/api/payments/verify', payload);
  },

  processRefund(payload: {
    paymentReference: string;
    amount: number;
    originalAmount: number;
    paymentStatus: PaymentStatus;
    reason?: string;
  }): Promise<RefundResponse> {
    return postJson<RefundResponse>('/api/payments/refund', payload);
  },

  buildPrintableReceiptText(payment: PaymentRecord): string {
    const modeLabel =
      payment.paymentMode === 'live'
        ? 'Verified South African PSP Transaction'
        : 'Sandbox / Demo Mode Transaction Receipt';
    return [
      '======================================================',
      '           CAPESAFE CONNECT 360 — PAYMENT RECEIPT     ',
      '======================================================',
      `Receipt Number      : ${payment.receiptNumber || 'Pending Issuance'}`,
      `Status Mode         : ${modeLabel}`,
      `Payment Status      : ${payment.paymentStatus}`,
      `Payment Method      : ${payment.paymentMethod}${
        payment.cardLastFour ? ` (${payment.cardBrand || 'Card'} •••• ${payment.cardLastFour})` : ''
      }${payment.inPersonMethodUsed ? ` (${payment.inPersonMethodUsed})` : ''}`,
      '------------------------------------------------------',
      `Booking Reference   : ${payment.bookingReference}`,
      `Transaction Ref     : ${payment.paymentReference}`,
      `PSP Reference       : ${payment.paymentProviderReference || 'N/A'}`,
      `Service             : ${payment.serviceTitle}`,
      `Tourism Provider    : ${payment.providerName}`,
      `Traveler            : ${payment.userName || payment.userId}`,
      '------------------------------------------------------',
      `Amount Paid (ZAR)   : R ${payment.amount.toLocaleString('en-ZA')}`,
      `Booking Total (ZAR) : R ${payment.bookingTotalZar.toLocaleString('en-ZA')}`,
      payment.balanceDueInPerson && payment.balanceDueInPerson > 0
        ? `Balance Due In Person: R ${payment.balanceDueInPerson.toLocaleString('en-ZA')}`
        : 'Balance Due In Person: R 0',
      payment.refundedAmount && payment.refundedAmount > 0
        ? `Refunded Amount     : R ${payment.refundedAmount.toLocaleString('en-ZA')}`
        : null,
      `Timestamp           : ${payment.paidAtLabel || payment.updatedAtLabel}`,
      '======================================================',
      'Issued by CapeSafe Connect 360 · Cape Town, South Africa',
    ]
      .filter(Boolean)
      .join('\n');
  },

  downloadReceipt(payment: PaymentRecord): void {
    const text = this.buildPrintableReceiptText(payment);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${payment.receiptNumber || payment.paymentReference}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  },

  printReceipt(payment: PaymentRecord): void {
    if (typeof window === 'undefined') return;
    const text = this.buildPrintableReceiptText(payment);
    const printEl = document.createElement('div');
    printEl.id = 'capesafe-print-receipt-root';
    printEl.style.position = 'fixed';
    printEl.style.inset = '0';
    printEl.style.zIndex = '99999';
    printEl.style.background = '#ffffff';
    printEl.style.padding = '32px';
    printEl.style.fontFamily = 'monospace';
    printEl.style.whiteSpace = 'pre-wrap';
    printEl.textContent = text;
    document.body.appendChild(printEl);
    window.print();
    setTimeout(() => {
      printEl.remove();
    }, 300);
  },
};
