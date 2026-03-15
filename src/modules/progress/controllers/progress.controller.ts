import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Query,
    UseGuards,
    ParseUUIDPipe,
} from '@nestjs/common';
import { ProgressService } from '../services/progress.service';
import { UpdateProgressDto, ProgressQueryDto } from '../dto';
import { UserProgress } from '../entities/progress.entity';
import { JwtAuthGuard, CurrentUser, JwtPayload } from '../../auth';
import { ApiResponse, createSuccessResponse } from '../../../common/dto';

@Controller('progress')
@UseGuards(JwtAuthGuard)
export class ProgressController {
    constructor(private readonly progressService: ProgressService) { }

    /**
     * Get current user's progress across all content
     */
    @Get('my')
    async getMyProgress(
        @CurrentUser() user: JwtPayload,
        @Query() query: ProgressQueryDto,
    ): Promise<ApiResponse<UserProgress[]>> {
        const progress = await this.progressService.getUserProgress(user.sub, query);
        return createSuccessResponse(progress);
    }

    /**
     * Get current user's progress for a specific course
     */
    @Get('my/course/:courseId')
    async getMyCourseProgress(
        @CurrentUser() user: JwtPayload,
        @Param('courseId', ParseUUIDPipe) courseId: string,
    ): Promise<ApiResponse<{ totalLessons: number; completedLessons: number; overallProgress: number }>> {
        const progress = await this.progressService.getCourseProgress(user.sub, courseId);
        return createSuccessResponse(progress);
    }

    /**
     * Get current user's summary stats
     */
    @Get('my/stats')
    async getMyStats(
        @CurrentUser() user: JwtPayload,
    ): Promise<ApiResponse<{
        completedCourses: number;
        completedLessons: number;
        hoursLearned: number;
        activeCourses: number;
        streakDays: number;
    }>> {
        const allProgress = await this.progressService.getUserProgress(user.sub);

        // Calculate stats from progress data
        const completedLessons = allProgress.filter(p => p.completedAt).length;
        const totalTimeSpent = allProgress.reduce((sum, p) => sum + (p.timeSpent || 0), 0);
        const hoursLearned = Math.round(totalTimeSpent / 3600); // Convert seconds to hours

        // Count unique courses where all tracked lessons are completed
        const courseMap = new Map<string, { total: number; completed: number }>();
        for (const p of allProgress) {
            const cId = (p.metadata as any)?.courseId;
            if (!cId) continue;
            const entry = courseMap.get(cId) || { total: 0, completed: 0 };
            entry.total++;
            if (p.completedAt) entry.completed++;
            courseMap.set(cId, entry);
        }
        const completedCourses = [...courseMap.values()].filter(c => c.total > 0 && c.completed === c.total).length;
        const activeCourses = courseMap.size - completedCourses;

        // Streak: count consecutive days (including today) with progress updates
        const progressDates = new Set(
            allProgress.map(p => p.updatedAt ? new Date(p.updatedAt).toDateString() : null).filter(Boolean),
        );
        let streakDays = 0;
        const d = new Date();
        while (progressDates.has(d.toDateString())) {
            streakDays++;
            d.setDate(d.getDate() - 1);
        }

        return createSuccessResponse({
            completedCourses,
            completedLessons,
            hoursLearned,
            activeCourses,
            streakDays,
        });
    }

    /**
     * Update progress for a content item
     */
    @Post('update')
    async updateProgress(
        @CurrentUser() user: JwtPayload,
        @Body() dto: UpdateProgressDto,
    ): Promise<ApiResponse<UserProgress>> {
        const progress = await this.progressService.updateProgress(user.sub, dto);
        return createSuccessResponse(progress, 'Progress updated');
    }

    /**
     * Sync progress (for offline-first clients)
     */
    @Get('sync')
    async syncProgress(
        @CurrentUser() user: JwtPayload,
        @Query() query: ProgressQueryDto,
    ): Promise<ApiResponse<UserProgress[]>> {
        const progress = await this.progressService.syncProgress(user.sub, query.contentType);
        return createSuccessResponse(progress);
    }
    /**
     * Get weekly activity stats
     */
    @Get('my/activity')
    async getMyActivity(
        @CurrentUser() user: JwtPayload,
    ): Promise<ApiResponse<{ name: string; hours: number }[]>> {
        const activity = await this.progressService.getWeeklyActivity(user.sub);
        return createSuccessResponse(activity);
    }
}
