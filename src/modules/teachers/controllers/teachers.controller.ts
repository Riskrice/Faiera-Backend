import {
    Controller,
    Get,
    Post,
    Put,
    Patch,
    Body,
    Param,
    Query,
    UseGuards,
    ParseUUIDPipe,
} from '@nestjs/common';
import { TeachersService, TimeSlot } from '../services/teachers.service';
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
    AvailableSlotsQueryDto,
    CreatePackageDto,
    UpdatePackageDto,
    CreateTeacherFullDto,
    RequestWithdrawalDto,
    ProcessWithdrawalDto,
} from '../dto';
import {
    TeacherProfile,
    TeacherAvailability,
    TeacherBooking,
    TeacherReview,
    SubscriptionPackage,
    WithdrawalRequest,
    WithdrawalStatus,
} from '../entities';
import { User } from '../../auth/entities/user.entity';
import { BookingStatus } from '../entities/teacher-booking.entity';
import {
    PaginationQueryDto,
    createSuccessResponse,
    createPaginatedResponse,
    ApiResponse,
    PaginatedResponse,
} from '../../../common/dto';
import { JwtAuthGuard, RbacGuard, Roles, CurrentUser, JwtPayload, Public } from '../../auth';
import { Role } from '../../auth/constants/roles.constant';

@Controller('teachers')
@UseGuards(JwtAuthGuard, RbacGuard)
export class TeachersController {
    constructor(private readonly teachersService: TeachersService) { }

    // ==================== Profile ====================

    @Post('admin/create')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    async createTeacher(
        @Body() dto: CreateTeacherFullDto,
    ): Promise<ApiResponse<any>> {
        const result = await this.teachersService.createTeacherAccount(dto);
        return createSuccessResponse(result, 'Teacher account created successfully');
    }

    @Post('profile')
    @Roles(Role.TEACHER)
    async createProfile(
        @Body() dto: CreateTeacherProfileDto,
        @CurrentUser() user: JwtPayload,
    ): Promise<ApiResponse<TeacherProfile>> {
        const profile = await this.teachersService.createProfile(dto, user.sub);
        return createSuccessResponse(profile, 'Teacher profile created');
    }

    @Get()
    @Public()
    async findAllTeachers(
        @Query() query: TeacherQueryDto,
    ): Promise<PaginatedResponse<TeacherProfile>> {
        const { teachers, total } = await this.teachersService.findAllProfiles(query, query);
        return createPaginatedResponse(teachers, query.page || 1, query.pageSize || 20, total);
    }

    @Get('profile/me')
    @Roles(Role.TEACHER)
    async getMyProfile(@CurrentUser() user: JwtPayload): Promise<ApiResponse<TeacherProfile>> {
        const profile = await this.teachersService.findProfileByUserId(user.sub);
        return createSuccessResponse(profile);
    }

    @Get('dashboard/stats')
    @Roles(Role.TEACHER)
    async getDashboardStats(@CurrentUser() user: JwtPayload) {
        const stats = await this.teachersService.getDashboardStats(user.sub);
        return createSuccessResponse(stats);
    }

    @Get(':id')
    @Public()
    async getTeacher(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<TeacherProfile>> {
        const profile = await this.teachersService.findProfileById(id);
        return createSuccessResponse(profile);
    }

    @Put('profile')
    @Roles(Role.TEACHER)
    async updateProfile(
        @Body() dto: UpdateTeacherProfileDto,
        @CurrentUser() user: JwtPayload,
    ): Promise<ApiResponse<TeacherProfile>> {
        const profile = await this.teachersService.updateProfile(user.sub, dto);
        return createSuccessResponse(profile, 'Profile updated');
    }

    @Patch(':id/approve')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    async approveTeacher(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: JwtPayload,
    ): Promise<ApiResponse<TeacherProfile>> {
        const profile = await this.teachersService.approveTeacher(id, user.sub);
        return createSuccessResponse(profile, 'Teacher approved');
    }

    @Patch(':id/suspend')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    async suspendTeacher(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<TeacherProfile>> {
        const profile = await this.teachersService.suspendTeacher(id);
        return createSuccessResponse(profile, 'Teacher suspended');
    }

    // ==================== Availability ====================

    @Post('availability')
    @Roles(Role.TEACHER)
    async setAvailability(
        @Body() slots: CreateAvailabilityDto[],
        @CurrentUser() user: JwtPayload,
    ): Promise<ApiResponse<TeacherAvailability[]>> {
        const availability = await this.teachersService.setAvailability(user.sub, slots);
        return createSuccessResponse(availability, 'Availability updated');
    }

    @Get(':id/availability')
    async getAvailability(
        @Param('id', ParseUUIDPipe) id: string,
    ): Promise<ApiResponse<TeacherAvailability[]>> {
        const availability = await this.teachersService.getAvailability(id);
        return createSuccessResponse(availability);
    }

    @Get(':id/slots')
    async getAvailableSlots(
        @Param('id', ParseUUIDPipe) id: string,
        @Query() query: AvailableSlotsQueryDto,
    ): Promise<ApiResponse<TimeSlot[]>> {
        const slots = await this.teachersService.getAvailableSlots(id, query.date, query.duration);
        return createSuccessResponse(slots);
    }

    // ==================== Bookings ====================

    @Post('bookings')
    async createBooking(
        @Body() dto: CreateBookingDto,
        @CurrentUser() user: JwtPayload,
    ): Promise<ApiResponse<TeacherBooking>> {
        const booking = await this.teachersService.createBooking(dto, user.sub);
        return createSuccessResponse(booking, 'Booking created');
    }

    @Patch('bookings/:id/confirm')
    @Roles(Role.TEACHER)
    async confirmBooking(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: JwtPayload,
    ): Promise<ApiResponse<TeacherBooking>> {
        const booking = await this.teachersService.confirmBooking(id, user.sub);
        return createSuccessResponse(booking, 'Booking confirmed');
    }

    @Patch('bookings/:id/cancel')
    async cancelBooking(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: CancelBookingDto,
        @CurrentUser() user: JwtPayload,
    ): Promise<ApiResponse<TeacherBooking>> {
        const booking = await this.teachersService.cancelBooking(id, user.sub, dto);
        return createSuccessResponse(booking, 'Booking cancelled');
    }

    @Patch('bookings/:id/reschedule')
    async rescheduleBooking(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: RescheduleBookingDto,
        @CurrentUser() user: JwtPayload,
    ): Promise<ApiResponse<TeacherBooking>> {
        const booking = await this.teachersService.rescheduleBooking(id, user.sub, dto);
        return createSuccessResponse(booking, 'Booking rescheduled');
    }

    @Patch('bookings/:id/complete')
    @Roles(Role.TEACHER, Role.ADMIN)
    async completeBooking(
        @Param('id', ParseUUIDPipe) id: string,
    ): Promise<ApiResponse<TeacherBooking>> {
        const booking = await this.teachersService.completeBooking(id);
        return createSuccessResponse(booking, 'Booking completed');
    }

    @Get('bookings/my')
    @Roles(Role.TEACHER)
    async getMyBookings(
        @CurrentUser() user: JwtPayload,
        @Query('status') status?: BookingStatus,
    ): Promise<ApiResponse<TeacherBooking[]>> {
        const bookings = await this.teachersService.getTeacherBookings(user.sub, status);
        return createSuccessResponse(bookings);
    }

    @Get('bookings/student')
    async getStudentBookings(
        @CurrentUser() user: JwtPayload,
        @Query('status') status?: BookingStatus,
    ): Promise<ApiResponse<TeacherBooking[]>> {
        const bookings = await this.teachersService.getStudentBookings(user.sub, status);
        return createSuccessResponse(bookings);
    }

    @Get('students/my')
    @Roles(Role.TEACHER)
    async getMyStudents(@CurrentUser() user: JwtPayload): Promise<ApiResponse<User[]>> {
        const students = await this.teachersService.getMyStudents(user.sub);
        return createSuccessResponse(students);
    }

    // ==================== Reviews ====================

    @Post('reviews')
    async createReview(
        @Body() dto: CreateReviewDto,
        @CurrentUser() user: JwtPayload,
    ): Promise<ApiResponse<TeacherReview>> {
        const review = await this.teachersService.createReview(dto, user.sub);
        return createSuccessResponse(review, 'Review submitted');
    }

    @Patch('reviews/:id/respond')
    @Roles(Role.TEACHER)
    async respondToReview(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: RespondToReviewDto,
        @CurrentUser() user: JwtPayload,
    ): Promise<ApiResponse<TeacherReview>> {
        const review = await this.teachersService.respondToReview(id, user.sub, dto);
        return createSuccessResponse(review, 'Response added');
    }

    @Get(':id/reviews')
    async getTeacherReviews(
        @Param('id', ParseUUIDPipe) id: string,
        @Query() pagination: PaginationQueryDto,
    ): Promise<PaginatedResponse<TeacherReview>> {
        const { reviews, total } = await this.teachersService.getTeacherReviews(id, pagination);
        return createPaginatedResponse(reviews, pagination.page || 1, pagination.pageSize || 20, total);
    }

    // ==================== Withdrawals ====================

    @Post('withdraw')
    @Roles(Role.TEACHER)
    async requestWithdrawal(
        @CurrentUser() user: JwtPayload,
        @Body() dto: RequestWithdrawalDto,
    ): Promise<ApiResponse<any>> {
        const request = await this.teachersService.requestWithdrawal(user.sub, dto.amount, dto.paymentDetails);
        return createSuccessResponse(request, 'Withdrawal requested');
    }

    @Get('admin/withdrawals')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    async getWithdrawalRequests(
        @Query('status') status?: WithdrawalStatus,
    ): Promise<ApiResponse<WithdrawalRequest[]>> {
        const requests = await this.teachersService.getWithdrawalRequests(status);
        return createSuccessResponse(requests);
    }

    @Post('admin/withdrawals/:id/process')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    async processWithdrawal(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: ProcessWithdrawalDto,
    ): Promise<ApiResponse<WithdrawalRequest>> {
        const request = await this.teachersService.processWithdrawalRequest(id, dto.action, dto.adminNotes);
        return createSuccessResponse(request, `Withdrawal request ${dto.action.toLowerCase()}ed`);
    }

    // ==================== Packages ====================

    @Post('packages')
    @Roles(Role.TEACHER)
    async createPackage(
        @Body() dto: CreatePackageDto,
        @CurrentUser() user: JwtPayload,
    ): Promise<ApiResponse<SubscriptionPackage>> {
        const pkg = await this.teachersService.createPackage(user.sub, dto);
        return createSuccessResponse(pkg, 'Package created successfully');
    }

    @Get('packages')
    @Roles(Role.TEACHER)
    async getMyPackages(@CurrentUser() user: JwtPayload): Promise<ApiResponse<SubscriptionPackage[]>> {
        const packages = await this.teachersService.getTeacherPackages(user.sub);
        return createSuccessResponse(packages);
    }

    @Get('packages/:id')
    async getPackage(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<SubscriptionPackage>> {
        const pkg = await this.teachersService.getPackageById(id);
        return createSuccessResponse(pkg);
    }

    @Patch('packages/:id')
    @Roles(Role.TEACHER)
    async updatePackage(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdatePackageDto,
        @CurrentUser() user: JwtPayload,
    ): Promise<ApiResponse<SubscriptionPackage>> {
        const pkg = await this.teachersService.updatePackage(id, user.sub, dto);
        return createSuccessResponse(pkg, 'Package updated successfully');
    }

    @Patch('packages/:id/toggle')
    @Roles(Role.TEACHER)
    async togglePackage(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: JwtPayload,
    ): Promise<ApiResponse<SubscriptionPackage>> {
        const pkg = await this.teachersService.togglePackage(id, user.sub);
        return createSuccessResponse(pkg, `Package ${pkg.isActive ? 'activated' : 'deactivated'}`);
    }
}
