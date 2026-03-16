import {
    Injectable,
    NotFoundException,
    Logger,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Program, ProgramStatus } from '../entities/program.entity';
import { Course, CourseStatus } from '../entities/course.entity';
import { Module } from '../entities/module.entity';
import { Lesson, LessonStatus } from '../entities/lesson.entity';
import { VideoResource } from '../entities/video-resource.entity';
import { Enrollment, EnrollmentStatus, EnrollmentSource } from '../entities/enrollment.entity';
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
import { PaginationQueryDto } from '../../../common/dto';

@Injectable()
export class ContentService {
    private readonly logger = new Logger(ContentService.name);

    constructor(
        @InjectRepository(Program)
        private readonly programRepository: Repository<Program>,
        @InjectRepository(Course)
        private readonly courseRepository: Repository<Course>,
        @InjectRepository(Module)
        private readonly moduleRepository: Repository<Module>,
        @InjectRepository(Lesson)
        private readonly lessonRepository: Repository<Lesson>,
        @InjectRepository(VideoResource)
        private readonly videoRepository: Repository<VideoResource>,
        @InjectRepository(Enrollment)
        private readonly enrollmentRepository: Repository<Enrollment>,
    ) { }

    // ==================== Programs ====================

    async createProgram(dto: CreateProgramDto): Promise<Program> {
        const program = this.programRepository.create(dto);
        await this.programRepository.save(program);
        this.logger.log(`Program created: ${program.titleEn}`);
        return program;
    }

    async findAllPrograms(
        query: ProgramQueryDto,
        pagination: PaginationQueryDto,
    ): Promise<{ programs: Program[]; total: number }> {
        const where: FindOptionsWhere<Program> = {};

        if (query.grade) where.grade = query.grade;
        if (query.subject) where.subject = query.subject;
        if (query.status) where.status = query.status;

        const [programs, total] = await this.programRepository.findAndCount({
            where,
            skip: pagination.skip,
            take: pagination.take,
            order: { sortOrder: 'ASC', createdAt: 'DESC' },
        });

        return { programs, total };
    }

    async findProgramById(id: string, includeCourses = false): Promise<Program> {
        const program = await this.programRepository.findOne({
            where: { id },
            relations: includeCourses ? ['courses'] : [],
        });

        if (!program) {
            throw new NotFoundException('Program not found');
        }

        return program;
    }

    async updateProgram(id: string, dto: UpdateProgramDto): Promise<Program> {
        const program = await this.findProgramById(id);
        Object.assign(program, dto);
        await this.programRepository.save(program);
        this.logger.log(`Program updated: ${program.titleEn}`);
        return program;
    }

    async publishProgram(id: string): Promise<Program> {
        const program = await this.findProgramById(id);
        program.status = ProgramStatus.PUBLISHED;
        await this.programRepository.save(program);
        this.logger.log(`Program published: ${program.titleEn}`);
        return program;
    }

    async archiveProgram(id: string): Promise<Program> {
        const program = await this.findProgramById(id);
        program.status = ProgramStatus.ARCHIVED;
        await this.programRepository.save(program);
        this.logger.log(`Program archived: ${program.titleEn}`);
        return program;
    }

    async deleteProgram(id: string): Promise<void> {
        const program = await this.findProgramById(id);
        await this.programRepository.remove(program);
        this.logger.log(`Program deleted: ${program.titleEn}`);
    }

    // ==================== Courses ====================

    async createCourse(dto: CreateCourseDto, userId?: string): Promise<Course> {
        // Only validate program if programId is provided (it's now optional)
        if (dto.programId) {
            await this.findProgramById(dto.programId);
        }

        // Wrap in transaction to prevent orphan modules/lessons on partial failure
        return this.courseRepository.manager.transaction(async manager => {
            const courseRepo = manager.getRepository(Course);
            const moduleRepo = manager.getRepository(Module);
            const lessonRepo = manager.getRepository(Lesson);

            const course = courseRepo.create({
                ...dto,
                createdBy: userId,
            });
            await courseRepo.save(course);

            // Handle nested sections/modules
            if (dto.sections && dto.sections.length > 0) {
                for (let i = 0; i < dto.sections.length; i++) {
                    const sectionDto = dto.sections[i];
                    const module = moduleRepo.create({
                        ...sectionDto,
                        courseId: course.id,
                        sortOrder: i
                    });
                    await moduleRepo.save(module);

                    // Handle nested lessons
                    if (sectionDto.lessons && sectionDto.lessons.length > 0) {
                        for (let j = 0; j < sectionDto.lessons.length; j++) {
                            const lessonDto = sectionDto.lessons[j];

                            // Handle Video Linkage if videoId (Bunny ID) is provided
                            let videoResource: VideoResource | null = null;

                            if (lessonDto.videoId) {
                                // First check if it's a full bunny:// URL and extract ID
                                let bunnyId = lessonDto.videoId;
                                if (bunnyId.startsWith('bunny://')) {
                                    bunnyId = bunnyId.replace('bunny://', '');
                                }

                                videoResource = await this.videoRepository.findOne({ where: { bunnyVideoId: bunnyId } });
                                if (!videoResource) {
                                    this.logger.warn(`Video resource not found for ID: ${bunnyId}`);
                                }
                            }

                            const lesson = lessonRepo.create({
                                ...lessonDto,
                                moduleId: module.id,
                                sortOrder: j,
                                video: videoResource || undefined // Link if found
                            });

                            await lessonRepo.save(lesson);
                        }
                    }
                }

                course.lessonCount = dto.sections.reduce((acc, sec) => acc + (sec.lessons?.length || 0), 0);
                await courseRepo.save(course);
            }

            this.logger.log(`Course created: ${course.titleEn}`);
            return course;
        });
    }

    async findAllCourses(
        query: CourseQueryDto,
        pagination: PaginationQueryDto,
    ): Promise<{ courses: Course[]; total: number }> {
        const queryBuilder = this.courseRepository.createQueryBuilder('course');
        queryBuilder.leftJoinAndSelect('course.program', 'program');
        queryBuilder.leftJoinAndSelect('course.teacher', 'teacher');
        queryBuilder.leftJoinAndSelect('teacher.user', 'teacherUser');

        if (query.status) {
            queryBuilder.andWhere('course.status = :status', { status: query.status });
        } else {
            // Default to published if not specified for public access (controller handles this, but good default)
            // But internal might need all. Let's filter in controller or assume caller specifies.
            // For now, simple filter.
        }

        if (query.search) {
            queryBuilder.andWhere(
                '(course.titleEn LIKE :search OR course.titleAr LIKE :search OR course.descriptionEn LIKE :search OR course.descriptionAr LIKE :search)',
                { search: `%${query.search}%` },
            );
        }

        if (query.category) {
            queryBuilder.andWhere('program.subject = :category', { category: query.category });
        }

        if (query.level) {
            queryBuilder.andWhere('program.grade = :level', { level: query.level });
        }

        if (query.programId) {
            queryBuilder.andWhere('course.programId = :programId', { programId: query.programId });
        }

        if (query.teacherId) {
            queryBuilder.andWhere('course.teacherId = :teacherId', { teacherId: query.teacherId });
        }

        queryBuilder
            .skip(pagination.skip)
            .take(pagination.take)
            .orderBy('course.createdAt', 'DESC');

        const [courses, total] = await queryBuilder.getManyAndCount();
        return { courses, total };
    }

    async findCoursesByProgram(programId: string): Promise<Course[]> {
        return this.courseRepository.find({
            where: { programId },
            relations: ['teacher', 'teacher.user'],
            order: { sortOrder: 'ASC' },
        });
    }

    async findCourseById(id: string, includeModules = false): Promise<Course> {
        const relations = ['teacher', 'teacher.user'];
        if (includeModules) {
            relations.push('modules', 'modules.lessons', 'modules.lessons.video');
        }

        const course = await this.courseRepository.findOne({
            where: { id },
            relations,
        });

        if (!course) {
            throw new NotFoundException('Course not found');
        }

        // Compute duration on-the-fly without persisting (avoids write-on-read side effects)
        if (includeModules && course.modules) {
            for (const m of course.modules) {
                if (m.lessons) {
                    for (const l of m.lessons) {
                        if (l.video && l.video.durationSeconds > 0 && l.durationMinutes === 0) {
                            l.durationMinutes = Math.ceil(l.video.durationSeconds / 60);
                        }
                    }
                }
            }
        }

        return course;
    }

    /**
     * Persist lesson durations synced from video metadata.
     * Call from admin endpoint or cron — not from read paths.
     */
    async syncLessonDurations(courseId: string): Promise<number> {
        const course = await this.findCourseById(courseId, true);
        let synced = 0;
        for (const m of course.modules ?? []) {
            for (const l of m.lessons ?? []) {
                if (l.video && l.video.durationSeconds > 0 && l.durationMinutes === 0) {
                    l.durationMinutes = Math.ceil(l.video.durationSeconds / 60);
                    await this.lessonRepository.save(l);
                    synced++;
                }
            }
        }
        return synced;
    }

    async updateCourse(id: string, dto: UpdateCourseDto, userId?: string): Promise<Course> {
        const course = await this.findCourseById(id, true);

        if (userId && course.createdBy && course.createdBy !== userId) {
            throw new ForbiddenException('You can only update your own courses');
        }

        return this.courseRepository.manager.transaction(async manager => {
            const courseRepo = manager.getRepository(Course);
            const moduleRepo = manager.getRepository(Module);
            const lessonRepo = manager.getRepository(Lesson);

            // Update course basic info
            const { sections, ...courseData } = dto;
            Object.assign(course, courseData);
            await courseRepo.save(course);

            if (sections) {
                const existingModules = course.modules || [];
                const incomingModuleIds = sections.filter(s => (s as any).id).map(s => (s as any).id);

                // 1. Delete modules not in incoming DTO
                for (const existingModule of existingModules) {
                    if (!incomingModuleIds.includes(existingModule.id)) {
                        await moduleRepo.remove(existingModule);
                    }
                }

                // 2. Update or Create modules
                for (let i = 0; i < sections.length; i++) {
                    const sectionDto = sections[i];
                    const sectionId = (sectionDto as any).id;
                    let module: Module;

                    if (sectionId) {
                        module = existingModules.find(m => m.id === sectionId) || moduleRepo.create({ id: sectionId });
                        Object.assign(module, {
                            titleAr: sectionDto.titleAr,
                            titleEn: sectionDto.titleEn,
                            sortOrder: i,
                            courseId: course.id
                        });
                    } else {
                        module = moduleRepo.create({
                            titleAr: sectionDto.titleAr,
                            titleEn: sectionDto.titleEn,
                            sortOrder: i,
                            courseId: course.id
                        });
                    }
                    await moduleRepo.save(module);

                    // Sync Lessons for this module
                    const existingLessons = module.lessons || [];
                    const incomingLessonIds = (sectionDto.lessons || []).filter(l => (l as any).id).map(l => (l as any).id);

                    // Delete lessons not in incoming DTO
                    for (const existingLesson of existingLessons) {
                        if (!incomingLessonIds.includes(existingLesson.id)) {
                            await lessonRepo.remove(existingLesson);
                        }
                    }

                    // Update or Create lessons
                    if (sectionDto.lessons) {
                        for (let j = 0; j < sectionDto.lessons.length; j++) {
                            const lessonDto = sectionDto.lessons[j];
                            const lessonId = (lessonDto as any).id;
                            let lesson: Lesson;

                            // Handle Video Linkage
                            let videoResource: VideoResource | null = null;
                            if (lessonDto.videoId) {
                                let bunnyId = lessonDto.videoId;
                                if (bunnyId.startsWith('bunny://')) {
                                    bunnyId = bunnyId.replace('bunny://', '');
                                }
                                videoResource = await this.videoRepository.findOne({ where: { bunnyVideoId: bunnyId } });
                            }

                            if (lessonId) {
                                lesson = existingLessons.find(l => l.id === lessonId) || lessonRepo.create({ id: lessonId });
                                Object.assign(lesson, {
                                    ...lessonDto,
                                    moduleId: module.id,
                                    sortOrder: j,
                                    video: videoResource || undefined
                                });
                            } else {
                                lesson = lessonRepo.create({
                                    ...lessonDto,
                                    moduleId: module.id,
                                    sortOrder: j,
                                    video: videoResource || undefined
                                });
                            }
                            await lessonRepo.save(lesson);
                        }
                    }
                }

                // Update course total stats after curriculum sync
                await this.updateCourseStatsByCourseId(course.id, manager);
            }

            this.logger.log(`Course updated with curriculum: ${course.titleEn}`);
            return course;
        });
    }

    /**
     * Helper to update course stats within a transaction
     */
    private async updateCourseStatsByCourseId(courseId: string, manager: any): Promise<void> {
        const lessonRepo = manager.getRepository(Lesson);
        const courseRepo = manager.getRepository(Course);

        const lessons = await lessonRepo.find({
            where: { module: { courseId } },
        });

        const course = await courseRepo.findOne({ where: { id: courseId } });
        if (course) {
            course.lessonCount = lessons.length;
            course.totalDurationMinutes = lessons.reduce(
                (sum: number, l: any) => sum + (l.durationMinutes || 0),
                0,
            );
            await courseRepo.save(course);
        }
    }

    async publishCourse(id: string): Promise<Course> {
        const course = await this.findCourseById(id);
        course.status = CourseStatus.PUBLISHED;
        await this.courseRepository.save(course);
        return course;
    }

    async deleteCourse(id: string): Promise<void> {
        const course = await this.findCourseById(id);
        await this.courseRepository.remove(course);
        this.logger.log(`Course deleted: ${course.titleEn}`);
    }

    // ==================== Modules ====================

    async createModule(dto: CreateModuleDto, userId?: string): Promise<Module> {
        const course = await this.findCourseById(dto.courseId); // Validate course exists

        if (userId && course.createdBy && course.createdBy !== userId) {
            throw new ForbiddenException('You can only add modules to your own courses');
        }

        const module = this.moduleRepository.create(dto);
        await this.moduleRepository.save(module);
        this.logger.log(`Module created: ${module.titleEn}`);
        return module;
    }

    async findModulesByCourse(courseId: string): Promise<Module[]> {
        return this.moduleRepository.find({
            where: { courseId },
            order: { sortOrder: 'ASC' },
        });
    }

    async findModuleById(id: string, includeLessons = false): Promise<Module> {
        const module = await this.moduleRepository.findOne({
            where: { id },
            relations: includeLessons ? ['lessons'] : [],
        });

        if (!module) {
            throw new NotFoundException('Module not found');
        }

        return module;
    }

    async updateModule(id: string, dto: UpdateModuleDto, userId?: string): Promise<Module> {
        const module = await this.findModuleById(id);

        if (userId) {
            const course = await this.courseRepository.findOneBy({ id: module.courseId });
            if (course && course.createdBy && course.createdBy !== userId) {
                throw new ForbiddenException('You can only update modules in your own courses');
            }
        }

        Object.assign(module, dto);
        await this.moduleRepository.save(module);
        this.logger.log(`Module updated: ${module.titleEn}`);
        return module;
    }

    async deleteModule(id: string): Promise<void> {
        const module = await this.findModuleById(id);
        await this.moduleRepository.remove(module);
        this.logger.log(`Module deleted: ${module.titleEn}`);
    }

    // ==================== Lessons ====================

    async createLesson(dto: CreateLessonDto, userId?: string): Promise<Lesson> {
        const module = await this.findModuleById(dto.moduleId); // Validate module exists

        if (userId) {
            const course = await this.courseRepository.findOneBy({ id: module.courseId });
            if (course && course.createdBy && course.createdBy !== userId) {
                throw new ForbiddenException('You can only add lessons to your own courses');
            }
        }

        const lesson = this.lessonRepository.create(dto);
        await this.lessonRepository.save(lesson);

        // Update course stats
        await this.updateCourseStats(dto.moduleId);

        this.logger.log(`Lesson created: ${lesson.titleEn}`);
        return lesson;
    }

    async findLessonsByModule(moduleId: string): Promise<Lesson[]> {
        return this.lessonRepository.find({
            where: { moduleId },
            order: { sortOrder: 'ASC' },
        });
    }

    async findLessonById(id: string, includeVideo = false): Promise<Lesson> {
        const lesson = await this.lessonRepository.findOne({
            where: { id },
            relations: includeVideo ? ['video'] : [],
        });

        if (!lesson) {
            throw new NotFoundException('Lesson not found');
        }

        return lesson;
    }

    async updateLesson(id: string, dto: UpdateLessonDto, userId?: string): Promise<Lesson> {
        const lesson = await this.findLessonById(id);

        if (userId) {
            const module = await this.moduleRepository.findOneBy({ id: lesson.moduleId });
            if (module) {
                const course = await this.courseRepository.findOneBy({ id: module.courseId });
                if (course && course.createdBy && course.createdBy !== userId) {
                    throw new ForbiddenException('You can only update lessons in your own courses');
                }
            }
        }

        const oldModuleId = lesson.moduleId;

        Object.assign(lesson, dto);
        lesson.version += 1; // Increment version on update
        await this.lessonRepository.save(lesson);

        // Update course stats if needed
        await this.updateCourseStats(oldModuleId);

        this.logger.log(`Lesson updated: ${lesson.titleEn} (v${lesson.version})`);
        return lesson;
    }

    async publishLesson(id: string): Promise<Lesson> {
        const lesson = await this.findLessonById(id);
        lesson.status = LessonStatus.PUBLISHED;
        lesson.publishedAt = new Date();
        await this.lessonRepository.save(lesson);
        this.logger.log(`Lesson published: ${lesson.titleEn}`);
        return lesson;
    }

    async deleteLesson(id: string): Promise<void> {
        const lesson = await this.findLessonById(id);
        const moduleId = lesson.moduleId;
        await this.lessonRepository.remove(lesson);

        // Update course stats
        await this.updateCourseStats(moduleId);

        this.logger.log(`Lesson deleted: ${lesson.titleEn}`);
    }

    // ==================== Helpers ====================

    private async updateCourseStats(moduleId: string): Promise<void> {
        const module = await this.moduleRepository.findOne({
            where: { id: moduleId },
        });

        if (!module) return;

        // Count lessons and total duration for the course
        const lessons = await this.lessonRepository.find({
            where: { module: { courseId: module.courseId } },
        });

        const course = await this.courseRepository.findOne({
            where: { id: module.courseId },
        });

        if (course) {
            course.lessonCount = lessons.length;
            course.totalDurationMinutes = lessons.reduce(
                (sum, l) => sum + (l.durationMinutes || 0),
                0,
            );
            await this.courseRepository.save(course);
        }
    }

    // Get full content tree for a program
    async getContentTree(programId: string): Promise<Program> {
        const program = await this.programRepository.findOne({
            where: { id: programId },
            relations: ['courses', 'courses.modules', 'courses.modules.lessons'],
        });

        if (!program) {
            throw new NotFoundException('Program not found');
        }

        return program;
    }

    // ==================== Enrollments ====================

    async enrollUserInCourse(
        courseId: string,
        userId: string,
        source: EnrollmentSource = EnrollmentSource.PAYMENT,
        transactionId?: string,
    ): Promise<Enrollment> {
        const course = await this.courseRepository.findOne({ where: { id: courseId } });
        if (!course) {
            throw new NotFoundException('Course not found');
        }

        const existing = await this.enrollmentRepository.findOne({
            where: { userId, courseId },
        });

        if (existing) {
            if (existing.status === EnrollmentStatus.ACTIVE) {
                this.logger.warn(`User ${userId} already enrolled in course ${courseId}`);
                return existing;
            }
            // Re-activate expired / cancelled enrollment
            existing.status = EnrollmentStatus.ACTIVE;
            existing.source = source;
            existing.transactionId = transactionId ?? existing.transactionId;
            existing.enrolledAt = new Date();
            existing.expiresAt = undefined;
            existing.completedAt = undefined;
            await this.enrollmentRepository.save(existing);
            this.logger.log(`Enrollment reactivated for user ${userId} in course ${courseId}`);
            return existing;
        }

        const enrollment = this.enrollmentRepository.create({
            userId,
            courseId,
            source,
            transactionId,
            status: EnrollmentStatus.ACTIVE,
            enrolledAt: new Date(),
        });
        await this.enrollmentRepository.save(enrollment);
        this.logger.log(`User ${userId} enrolled in course ${courseId} via ${source}`);
        return enrollment;
    }

    async isUserEnrolled(userId: string, courseId: string): Promise<boolean> {
        const count = await this.enrollmentRepository.count({
            where: { userId, courseId, status: EnrollmentStatus.ACTIVE },
        });
        return count > 0;
    }

    async isUserEnrolledInLesson(userId: string, lessonId: string): Promise<boolean> {
        const lesson = await this.lessonRepository.findOne({
            where: { id: lessonId },
            relations: ['module'],
        });
        if (!lesson || !lesson.module) {
            return false;
        }

        const mod = await this.moduleRepository.findOne({
            where: { id: lesson.module.id },
            relations: ['course'],
        });
        if (!mod || !mod.course) {
            return false;
        }

        return this.isUserEnrolled(userId, mod.course.id);
    }

    async getUserEnrollments(userId: string): Promise<Enrollment[]> {
        return this.enrollmentRepository.find({
            where: { userId, status: EnrollmentStatus.ACTIVE },
            relations: ['course'],
            order: { enrolledAt: 'DESC' },
        });
    }

    async cancelEnrollment(userId: string, courseId: string): Promise<void> {
        const enrollment = await this.enrollmentRepository.findOne({
            where: { userId, courseId, status: EnrollmentStatus.ACTIVE },
        });
        if (!enrollment) {
            throw new NotFoundException('Active enrollment not found');
        }
        enrollment.status = EnrollmentStatus.CANCELLED;
        await this.enrollmentRepository.save(enrollment);
        this.logger.log(`Enrollment cancelled for user ${userId} in course ${courseId}`);
    }
}
