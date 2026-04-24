import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UseGuards,
  Get,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
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
  RequestOtpDto,
  VerifyOtpDto,
  AuthResponse,
  RegisterResponse,
  TokenResponse,
  JwtPayload,
} from '../dto';
import { Public } from '../decorators/public.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { createSuccessResponse, ApiResponse } from '../../../common/dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @SkipThrottle()
  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<ApiResponse<RegisterResponse>> {
    const result = await this.authService.register(dto);
    return createSuccessResponse(result, 'Registration successful. Welcome email has been sent');
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request): Promise<ApiResponse<AuthResponse>> {
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
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<ApiResponse<null>> {
    await this.authService.forgotPassword(dto.email);
    return createSuccessResponse(
      null,
      'If an account with this email exists, a reset link has been sent',
    );
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<ApiResponse<null>> {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return createSuccessResponse(null, 'Password has been reset successfully');
  }

  @Public()
  @SkipThrottle()
  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  async requestOtp(@Body() dto: RequestOtpDto): Promise<ApiResponse<null>> {
    await this.authService.requestOtp(dto.email);
    return createSuccessResponse(null, 'Verification code has been sent to your email');
  }

  @Public()
  @SkipThrottle()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
  ): Promise<ApiResponse<AuthResponse>> {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('user-agent');
    const result = await this.authService.verifyOtp(dto, ipAddress, userAgent);
    return createSuccessResponse(result, 'Account verified successfully');
  }

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Initiates the Google OAuth2 login flow
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: any, @Res() res: any) {
    const result = await this.authService.validateOAuthLogin(req.user);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    // Pass the tokens or session identifier securely. Since it's a redirect, we can pass access token.
    // It's recommended to securely store the refresh token later.
    const accessToken = result.tokens.accessToken;
    const refreshToken = result.tokens.refreshToken;

    return res.redirect(
      `${frontendUrl}/oauth2/redirect?accessToken=${accessToken}&refreshToken=${refreshToken}`,
    );
  }
}
