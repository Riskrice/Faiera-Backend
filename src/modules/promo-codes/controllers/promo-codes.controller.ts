import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PromoCodesService } from '../services/promo-codes.service';
import {
  CreatePromoCodeDto,
  GeneratePromoCodesDto,
  UpdatePromoCodeDto,
  QueryPromoCodesDto,
  PromoCodeRedemptionsQueryDto,
  ValidatePromoCodeDto,
} from '../dto/promo-code.dto';
import { JwtAuthGuard, CurrentUser, JwtPayload } from '../../auth';
import { PermissionsGuard } from '../../rbac/guards/permissions.guard';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator';
import { createSuccessResponse, createPaginatedResponse } from '../../../common/dto';
import { Throttle } from '@nestjs/throttler';

@Controller('promo-codes')
@UseGuards(PermissionsGuard)
export class PromoCodesController {
  constructor(private readonly promoCodesService: PromoCodesService) {}

  /* ============================================================== */
  /*  Admin / Management Endpoints                                  */
  /* ============================================================== */

  @Post()
  @UseGuards(JwtAuthGuard)
  @RequirePermissions({ action: 'manage', resource: 'promo_codes' })
  async create(@Body() createDto: CreatePromoCodeDto, @CurrentUser() user: JwtPayload) {
    const promoCode = await this.promoCodesService.create(createDto, user.sub);
    return createSuccessResponse(promoCode, 'Promo code created successfully');
  }

  @Post('generate')
  @UseGuards(JwtAuthGuard)
  @RequirePermissions({ action: 'manage', resource: 'promo_codes' })
  async generateBatch(@Body() generateDto: GeneratePromoCodesDto, @CurrentUser() user: JwtPayload) {
    const codes = await this.promoCodesService.generateBatch(generateDto, user.sub);
    return createSuccessResponse(codes, `Successfully generated ${codes.length} promo codes`);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermissions({ action: 'view', resource: 'promo_codes' })
  async findAll(@Query() queryDto: QueryPromoCodesDto) {
    const result = await this.promoCodesService.findAll(queryDto);
    return createPaginatedResponse(
      result.data,
      result.page,
      result.limit,
      result.total,
    );
  }

  @Get('analytics')
  @UseGuards(JwtAuthGuard)
  @RequirePermissions({ action: 'view', resource: 'promo_codes' })
  async getAnalytics() {
    const analytics = await this.promoCodesService.getAnalytics();
    return createSuccessResponse(analytics);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermissions({ action: 'view', resource: 'promo_codes' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const promoCode = await this.promoCodesService.findById(id);
    return createSuccessResponse(promoCode);
  }

  @Get(':id/redemptions')
  @UseGuards(JwtAuthGuard)
  @RequirePermissions({ action: 'view', resource: 'promo_codes' })
  async getRedemptions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PromoCodeRedemptionsQueryDto,
  ) {
    const result = await this.promoCodesService.getRedemptions(
      id,
      query.page || 1,
      query.limit || 10,
    );
    return createPaginatedResponse(
      result.data,
      result.page,
      result.limit,
      result.total,
    );
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @RequirePermissions({ action: 'manage', resource: 'promo_codes' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdatePromoCodeDto,
  ) {
    const promoCode = await this.promoCodesService.update(id, updateDto);
    return createSuccessResponse(promoCode, 'Promo code updated successfully');
  }

  @Patch(':id/deactivate')
  @UseGuards(JwtAuthGuard)
  @RequirePermissions({ action: 'manage', resource: 'promo_codes' })
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const promoCode = await this.promoCodesService.deactivate(id, user.sub);
    return createSuccessResponse(promoCode, 'Promo code deactivated');
  }

  @Patch(':id/reactivate')
  @UseGuards(JwtAuthGuard)
  @RequirePermissions({ action: 'manage', resource: 'promo_codes' })
  async reactivate(@Param('id', ParseUUIDPipe) id: string) {
    const promoCode = await this.promoCodesService.reactivate(id);
    return createSuccessResponse(promoCode, 'Promo code reactivated');
  }

  /* ============================================================== */
  /*  Public / Student Endpoints                                    */
  /* ============================================================== */

  @Post('validate')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // Max 10 attempts per minute per user to prevent brute force
  async validateCode(
    @Body() validateDto: ValidatePromoCodeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.promoCodesService.validate(validateDto, user.sub);
    return createSuccessResponse(result, 'Promo code is valid');
  }
}
