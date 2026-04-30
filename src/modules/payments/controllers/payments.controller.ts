import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  Get,
  Query,
  Headers,
  ForbiddenException,
  Logger,
  RawBodyRequest,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from '../services/payments.service';
import { FawaterkService } from '../services/fawaterk.service';
import { PaymobService } from '../services/paymob.service';
import { JwtAuthGuard, CurrentUser, JwtPayload, Public } from '../../auth';
import { ApiResponse, createSuccessResponse } from '../../../common/dto';
import { ConfigService } from '@nestjs/config';
import { CheckoutResult } from '../interfaces/payment-provider.interface';
import * as crypto from 'crypto';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly fawaterkService: FawaterkService,
    private readonly paymobService: PaymobService,
    private readonly configService: ConfigService,
  ) {}

  /* ============================================================== */
  /*  Checkout Endpoints (Authenticated)                              */
  /* ============================================================== */

  @Post('checkout/session/:sessionId')
  @UseGuards(JwtAuthGuard)
  async checkoutSession(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<CheckoutResult>> {
    const result = await this.paymentsService.createSessionCheckout(sessionId, user.sub);
    return createSuccessResponse(result);
  }

  @Post('checkout/subscription/:planId')
  @UseGuards(JwtAuthGuard)
  async checkoutSubscription(
    @Param('planId', ParseUUIDPipe) planId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<CheckoutResult>> {
    const result = await this.paymentsService.createSubscriptionCheckout(planId, user.sub);
    return createSuccessResponse(result);
  }

  @Post('checkout/course/:courseId')
  @UseGuards(JwtAuthGuard)
  async checkoutCourse(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<CheckoutResult>> {
    const result = await this.paymentsService.createCourseCheckout(courseId, user.sub);
    return createSuccessResponse(result);
  }

  /* ============================================================== */
  /*  Paymob Webhook (Server-to-Server)                               */
  /* ============================================================== */

  /**
   * Paymob sends a POST to this endpoint after every payment event.
   * HMAC is passed as a query parameter: ?hmac=xxxx
   *
   * ⚠️ We return 200 immediately to prevent Paymob from retrying.
   *    Fulfillment happens asynchronously in handlePaymobCallback.
   */
  @Post('paymob/webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  async paymobWebhook(
    @Req() _req: RawBodyRequest<Request>,
    @Query('hmac') hmac: string,
    @Body() payload: any,
  ) {
    this.logger.log(
      `Paymob webhook received: type=${payload?.type} txnId=${payload?.obj?.id} hmac=${hmac ? 'present' : 'missing'}`,
    );

    // 1. Verify HMAC signature
    if (!hmac) {
      this.logger.warn('Paymob webhook received without HMAC — rejecting');
      throw new ForbiddenException('Missing HMAC signature');
    }

    const isValid = this.paymobService.verifyWebhook(payload, hmac);
    if (!isValid) {
      this.logger.warn('Paymob webhook HMAC verification failed — rejecting');
      throw new ForbiddenException('Invalid HMAC signature');
    }

    this.logger.log('Paymob webhook HMAC verified successfully');

    // 2. Process the callback (async — we've already returned 200)
    try {
      await this.paymentsService.handlePaymobCallback(payload);
    } catch (error) {
      // Log but don't throw — we already acknowledged the webhook
      this.logger.error('Error processing Paymob webhook', (error as Error).message);
    }

    return { status: 'success' };
  }

  /**
   * Paymob redirects the user to this URL after payment.
   * This is for frontend UX only — we do NOT trust this for fulfillment.
   * The actual status is determined by the webhook above.
   *
   * Query params from Paymob include transaction details + hmac
   */
  @Get('paymob/callback')
  @Public()
  async paymobCallback(
    @Query('success') success: string,
    @Query('id') transactionId: string,
    @Query('hmac') _hmac: string,
    @Query() _allQuery: any,
  ) {
    this.logger.log(
      `Paymob redirect callback: success=${success} txnId=${transactionId}`,
    );

    // Optionally verify HMAC on redirect too (for extra security)
    // Note: redirect HMAC uses GET params, not POST body
    // We don't rely on this for fulfillment — webhook is the source of truth

    return {
      message: 'Payment processed',
      success: success === 'true',
      transactionId,
    };
  }

  /* ============================================================== */
  /*  Fawaterak Webhook (Legacy — preserved)                          */
  /* ============================================================== */

  /**
   * Fawaterak server-to-server webhook.
   * Original implementation preserved for backward compatibility.
   */
  @Post('webhook')
  @Public()
  async fawaterkWebhook(
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
      this.logger.warn('Invalid Fawaterak webhook signature received');
      throw new ForbiddenException('Invalid webhook signature');
    }

    if (payload.invoice_id && payload.invoice_status) {
      await this.paymentsService.handleFawaterkCallback(
        payload.invoice_id.toString(),
        payload.invoice_status,
      );
    }
    return { status: 'success' };
  }

  /**
   * Fawaterak frontend redirect callback.
   * Verifies status from Fawaterak API — does NOT trust query params.
   */
  @Public()
  @Get('callback')
  async fawaterkCallback(@Query('invoice_id') invoiceId: string) {
    if (invoiceId) {
      const invoice = await this.fawaterkService.getInvoiceStatus(invoiceId);
      const verifiedStatus =
        invoice?.data?.invoice_status || invoice?.invoice_status || 'unknown';
      await this.paymentsService.handleFawaterkCallback(invoiceId, verifiedStatus);
    }
    return { message: 'Payment processed' };
  }
}
