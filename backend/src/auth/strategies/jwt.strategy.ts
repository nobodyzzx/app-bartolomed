import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { User } from '../../users/entities';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    configService: ConfigService,
  ) {
    super({
      secretOrKey: configService.get<string>('JWT_SECRET', ''),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    });
  }
  async validate(payload: JwtPayload): Promise<User & { clinicIds: string[] }> {
    const { id } = payload;

    const user = await this.userRepository.findOneBy({ id });

    if (!user) throw new UnauthorizedException('Token is not valid');
    if (!user.isActive) throw new UnauthorizedException('User is not active');

    // Adjuntar clinicIds del payload para que ClinicScopeGuard no necesite consultar la DB
    return Object.assign(user, { clinicIds: payload.clinicIds ?? [] });
  }
}
