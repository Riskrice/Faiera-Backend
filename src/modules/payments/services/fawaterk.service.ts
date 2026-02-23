import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import fawaterkConfig from '../../../config/fawaterk.config';
import axios from 'axios';

export interface FawaterkPaymentRequest {
    cartTotal: number;
    currency: string;
    customer: {
        first_name: string;
        last_name: string;
        email: string;
        phone: string;
        address: string;
    };
    redirectionUrls: {
        successUrl: string;
        failUrl: string;
        pendingUrl: string;
    };
    cartItems: {
        name: string;
        price: number;
        quantity: number;
    }[];
    payLoad?: {
        custom_field_1?: string; // e.g. userId
        custom_field_2?: string; // e.g. referenceId
        custom_field_3?: string; // e.g. type
    };
    paymentMethodId?: number;
}

export interface FawaterkResponse {
    status: string;
    data: {
        invoice_id: number;
        invoice_key: string;
        payment_data: {
            fawryCode?: string;
            meezaReference?: string;
            redirectTo?: string;
        }
    }
}

@Injectable()
export class FawaterkService {
    private readonly logger = new Logger(FawaterkService.name);

    constructor(
        @Inject(fawaterkConfig.KEY)
        private readonly config: ConfigType<typeof fawaterkConfig>,
    ) { }

    async initiatePayment(request: FawaterkPaymentRequest): Promise<any> {
        try {
            const payload = {
                cartTotal: request.cartTotal,
                currency: request.currency,
                customer: request.customer,
                redirectionUrls: request.redirectionUrls,
                cartItems: request.cartItems,
                payLoad: request.payLoad,
                payment_method_id: request.paymentMethodId || 2, // Default to 2 (Cards/Online)
                sendEmail: true,
                sendSMS: false
            };

            this.logger.log(`Initiating Fawaterk payment (Invoice Link): ${JSON.stringify(payload)}`);

            const response = await axios.post(
                `${this.config.baseUrl}/createInvoiceLink`,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                },
            );

            this.logger.log(`Fawaterk Response: ${JSON.stringify(response.data)}`);
            return response.data;
        } catch (error: any) {
            this.logger.error(`Fawaterk API Error: ${error.message}`, error.response?.data);
            throw new Error(`Payment initialization failed: ${error.message}`);
        }
    }

    async getInvoiceStatus(invoiceId: string): Promise<any> {
        try {
            const response = await axios.get(
                `${this.config.baseUrl}/getInvoiceStatus/${invoiceId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`,
                    },
                },
            );

            return response.data;
        } catch (error: any) {
            this.logger.error(`Fawaterk Status Check Error: ${error.message}`, error.response?.data);
            throw error;
        }
    }
}
