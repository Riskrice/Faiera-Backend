import {
    Controller,
    Post,
    Body,
    HttpCode,
    HttpStatus,
    Req,
    UseGuards,
    Get,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { User } from '../entities/user.entity';
import { AuthService } from '../services/auth.service';
import {
    RegisterDto,
    LoginDto,
    RefreshTokenDto,
    ChangePasswordDto,
    ForgotPasswordDto,
    ResetPasswordDto,
    AuthResponse,
    TokenResponse,
    JwtPayload,
} from '../dto';
import { Public } from '../decorators/public.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { createSuccessResponse, ApiResponse } from '../../../common/dto';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Public()
    @Throttle({ default: { ttl: 60000, limit: 3 } })
    @Post('register')
    async register(@Body() dto: RegisterDto): Promise<ApiResponse<AuthResponse>> {
        const result = await this.authService.register(dto);
        return createSuccessResponse(result, 'Registration successful');
    }

    @Public()
    @Throttle({ default: { ttl: 60000, limit: 5 } })
    @Post('login')
    @HttpCode(HttpStatus.OK)
    async login(
        @Body() dto: LoginDto,
        @Req() req: Request,
    ): Promise<ApiResponse<AuthResponse>> {
        const ipAddress = req.ip || req.socket.remoteAddress;
        const userAgent = req.get('user-agent');
        const result = await this.authService.login(dto, ipAddress, userAgent);
        return createSuccessResponse(result, 'Login successful');
    }

    @Public()
    @Throttle({ default: { ttl: 60000, limit: 10 } })
    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    async refresh(@Body() dto: RefreshTokenDto): Promise<ApiResponse<TokenResponse>> {
        const result = await this.authService.refreshTokens(dto.refreshToken);
        return createSuccessResponse(result, 'Token refreshed successfully');
    }

    @UseGuards(JwtAuthGuard)
    @Post('logout')
    @HttpCode(HttpStatus.OK)
    async logout(
        @CurrentUser() user: JwtPayload,
        @Body() dto?: RefreshTokenDto,
    ): Promise<ApiResponse<null>> {
        await this.authService.logout(user.sub, dto?.refreshToken);
        return createSuccessResponse(null, 'Logout successful');
    }

    @UseGuards(JwtAuthGuard)
    @Post('change-password')
    @HttpCode(HttpStatus.OK)
    async changePassword(
        @CurrentUser() user: JwtPayload,
        @Body() dto: ChangePasswordDto,
    ): Promise<ApiResponse<null>> {
        await this.authService.changePassword(user.sub, dto.currentPassword, dto.newPassword);
        return createSuccessResponse(null, 'Password changed successfully');
    }

    @UseGuards(JwtAuthGuard)
    @Post('logout-all')
    @HttpCode(HttpStatus.OK)
    async logoutAll(@CurrentUser() user: JwtPayload): Promise<ApiResponse<null>> {
        await this.authService.logout(user.sub);
        return createSuccessResponse(null, 'Logged out from all devices');
    }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    @HttpCode(HttpStatus.OK)
    async getProfile(@CurrentUser() user: JwtPayload): Promise<ApiResponse<User>> {
        const result = await this.authService.getProfile(user.sub);
        return createSuccessResponse(result, 'User profile retrieved successfully');
    }

    @Public()
    @Throttle({ default: { ttl: 60000, limit: 3 } })
    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<ApiResponse<null>> {
        await this.authService.forgotPassword(dto.email);
        return createSuccessResponse(null, 'If an account with this email exists, a reset link has been sent');
    }

    @Public()
    @Throttle({ default: { ttl: 60000, limit: 5 } })
    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    async resetPassword(@Body() dto: ResetPasswordDto): Promise<ApiResponse<null>> {
        await this.authService.resetPassword(dto.token, dto.newPassword);
        return createSuccessResponse(null, 'Password has been reset successfully');
    }
}
