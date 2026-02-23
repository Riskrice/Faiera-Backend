// ==================== Overview ====================

export class OverviewStatsDto {
    totalUsers!: number;
    totalStudents!: number;
    totalTeachers!: number;
    activeUsersToday!: number;
    activeUsersThisWeek!: number;
    activeUsersThisMonth!: number;
    totalCourses!: number;
    totalLessons!: number;
    totalAssessments!: number;
    totalSubscriptions!: number;
    activeSubscriptions!: number;
    totalRevenue!: number;
    revenueThisMonth!: number;
    revenueGrowth!: number;
    userGrowth!: number;
    courseGrowth!: number;
    completedCourses!: number;
}

// ==================== User Analytics ====================

export class UserStatsDto {
    totalUsers!: number;
    byRole!: {
        students: number;
        teachers: number;
        admins: number;
    };
    newRegistrations!: {
        today: number;
        thisWeek: number;
        thisMonth: number;
    };
    activeUsers!: {
        daily: number;
        weekly: number;
        monthly: number;
    };
    registrationTrend!: TrendDataPoint[];
}

export class TrendDataPoint {
    date!: string;
    count!: number;
}

// ==================== Learning Analytics ====================

export class LearningStatsDto {
    courseStats!: {
        totalCourses: number;
        totalEnrollments: number;
        averageCompletionRate: number;
    };
    lessonStats!: {
        totalLessons: number;
        totalViews: number;
        averageWatchTime: number;
    };
    assessmentStats!: {
        totalAssessments: number;
        totalAttempts: number;
        averageScore: number;
        passRate: number;
    };
    topCourses!: TopContentItem[];
    topLessons!: TopContentItem[];
}

export class TopContentItem {
    id!: string;
    name!: string;
    count!: number; // views or enrollments
}

// ==================== Revenue Analytics ====================

export class RevenueStatsDto {
    totalRevenue!: number;
    revenueByPeriod!: {
        today: number;
        thisWeek: number;
        thisMonth: number;
        thisYear: number;
    };
    subscriptionStats!: {
        total: number;
        active: number;
        expired: number;
        cancelled: number;
    };
    planPopularity!: PlanStatsItem[];
    revenueTrend!: TrendDataPoint[];
    churnRate!: number;
}

export class PlanStatsItem {
    planId!: string;
    planName!: string;
    subscriptionCount!: number;
    revenue!: number;
}

// ==================== Teacher Analytics ====================

export class TeacherStatsDto {
    teacherId!: string;
    name!: string;
    totalStudents!: number;
    totalSessions!: number;
    completedSessions!: number;
    averageRating!: number;
    totalReviews!: number;
    totalEarnings!: number;
}

// ==================== Recent Sales ====================

export class RecentSalesDto {
    id!: string;
    studentName!: string;
    studentEmail!: string;
    amount!: number;
    currency!: string;
    date!: Date;
    avatarUrl?: string;
}

// ==================== Query DTOs ====================

import { IsOptional, IsEnum, IsDateString } from 'class-validator';

export class AnalyticsQueryDto {
    @IsOptional()
    @IsDateString()
    startDate?: Date;

    @IsOptional()
    @IsDateString()
    endDate?: Date;

    @IsOptional()
    @IsEnum(['day', 'week', 'month', 'year'])
    period?: 'day' | 'week' | 'month' | 'year';
}
