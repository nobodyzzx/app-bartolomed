import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes, randomUUID } from 'crypto';

import * as bcrypt from 'bcrypt';

import { ValidRoles } from 'src/users/interfaces';
import { CreateUserDto } from '../users/dto';
import { Clinic } from '../clinics/entities/clinic.entity';
import { UserClinic } from '../users/entities/user-clinic.entity';
import { User } from '../users/entities/user.entity';
import { ChangePasswordDto, ForgotPasswordDto, LoginUserDto, RefreshTokenDto, ResetPasswordDto, UpdateProfileDto } from './dto';
import { GodBootstrapDto } from './dto/god-bootstrap.dto';
import { LoginResponse } from './interfaces';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { permissionsForRoles } from './permissions/role-permissions.map';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserClinic)
    private readonly userClinicRepository: Repository<UserClinic>,
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
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
      delete (user as any).password;

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
    // Obtener clínicas del usuario para embeber en el token
    const clinicIds = await this.getClinicIds(user.id);

    // Generar tokens
    const token = this.getJwtToken({ id: user.id, clinicIds });
    const refreshToken = await this.getRefreshToken({ id: user.id, clinicIds });

    // Guardar hash del refresh token para rotación
    const refreshTokenHash = await bcrypt.hash(this.fingerprintToken(refreshToken), 10);
    await this.userRepository.update({ id: user.id }, { refreshTokenHash });

    // Cargar usuario completo con clínica principal para que el frontend hidrate ClinicContextService
    const safeUser = await this.userRepository.findOne({ where: { id: user.id }, relations: ['clinic'] });
    if (!safeUser) throw new InternalServerErrorException('Usuario no encontrado tras autenticación');
    return {
      user: safeUser,
      token,
      refreshToken,
      permissions: permissionsForRoles(safeUser.roles),
    };
  }

  async checkAuthStatus(user: User): Promise<LoginResponse> {
    const clinicIds = await this.getClinicIds(user.id);
    // Re-cargar con clínica principal (JwtStrategy no carga relaciones)
    const userWithClinic = await this.userRepository.findOne({ where: { id: user.id }, relations: ['clinic'] });
    return {
      user: userWithClinic ?? user,
      token: this.getJwtToken({ id: user.id, clinicIds }),
      permissions: permissionsForRoles(user.roles),
    };
  }

  private async getClinicIds(userId: string): Promise<string[]> {
    const memberships = await this.userClinicRepository.find({
      where: { user: { id: userId } },
      relations: ['clinic'],
      select: { id: true, clinic: { id: true } },
    });
    return memberships.map(m => m.clinic.id);
  }

  async getMyMemberships(userId: string, userRoles: string[]): Promise<{ id: string; name: string; address: string }[]> {
    // Super-admin ve todas las clínicas activas sin necesidad de membresía
    if (userRoles.includes(ValidRoles.SUPER_ADMIN)) {
      const all = await this.clinicRepository.find({ where: { isActive: true }, order: { name: 'ASC' } });
      return all.map(c => ({ id: c.id, name: c.name, address: c.address }));
    }

    const memberships = await this.userClinicRepository.find({
      where: { user: { id: userId } },
      relations: ['clinic'],
    });
    return memberships
      .filter(m => m.clinic?.isActive)
      .map(m => ({ id: m.clinic.id, name: m.clinic.name, address: m.clinic.address }));
  }

  private getJwtToken(payload: JwtPayload) {
    const token = this.jwtService.sign(payload);
    return token;
  }

  private async getRefreshToken(payload: JwtPayload): Promise<string> {
    // Usar secreto y expiración diferente para refresh tokens
    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'changeme-refresh';
    const token = this.jwtService.sign({ ...payload, jti: randomUUID() }, { secret, expiresIn: '15d' });
    return token;
  }

  async refreshToken(dto: RefreshTokenDto): Promise<LoginResponse> {
    const { refreshToken } = dto;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token requerido');
    }

    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'changeme-refresh';
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, { secret });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.id },
      select: { id: true, email: true, roles: true, isActive: true, refreshTokenHash: true },
    });
    if (!user || !user.isActive) throw new UnauthorizedException('Usuario no válido');

    if (!user.refreshTokenHash) throw new UnauthorizedException('No hay refresh token registrado');
    const tokenFingerprint = this.fingerprintToken(refreshToken);
    const isValidFingerprint = await bcrypt.compare(tokenFingerprint, user.refreshTokenHash);
    const isValidLegacy = isValidFingerprint ? false : await bcrypt.compare(refreshToken, user.refreshTokenHash);
    const isValid = isValidFingerprint || isValidLegacy;
    if (!isValid) {
      // Reuso o token stale: invalidar sesión para forzar login explícito.
      await this.userRepository.update({ id: user.id }, { refreshTokenHash: null });
      throw new UnauthorizedException('Refresh token inválido');
    }

    // Rotar tokens (preservar clinicIds del payload anterior o recalcular)
    const clinicIds = payload.clinicIds ?? (await this.getClinicIds(user.id));
    const newAccessToken = this.getJwtToken({ id: user.id, clinicIds });
    const newRefreshToken = await this.getRefreshToken({ id: user.id, clinicIds });
    const newHash = await bcrypt.hash(this.fingerprintToken(newRefreshToken), 10);
    await this.userRepository.update({ id: user.id }, { refreshTokenHash: newHash });

    const safeUser = await this.userRepository.findOne({ where: { id: user.id }, relations: ['clinic'] });
    if (!safeUser) throw new InternalServerErrorException('Usuario no encontrado tras refresh');
    return {
      user: safeUser,
      token: newAccessToken,
      refreshToken: newRefreshToken,
      permissions: permissionsForRoles(safeUser.roles),
    };
  }

  async logout(userId: string): Promise<void> {
    await this.userRepository.update({ id: userId }, { refreshTokenHash: null });
  }

  async requestPasswordReset(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase().trim() },
      select: { id: true, email: true, isActive: true },
    });

    // Respuesta genérica para no revelar si el email existe
    if (!user || !user.isActive) {
      return { message: 'Si el correo existe en el sistema, recibirás instrucciones para restablecer tu contraseña.' };
    }

    const rawToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await this.userRepository.update(
      { id: user.id },
      { passwordResetToken: rawToken, passwordResetExpiresAt: expiresAt },
    );

    // TODO: enviar por email cuando se configure servicio SMTP
    this.logger.log(`[PASSWORD RESET] Token para ${user.email}: ${rawToken} (expira: ${expiresAt.toISOString()})`);

    return { message: 'Si el correo existe en el sistema, recibirás instrucciones para restablecer tu contraseña.' };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { passwordResetToken: dto.token },
      select: { id: true, email: true, isActive: true, passwordResetToken: true, passwordResetExpiresAt: true },
    });

    if (!user || !user.isActive) {
      throw new NotFoundException('Token inválido o expirado');
    }

    if (!user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
      await this.userRepository.update({ id: user.id }, { passwordResetToken: null, passwordResetExpiresAt: null });
      throw new BadRequestException('El token ha expirado. Solicita un nuevo enlace de recuperación.');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.userRepository.update(
      { id: user.id },
      { password: hashedPassword, passwordResetToken: null, passwordResetExpiresAt: null, refreshTokenHash: null },
    );

    this.logger.log(`[PASSWORD RESET] Contraseña restablecida para usuario ${user.email}`);
    return { message: 'Contraseña restablecida exitosamente. Ya puedes iniciar sesión.' };
  }

  async getProfile(user: User): Promise<User> {
    return this.userRepository.findOne({
      where: { id: user.id },
      relations: ['personalInfo', 'professionalInfo'],
    }) as Promise<User>;
  }

  async updateProfile(user: User, dto: UpdateProfileDto): Promise<User> {
    const found = await this.userRepository.findOne({
      where: { id: user.id },
      relations: ['personalInfo'],
    });

    if (found?.personalInfo) {
      await this.userRepository.manager.getRepository('personal_info').update(
        { id: found.personalInfo.id },
        { ...dto },
      );
    }

    return this.getProfile(user);
  }

  async changePassword(user: User, dto: ChangePasswordDto): Promise<{ message: string }> {
    const found = await this.userRepository.findOne({
      where: { id: user.id },
      select: { id: true, password: true },
    });

    if (!found) throw new NotFoundException('Usuario no encontrado.');

    const valid = await bcrypt.compare(dto.currentPassword, found.password);
    if (!valid) throw new BadRequestException('La contraseña actual es incorrecta.');

    await this.userRepository.update({ id: found.id }, { password: await bcrypt.hash(dto.newPassword, 10) });

    return { message: 'Contraseña actualizada correctamente.' };
  }

  // Godmode: crea o promueve un SUPER_ADMIN, protegido por token de entorno
  async bootstrapSuperAdmin(dto: GodBootstrapDto, providedToken?: string): Promise<LoginResponse> {
    const godToken = process.env.GOD_MODE_TOKEN?.trim();
    if (!godToken || this.isInsecureGodToken(godToken))
      throw new UnauthorizedException('God mode is not configured');
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
      if (!safeUser) throw new InternalServerErrorException('Usuario no encontrado tras promoción');
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
      if (!safeUser) throw new InternalServerErrorException('Usuario no encontrado tras creación godmode');
      return { user: safeUser, token: this.getJwtToken({ id: created.id }) };
    }

    // Si existe y modo 'create', promueve roles y resetea la contraseña
    const promoteRoles = new Set([...(user.roles || []), ValidRoles.SUPER_ADMIN, ValidRoles.ADMIN]);
    const newPasswordHash = await bcrypt.hash(dto.password, 10);
    await this.userRepository.update(
      { id: user.id },
      { roles: Array.from(promoteRoles), password: newPasswordHash, isActive: true },
    );
    const safeUser = await this.userRepository.findOne({ where: { id: user.id } });
    if (!safeUser) throw new InternalServerErrorException('Usuario no encontrado tras promoción godmode');
    return { user: safeUser, token: this.getJwtToken({ id: user.id }) };
  }

  private readonly logger = new Logger(AuthService.name);

  private isInsecureGodToken(token: string): boolean {
    const normalized = token.toLowerCase();
    return normalized === 'change-me-very-strong' || normalized.includes('change-me');
  }

  private fingerprintToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private handleDBError(error: any): never {
    if (error.code === '23505') throw new BadRequestException(error.detail);
    this.logger.error(error.message, error.stack);
    throw new InternalServerErrorException('Something went wrong');
  }
}
