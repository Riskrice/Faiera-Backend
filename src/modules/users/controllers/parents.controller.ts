import { Controller, Get, Post, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { UsersService } from '../services/users.service';
import { JwtAuthGuard, RbacGuard, Roles, CurrentUser, JwtPayload } from '../../auth';
import { Role } from '../../auth/constants/roles.constant';
import { createSuccessResponse } from '../../../common/dto';

@Controller('parents')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ParentsController {
    constructor(private readonly usersService: UsersService) { }

    @Get('children')
    @Roles(Role.PARENT)
    async getMyChildren(@CurrentUser() user: JwtPayload) {
        const result = await this.usersService.findParentWithStudents(user.sub);
        return createSuccessResponse(result.students);
    }

    @Post('children/link')
    @Roles(Role.PARENT)
    async linkChild(@Body() body: { email: string }, @CurrentUser() user: JwtPayload) {
        const result = await this.usersService.linkChildByEmail(user.sub, body.email);
        return createSuccessResponse(result, 'Child linked successfully');
    }

    @Get('children/:id/overview')
    @Roles(Role.PARENT)
    async getChildOverview(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
        const stats = await this.usersService.getChildOverview(id, user.sub);
        return createSuccessResponse(stats);
    }
}
