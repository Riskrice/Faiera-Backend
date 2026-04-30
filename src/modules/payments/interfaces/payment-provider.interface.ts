import { Transaction } from '../entities/transaction.entity';

/**
 * Unified result from any payment provider checkout.
 * Frontend uses `provider` to decide how to render:
 *   - paymob  → embed iframe via iframeUrl / clientSecret
 *   - fawaterk → redirect to paymentUrl
 */
export interface CheckoutResult {
  /** Redirect URL (Fawaterak) or fallback URL (Paymob) */
  paymentUrl: string;

  /** Provider identifier */
  provider: 'paymob' | 'fawaterk';

  /** Internal transaction ID */
  transactionId: string;

  /** Paymob-specific: client secret for Pixel SDK / iframe */
  clientSecret?: string;

  /** Paymob-specific: public key for iframe URL construction */
  publicKey?: string;

  /** Paymob-specific: ready-to-use iframe URL for embedded checkout */
  iframeUrl?: string;

  /** Provider's own transaction/order ID */
  providerTransactionId?: string;
}

/**
 * Data extracted from a payment webhook callback.
 */
export interface WebhookTransactionData {
  /** Provider's transaction ID */
  providerTransactionId: string;

  /** Our internal reference (special_reference / custom_field_1) */
  internalTransactionId?: string;

  /** Payment success status */
  success: boolean;

  /** Payment is still pending */
  pending: boolean;

  /** Amount in cents (smallest currency unit) */
  amountCents: number;

  /** Currency code */
  currency: string;

  /** Whether this is a refund */
  isRefunded: boolean;

  /** Whether this is voided */
  isVoided: boolean;

  /** Actual payment method used (e.g., 'card', 'wallet', 'kiosk') */
  paymentMethodType: string;

  /** Sub-type (e.g., 'MasterCard', 'Visa', 'Vodafone') */
  paymentMethodSubType: string;

  /** Whether an error occurred */
  errorOccurred: boolean;

  /** Raw provider response for audit trail */
  rawPayload: Record<string, unknown>;
}

/**
 * Interface that every payment provider service must implement.
 * This enables the Strategy Pattern for multi-provider support.
 */
export interface PaymentProvider {
  /**
   * Initiate a payment and return checkout details.
   */
  initiatePayment(
    transaction: Transaction,
    user: { firstName: string; lastName: string; email: string; phone?: string },
    itemName: string,
    metadata?: Record<string, string>,
  ): Promise<CheckoutResult>;

  /**
   * Verify a webhook's authenticity (HMAC / signature).
   * Returns true if the webhook is valid.
   */
  verifyWebhook(payload: any, signature: string): boolean;

  /**
   * Extract standardized transaction data from a provider-specific webhook payload.
   */
  extractWebhookData(payload: any): WebhookTransactionData;
}
