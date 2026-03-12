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
} from '@nestjs/common';
import { UsersService } from '../services/users.service';
import {
    CreateUserDto,
    UpdateUserDto,
    UpdateUserRoleDto,
    LinkParentDto,
    UserQueryDto,
    UserResponse,
    StudentWithParent,
    ParentWithStudents,
} from '../dto';
import { createSuccessResponse, createPaginatedResponse, ApiResponse, PaginatedResponse } from '../../../common/dto';
import { JwtAuthGuard, RbacGuard, Roles, Permissions, CurrentUser, JwtPayload } from '../../auth';
import { Role, Permission } from '../../auth/constants/roles.constant';

@Controller('users')
@UseGuards(JwtAuthGuard, RbacGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    // Admin: Create new user
    @Post()
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    @Permissions(Permission.USER_WRITE)
    async create(@Body() dto: CreateUserDto): Promise<ApiResponse<UserResponse>> {
        const user = await this.usersService.create(dto);
        return createSuccessResponse(user, 'User created successfully');
    }

    // Admin: List all users with filtering
    @Get()
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    @Permissions(Permission.USER_READ)
    async findAll(
        @Query() query: UserQueryDto,
    ): Promise<PaginatedResponse<UserResponse>> {
        const { users, total } = await this.usersService.findAll(query, query);
        return createPaginatedResponse(
            users,
            query.page || 1,
            query.pageSize || 20,
            total,
        );
    }

    // Get current user profile
    @Get('me')
    async getProfile(@CurrentUser() currentUser: JwtPayload): Promise<ApiResponse<UserResponse>> {
        const user = await this.usersService.findById(currentUser.sub);
        return createSuccessResponse(user);
    }

    // Update current user profile
    @Put('me')
    async updateProfile(
        @CurrentUser() currentUser: JwtPayload,
        @Body() dto: UpdateUserDto,
    ): Promise<ApiResponse<UserResponse>> {
        // Don't allow status changes via profile update
        delete dto.status;
        const user = await this.usersService.update(currentUser.sub, dto);
        return createSuccessResponse(user, 'Profile updated successfully');
    }

    // Parent: Get linked students
    @Get('me/students')
    @Roles(Role.PARENT)
    async getMyStudents(@CurrentUser() currentUser: JwtPayload): Promise<ApiResponse<ParentWithStudents>> {
        const result = await this.usersService.findParentWithStudents(currentUser.sub);
        return createSuccessResponse(result);
    }

    // Student: Get parent info
    @Get('me/parent')
    @Roles(Role.STUDENT)
    async getMyParent(@CurrentUser() currentUser: JwtPayload): Promise<ApiResponse<StudentWithParent>> {
        const result = await this.usersService.findStudentWithParent(currentUser.sub);
        return createSuccessResponse(result);
    }

    // Admin: Get specific user
    @Get(':id')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    @Permissions(Permission.USER_READ)
    async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<UserResponse>> {
        const user = await this.usersService.findById(id);
        return createSuccessResponse(user);
    }

    // Admin: Update user
    @Put(':id')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    @Permissions(Permission.USER_WRITE)
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateUserDto,
    ): Promise<ApiResponse<UserResponse>> {
        const user = await this.usersService.update(id, dto);
        return createSuccessResponse(user, 'User updated successfully');
    }

    // Admin: Change user role
    @Patch(':id/role')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    async updateRole(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateUserRoleDto,
    ): Promise<ApiResponse<UserResponse>> {
        const user = await this.usersService.updateRole(id, dto);
        return createSuccessResponse(user, 'User role updated successfully');
    }

    // Admin: Link parent to student
    @Patch(':id/link-parent')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    @Permissions(Permission.USER_WRITE)
    async linkParent(
        @Param('id', ParseUUIDPipe) studentId: string,
        @Body() dto: LinkParentDto,
    ): Promise<ApiResponse<UserResponse>> {
        const user = await this.usersService.linkParent(studentId, dto.parentId);
        return createSuccessResponse(user, 'Parent linked successfully');
    }

    // Admin: Suspend user
    @Patch(':id/suspend')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    @Permissions(Permission.USER_WRITE)
    async suspend(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<UserResponse>> {
        const user = await this.usersService.suspend(id);
        return createSuccessResponse(user, 'User suspended successfully');
    }

    // Admin: Activate user
    @Patch(':id/activate')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    @Permissions(Permission.USER_WRITE)
    async activate(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<UserResponse>> {
        const user = await this.usersService.activate(id);
        return createSuccessResponse(user, 'User activated successfully');
    }

    // Admin: Delete user
    @Delete(':id')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    @Permissions(Permission.USER_DELETE)
    async delete(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<null>> {
        await this.usersService.delete(id);
        return createSuccessResponse(null, 'User deleted successfully');
    }
}
