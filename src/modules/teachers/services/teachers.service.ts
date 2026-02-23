import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between, MoreThan } from 'typeorm';
import { TeacherProfile, TeacherStatus } from '../entities/teacher-profile.entity';
import { TeacherAvailability, DayOfWeek } from '../entities/teacher-availability.entity';
import { TeacherBooking, BookingStatus, BookingType } from '../entities/teacher-booking.entity';
import { TeacherReview } from '../entities/teacher-review.entity';
import { WithdrawalRequest, WithdrawalStatus } from '../entities/withdrawal-request.entity';
import {
    CreateTeacherProfileDto,
    UpdateTeacherProfileDto,
    CreateAvailabilityDto,
    CreateBookingDto,
    RescheduleBookingDto,
    CancelBookingDto,
    CreateReviewDto,
    RespondToReviewDto,
    TeacherQueryDto,
    CreatePackageDto,
    UpdatePackageDto,
    CreateTeacherFullDto,
} from '../dto';
import { PaginationQueryDto } from '../../../common/dto';
import { SubscriptionPackage, BillingCycle } from '../entities/subscription-package.entity';

export interface TimeSlot {
    startTime: Date;
    endTime: Date;
    durationMinutes: number;
}

import { User } from '../../auth/entities/user.entity';
import { In } from 'typeorm';
import { AuthService } from '../../auth/services/auth.service';
import { Role } from '../../auth/constants/roles.constant';

@Injectable()
export class TeachersService {
    private readonly logger = new Logger(TeachersService.name);

    constructor(
        @InjectRepository(TeacherProfile)
        private readonly profileRepository: Repository<TeacherProfile>,
        @InjectRepository(TeacherAvailability)
        private readonly availabilityRepository: Repository<TeacherAvailability>,
        @InjectRepository(TeacherBooking)
        private readonly bookingRepository: Repository<TeacherBooking>,
        @InjectRepository(TeacherReview)
        private readonly reviewRepository: Repository<TeacherReview>,
        @InjectRepository(WithdrawalRequest)
        private readonly withdrawalRepository: Repository<WithdrawalRequest>,
        @InjectRepository(SubscriptionPackage)
        private readonly packageRepository: Repository<SubscriptionPackage>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly authService: AuthService,
    ) { }



    // ==================== Profile Management ====================

    async createTeacherAccount(dto: CreateTeacherFullDto): Promise<{ user: any, profile: TeacherProfile }> {
        // 1. Create User as student first, then promote to TEACHER
        const { role: _ignoreRole, avatar, bio, ...registerData } = dto as any;
        const authResponse = await this.authService.register(registerData);

        const userId = authResponse.user.id;

        // Promote to TEACHER role and set avatar if provided
        const updateData: any = { role: Role.TEACHER };
        if (avatar) {
            updateData.metadata = { ...(authResponse.user as any).metadata, avatar };
        }
        await this.userRepository.update(userId, updateData);

        // 2. Create Default Profile
        const profileDto: CreateTeacherProfileDto = {
            bioAr: bio || '',
            bioEn: bio || '',
            subjects: [],
            grades: [],
            headline: 'New Teacher',
        };

        const profile = await this.createProfile(profileDto, userId);

        // 3. Auto-approve
        profile.status = TeacherStatus.APPROVED;
        profile.approvedAt = new Date();
        await this.profileRepository.save(profile);

        return { user: authResponse.user, profile };
    }

    async getMyStudents(userId: string): Promise<User[]> {
        const profile = await this.findProfileByUserId(userId);

        // Get unique student IDs from bookings
        const bookings = await this.bookingRepository.find({
            where: { teacherId: profile.id },
            select: ['studentId'],
        });

        const studentIds = [...new Set(bookings.map(b => b.studentId))];

        if (studentIds.length === 0) {
            return [];
        }

        return this.userRepository.find({
            where: { id: In(studentIds) },
            select: ['id', 'firstName', 'lastName', 'email', 'phone', 'grade'],
        });
    }

    async createProfile(dto: CreateTeacherProfileDto, userId: string): Promise<TeacherProfile> {
        // Check if profile already exists
        const existing = await this.profileRepository.findOne({ where: { userId } });
        if (existing) {
            throw new BadRequestException('Teacher profile already exists');
        }

        const profile = this.profileRepository.create({
            ...dto,
            userId,
            status: TeacherStatus.PENDING,
        });

        await this.profileRepository.save(profile);
        this.logger.log(`Teacher profile created for user: ${userId}`);
        return profile;
    }

    async findAllProfiles(
        query: TeacherQueryDto,
        pagination: PaginationQueryDto,
    ): Promise<{ teachers: TeacherProfile[]; total: number }> {
        const queryBuilder = this.profileRepository.createQueryBuilder('teacher');
        queryBuilder.leftJoinAndSelect('teacher.user', 'user');

        if (query.status) {
            queryBuilder.andWhere('teacher.status = :status', { status: query.status });
        }
        // No default status filter — admin sees ALL, public controllers should pass status=approved

        if (query.subject) {
            queryBuilder.andWhere(':subject = ANY(teacher.subjects)', { subject: query.subject });
        }

        if (query.grade) {
            queryBuilder.andWhere(':grade = ANY(teacher.grades)', { grade: query.grade });
        }

        if (query.minRating) {
            queryBuilder.andWhere('teacher.averageRating >= :minRating', { minRating: query.minRating });
        }

        if (query.maxPrice) {
            queryBuilder.andWhere('teacher.hourlyRate <= :maxPrice', { maxPrice: query.maxPrice });
        }

        queryBuilder
            .orderBy('teacher.averageRating', 'DESC')
            .skip(pagination.skip)
            .take(pagination.take);

        const [teachers, total] = await queryBuilder.getManyAndCount();
        return { teachers, total };
    }

    async findProfileById(id: string): Promise<TeacherProfile> {
        const profile = await this.profileRepository.findOne({ where: { id } });
        if (!profile) {
            throw new NotFoundException('Teacher profile not found');
        }
        return profile;
    }

    async findProfileByUserId(userId: string): Promise<TeacherProfile> {
        const profile = await this.profileRepository.findOne({ where: { userId } });
        if (!profile) {
            throw new NotFoundException('Teacher profile not found');
        }
        return profile;
    }

    async updateProfile(userId: string, dto: UpdateTeacherProfileDto): Promise<TeacherProfile> {
        const profile = await this.findProfileByUserId(userId);
        Object.assign(profile, dto);
        await this.profileRepository.save(profile);
        return profile;
    }

    async approveTeacher(teacherId: string, approverId: string): Promise<TeacherProfile> {
        const profile = await this.findProfileById(teacherId);
        profile.status = TeacherStatus.APPROVED;
        profile.approvedAt = new Date();
        profile.approvedBy = approverId;
        await this.profileRepository.save(profile);
        this.logger.log(`Teacher approved: ${teacherId}`);
        return profile;
    }

    async suspendTeacher(teacherId: string): Promise<TeacherProfile> {
        const profile = await this.findProfileById(teacherId);
        profile.status = TeacherStatus.SUSPENDED;
        await this.profileRepository.save(profile);
        return profile;
    }

    async getDashboardStats(userId: string) {
        try {
            const profile = await this.findProfileByUserId(userId);

            // 1. Get total students (unique students from bookings)
            const uniqueStudents = await this.bookingRepository
                .createQueryBuilder('booking')
                .select('COUNT(DISTINCT booking.studentId)', 'count')
                .where('booking.teacherId = :teacherId', { teacherId: profile.id })
                .getRawOne();

            // 2. Get next upcoming session
            const nextSession = await this.bookingRepository.findOne({
                where: {
                    teacherId: profile.id,
                    status: BookingStatus.CONFIRMED,
                    scheduledStartTime: MoreThan(new Date()),
                },
                order: { scheduledStartTime: 'ASC' },
                relations: ['student'],
            });

            // 3. Get pending requests count
            const pendingRequests = await this.bookingRepository.count({
                where: {
                    teacherId: profile.id,
                    status: BookingStatus.PENDING,
                },
            });

            return {
                totalStudents: parseInt(uniqueStudents?.count) || 0,
                averageRating: profile.averageRating,
                totalEarnings: profile.currentBalance,
                totalSessions: profile.totalSessions,
                nextSession,
                pendingRequests,
            };
        } catch (err) {
            const error = err as Error;
            this.logger.error(`Error in getDashboardStats: ${error.message}`, error.stack);
            throw new BadRequestException(`Stats Error: ${error.message}`);
        }
    }

    // ==================== Availability Management ====================

    async setAvailability(
        userId: string,
        slots: CreateAvailabilityDto[],
    ): Promise<TeacherAvailability[]> {
        const profile = await this.findProfileByUserId(userId);

        // Clear existing availability (for recurring slots)
        await this.availabilityRepository.delete({
            teacherId: profile.id,
            isRecurring: true,
        });

        const availabilities = slots.map(slot =>
            this.availabilityRepository.create({
                ...slot,
                teacherId: profile.id,
            }),
        );

        await this.availabilityRepository.save(availabilities);
        return availabilities;
    }

    async getAvailability(teacherId: string): Promise<TeacherAvailability[]> {
        return this.availabilityRepository.find({
            where: { teacherId, isActive: true },
            order: { dayOfWeek: 'ASC', startTime: 'ASC' },
        });
    }

    async getAvailableSlots(teacherId: string, date: Date, durationMinutes = 60): Promise<TimeSlot[]> {
        // Verify teacher exists
        await this.findProfileById(teacherId);
        const dayOfWeek = date.getDay() as DayOfWeek;

        // Get availability for this day
        const availability = await this.availabilityRepository.find({
            where: { teacherId, dayOfWeek, isActive: true },
        });

        if (availability.length === 0) return [];

        // Get existing bookings for this day
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const bookings = await this.bookingRepository.find({
            where: {
                teacherId,
                status: BookingStatus.CONFIRMED,
                scheduledStartTime: Between(startOfDay, endOfDay),
            },
        });

        // Generate available slots
        const slots: TimeSlot[] = [];

        for (const avail of availability) {
            const [startHour, startMin] = avail.startTime.split(':').map(Number);
            const [endHour, endMin] = avail.endTime.split(':').map(Number);

            const slotStart = new Date(date);
            slotStart.setHours(startHour, startMin, 0, 0);

            const availEnd = new Date(date);
            availEnd.setHours(endHour, endMin, 0, 0);

            while (slotStart.getTime() + durationMinutes * 60000 <= availEnd.getTime()) {
                const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);

                // Check if slot conflicts with existing bookings
                const hasConflict = bookings.some(booking => {
                    const bookingStart = new Date(booking.scheduledStartTime);
                    const bookingEnd = new Date(booking.scheduledEndTime);
                    return slotStart < bookingEnd && slotEnd > bookingStart;
                });

                if (!hasConflict && slotStart > new Date()) {
                    slots.push({
                        startTime: new Date(slotStart),
                        endTime: slotEnd,
                        durationMinutes,
                    });
                }

                slotStart.setMinutes(slotStart.getMinutes() + 30); // 30-min intervals
            }
        }

        return slots;
    }

    // ==================== Booking Management ====================

    async createBooking(dto: CreateBookingDto, studentId: string): Promise<TeacherBooking> {
        const profile = await this.findProfileById(dto.teacherId);

        if (profile.status !== TeacherStatus.APPROVED) {
            throw new BadRequestException('Teacher is not available');
        }

        // Calculate end time and price
        const scheduledEndTime = new Date(dto.scheduledStartTime);
        scheduledEndTime.setMinutes(scheduledEndTime.getMinutes() + dto.durationMinutes);

        const price = (profile.hourlyRate / 60) * dto.durationMinutes;

        // Check slot availability
        const availableSlots = await this.getAvailableSlots(
            dto.teacherId,
            dto.scheduledStartTime,
            dto.durationMinutes,
        );

        const isSlotAvailable = availableSlots.some(
            slot => slot.startTime.getTime() === dto.scheduledStartTime.getTime(),
        );

        if (!isSlotAvailable) {
            throw new BadRequestException('Selected time slot is not available');
        }

        const booking = this.bookingRepository.create({
            ...dto,
            studentId,
            scheduledEndTime,
            price,
            currency: profile.currency,
            bookingType: BookingType.ONE_ON_ONE,
            status: BookingStatus.PENDING,
        });

        await this.bookingRepository.save(booking);
        this.logger.log(`Booking created: ${booking.id}`);
        return booking;
    }

    async confirmBooking(bookingId: string, teacherId: string): Promise<TeacherBooking> {
        const booking = await this.findBookingById(bookingId);

        // Verify teacher owns this booking
        const profile = await this.findProfileById(booking.teacherId);
        if (profile.userId !== teacherId) {
            throw new ForbiddenException('Not authorized');
        }

        booking.status = BookingStatus.CONFIRMED;
        await this.bookingRepository.save(booking);
        return booking;
    }

    async cancelBooking(
        bookingId: string,
        userId: string,
        dto: CancelBookingDto,
    ): Promise<TeacherBooking> {
        const booking = await this.findBookingById(bookingId);

        if (booking.status === BookingStatus.COMPLETED) {
            throw new BadRequestException('Cannot cancel completed booking');
        }

        booking.status = BookingStatus.CANCELLED;
        booking.cancelledAt = new Date();
        booking.cancellationReason = dto.reason;
        booking.cancelledBy = userId;

        await this.bookingRepository.save(booking);
        return booking;
    }

    async rescheduleBooking(
        bookingId: string,
        _userId: string,
        dto: RescheduleBookingDto,
    ): Promise<TeacherBooking> {
        const originalBooking = await this.findBookingById(bookingId);

        // Cancel original
        originalBooking.status = BookingStatus.RESCHEDULED;
        await this.bookingRepository.save(originalBooking);

        // Create new booking
        const newEndTime = new Date(dto.newStartTime);
        newEndTime.setMinutes(newEndTime.getMinutes() + originalBooking.durationMinutes);

        const newBooking = this.bookingRepository.create({
            teacherId: originalBooking.teacherId,
            studentId: originalBooking.studentId,
            scheduledStartTime: dto.newStartTime,
            scheduledEndTime: newEndTime,
            durationMinutes: originalBooking.durationMinutes,
            subject: originalBooking.subject,
            grade: originalBooking.grade,
            topic: originalBooking.topic,
            price: originalBooking.price,
            currency: originalBooking.currency,
            bookingType: originalBooking.bookingType,
            status: BookingStatus.CONFIRMED,
            originalBookingId: originalBooking.id,
        });

        await this.bookingRepository.save(newBooking);
        return newBooking;
    }

    async completeBooking(bookingId: string): Promise<TeacherBooking> {
        const booking = await this.findBookingById(bookingId);
        booking.status = BookingStatus.COMPLETED;
        booking.completedAt = new Date();
        await this.bookingRepository.save(booking);

        // Update teacher stats
        await this.profileRepository.increment({ id: booking.teacherId }, 'totalSessions', 1);

        return booking;
    }

    async findBookingById(id: string): Promise<TeacherBooking> {
        const booking = await this.bookingRepository.findOne({ where: { id } });
        if (!booking) {
            throw new NotFoundException('Booking not found');
        }
        return booking;
    }

    async getTeacherBookings(
        userId: string,
        status?: BookingStatus,
    ): Promise<TeacherBooking[]> {
        const profile = await this.findProfileByUserId(userId);
        const where: FindOptionsWhere<TeacherBooking> = { teacherId: profile.id };
        if (status) where.status = status;

        return this.bookingRepository.find({
            where,
            order: { scheduledStartTime: 'DESC' },
        });
    }

    async getStudentBookings(studentId: string, status?: BookingStatus): Promise<TeacherBooking[]> {
        const where: FindOptionsWhere<TeacherBooking> = { studentId };
        if (status) where.status = status;

        return this.bookingRepository.find({
            where,
            order: { scheduledStartTime: 'DESC' },
        });
    }

    // ==================== Reviews ====================

    async createReview(dto: CreateReviewDto, studentId: string): Promise<TeacherReview> {
        // Verify student had a completed booking with this teacher
        const hasCompletedBooking = await this.bookingRepository.findOne({
            where: {
                teacherId: dto.teacherId,
                studentId,
                status: BookingStatus.COMPLETED,
            },
        });

        if (!hasCompletedBooking) {
            throw new ForbiddenException('Must complete a session before reviewing');
        }

        const review = this.reviewRepository.create({
            ...dto,
            studentId,
            isVerified: true,
        });

        await this.reviewRepository.save(review);

        // Update teacher average rating
        await this.updateTeacherRating(dto.teacherId);

        return review;
    }

    async respondToReview(
        reviewId: string,
        teacherId: string,
        dto: RespondToReviewDto,
    ): Promise<TeacherReview> {
        const review = await this.reviewRepository.findOne({ where: { id: reviewId } });
        if (!review) {
            throw new NotFoundException('Review not found');
        }

        const profile = await this.findProfileById(review.teacherId);
        if (profile.userId !== teacherId) {
            throw new ForbiddenException('Not authorized');
        }

        review.teacherResponse = dto.response;
        review.respondedAt = new Date();
        await this.reviewRepository.save(review);
        return review;
    }

    async getTeacherReviews(teacherId: string, pagination: PaginationQueryDto): Promise<{
        reviews: TeacherReview[];
        total: number;
    }> {
        const [reviews, total] = await this.reviewRepository.findAndCount({
            where: { teacherId, isPublic: true },
            order: { createdAt: 'DESC' },
            skip: pagination.skip,
            take: pagination.take,
        });

        return { reviews, total };
    }

    private async updateTeacherRating(teacherId: string): Promise<void> {
        const stats = await this.reviewRepository
            .createQueryBuilder('review')
            .select('AVG(review.rating)', 'avgRating')
            .addSelect('COUNT(*)', 'totalRatings')
            .where('review.teacherId = :teacherId', { teacherId })
            .getRawOne();

        await this.profileRepository.update(teacherId, {
            averageRating: parseFloat(stats.avgRating) || 0,
            totalRatings: parseInt(stats.totalRatings) || 0,
        });
    }

    // ==================== Package Management ====================

    async createPackage(userId: string, dto: CreatePackageDto): Promise<SubscriptionPackage> {
        const profile = await this.findProfileByUserId(userId);

        const pkg = this.packageRepository.create({
            ...dto,
            billingCycle: dto.billingCycle as unknown as BillingCycle,
            teacherId: profile.id,
            isActive: true,
        });

        await this.packageRepository.save(pkg);
        return pkg;
    }

    async getTeacherPackages(userId: string): Promise<SubscriptionPackage[]> {
        const profile = await this.findProfileByUserId(userId);
        return this.packageRepository.find({
            where: { teacherId: profile.id },
            order: { name: 'ASC' },
        });
    }

    async getPackageById(id: string): Promise<SubscriptionPackage> {
        const pkg = await this.packageRepository.findOne({ where: { id } });
        if (!pkg) {
            throw new NotFoundException('Subscription package not found');
        }
        return pkg;
    }

    async updatePackage(packageId: string, userId: string, dto: UpdatePackageDto): Promise<SubscriptionPackage> {
        const pkg = await this.getPackageById(packageId);
        const profile = await this.findProfileByUserId(userId);

        if (pkg.teacherId !== profile.id) {
            throw new ForbiddenException('You can only update your own packages');
        }

        Object.assign(pkg, dto);
        await this.packageRepository.save(pkg);
        return pkg;
    }

    async togglePackage(packageId: string, userId: string): Promise<SubscriptionPackage> {
        const pkg = await this.getPackageById(packageId);
        const profile = await this.findProfileByUserId(userId);

        if (pkg.teacherId !== profile.id) {
            throw new ForbiddenException('You can only update your own packages');
        }

        pkg.isActive = !pkg.isActive;
        await this.packageRepository.save(pkg);
        return pkg;
    }
    // ==================== Financial & Withdrawal Management ====================

    async requestWithdrawal(userId: string, amount: number, paymentDetails: any): Promise<WithdrawalRequest> {
        const profile = await this.findProfileByUserId(userId);

        if (amount <= 0) {
            throw new BadRequestException('Invalid amount');
        }

        // Atomic balance check + deduction to prevent race conditions
        const result = await this.profileRepository
            .createQueryBuilder()
            .update()
            .set({
                currentBalance: () => '"currentBalance" - :amt',
                frozenBalance: () => '"frozenBalance" + :amt',
            })
            .where('"userId" = :userId AND "currentBalance" >= :amt', { userId: profile.userId, amt: amount })
            .execute();

        if (result.affected === 0) {
            throw new BadRequestException('Insufficient balance');
        }

        // Create request
        const request = this.withdrawalRepository.create({
            teacherId: profile.userId,
            amount,
            status: WithdrawalStatus.PENDING,
            paymentDetails,
        });

        await this.withdrawalRepository.save(request);

        return request;
    }

    async getWithdrawalRequests(status?: WithdrawalStatus): Promise<WithdrawalRequest[]> {
        const where: FindOptionsWhere<WithdrawalRequest> = {};
        if (status) where.status = status;

        return this.withdrawalRepository.find({
            where,
            relations: ['teacher'],
            order: { createdAt: 'DESC' },
        });
    }

    async processWithdrawalRequest(
        requestId: string,
        action: 'APPROVE' | 'REJECT',
        adminNotes?: string,
    ): Promise<WithdrawalRequest> {
        const request = await this.withdrawalRepository.findOne({ where: { id: requestId } });
        if (!request) throw new NotFoundException('Request not found');

        if (request.status !== WithdrawalStatus.PENDING) {
            throw new BadRequestException('Request already processed');
        }

        const profile = await this.findProfileByUserId(request.teacherId);

        if (action === 'APPROVE') {
            request.status = WithdrawalStatus.APPROVED;
            request.processedAt = new Date();
            request.adminNotes = adminNotes;

            // Finalize deduction: Frozen -> Withdrawn
            profile.frozenBalance = Number(profile.frozenBalance) - Number(request.amount);
            profile.totalWithdrawn = Number(profile.totalWithdrawn) + Number(request.amount);

        } else {
            request.status = WithdrawalStatus.REJECTED;
            request.processedAt = new Date();
            request.adminNotes = adminNotes;

            // Refund: Frozen -> Current
            profile.frozenBalance = Number(profile.frozenBalance) - Number(request.amount);
            profile.currentBalance = Number(profile.currentBalance) + Number(request.amount);
        }

        await this.withdrawalRepository.save(request);
        await this.profileRepository.save(profile);

        return request;
    }
}
