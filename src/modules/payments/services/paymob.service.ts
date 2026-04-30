import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import paymobConfig from '../../../config/paymob.config';
import axios, { AxiosError } from 'axios';
import * as crypto from 'crypto';
import { Transaction } from '../entities/transaction.entity';
import {
  PaymentProvider,
  CheckoutResult,
  WebhookTransactionData,
} from '../interfaces/payment-provider.interface';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PaymobIntentionItem {
  name: string;
  amount: number; // in cents
  description?: string;
  quantity: number;
}

interface PaymobBillingData {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  apartment?: string;
  floor?: string;
  street?: string;
  building?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
}

interface PaymobIntentionRequest {
  amount: number; // in cents (smallest currency unit)
  currency: string;
  payment_methods: number[]; // Integration IDs
  items: PaymobIntentionItem[];
  billing_data: PaymobBillingData;
  customer?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  extras?: Record<string, unknown>;
  special_reference?: string;
  notification_url?: string;
  redirection_url?: string;
}

interface PaymobIntentionResponse {
  id: string;
  client_secret: string;
  intention_detail?: {
    id: string;
    amount: number;
    currency: string;
  };
  payment_keys?: any[];
}

/* ------------------------------------------------------------------ */
/*  HMAC fields — the exact order Paymob specifies for SHA-512         */
/*  Reference: Paymob Developer Docs → Webhook & HMAC → Calculation    */
/* ------------------------------------------------------------------ */

const HMAC_FIELDS = [
  'amount_cents',
  'created_at',
  'currency',
  'error_occured',
  'has_parent_transaction',
  'id',
  'integration_id',
  'is_3d_secure',
  'is_auth',
  'is_capture',
  'is_refunded',
  'is_standalone_payment',
  'is_voided',
  'order.id',
  'owner',
  'pending',
  'source_data.pan',
  'source_data.sub_type',
  'source_data.type',
  'success',
] as const;

/* ------------------------------------------------------------------ */
/*  Service                                                            */
/* ------------------------------------------------------------------ */

@Injectable()
export class PaymobService implements PaymentProvider, OnModuleInit {
  private readonly logger = new Logger(PaymobService.name);

  constructor(
    @Inject(paymobConfig.KEY)
    private readonly config: ConfigType<typeof paymobConfig>,
  ) {}

  /* ============================================================== */
  /*  Lifecycle — validate configuration on startup                   */
  /* ============================================================== */

  onModuleInit(): void {
    const { secretKey, publicKey, hmacSecret, integrationIds } = this.config;

    if (!secretKey) {
      this.logger.warn(
        'PAYMOB_SECRET_KEY is not set — Paymob payments will fail if selected as active provider',
      );
    }
    if (!publicKey) {
      this.logger.warn('PAYMOB_PUBLIC_KEY is not set — embedded checkout URL cannot be built');
    }
    if (!hmacSecret) {
      this.logger.warn(
        'PAYMOB_HMAC_SECRET is not set — webhook verification will reject all callbacks',
      );
    }

    // Log which integration IDs are configured
    const activeIntegrations = Object.entries(integrationIds)
      .filter(([, id]) => id > 0)
      .map(([name, id]) => `${name}=${id}`);

    if (activeIntegrations.length === 0) {
      this.logger.warn('No Paymob integration IDs configured — no payment methods available');
    } else {
      this.logger.log(`Paymob integrations configured: ${activeIntegrations.join(', ')}`);
    }
  }

  /* ============================================================== */
  /*  Public API                                                      */
  /* ============================================================== */

  /**
   * Create a Payment Intention via Paymob API.
   * Returns a client_secret that the frontend uses for the embedded Pixel checkout.
   */
  async initiatePayment(
    transaction: Transaction,
    user: { firstName: string; lastName: string; email: string; phone?: string },
    itemName: string,
    metadata?: Record<string, string>,
  ): Promise<CheckoutResult> {
    const amountCents = Math.round(transaction.amount * 100); // Convert to cents
    const paymentMethods = this.getActiveIntegrationIds();

    if (paymentMethods.length === 0) {
      throw new Error('No Paymob integration IDs configured. Check PAYMOB_*_INTEGRATION_ID env vars.');
    }

    const requestBody: PaymobIntentionRequest = {
      amount: amountCents,
      currency: transaction.currency || 'EGP',
      payment_methods: paymentMethods,
      items: [
        {
          name: itemName,
          amount: amountCents,
          description: `Payment for ${itemName}`,
          quantity: 1,
        },
      ],
      billing_data: {
        first_name: user.firstName || 'N/A',
        last_name: user.lastName || 'N/A',
        email: user.email || 'N/A',
        phone_number: user.phone || '+20000000000',
        apartment: 'N/A',
        floor: 'N/A',
        street: 'N/A',
        building: 'N/A',
        city: 'Cairo',
        state: 'Cairo',
        country: 'EG',
        postal_code: '00000',
      },
      customer: {
        first_name: user.firstName || 'N/A',
        last_name: user.lastName || 'N/A',
        email: user.email,
      },
      // Our internal transaction ID — used to match webhook back to our system
      special_reference: transaction.id,
      // Webhook endpoint (server-to-server)
      notification_url: metadata?.notificationUrl,
      // Where user is redirected after payment
      redirection_url: metadata?.redirectionUrl,
      // Extra data stored with the intention
      extras: {
        transaction_id: transaction.id,
        user_id: transaction.userId,
        payment_type: transaction.type,
        ...(metadata || {}),
      },
    };

    this.logger.log(
      `Creating Paymob intention: amount=${amountCents} currency=${transaction.currency} ` +
        `methods=[${paymentMethods.join(',')}] ref=${transaction.id}`,
    );

    try {
      const response = await axios.post<PaymobIntentionResponse>(
        `${this.config.baseUrl}/v1/intention/`,
        requestBody,
        {
          headers: {
            Authorization: `Token ${this.config.secretKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30s timeout
        },
      );

      const { client_secret, id: intentionId } = response.data;

      if (!client_secret) {
        this.logger.error('Paymob returned no client_secret', response.data);
        throw new Error('Paymob intention creation failed: no client_secret returned');
      }

      const iframeUrl = this.buildCheckoutUrl(client_secret);

      this.logger.log(
        `Paymob intention created: intentionId=${intentionId} ref=${transaction.id}`,
      );

      return {
        paymentUrl: iframeUrl, // Can be used as redirect fallback
        provider: 'paymob',
        transactionId: transaction.id,
        clientSecret: client_secret,
        publicKey: this.config.publicKey,
        iframeUrl,
        providerTransactionId: intentionId,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorData = axiosError.response?.data;
      this.logger.error(
        `Paymob Intention API Error: ${axiosError.message}`,
        JSON.stringify(errorData),
      );
      throw new Error(
        `Paymob payment initialization failed: ${axiosError.message}`,
      );
    }
  }

  /**
   * Build the embedded checkout iframe URL.
   * Frontend can embed this in an <iframe> or use the Pixel SDK with clientSecret.
   */
  buildCheckoutUrl(clientSecret: string): string {
    return `${this.config.baseUrl}/unifiedcheckout/?publicKey=${encodeURIComponent(this.config.publicKey)}&clientSecret=${encodeURIComponent(clientSecret)}`;
  }

  /* ============================================================== */
  /*  Webhook HMAC Verification                                       */
  /* ============================================================== */

  /**
   * Verify HMAC-SHA512 signature for a Paymob webhook.
   * Uses timing-safe comparison to prevent timing attacks.
   *
   * @param payload   The parsed webhook body (contains `obj` with transaction data)
   * @param receivedHmac  The HMAC string from the `?hmac=` query parameter
   * @returns true if HMAC is valid
   */
  verifyWebhook(payload: any, receivedHmac: string): boolean {
    if (!this.config.hmacSecret) {
      this.logger.error('PAYMOB_HMAC_SECRET not configured — cannot verify webhook');
      return false;
    }

    if (!receivedHmac || !payload?.obj) {
      this.logger.warn('Missing HMAC or payload.obj in webhook');
      return false;
    }

    const obj = payload.obj;
    const concatenated = this.concatenateHmacFields(obj);

    const calculatedHmac = crypto
      .createHmac('sha512', this.config.hmacSecret)
      .update(concatenated)
      .digest('hex');

    // Timing-safe comparison to prevent timing attacks
    try {
      const a = Buffer.from(calculatedHmac, 'hex');
      const b = Buffer.from(receivedHmac, 'hex');
      if (a.length !== b.length) {
        this.logger.warn('HMAC length mismatch — possible tampering');
        return false;
      }
      return crypto.timingSafeEqual(a, b);
    } catch {
      this.logger.warn('HMAC comparison failed (invalid hex)');
      return false;
    }
  }

  /* ============================================================== */
  /*  Webhook Data Extraction                                         */
  /* ============================================================== */

  /**
   * Extract standardized transaction data from Paymob webhook payload.
   */
  extractWebhookData(payload: any): WebhookTransactionData {
    const obj = payload?.obj || {};
    const sourceData = obj.source_data || {};
    const order = obj.order || {};

    return {
      providerTransactionId: String(obj.id || ''),
      internalTransactionId: obj.merchant_order_id || obj.payment_key_claims?.extra?.transaction_id || order.merchant_order_id || undefined,
      success: obj.success === true,
      pending: obj.pending === true,
      amountCents: parseInt(obj.amount_cents, 10) || 0,
      currency: obj.currency || 'EGP',
      isRefunded: obj.is_refunded === true,
      isVoided: obj.is_voided === true,
      paymentMethodType: sourceData.type || 'unknown',
      paymentMethodSubType: sourceData.sub_type || 'unknown',
      errorOccurred: obj.error_occured === true,
      rawPayload: payload,
    };
  }

  /**
   * Try to find our internal transaction ID from the webhook payload.
   * Paymob stores our `special_reference` in the order object.
   */
  findInternalTransactionId(payload: any): string | undefined {
    const obj = payload?.obj || {};
    const order = obj.order || {};
    const extras = obj.payment_key_claims?.extra || {};

    // Priority: special_reference → extras.transaction_id → order.merchant_order_id
    return (
      order.merchant_order_id ||
      extras.transaction_id ||
      obj.merchant_order_id ||
      undefined
    );
  }

  /* ============================================================== */
  /*  Private Helpers                                                  */
  /* ============================================================== */

  /**
   * Get all configured (non-zero) integration IDs.
   * Only includes payment methods that have a valid integration ID.
   */
  private getActiveIntegrationIds(): number[] {
    return Object.values(this.config.integrationIds).filter((id) => id > 0);
  }

  /**
   * Concatenate HMAC fields in the exact order Paymob requires.
   * Handles nested fields like `source_data.pan` and `order.id`.
   */
  private concatenateHmacFields(obj: Record<string, any>): string {
    return HMAC_FIELDS.map((field) => {
      const value = this.getNestedValue(obj, field);
      // Convert to string — booleans become "true"/"false"
      return String(value ?? '');
    }).join('');
  }

  /**
   * Access nested object values using dot notation.
   * e.g., getNestedValue(obj, 'source_data.pan') → obj.source_data.pan
   *       getNestedValue(obj, 'order.id')         → obj.order.id
   *
   * Special case: 'order' field at top level is the order object,
   * so 'order.id' means obj.order.id
   */
  private getNestedValue(obj: Record<string, any>, path: string): any {
    const parts = path.split('.');
    let current: any = obj;
    for (const part of parts) {
      if (current == null) return undefined;
      current = current[part];
    }
    return current;
  }
}
