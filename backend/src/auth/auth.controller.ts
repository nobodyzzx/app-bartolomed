import { Body, Controller, Get, Headers, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';

import { CreateUserDto } from '../users/dto';
import { User } from '../users/entities/user.entity';
import { Auth, GetUser, RawHeaders } from './decorators';
import { RoleProtected } from './decorators/role-protected.decorator';
import { LoginUserDto, RefreshTokenDto } from './dto';
import { GodBootstrapDto } from './dto/god-bootstrap.dto';
import { UserRoleGuard } from './guards/user-role.guard';
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
    // Set httpOnly refresh token cookie for rotation
    if (result.refreshToken) {
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('rt', result.refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'lax' : 'lax',
        path: '/',
        maxAge: 15 * 24 * 60 * 60 * 1000, // 15 days
      });
    }
    return { user: result.user, token: result.token };
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // Prefer cookie 'rt'; fallback to body
    let refreshToken = dto?.refreshToken;
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
      res.cookie('rt', result.refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'lax' : 'lax',
        path: '/',
        maxAge: 15 * 24 * 60 * 60 * 1000,
      });
    }
    return { user: result.user, token: result.token };
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
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
  @UseGuards(AuthGuard('jwt'))
  async checkStatus(@GetUser() user: User): Promise<LoginResponse> {
    return this.authService.checkAuthStatus(user);
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

  @Get('private')
  @UseGuards(AuthGuard())
  testingPrivateRoute(
    @Req() request: Request,
    @GetUser() user: User,
    @GetUser('email') userEmail: string,
    @RawHeaders() rawHeaders: string[],
  ) {
    console.log(request);
    return {
      ok: true,
      message: 'This is a private route',
      user,
      userEmail,
      rawHeaders,
    };
  }
  // @SetMetadata('roles', ['admin', 'super-user'])

  @Get('private2')
  @RoleProtected(ValidRoles.SUPER_ADMIN)
  @UseGuards(AuthGuard(), UserRoleGuard)
  privateRoute2(@GetUser() user: User) {
    return {
      ok: true,
      message: 'This is a private route dos',
      user,
    };
  }
  @Get('private3')
  @Auth()
  privateRoute3(@GetUser() user: User) {
    return {
      ok: true,
      message: 'This is a private route tres',
      user,
    };
  }
}
