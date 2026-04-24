import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { UserProgress, ContentType } from '../entities/progress.entity';
import { UpdateProgressDto, ProgressQueryDto } from '../dto';

@Injectable()
export class ProgressService {
  private readonly logger = new Logger(ProgressService.name);

  constructor(
    @InjectRepository(UserProgress)
    private readonly progressRepository: Repository<UserProgress>,
  ) {}

  async updateProgress(userId: string, dto: UpdateProgressDto): Promise<UserProgress> {
    let progress = await this.progressRepository.findOne({
      where: {
        userId,
        contentType: dto.contentType,
        contentId: dto.contentId,
      },
    });

    if (!progress) {
      progress = this.progressRepository.create({
        userId,
        contentType: dto.contentType,
        contentId: dto.contentId,
        startedAt: new Date(),
      });
    }

    // Update progress fields
    progress.progressPercent = dto.progressPercent;

    if (dto.lastPosition !== undefined) {
      progress.lastPosition = dto.lastPosition;
    }

    if (dto.totalDuration !== undefined) {
      progress.totalDuration = dto.totalDuration;
    }

    if (dto.timeSpent !== undefined) {
      progress.timeSpent += dto.timeSpent;
    }

    if (dto.metadata) {
      progress.metadata = { ...progress.metadata, ...dto.metadata };
    }

    // Check if completed
    if (dto.progressPercent >= 100 && !progress.completedAt) {
      progress.completedAt = new Date();
      this.logger.log(`User ${userId} completed ${dto.contentType}:${dto.contentId}`);
    }

    await this.progressRepository.save(progress);
    return progress;
  }

  async getProgress(
    userId: string,
    contentType: ContentType,
    contentId: string,
  ): Promise<UserProgress | null> {
    return this.progressRepository.findOne({
      where: { userId, contentType, contentId },
    });
  }

  async getUserProgress(userId: string, query?: ProgressQueryDto): Promise<UserProgress[]> {
    const where: FindOptionsWhere<UserProgress> = { userId };

    if (query?.contentType) {
      where.contentType = query.contentType;
    }

    if (query?.contentId) {
      where.contentId = query.contentId;
    }

    return this.progressRepository.find({
      where,
      order: { updatedAt: 'DESC' },
      take: query?.limit || 50,
    });
  }

  async getCourseProgress(
    userId: string,
    courseId: string,
  ): Promise<{
    totalLessons: number;
    completedLessons: number;
    overallProgress: number;
  }> {
    // Fetch lesson progress for this user and specific course efficiently using Postgres JSONB query
    const courseLessons = await this.progressRepository
      .createQueryBuilder('progress')
      .where('progress.userId = :userId', { userId })
      .andWhere('progress.contentType = :contentType', { contentType: ContentType.LESSON })
      .andWhere("progress.metadata ->> 'courseId' = :courseId", { courseId })
      .getMany();

    const totalLessons = courseLessons.length;
    const completedLessons = courseLessons.filter(l => l.isCompleted()).length;
    const overallProgress =
      totalLessons > 0
        ? courseLessons.reduce((sum, l) => sum + Number(l.progressPercent), 0) / totalLessons
        : 0;

    return {
      totalLessons,
      completedLessons,
      overallProgress: Math.round(overallProgress * 100) / 100,
    };
  }

  async syncProgress(userId: string, contentType?: ContentType): Promise<UserProgress[]> {
    const where: FindOptionsWhere<UserProgress> = { userId };
    if (contentType) {
      where.contentType = contentType;
    }

    return this.progressRepository.find({
      where,
      order: { updatedAt: 'DESC' },
      take: 50, // Limit initial sync
    });
  }

  async getWeeklyActivity(userId: string): Promise<{ name: string; hours: number }[]> {
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // Query progress records updated in the last 7 days
    const recentProgress = await this.progressRepository
      .createQueryBuilder('p')
      .select('DATE(p.updatedAt)', 'day')
      .addSelect('SUM(p.timeSpent)', 'totalSeconds')
      .where('p.userId = :userId', { userId })
      .andWhere('p.updatedAt >= :since', { since: sevenDaysAgo })
      .groupBy('DATE(p.updatedAt)')
      .getRawMany<{ day: string; totalSeconds: string }>();

    // Build a map of date -> hours from real data
    const dayHoursMap = new Map<number, number>();
    for (const row of recentProgress) {
      const d = new Date(row.day);
      const dayOfWeek = d.getDay();
      const hours = Math.round(((Number(row.totalSeconds) || 0) / 3600) * 10) / 10;
      dayHoursMap.set(dayOfWeek, (dayHoursMap.get(dayOfWeek) || 0) + hours);
    }

    // Build last 7 days array ending with today
    const result: { name: string; hours: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dayIndex = d.getDay();
      result.push({
        name: days[dayIndex],
        hours: dayHoursMap.get(dayIndex) || 0,
      });
    }

    return result;
  }
}
