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
    NotFoundException,
    ForbiddenException,
    Logger,
    Req,
    BadRequestException,
    Res,
    UseInterceptors,
    CallHandler,
    ExecutionContext,
    NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

export class CourseCompatInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const req = context.switchToHttp().getRequest();
        if (req.body) {
            this.mapBody(req.body);
        }
        return next.handle();
    }

    private mapBody(obj: any) {
        if (!obj || typeof obj !== 'object') return;
        
        if (obj.title && !obj.titleAr) { obj.titleAr = obj.title; obj.titleEn = obj.title; }
        if (obj.description && !obj.descriptionAr) obj.descriptionAr = obj.description;
        if (obj.thumbnail && !obj.thumbnailUrl) obj.thumbnailUrl = obj.thumbnail;
        if (obj.duration !== undefined && obj.durationMinutes === undefined) obj.durationMinutes = obj.duration;
        if (obj.articleContent !== undefined && !obj.contentAr) obj.contentAr = obj.articleContent;
        
        if (obj.programId === '') delete obj.programId;
        delete obj.language;
        delete obj.attachments; // from lessons
        delete obj.isPublished;
        
        if (Array.isArray(obj.sections)) {
            obj.sections.forEach((s: any) => this.mapBody(s));
        }
        if (Array.isArray(obj.lessons)) {
            obj.lessons.forEach((l: any) => this.mapBody(l));
        }
    }
}

import { Response } from 'express';
import { ContentService } from '../services/content.service';
import {
    CreateProgramDto,
    UpdateProgramDto,
    ProgramQueryDto,
    CreateCourseDto,
    UpdateCourseDto,
    CreateModuleDto,
    UpdateModuleDto,
    CreateLessonDto,
    UpdateLessonDto,
    CourseQueryDto,
} from '../dto';
import { Program, Course, Module, Lesson } from '../entities';
import { CourseStatus } from '../entities/course.entity';
import { ProgramStatus } from '../entities/program.entity';
import { EnrollmentSource } from '../entities/enrollment.entity';
import {
    createSuccessResponse,
    createPaginatedResponse,
    ApiResponse,
    PaginatedResponse,
} from '../../../common/dto';
import { JwtAuthGuard, RbacGuard, Roles, Permissions, Public, CurrentUser, JwtPayload } from '../../auth';
import { Role, Permission } from '../../auth/constants/roles.constant';

import { VideoStatus } from '../entities/video-resource.entity';
import { BunnyMigrationService } from '../../../bunny/bunny-migration.service';

@Controller('content')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ContentController {
    private readonly logger = new Logger(ContentController.name);

    constructor(
        private readonly contentService: ContentService,
        private readonly bunnyMigrationService: BunnyMigrationService,
    ) { }

    // ==================== Programs ====================

    @Post('programs')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    @Permissions(Permission.CONTENT_WRITE)
    async createProgram(@Body() dto: CreateProgramDto): Promise<ApiResponse<Program>> {
        const program = await this.contentService.createProgram(dto);
        return createSuccessResponse(program, 'Program created successfully');
    }

    @Get('programs')
    @Public() // Public for catalog browsing
    async findAllPrograms(
        @Query() query: ProgramQueryDto,
    ): Promise<PaginatedResponse<Program>> {
        // Public endpoint: only show published programs
        if (!query.status) {
            query.status = ProgramStatus.PUBLISHED;
        }
        const { programs, total } = await this.contentService.findAllPrograms(query, query);
        return createPaginatedResponse(programs, query.page || 1, query.pageSize || 20, total);
    }

    @Get('programs/all')
    @Public()
    async findAllProgramsAlias(
        @Query() query: ProgramQueryDto,
    ): Promise<PaginatedResponse<Program>> {
        // Alias for GET /programs — frontend calls /programs/all
        if (!query.status) {
            query.status = ProgramStatus.PUBLISHED;
        }
        const { programs, total } = await this.contentService.findAllPrograms(query, query);
        return createPaginatedResponse(programs, query.page || 1, query.pageSize || 20, total);
    }

    @Get('programs/:id')
    @Public()
    async findProgram(
        @Param('id', ParseUUIDPipe) id: string,
        @Query('includeCourses') includeCourses?: string,
    ): Promise<ApiResponse<Program>> {
        const program = await this.contentService.findProgramById(id, includeCourses === 'true');
        // Public endpoint: only expose published programs
        if (program.status !== ProgramStatus.PUBLISHED) {
            throw new NotFoundException('Program not found');
        }
        return createSuccessResponse(program);
    }

    @Get('programs/:id/tree')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER)
    async getContentTree(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<Program>> {
        const tree = await this.contentService.getContentTree(id);
        return createSuccessResponse(tree);
    }

    @Put('programs/:id')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    @Permissions(Permission.CONTENT_WRITE)
    async updateProgram(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateProgramDto,
    ): Promise<ApiResponse<Program>> {
        const program = await this.contentService.updateProgram(id, dto);
        return createSuccessResponse(program, 'Program updated successfully');
    }

    @Patch('programs/:id/publish')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    @Permissions(Permission.CONTENT_PUBLISH)
    async publishProgram(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<Program>> {
        const program = await this.contentService.publishProgram(id);
        return createSuccessResponse(program, 'Program published successfully');
    }

    @Patch('programs/:id/archive')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    @Permissions(Permission.CONTENT_WRITE)
    async archiveProgram(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<Program>> {
        const program = await this.contentService.archiveProgram(id);
        return createSuccessResponse(program, 'Program archived successfully');
    }

    @Delete('programs/:id')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    @Permissions(Permission.CONTENT_DELETE)
    async deleteProgram(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<null>> {
        await this.contentService.deleteProgram(id);
        return createSuccessResponse(null, 'Program deleted successfully');
    }

    // ==================== Courses ====================

    @Post('courses')
    @UseInterceptors(CourseCompatInterceptor)
    @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER)
    @Permissions(Permission.CONTENT_WRITE)
    async createCourse(
        @Body() dto: CreateCourseDto,
        @CurrentUser() user: JwtPayload,
    ): Promise<ApiResponse<Course>> {
        const course = await this.contentService.createCourse(dto, user.sub);
        return createSuccessResponse(course, 'Course created successfully');
    }

    @Get('courses')
    @Public()
    async findAllCourses(
        @Query() query: CourseQueryDto,
        @CurrentUser() user?: JwtPayload,
    ): Promise<PaginatedResponse<Course>> {
        // Only enforce published status for unauthenticated (public) requests
        if (!query.status && !user) {
            query.status = CourseStatus.PUBLISHED;
        }

        const { courses, total } = await this.contentService.findAllCourses(query, query);
        return createPaginatedResponse(courses, query.page || 1, query.pageSize || 20, total);
    }

    @Get('program-courses/:programId') // Renaming to avoid conflict if needed, or keep specific route
    @Public()
    async findCoursesByProgram(
        @Param('programId', ParseUUIDPipe) programId: string,
    ): Promise<ApiResponse<Course[]>> {
        const courses = await this.contentService.findCoursesByProgram(programId);
        return createSuccessResponse(courses);
    }

    @Get('courses/:id')
    @Public()
    async findCourse(
        @Param('id', ParseUUIDPipe) id: string,
        @Query('includeModules') includeModules?: string,
        @CurrentUser() user?: JwtPayload,
        @Req() req?: any, // Inject Request for debugging
    ): Promise<ApiResponse<Course>> {
        console.log('--- BACKEND findCourse Called ---');
        console.log('Auth Header:', req?.headers?.authorization?.substring(0, 30));
        console.log('CurrentUser:', user);

        const course = await this.contentService.findCourseById(id, includeModules === 'true');
        // Public endpoint: only expose published courses to unauthenticated users
        if (course.status !== CourseStatus.PUBLISHED && !user) {
            throw new NotFoundException('Course not found');
        }
        return createSuccessResponse(course);
    }

    @Put('courses/:id')
    @UseInterceptors(CourseCompatInterceptor)
    @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER)
    @Permissions(Permission.CONTENT_WRITE)
    async updateCourse(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateCourseDto,
        @CurrentUser() user: JwtPayload,
    ): Promise<ApiResponse<Course>> {
        const course = await this.contentService.updateCourse(id, dto, user.sub);
        return createSuccessResponse(course, 'Course updated successfully');
    }

    @Patch('courses/:id/publish')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    @Permissions(Permission.CONTENT_PUBLISH)
    async publishCourse(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<Course>> {
        const course = await this.contentService.publishCourse(id);
        return createSuccessResponse(course, 'Course published successfully');
    }

    @Delete('courses/:id')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    @Permissions(Permission.CONTENT_DELETE)
    async deleteCourse(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<null>> {
        await this.contentService.deleteCourse(id);
        return createSuccessResponse(null, 'Course deleted successfully');
    }

    // ==================== Modules ====================

    @Post('modules')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER)
    @Permissions(Permission.CONTENT_WRITE)
    async createModule(
        @Body() dto: CreateModuleDto,
        @CurrentUser() user: JwtPayload,
    ): Promise<ApiResponse<Module>> {
        const module = await this.contentService.createModule(dto, user.sub);
        return createSuccessResponse(module, 'Module created successfully');
    }

    @Get('courses/:courseId/modules')
    async findModulesByCourse(
        @Param('courseId', ParseUUIDPipe) courseId: string,
    ): Promise<ApiResponse<Module[]>> {
        const modules = await this.contentService.findModulesByCourse(courseId);
        return createSuccessResponse(modules);
    }

    @Get('modules/:id')
    async findModule(
        @Param('id', ParseUUIDPipe) id: string,
        @Query('includeLessons') includeLessons?: string,
    ): Promise<ApiResponse<Module>> {
        const module = await this.contentService.findModuleById(id, includeLessons === 'true');
        return createSuccessResponse(module);
    }

    @Put('modules/:id')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER)
    @Permissions(Permission.CONTENT_WRITE)
    async updateModule(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateModuleDto,
        @CurrentUser() user: JwtPayload,
    ): Promise<ApiResponse<Module>> {
        const module = await this.contentService.updateModule(id, dto, user.sub);
        return createSuccessResponse(module, 'Module updated successfully');
    }

    @Delete('modules/:id')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    @Permissions(Permission.CONTENT_DELETE)
    async deleteModule(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<null>> {
        await this.contentService.deleteModule(id);
        return createSuccessResponse(null, 'Module deleted successfully');
    }

    // ==================== Lessons ====================

    @Post('lessons')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER)
    @Permissions(Permission.CONTENT_WRITE)
    async createLesson(
        @Body() dto: CreateLessonDto,
        @CurrentUser() user: JwtPayload,
    ): Promise<ApiResponse<Lesson>> {
        const lesson = await this.contentService.createLesson(dto, user.sub);
        return createSuccessResponse(lesson, 'Lesson created successfully');
    }

    @Get('modules/:moduleId/lessons')
    async findLessonsByModule(
        @Param('moduleId', ParseUUIDPipe) moduleId: string,
    ): Promise<ApiResponse<Lesson[]>> {
        const lessons = await this.contentService.findLessonsByModule(moduleId);
        return createSuccessResponse(lessons);
    }

    @Get('lessons/:id')
    async findLesson(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<Lesson>> {
        const lesson = await this.contentService.findLessonById(id);
        return createSuccessResponse(lesson);
    }

    @Put('lessons/:id')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER)
    @Permissions(Permission.CONTENT_WRITE)
    async updateLesson(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateLessonDto,
        @CurrentUser() user: JwtPayload,
    ): Promise<ApiResponse<Lesson>> {
        const lesson = await this.contentService.updateLesson(id, dto, user.sub);
        return createSuccessResponse(lesson, 'Lesson updated successfully');
    }

    @Patch('lessons/:id/publish')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    @Permissions(Permission.CONTENT_PUBLISH)
    async publishLesson(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<Lesson>> {
        const lesson = await this.contentService.publishLesson(id);
        return createSuccessResponse(lesson, 'Lesson published successfully');
    }

    @Delete('lessons/:id')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    @Permissions(Permission.CONTENT_DELETE)
    async deleteLesson(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<null>> {
        await this.contentService.deleteLesson(id);
        return createSuccessResponse(null, 'Lesson deleted successfully');
    }

    // ==================== Video Upload ====================

    @Post('lessons/upload-url')
    @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
    async generateUploadUrl(
        @Body('title') title: string | undefined,
        @Body('videoId') videoId: string | undefined,
        @Body('forceNew') forceNew: boolean | string | undefined,
        @Res({ passthrough: true }) res: Response,
    ): Promise<ApiResponse<{
        videoId: string;
        libraryId: string;
        authorizationSignature: string;
        expirationTime: number;
        uploadUrl: string;
        tusUploadEndpoint: string;
        reused: boolean;
    }>> {
        const normalizedTitle = typeof title === 'string' ? title.trim() : '';
        const normalizedVideoId = typeof videoId === 'string' ? videoId.trim() : '';
        const shouldForceNew = forceNew === true || forceNew === 'true';

        if (!normalizedTitle && !normalizedVideoId) {
            throw new BadRequestException('Either title or videoId is required for upload URL generation');
        }

        res.setHeader('Deprecation', 'true');
        res.setHeader('Warning', '299 - "Deprecated endpoint: use unified Bunny upload flow"');
        this.logger.warn('Deprecated endpoint called: POST /content/lessons/upload-url');

        const result = normalizedVideoId
            ? await this.bunnyMigrationService.getCredentialsWithFallback({
                title: normalizedTitle || undefined,
                videoId: normalizedVideoId,
                forceNew: shouldForceNew,
                routeKey: `content:lessons/upload-url:refresh:${normalizedVideoId}`,
            })
            : await this.bunnyMigrationService.createVideoWithFallback({
                title: normalizedTitle,
                forceNew: shouldForceNew,
                routeKey: `content:lessons/upload-url:create:${normalizedTitle}`,
            });

        const tusUploadEndpoint = this.deriveTusUploadEndpoint(result.uploadUrl);

        return createSuccessResponse(
            {
                videoId: result.videoId,
                libraryId: result.libraryId,
                authorizationSignature: result.authorizationSignature,
                expirationTime: result.expirationTime,
                uploadUrl: result.uploadUrl,
                tusUploadEndpoint,
                reused: result.reused,
            },
            normalizedVideoId
                ? 'Upload credentials refreshed successfully'
                : 'Upload URL generated successfully',
        );
    }

    @Get('lessons/:id/stream-url')
    @Public()
    async getStreamUrl(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user?: JwtPayload,
    ): Promise<ApiResponse<{ url: string; token: string }>> {
        const lesson = await this.contentService.findLessonById(id, true);

        // Paid lessons: only allow if user is authenticated and enrolled in the parent course
        if (!lesson.isFree) {
            if (!user) {
                throw new ForbiddenException('يجب تسجيل الدخول والاشتراك في الدورة لمشاهدة هذا الدرس');
            }
            // Admins, super admins, and teachers bypass enrollment check
            const isPrivileged = [Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER].includes(user.role as Role);
            if (!isPrivileged) {
                const enrolled = await this.contentService.isUserEnrolledInLesson(user.sub, id);
                if (!enrolled) {
                    throw new ForbiddenException('يجب الاشتراك في الدورة لمشاهدة هذا الدرس');
                }
            }
        }

        // 1. If a manual video URL is provided, handle it
        if (lesson.videoUrl && lesson.videoUrl.trim() !== '') {
            const trimmedUrl = lesson.videoUrl.trim();
            
            // If it's a Bunny video reference stored in videoUrl (e.g., from old imports or specific format)
            if (trimmedUrl.startsWith('bunny://')) {
                const bunnyVideoId = trimmedUrl.replace('bunny://', '');
                const signed = this.bunnyMigrationService.generateSignedUrlWithFallback(
                    bunnyVideoId,
                    3600,
                    user?.sub,
                    `content:stream-url:${id}:legacy-url`,
                );
                
                return createSuccessResponse({ url: signed.embedUrl, token: signed.token });
            }

            // Otherwise, it's a standard external link (e.g. YouTube, Vimeo)
            return createSuccessResponse({
                url: trimmedUrl,
                token: '', // No token needed for direct external links
            });
        }

        // 2. Otherwise, fall back to Bunny.net integration
        if (!lesson.video || !lesson.video.bunnyVideoId) {
            throw new NotFoundException('لا يوجد فيديو متاح لهذا الدرس');
        }

        if (lesson.video.status !== VideoStatus.READY) {
            // Video might still be encoding - log but try anyway
            this.logger.warn(`Video ${lesson.video.bunnyVideoId} status is ${lesson.video.status}, attempting playback anyway`);
        }

        const signed = this.bunnyMigrationService.generateSignedUrlWithFallback(
            lesson.video.bunnyVideoId,
            3600,
            user?.sub,
            `content:stream-url:${id}`,
        );

        return createSuccessResponse({ url: signed.embedUrl, token: signed.token });
    }

    private deriveTusUploadEndpoint(uploadUrl: string): string {
        try {
            const parsed = new URL(uploadUrl);
            return `${parsed.origin}/tusupload`;
        } catch {
            return 'https://video.bunnycdn.com/tusupload';
        }
    }

    // ==================== Enrollments ====================

    @Get('enrollments/my')
    async getMyEnrollments(
        @CurrentUser() user: JwtPayload,
    ): Promise<ApiResponse<any[]>> {
        const enrollments = await this.contentService.getUserEnrollments(user.sub);
        return createSuccessResponse(enrollments);
    }

    @Get('enrollments/check/:courseId')
    async checkEnrollment(
        @Param('courseId', ParseUUIDPipe) courseId: string,
        @CurrentUser() user: JwtPayload,
    ): Promise<ApiResponse<{ enrolled: boolean }>> {
        const enrolled = await this.contentService.isUserEnrolled(user.sub, courseId);
        return createSuccessResponse({ enrolled });
    }
    @Post('enrollments/free/:courseId')
    async enrollFreeCourse(
        @Param('courseId', ParseUUIDPipe) courseId: string,
        @CurrentUser() user: JwtPayload,
    ): Promise<ApiResponse<any>> {
        const course = await this.contentService.findCourseById(courseId);
        
        if (course.price && course.price > 0) {
            throw new BadRequestException('This course is not free. Please complete the checkout process.');
        }

        const enrollment = await this.contentService.enrollUserInCourse(
            courseId, 
            user.sub, 
            EnrollmentSource.FREE
        );
        
        return createSuccessResponse(enrollment, 'Successfully enrolled in the free course');
    }
}
