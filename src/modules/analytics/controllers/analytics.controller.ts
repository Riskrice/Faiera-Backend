import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from '../services/analytics.service';
import { Roles } from '../../auth/decorators';
import { Role } from '../../auth/constants/roles.constant';
import {
  OverviewStatsDto,
  UserStatsDto,
  LearningStatsDto,
  RevenueStatsDto,
  RecentSalesDto,
  AnalyticsQueryDto,
} from '../dto';

@Controller('analytics')
@Roles(Role.ADMIN, Role.SUPER_ADMIN) // All analytics endpoints require admin role
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  async getOverview(): Promise<OverviewStatsDto> {
    return this.analyticsService.getOverview();
  }

  @Get('users')
  async getUserAnalytics(@Query() query: AnalyticsQueryDto): Promise<UserStatsDto> {
    return this.analyticsService.getUserAnalytics(query);
  }

  @Get('learning')
  async getLearningAnalytics(): Promise<LearningStatsDto> {
    return this.analyticsService.getLearningAnalytics();
  }

  @Get('revenue')
  async getRevenueAnalytics(): Promise<RevenueStatsDto> {
    return this.analyticsService.getRevenueAnalytics();
  }

  @Get('recent-sales')
  async getRecentSales(): Promise<RecentSalesDto[]> {
    return this.analyticsService.getRecentSales();
  }
}
