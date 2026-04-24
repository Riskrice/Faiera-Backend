import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserStatus } from '../../auth/entities/user.entity';
import { Role } from '../../auth/constants/roles.constant';
import {
  CreateUserDto,
  UpdateUserDto,
  UpdateUserRoleDto,
  UpdateAcademicProfileDto,
  SecondaryYear,
  StudyPath,
  UserQueryDto,
  UserResponse,
  StudentWithParent,
  ParentWithStudents,
} from '../dto';
import { PaginationQueryDto } from '../../../common/dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly saltRounds = 12;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<UserResponse> {
    // Check if email exists
    const existingUser = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, this.saltRounds);

    const user = this.userRepository.create({
      ...dto,
      email: dto.email.toLowerCase(),
      password: hashedPassword,
      status: UserStatus.ACTIVE,
      preferredLanguage: dto.preferredLanguage || 'ar',
    });

    await this.userRepository.save(user);
    this.logger.log(`User created: ${user.email}`);

    return this.toUserResponse(user);
  }

  async findAll(
    query: UserQueryDto,
    pagination: PaginationQueryDto,
  ): Promise<{ users: UserResponse[]; total: number }> {
    const qb = this.userRepository.createQueryBuilder('user');

    if (query.role) {
      qb.andWhere('user.role = :role', { role: query.role });
    }

    if (query.status) {
      qb.andWhere('user.status = :status', { status: query.status });
    }

    if (query.grade) {
      qb.andWhere('user.grade = :grade', { grade: query.grade });
    }

    if (query.search) {
      qb.andWhere(
        '(user.email ILIKE :search OR user.firstName ILIKE :search OR user.lastName ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('user.createdAt', 'DESC').skip(pagination.skip).take(pagination.take);

    const [users, total] = await qb.getManyAndCount();

    return {
      users: users.map(user => this.toUserResponse(user)),
      total,
    };
  }

  async findById(id: string): Promise<UserResponse> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toUserResponse(user);
  }

  async findStudentWithParent(studentId: string): Promise<StudentWithParent> {
    const student = await this.userRepository.findOne({
      where: { id: studentId, role: Role.STUDENT },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    let parent = null;
    if (student.parentId) {
      parent = await this.userRepository.findOne({
        where: { id: student.parentId },
        select: ['id', 'firstName', 'lastName', 'email', 'phone'],
      });
    }

    return {
      ...this.toUserResponse(student),
      parent: parent
        ? {
            id: parent.id,
            firstName: parent.firstName,
            lastName: parent.lastName,
            email: parent.email,
            phone: parent.phone,
          }
        : undefined,
    };
  }

  async findParentWithStudents(parentId: string): Promise<ParentWithStudents> {
    const parent = await this.userRepository.findOne({
      where: { id: parentId, role: Role.PARENT },
    });

    if (!parent) {
      throw new NotFoundException('Parent not found');
    }

    const students = await this.userRepository.find({
      where: { parentId: parentId },
      select: ['id', 'firstName', 'lastName', 'grade'],
    });

    return {
      ...this.toUserResponse(parent),
      students: students.map(s => ({
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        grade: s.grade,
      })),
    };
  }

  async update(id: string, dto: UpdateUserDto, updatedBy?: string): Promise<UserResponse> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.email !== undefined) {
      const normalizedEmail = dto.email.toLowerCase();

      if (normalizedEmail !== user.email) {
        const existingUser = await this.userRepository.findOne({
          where: { email: normalizedEmail, id: Not(id) },
        });

        if (existingUser) {
          throw new ConflictException('User with this email already exists');
        }
      }

      dto.email = normalizedEmail;
    }

    // Initialize metadata if null
    const currentMetadata = user.metadata || {};

    // Handle password update if provided
    if (dto.password) {
      user.password = await bcrypt.hash(dto.password, this.saltRounds);
      delete dto.password; // Don't allow it to be processed in Object.assign

      // Add history record for password change
      const passwordHistory = Array.isArray(currentMetadata.passwordChangeHistory)
        ? currentMetadata.passwordChangeHistory
        : [];

      passwordHistory.push({
        changedAt: new Date().toISOString(),
        changedBy: updatedBy || 'self',
      });

      currentMetadata.passwordChangeHistory = passwordHistory;
    }

    // 1. Handle explicit 'bio' field from DTO
    if (dto.bio !== undefined) {
      currentMetadata.bio = dto.bio;
      delete dto.bio;
    }

    // 2. Handle generic 'metadata' field from DTO (e.g. avatar)
    if (dto.metadata) {
      Object.assign(currentMetadata, dto.metadata);
      delete dto.metadata;
    }

    // Apply other DTO fields
    Object.assign(user, dto);

    // Set metadata explicitly (important for TypeORM to detect changes in jsonb)
    user.metadata = { ...currentMetadata };

    await this.userRepository.save(user);

    this.logger.log(`User updated: ${user.email}`);
    return this.toUserResponse(user);
  }

  async updateAcademicProfile(id: string, dto: UpdateAcademicProfileDto): Promise<UserResponse> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== Role.STUDENT) {
      throw new ForbiddenException('Only students can submit academic onboarding data');
    }

    const requiresScientificSpecialization =
      dto.secondaryYear === SecondaryYear.THIRD_SECONDARY && dto.studyPath === StudyPath.SCIENTIFIC;

    if (requiresScientificSpecialization && !dto.scientificSpecialization) {
      throw new BadRequestException(
        'Scientific specialization is required for third secondary scientific students',
      );
    }

    if (!requiresScientificSpecialization && dto.scientificSpecialization) {
      throw new BadRequestException(
        'Scientific specialization is only valid for third secondary scientific students',
      );
    }

    const currentMetadata: Record<string, unknown> = { ...(user.metadata || {}) };
    const completedAt = new Date().toISOString();

    currentMetadata.academicProfile = {
      secondaryYear: dto.secondaryYear,
      studyPath: dto.studyPath,
      scientificSpecialization: dto.scientificSpecialization || null,
      completed: true,
      completedAt,
      source: 'first_login',
      version: 1,
    };

    const onboardingMetadata =
      typeof currentMetadata.onboarding === 'object' && currentMetadata.onboarding !== null
        ? (currentMetadata.onboarding as Record<string, unknown>)
        : {};

    currentMetadata.onboarding = {
      ...onboardingMetadata,
      academicProfileCompleted: true,
      academicProfileCompletedAt: completedAt,
    };

    // Keep the legacy grade field aligned for existing filters and reports.
    user.grade = dto.secondaryYear;
    user.metadata = currentMetadata;

    await this.userRepository.save(user);

    this.logger.log(`Academic onboarding completed for: ${user.email}`);
    return this.toUserResponse(user);
  }

  async updateRole(id: string, dto: UpdateUserRoleDto): Promise<UserResponse> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.role === Role.ADMIN || dto.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('Use RBAC admin management endpoints for privileged roles');
    }

    if (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot mutate admin accounts through this endpoint');
    }

    user.role = dto.role;
    await this.userRepository.save(user);

    this.logger.log(`User role updated: ${user.email} -> ${dto.role}`);
    return this.toUserResponse(user);
  }

  async linkParent(studentId: string, parentId: string): Promise<UserResponse> {
    const student = await this.userRepository.findOne({
      where: { id: studentId, role: Role.STUDENT },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const parent = await this.userRepository.findOne({
      where: { id: parentId, role: Role.PARENT },
    });

    if (!parent) {
      throw new NotFoundException('Parent not found');
    }

    student.parentId = parentId;
    await this.userRepository.save(student);

    this.logger.log(`Parent ${parentId} linked to student ${studentId}`);
    return this.toUserResponse(student);
  }

  async suspend(id: string): Promise<UserResponse> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN) {
      throw new ForbiddenException('Cannot suspend admin');
    }

    user.status = UserStatus.SUSPENDED;
    await this.userRepository.save(user);

    this.logger.log(`User suspended: ${user.email}`);
    return this.toUserResponse(user);
  }

  async activate(id: string): Promise<UserResponse> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.status = UserStatus.ACTIVE;
    await this.userRepository.save(user);

    this.logger.log(`User activated: ${user.email}`);
    return this.toUserResponse(user);
  }

  async delete(id: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN) {
      throw new ForbiddenException('Cannot delete admin');
    }

    await this.userRepository.remove(user);
    this.logger.log(`User deleted: ${user.email}`);
  }

  private toUserResponse(user: User): UserResponse {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      grade: user.grade,
      preferredLanguage: user.preferredLanguage,
      lastLoginAt: user.lastLoginAt,
      emailVerifiedAt: user.emailVerifiedAt,
      parentId: user.parentId,
      metadata: user.metadata,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
  async linkChildByEmail(parentId: string, childEmail: string): Promise<UserResponse> {
    const student = await this.userRepository.findOne({
      where: { email: childEmail.toLowerCase(), role: Role.STUDENT },
    });

    if (!student) {
      throw new NotFoundException('Student not found with this email');
    }

    if (student.parentId) {
      throw new ConflictException('Student is already linked to a parent');
    }

    return this.linkParent(student.id, parentId);
  }

  async getChildOverview(studentId: string, parentId: string): Promise<any> {
    const student = await this.userRepository.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');

    if (student.parentId !== parentId) {
      throw new ForbiddenException('You do not have access to this student');
    }

    // Aggregate real stats from progress and session data
    // Use progress repository if available, otherwise return zeros
    const progressRepo = this.userRepository.manager.getRepository('user_progress');
    const sessionRepo = this.userRepository.manager.getRepository('session_attendees');

    let attendanceRate = 0;
    let assignmentsCompleted = 0;

    try {
      // Count completed progress items
      const completedCount = await progressRepo.count({
        where: { userId: studentId, completedAt: Not(IsNull()) },
      });
      assignmentsCompleted = completedCount;

      // Calculate attendance from session bookings
      const totalBookings = await sessionRepo.count({ where: { userId: studentId } });
      const attendedBookings = await sessionRepo.count({
        where: { userId: studentId, status: 'completed' },
      });
      attendanceRate = totalBookings > 0 ? Math.round((attendedBookings / totalBookings) * 100) : 0;
    } catch {
      // Tables might not exist yet — return zeros
      this.logger.warn(`Could not aggregate stats for student ${studentId}`);
    }

    return {
      student: this.toUserResponse(student),
      stats: {
        attendanceRate,
        assignmentsCompleted,
        averageGrade: null, // No grading system implemented yet
        nextSession: null,
      },
    };
  }
}
