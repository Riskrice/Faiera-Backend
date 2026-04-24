import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ForbiddenException,
} from '@nestjs/common';
import { SubscriptionsService } from '../services/subscriptions.service';
import {
  CreatePlanDto,
  UpdatePlanDto,
  PlanQueryDto,
  CreateSubscriptionDto,
  CancelSubscriptionDto,
  AccessCheckResult,
} from '../dto';
import { SubscriptionPlan, Subscription } from '../entities';
import {
  PaginationQueryDto,
  createSuccessResponse,
  createPaginatedResponse,
  ApiResponse,
  PaginatedResponse,
} from '../../../common/dto';
import {
  JwtAuthGuard,
  RbacGuard,
  Roles,
  Permissions,
  CurrentUser,
  JwtPayload,
  Public,
} from '../../auth';
import { Role, Permission } from '../../auth/constants/roles.constant';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard, RbacGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  // ==================== Plans (Admin) ====================

  @Post('plans')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Permissions(Permission.SUBSCRIPTION_WRITE)
  async createPlan(@Body() dto: CreatePlanDto): Promise<ApiResponse<SubscriptionPlan>> {
    const plan = await this.subscriptionsService.createPlan(dto);
    return createSuccessResponse(plan, 'Plan created successfully');
  }

  @Get('plans')
  @Public() // Public for catalog
  async findAllPlans(
    @Query() query: PlanQueryDto,
    @Query() pagination: PaginationQueryDto,
  ): Promise<PaginatedResponse<SubscriptionPlan>> {
    const { plans, total } = await this.subscriptionsService.findAllPlans(query, pagination);
    return createPaginatedResponse(plans, pagination.page || 1, pagination.pageSize || 20, total);
  }

  @Get('plans/active')
  @Public()
  async findActivePlans(@Query('grade') grade?: string): Promise<ApiResponse<SubscriptionPlan[]>> {
    const plans = await this.subscriptionsService.findActivePlans(grade);
    return createSuccessResponse(plans);
  }

  @Get('plans/:id')
  @Public()
  async findPlan(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<SubscriptionPlan>> {
    const plan = await this.subscriptionsService.findPlanById(id);
    return createSuccessResponse(plan);
  }

  @Put('plans/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Permissions(Permission.SUBSCRIPTION_WRITE)
  async updatePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanDto,
  ): Promise<ApiResponse<SubscriptionPlan>> {
    const plan = await this.subscriptionsService.updatePlan(id, dto);
    return createSuccessResponse(plan, 'Plan updated successfully');
  }

  @Delete('plans/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Permissions(Permission.SUBSCRIPTION_WRITE)
  async deletePlan(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<null>> {
    await this.subscriptionsService.deletePlan(id);
    return createSuccessResponse(null, 'Plan deleted successfully');
  }

  // ==================== User Subscriptions ====================

  @Get('my')
  async getMySubscriptions(@CurrentUser() user: JwtPayload): Promise<ApiResponse<Subscription[]>> {
    const subscriptions = await this.subscriptionsService.findUserSubscriptions(user.sub);
    return createSuccessResponse(subscriptions);
  }

  @Get('my/active')
  async getMyActiveSubscription(
    @CurrentUser() user: JwtPayload,
    @Query('grade') grade: string,
  ): Promise<ApiResponse<Subscription | null>> {
    const subscription = await this.subscriptionsService.findActiveSubscription(user.sub, grade);
    return createSuccessResponse(subscription);
  }

  @Get('check-access')
  async checkMyAccess(
    @CurrentUser() user: JwtPayload,
    @Query('grade') grade: string,
    @Query('subject') subject: string,
  ): Promise<ApiResponse<AccessCheckResult>> {
    const result = await this.subscriptionsService.checkAccess(user.sub, grade, subject);
    return createSuccessResponse(result);
  }

  // ==================== Admin Subscriptions ====================

  @Post()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Permissions(Permission.SUBSCRIPTION_WRITE)
  async createSubscription(@Body() dto: CreateSubscriptionDto): Promise<ApiResponse<Subscription>> {
    const subscription = await this.subscriptionsService.createSubscription(dto);
    return createSuccessResponse(subscription, 'Subscription created successfully');
  }

  @Get('user/:userId')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Permissions(Permission.SUBSCRIPTION_READ)
  async getUserSubscriptions(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<ApiResponse<Subscription[]>> {
    const subscriptions = await this.subscriptionsService.findUserSubscriptions(userId);
    return createSuccessResponse(subscriptions);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Permissions(Permission.SUBSCRIPTION_READ)
  async findSubscription(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<Subscription>> {
    const subscription = await this.subscriptionsService.findSubscriptionById(id);
    return createSuccessResponse(subscription);
  }

  @Patch(':id/activate')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Permissions(Permission.SUBSCRIPTION_WRITE)
  async activateSubscription(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('paymentId') paymentId: string,
  ): Promise<ApiResponse<Subscription>> {
    const subscription = await this.subscriptionsService.activateSubscription(id, paymentId);
    return createSuccessResponse(subscription, 'Subscription activated successfully');
  }

  @Patch(':id/cancel')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Permissions(Permission.SUBSCRIPTION_WRITE)
  async cancelSubscription(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelSubscriptionDto,
  ): Promise<ApiResponse<Subscription>> {
    const subscription = await this.subscriptionsService.cancelSubscription(id, dto);
    return createSuccessResponse(subscription, 'Subscription cancelled successfully');
  }

  // User self-cancel
  @Patch('my/:id/cancel')
  async cancelMySubscription(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelSubscriptionDto,
  ): Promise<ApiResponse<Subscription>> {
    // Verify ownership
    const subscription = await this.subscriptionsService.findSubscriptionById(id);
    if (subscription.userId !== user.sub) {
      throw new ForbiddenException('You do not have permission to cancel this subscription');
    }
    const cancelled = await this.subscriptionsService.cancelSubscription(id, dto);
    return createSuccessResponse(cancelled, 'Subscription cancelled successfully');
  }
}
