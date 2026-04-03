import { Body, Controller, Get, Headers, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';

import { CreateUserDto } from '../users/dto';
import { User } from '../users/entities/user.entity';
import { Auth, GetUser } from './decorators';
import { ForgotPasswordDto, LoginUserDto, RefreshTokenDto, ResetPasswordDto } from './dto';
import { GodBootstrapDto } from './dto/god-bootstrap.dto';
import { LoginResponse, ValidRoles } from './interfaces';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Auth(ValidRoles.ADMIN)
  createUser(@Body() createUserDto: CreateUserDto) {
    return this.authService.create(createUserDto);
  }

  @Post('login')
  async loginUser(@Body() loginUserDto: LoginUserDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(loginUserDto);
    const remember = !!loginUserDto.rememberMe;
    // Set httpOnly refresh token cookie for rotation
    if (result.refreshToken) {
      const isProduction = process.env.NODE_ENV === 'production';
      const cookieCommon: any = {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'lax' : 'lax',
        path: '/',
      };
      const rtOptions = remember ? { ...cookieCommon, maxAge: 15 * 24 * 60 * 60 * 1000 } : cookieCommon;
      res.cookie('rt', result.refreshToken, rtOptions);
      // Helper cookie to remember choice (not httpOnly so FE could read if needed, but keep httpOnly off)
      res.cookie('rtr', remember ? '1' : '0', {
        secure: isProduction,
        sameSite: isProduction ? 'lax' : 'lax',
        path: '/',
        ...(remember ? { maxAge: 15 * 24 * 60 * 60 * 1000 } : {}),
      });
    }
    return { user: result.user, token: result.token, rememberMe: remember };
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // Prefer cookie 'rt'; fallback to body
    let refreshToken: string | undefined = dto?.refreshToken;
    if (!refreshToken) {
      const cookieHeader = req.headers['cookie'] || '';
      const match = cookieHeader
        .split(';')
        .map(c => c.trim())
        .find(c => c.startsWith('rt='));
      refreshToken = match ? decodeURIComponent(match.split('=')[1]) : undefined;
    }
    const result = await this.authService.refreshToken({ refreshToken } as RefreshTokenDto);

    if (result.refreshToken) {
      const isProduction = process.env.NODE_ENV === 'production';
      const cookieHeader = req.headers['cookie'] || '';
      const rtr = cookieHeader
        .split(';')
        .map(c => c.trim())
        .find(c => c.startsWith('rtr='));
      const remember = rtr ? rtr.split('=')[1] === '1' : false;
      const cookieCommon: any = {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'lax' : 'lax',
        path: '/',
      };
      const rtOptions = remember ? { ...cookieCommon, maxAge: 15 * 24 * 60 * 60 * 1000 } : cookieCommon;
      res.cookie('rt', result.refreshToken, rtOptions);
      // refresh rtr as well
      res.cookie('rtr', remember ? '1' : '0', {
        secure: isProduction,
        sameSite: isProduction ? 'lax' : 'lax',
        path: '/',
        ...(remember ? { maxAge: 15 * 24 * 60 * 60 * 1000 } : {}),
      });
      return { user: result.user, token: result.token, rememberMe: remember };
    }
    return { user: result.user, token: result.token, rememberMe: false };
  }

  @Post('logout')
  @Auth()
  async logout(@GetUser() user: User, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(user.id);
    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie('rt', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'lax' : 'lax',
      path: '/',
    });
    return { ok: true };
  }

  @Get('check-status')
  @Auth()
  async checkStatus(@GetUser() user: User): Promise<LoginResponse> {
    return this.authService.checkAuthStatus(user);
  }

  @Get('my-clinics')
  @Auth()
  getMyMemberships(@GetUser() user: User) {
    return this.authService.getMyMemberships(user.id, user.roles);
  }

  @Post('forgot-password')
  requestPasswordReset(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // GODMODE: crear o promover SUPER_ADMIN mediante token de entorno
  @Post('godmode/super-admin')
  async godmodeBootstrap(
    @Body() dto: GodBootstrapDto,
    @Headers('x-god-token') xGodToken?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const bearer = (authHeader || '').startsWith('Bearer ') ? (authHeader || '').slice(7) : undefined;
    const providedToken = xGodToken || bearer;
    const result = await this.authService.bootstrapSuperAdmin(dto, providedToken);
    // Opcional: setear refresh token como en login para entrar directo (no generamos refresh aquí para simplicidad)
    return { user: result.user, token: result.token };
  }

}
