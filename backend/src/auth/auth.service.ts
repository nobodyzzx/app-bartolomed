import { BadRequestException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import * as bcrypt from 'bcrypt';

import { ValidRoles } from 'src/users/interfaces';
import { CreateUserDto } from '../users/dto';
import { User } from '../users/entities/user.entity';
import { LoginUserDto, RefreshTokenDto } from './dto';
import { GodBootstrapDto } from './dto/god-bootstrap.dto';
import { LoginResponse } from './interfaces';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    try {
      const { password, roles = [ValidRoles.USER], ...userData } = createUserDto;

      const user = this.userRepository.create({
        ...userData,
        // Usar hash asíncrono para no bloquear el event loop
        password: await bcrypt.hash(password, 10),
        roles: roles,
      });

      await this.userRepository.save(user);
      delete user.password;

      return {
        ...user,
        token: this.getJwtToken({ id: user.id }),
      };
    } catch (error) {
      this.handleDBError(error);
    }
  }

  async login(loginUserDto: LoginUserDto) {
    const { email, password } = loginUserDto;
    const user = await this.userRepository.findOne({
      where: { email },
      select: { email: true, password: true, id: true, roles: true, isActive: true },
    });
    if (!user) throw new UnauthorizedException('Credenciales no Validas (email)');
    if (!(await bcrypt.compare(password, user.password)))
      throw new UnauthorizedException('Credenciales no Validas (password)');
    // Generar tokens
    const token = this.getJwtToken({ id: user.id });
    const refreshToken = await this.getRefreshToken({ id: user.id });

    // Guardar hash del refresh token para rotación
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.userRepository.update({ id: user.id }, { refreshTokenHash });

    // Cargar usuario completo con relaciones (sin password)
    const safeUser = await this.userRepository.findOne({ where: { id: user.id } });
    return {
      user: safeUser,
      token,
      refreshToken,
    };
  }

  async checkAuthStatus(user: User): Promise<LoginResponse> {
    return {
      user,
      token: this.getJwtToken({ id: user.id }),
    };
  }

  private getJwtToken(payload: JwtPayload) {
    const token = this.jwtService.sign(payload);
    return token;
  }

  private async getRefreshToken(payload: JwtPayload): Promise<string> {
    // Usar secreto y expiración diferente para refresh tokens
    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'changeme-refresh';
    const token = this.jwtService.sign(payload, { secret, expiresIn: '15d' });
    return token;
  }

  async refreshToken(dto: RefreshTokenDto): Promise<LoginResponse> {
    const { refreshToken } = dto;
    try {
      const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'changeme-refresh';
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, { secret });
      const user = await this.userRepository.findOne({
        where: { id: payload.id },
        select: { id: true, email: true, roles: true, isActive: true, refreshTokenHash: true },
      });
      if (!user || !user.isActive) throw new UnauthorizedException('Usuario no válido');

      if (!user.refreshTokenHash) throw new UnauthorizedException('No hay refresh token registrado');
      const isValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
      if (!isValid) throw new UnauthorizedException('Refresh token inválido');

      // Rotar tokens
      const newAccessToken = this.getJwtToken({ id: user.id });
      const newRefreshToken = await this.getRefreshToken({ id: user.id });
      const newHash = await bcrypt.hash(newRefreshToken, 10);
      await this.userRepository.update({ id: user.id }, { refreshTokenHash: newHash });

      const safeUser = await this.userRepository.findOne({ where: { id: user.id } });
      return {
        user: safeUser,
        token: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch {
      throw new UnauthorizedException('No se pudo refrescar el token');
    }
  }

  async logout(userId: string): Promise<void> {
    await this.userRepository.update({ id: userId }, { refreshTokenHash: null });
  }

  // Godmode: crea o promueve un SUPER_ADMIN, protegido por token de entorno
  async bootstrapSuperAdmin(dto: GodBootstrapDto, providedToken?: string): Promise<LoginResponse> {
    const godToken = process.env.GOD_MODE_TOKEN;
    if (!godToken) throw new UnauthorizedException('God mode is not configured');
    if (!providedToken || providedToken !== godToken) throw new UnauthorizedException('Invalid god token');

    const email = dto.email.toLowerCase().trim();
    const user = await this.userRepository.findOne({
      where: { email },
      select: { id: true, email: true, password: true, roles: true, isActive: true },
    });

    if (user && dto.mode === 'promote') {
      // Promover a SUPER_ADMIN y ADMIN si no los tiene
      const newRoles = new Set([...(user.roles || []), ValidRoles.SUPER_ADMIN, ValidRoles.ADMIN]);
      await this.userRepository.update({ id: user.id }, { roles: Array.from(newRoles) });
      const safeUser = await this.userRepository.findOne({ where: { id: user.id } });
      return { user: safeUser, token: this.getJwtToken({ id: user.id }) };
    }

    if (!user) {
      // Crear si no existe
      const passwordHash = await bcrypt.hash(dto.password, 10);
      const personalInfo = {
        firstName: dto.firstName || 'God',
        lastName: dto.lastName || 'Mode',
      } as any;
      const created = this.userRepository.create({
        email,
        password: passwordHash,
        roles: [ValidRoles.SUPER_ADMIN, ValidRoles.ADMIN],
        personalInfo,
      });
      await this.userRepository.save(created);
      const safeUser = await this.userRepository.findOne({ where: { id: created.id } });
      return { user: safeUser, token: this.getJwtToken({ id: created.id }) };
    }

    // Si existe y modo 'create', también promueve
    const promoteRoles = new Set([...(user.roles || []), ValidRoles.SUPER_ADMIN, ValidRoles.ADMIN]);
    await this.userRepository.update({ id: user.id }, { roles: Array.from(promoteRoles) });
    const safeUser = await this.userRepository.findOne({ where: { id: user.id } });
    return { user: safeUser, token: this.getJwtToken({ id: user.id }) };
  }

  private handleDBError(error: any): never {
    if (error.code === '23505') throw new BadRequestException(error.detail);
    console.log(error);
    throw new InternalServerErrorException('Something went wrong');
  }
}
