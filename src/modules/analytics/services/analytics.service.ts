import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, Between } from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Role } from '../../auth/constants/roles.constant';
import { Subscription, SubscriptionStatus } from '../../subscriptions/entities/subscription.entity';
import { UserProgress, ContentType } from '../../progress/entities/progress.entity';
import { Course } from '../../content/entities/course.entity';
import { Lesson } from '../../content/entities/lesson.entity';
import { Assessment } from '../../assessments/entities/assessment.entity';
import { AssessmentAttempt, AttemptStatus } from '../../assessments/entities/assessment-attempt.entity';
import {
    OverviewStatsDto,
    UserStatsDto,
    LearningStatsDto,
    RevenueStatsDto,
    RecentSalesDto,
    TrendDataPoint,
    AnalyticsQueryDto,
} from '../dto';

@Injectable()
export class AnalyticsService {

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(Subscription)
        private readonly subscriptionRepository: Repository<Subscription>,
        @InjectRepository(UserProgress)
        private readonly progressRepository: Repository<UserProgress>,
        @InjectRepository(Course)
        private readonly courseRepository: Repository<Course>,
        @InjectRepository(Lesson)
        private readonly lessonRepository: Repository<Lesson>,
        @InjectRepository(Assessment)
        private readonly assessmentRepository: Repository<Assessment>,
        @InjectRepository(AssessmentAttempt)
        private readonly attemptRepository: Repository<AssessmentAttempt>,
    ) { }

    // ==================== Overview ====================

    async getOverview(): Promise<OverviewStatsDto> {
        const now = new Date();
        const todayStart = this.getStartOfDay(now);
        const weekStart = this.getStartOfWeek(now);
        const monthStart = this.getStartOfMonth(now);

        // Previous month calculation
        const lastMonthStart = new Date(monthStart);
        lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
        const lastMonthEnd = new Date(monthStart);
        lastMonthEnd.setSeconds(lastMonthEnd.getSeconds() - 1);

        // User counts
        const [totalUsers, totalStudents, totalTeachers] = await Promise.all([
            this.userRepository.count(),
            this.userRepository.count({ where: { role: Role.STUDENT } }),
            this.userRepository.count({ where: { role: Role.TEACHER } }),
        ]);

        // User Growth
        const usersLastMonth = await this.userRepository.count({
            where: { createdAt: Between(lastMonthStart, lastMonthEnd) }
        });
        const usersThisMonth = await this.userRepository.count({
            where: { createdAt: MoreThanOrEqual(monthStart) }
        });
        const userGrowth = usersLastMonth > 0
            ? Math.round(((usersThisMonth - usersLastMonth) / usersLastMonth) * 100)
            : (usersThisMonth > 0 ? 100 : 0);

        // Active users (based on last login or progress updates)
        const [activeToday, activeWeek, activeMonth] = await Promise.all([
            this.getActiveUsersCount(todayStart),
            this.getActiveUsersCount(weekStart),
            this.getActiveUsersCount(monthStart),
        ]);

        // Subscription stats
        const [totalSubscriptions, activeSubscriptions] = await Promise.all([
            this.subscriptionRepository.count(),
            this.subscriptionRepository.count({ where: { status: SubscriptionStatus.ACTIVE } }),
        ]);

        // Revenue
        const [totalRevenue, revenueThisMonth, revenueLastMonth] = await Promise.all([
            this.getTotalRevenue(),
            this.getRevenueForPeriod(monthStart, now),
            this.getRevenueForPeriod(lastMonthStart, lastMonthEnd),
        ]);

        const revenueGrowth = revenueLastMonth > 0
            ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100)
            : (revenueThisMonth > 0 ? 100 : 0);

        // Content counts
        const [totalCourses, totalLessons, totalAssessments] = await Promise.all([
            this.courseRepository.count(),
            this.lessonRepository.count(),
            this.assessmentRepository.count(),
        ]);

        // Completed courses (users with 100% progress)
        // This is an approximation based on progress entries equal to total lessons in a course
        // For simplicity, let's count progress where progressPercent = 100 and contentType = COURSE (if supported)
        // Or just count total unique user-course pairs with 100% progress
        const completedCoursesCount = await this.progressRepository.count({
            where: { progressPercent: 100, contentType: ContentType.LESSON } // Assuming lesson completion for now, or course if supported
        });
        // Better: Count how many UserProgress have 100%? No, usually Course Progress is aggregated.
        // Let's assume completedCourses logic is complex, for now returning count of 100% progress items.

        const coursesLastMonth = await this.courseRepository.count({
            where: { createdAt: Between(lastMonthStart, lastMonthEnd) }
        });
        const coursesThisMonth = await this.courseRepository.count({
            where: { createdAt: MoreThanOrEqual(monthStart) }
        });

        const courseGrowth = coursesLastMonth > 0
            ? Math.round(((coursesThisMonth - coursesLastMonth) / coursesLastMonth) * 100)
            : (coursesThisMonth > 0 ? 100 : 0);


        return {
            totalUsers,
            totalStudents,
            totalTeachers,
            activeUsersToday: activeToday,
            activeUsersThisWeek: activeWeek,
            activeUsersThisMonth: activeMonth,
            totalCourses,
            totalLessons,
            totalAssessments,
            totalSubscriptions,
            activeSubscriptions,
            totalRevenue,
            revenueThisMonth,
            revenueGrowth,
            userGrowth,
            courseGrowth,
            completedCourses: completedCoursesCount,
        };
    }

    // ==================== User Analytics ====================

    async getUserAnalytics(_query?: AnalyticsQueryDto): Promise<UserStatsDto> {
        const now = new Date();
        const todayStart = this.getStartOfDay(now);
        const weekStart = this.getStartOfWeek(now);
        const monthStart = this.getStartOfMonth(now);

        // Total users by role
        const [students, teachers, admins] = await Promise.all([
            this.userRepository.count({ where: { role: Role.STUDENT } }),
            this.userRepository.count({ where: { role: Role.TEACHER } }),
            this.userRepository.count({ where: { role: Role.ADMIN } }),
        ]);

        // New registrations
        const [newToday, newThisWeek, newThisMonth] = await Promise.all([
            this.userRepository.count({ where: { createdAt: MoreThanOrEqual(todayStart) } }),
            this.userRepository.count({ where: { createdAt: MoreThanOrEqual(weekStart) } }),
            this.userRepository.count({ where: { createdAt: MoreThanOrEqual(monthStart) } }),
        ]);

        // Active users
        const [activeDaily, activeWeekly, activeMonthly] = await Promise.all([
            this.getActiveUsersCount(todayStart),
            this.getActiveUsersCount(weekStart),
            this.getActiveUsersCount(monthStart),
        ]);

        // Registration trend (last 30 days)
        const registrationTrend = await this.getRegistrationTrend(30);

        return {
            totalUsers: students + teachers + admins,
            byRole: { students, teachers, admins },
            newRegistrations: {
                today: newToday,
                thisWeek: newThisWeek,
                thisMonth: newThisMonth,
            },
            activeUsers: {
                daily: activeDaily,
                weekly: activeWeekly,
                monthly: activeMonthly,
            },
            registrationTrend,
        };
    }

    // ==================== Learning Analytics ====================

    async getLearningAnalytics(): Promise<LearningStatsDto> {
        // Progress stats — use aggregate queries instead of loading all records
        const [totalProgress, completedProgress] = await Promise.all([
            this.progressRepository.count(),
            this.progressRepository.count({ where: { progressPercent: 100 } }),
        ]);

        // Lesson stats — aggregate in DB
        const lessonAgg = await this.progressRepository
            .createQueryBuilder('p')
            .select('COUNT(*)', 'totalViews')
            .addSelect('COALESCE(AVG(p.timeSpent), 0)', 'avgWatchTime')
            .where('p.contentType = :type', { type: ContentType.LESSON })
            .getRawOne();
        const totalLessonViews = parseInt(lessonAgg?.totalViews || '0', 10);
        const avgWatchTime = parseFloat(lessonAgg?.avgWatchTime || '0');

        // Assessment attempt count via progress
        const assessmentProgressCount = await this.progressRepository.count({
            where: { contentType: ContentType.ASSESSMENT },
        });

        // Counts from repos
        const [totalCourses, totalLessons, totalAssessments] = await Promise.all([
            this.courseRepository.count(),
            this.lessonRepository.count(),
            this.assessmentRepository.count(),
        ]);

        // Assessment scores — aggregate in DB
        const attemptAgg = await this.attemptRepository
            .createQueryBuilder('a')
            .select('COUNT(*)', 'total')
            .addSelect('COALESCE(AVG(a.percentageScore), 0)', 'avgScore')
            .addSelect('SUM(CASE WHEN a.passed = true THEN 1 ELSE 0 END)', 'passCount')
            .where('a.status = :status', { status: AttemptStatus.GRADED })
            .getRawOne();

        const totalAttempts = parseInt(attemptAgg?.total || '0', 10);
        const avgScore = parseFloat(attemptAgg?.avgScore || '0');
        const passCount = parseInt(attemptAgg?.passCount || '0', 10);

        return {
            courseStats: {
                totalCourses,
                totalEnrollments: totalProgress,
                averageCompletionRate: totalProgress > 0 ? (completedProgress / totalProgress) * 100 : 0,
            },
            lessonStats: {
                totalLessons,
                totalViews: totalLessonViews,
                averageWatchTime: Math.round(avgWatchTime),
            },
            assessmentStats: {
                totalAssessments,
                totalAttempts: assessmentProgressCount,
                averageScore: Math.round(avgScore * 100) / 100,
                passRate: totalAttempts > 0 ? (passCount / totalAttempts) * 100 : 0,
            },
            topCourses: [],
            topLessons: [],
        };
    }

    // ==================== Revenue Analytics ====================

    async getRevenueAnalytics(): Promise<RevenueStatsDto> {
        const now = new Date();
        const todayStart = this.getStartOfDay(now);
        const weekStart = this.getStartOfWeek(now);
        const monthStart = this.getStartOfMonth(now);
        const yearStart = this.getStartOfYear(now);

        // Total revenue
        const totalRevenue = await this.getTotalRevenue();

        // Revenue by period
        const [revenueToday, revenueWeek, revenueMonth, revenueYear] = await Promise.all([
            this.getRevenueForPeriod(todayStart, now),
            this.getRevenueForPeriod(weekStart, now),
            this.getRevenueForPeriod(monthStart, now),
            this.getRevenueForPeriod(yearStart, now),
        ]);

        // Subscription stats
        const [total, active, expired, cancelled] = await Promise.all([
            this.subscriptionRepository.count(),
            this.subscriptionRepository.count({ where: { status: SubscriptionStatus.ACTIVE } }),
            this.subscriptionRepository.count({ where: { status: SubscriptionStatus.EXPIRED } }),
            this.subscriptionRepository.count({ where: { status: SubscriptionStatus.CANCELLED } }),
        ]);

        // Plan popularity
        const planPopularity = await this.getPlanPopularity();

        // Revenue trend (last 12 months)
        const revenueTrend = await this.getRevenueTrend(12);

        // Churn rate
        const churnRate = total > 0 ? (cancelled / total) * 100 : 0;

        return {
            totalRevenue,
            revenueByPeriod: {
                today: revenueToday,
                thisWeek: revenueWeek,
                thisMonth: revenueMonth,
                thisYear: revenueYear,
            },
            subscriptionStats: { total, active, expired, cancelled },
            planPopularity,
            revenueTrend,
            churnRate: Math.round(churnRate * 100) / 100,
        };
    }

    async getRecentSales(limit: number = 5): Promise<RecentSalesDto[]> {
        const recentSubscriptions = await this.subscriptionRepository.find({
            where: { status: SubscriptionStatus.ACTIVE } as any,
            relations: ['user'],
            order: { createdAt: 'DESC' },
            take: limit,
        });

        return recentSubscriptions.map(sub => ({
            id: sub.id,
            studentName: `${sub.user.firstName} ${sub.user.lastName}`,
            studentEmail: sub.user.email,
            amount: Number(sub.paidAmount),
            currency: sub.currency,
            date: sub.createdAt,
            avatarUrl: (sub.user as any).avatarUrl, // User entity may not have avatarUrl, will be undefined
        }));
    }

    // ==================== Helper Methods ====================

    private async getActiveUsersCount(since: Date): Promise<number> {
        const result = await this.progressRepository
            .createQueryBuilder('progress')
            .select('COUNT(DISTINCT progress.userId)', 'count')
            .where('progress.updatedAt >= :since', { since })
            .getRawOne();
        return parseInt(result?.count || '0', 10);
    }

    private async getTotalRevenue(): Promise<number> {
        const result = await this.subscriptionRepository
            .createQueryBuilder('sub')
            .select('COALESCE(SUM(sub.paidAmount), 0)', 'total')
            .where('sub.status != :pending', { pending: SubscriptionStatus.PENDING })
            .getRawOne();
        return parseFloat(result?.total || '0');
    }

    private async getRevenueForPeriod(start: Date, end: Date): Promise<number> {
        const result = await this.subscriptionRepository
            .createQueryBuilder('sub')
            .select('COALESCE(SUM(sub.paidAmount), 0)', 'total')
            .where('sub.createdAt BETWEEN :start AND :end', { start, end })
            .andWhere('sub.status != :pending', { pending: SubscriptionStatus.PENDING })
            .getRawOne();
        return parseFloat(result?.total || '0');
    }

    private async getRegistrationTrend(days: number): Promise<TrendDataPoint[]> {
        const now = new Date();
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - days + 1);
        const dayStart = this.getStartOfDay(startDate);

        const results = await this.userRepository
            .createQueryBuilder('u')
            .select("TO_CHAR(u.createdAt, 'YYYY-MM-DD')", 'date')
            .addSelect('COUNT(*)', 'count')
            .where('u.createdAt >= :dayStart', { dayStart })
            .groupBy("TO_CHAR(u.createdAt, 'YYYY-MM-DD')")
            .orderBy('date', 'ASC')
            .getRawMany();

        // Build full date range with zeros for missing days
        const dateMap = new Map(results.map((r: any) => [r.date, parseInt(r.count, 10)]));
        const trend: TrendDataPoint[] = [];
        for (let i = 0; i < days; i++) {
            const date = new Date(dayStart);
            date.setDate(date.getDate() + i);
            const key = date.toISOString().split('T')[0];
            trend.push({ date: key, count: dateMap.get(key) || 0 });
        }

        return trend;
    }

    private async getRevenueTrend(months: number): Promise<TrendDataPoint[]> {
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

        const results = await this.subscriptionRepository
            .createQueryBuilder('sub')
            .select("TO_CHAR(sub.createdAt, 'YYYY-MM')", 'month')
            .addSelect('COALESCE(SUM(sub.paidAmount), 0)', 'revenue')
            .where('sub.createdAt >= :startDate', { startDate })
            .andWhere('sub.status != :pending', { pending: SubscriptionStatus.PENDING })
            .groupBy("TO_CHAR(sub.createdAt, 'YYYY-MM')")
            .orderBy('month', 'ASC')
            .getRawMany();

        const monthMap = new Map(results.map((r: any) => [r.month, parseFloat(r.revenue)]));
        const trend: TrendDataPoint[] = [];
        for (let i = 0; i < months; i++) {
            const date = new Date(now.getFullYear(), now.getMonth() - months + 1 + i, 1);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            trend.push({ date: key, count: monthMap.get(key) || 0 });
        }

        return trend;
    }

    private async getPlanPopularity(): Promise<
        { planId: string; planName: string; subscriptionCount: number; revenue: number }[]
    > {
        const result = await this.subscriptionRepository
            .createQueryBuilder('sub')
            .leftJoin('sub.plan', 'plan')
            .select('sub.planId', 'plan_id')
            .addSelect('plan.nameEn', 'plan_name')
            .addSelect('COUNT(*)', 'subscription_count')
            .addSelect('COALESCE(SUM(sub.paidAmount), 0)', 'revenue')
            .groupBy('sub.planId')
            .addGroupBy('plan.nameEn')
            .orderBy('subscription_count', 'DESC')
            .limit(10)
            .getRawMany();

        return result.map(r => ({
            planId: r.plan_id,
            planName: r.plan_name || 'Unknown',
            subscriptionCount: parseInt(r.subscription_count, 10),
            revenue: parseFloat(r.revenue),
        }));
    }

    // Date helpers
    private getStartOfDay(date: Date): Date {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    private getStartOfWeek(date: Date): Date {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    }

    private getStartOfMonth(date: Date): Date {
        return new Date(date.getFullYear(), date.getMonth(), 1);
    }

    private getStartOfYear(date: Date): Date {
        return new Date(date.getFullYear(), 0, 1);
    }
}
