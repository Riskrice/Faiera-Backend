import { Controller, Post, Param, Body, UseGuards, Get, Query, Headers, ForbiddenException, Logger, RawBodyRequest, Req, ParseUUIDPipe } from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from '../services/payments.service';
import { FawaterkService } from '../services/fawaterk.service';
import { JwtAuthGuard, CurrentUser, JwtPayload, Public } from '../../auth';
import { ApiResponse, createSuccessResponse } from '../../../common/dto';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Controller('payments')
export class PaymentsController {
    private readonly logger = new Logger(PaymentsController.name);

    constructor(
        private readonly paymentsService: PaymentsService,
        private readonly fawaterkService: FawaterkService,
        private readonly configService: ConfigService,
    ) { }

    @Post('checkout/session/:sessionId')
    @UseGuards(JwtAuthGuard)
    async checkoutSession(
        @Param('sessionId', ParseUUIDPipe) sessionId: string,
        @CurrentUser() user: JwtPayload,
    ): Promise<ApiResponse<{ paymentUrl: string }>> {
        const result = await this.paymentsService.createSessionCheckout(sessionId, user.sub);
        return createSuccessResponse(result);
    }

    @Post('checkout/subscription/:planId')
    @UseGuards(JwtAuthGuard)
    async checkoutSubscription(
        @Param('planId', ParseUUIDPipe) planId: string,
        @CurrentUser() user: JwtPayload,
    ): Promise<ApiResponse<{ paymentUrl: string }>> {
        const result = await this.paymentsService.createSubscriptionCheckout(planId, user.sub);
        return createSuccessResponse(result);
    }

    @Post('checkout/course/:courseId')
    @UseGuards(JwtAuthGuard)
    async checkoutCourse(
        @Param('courseId', ParseUUIDPipe) courseId: string,
        @CurrentUser() user: JwtPayload,
    ): Promise<ApiResponse<{ paymentUrl: string }>> {
        const result = await this.paymentsService.createCourseCheckout(courseId, user.sub);
        return createSuccessResponse(result);
    }

    // Webhook for server-to-server updates
    @Post('webhook')
    @Public()
    async webhook(
        @Req() req: RawBodyRequest<Request>,
        @Headers('x-fawaterk-signature') signature: string,
        @Body() payload: any,
    ) {
        // Verify webhook signature
        const webhookSecret = this.configService.get<string>('FAWATERK_WEBHOOK_SECRET');
        if (!webhookSecret) {
            this.logger.error('FAWATERK_WEBHOOK_SECRET not configured — rejecting webhook');
            throw new ForbiddenException('Webhook verification unavailable');
        }

        const rawBody = req.rawBody?.toString() || JSON.stringify(payload);
        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(rawBody)
            .digest('hex');

        if (!signature || signature !== expectedSignature) {
            this.logger.warn('Invalid webhook signature received');
            throw new ForbiddenException('Invalid webhook signature');
        }

        if (payload.invoice_id && payload.invoice_status) {
            await this.paymentsService.handleCallback(payload.invoice_id.toString(), payload.invoice_status);
        }
        return { status: 'success' };
    }

    // Callback for frontend redirect — Fawaterk redirects here (unauthenticated)
    // Do NOT trust the query-param status; always verify from Fawaterk's API
    @Public()
    @Get('callback')
    async callback(@Query('invoice_id') invoiceId: string) {
        if (invoiceId) {
            const invoice = await this.fawaterkService.getInvoiceStatus(invoiceId);
            const verifiedStatus = invoice?.data?.invoice_status || invoice?.invoice_status || 'unknown';
            await this.paymentsService.handleCallback(invoiceId, verifiedStatus);
        }
        return { message: 'Payment processed' };
    }
}
