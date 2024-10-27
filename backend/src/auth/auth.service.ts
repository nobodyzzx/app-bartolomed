import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';

import * as bcrypt from 'bcrypt';

import { User } from './entities/user.entity';
import { CreateUserDto, LoginUserDto } from './dto';
import { JwtPayload } from './interfaces/jwt-payload.interfaces';
import { LoginResponse } from './interfaces';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly jwtService: JwtService,
  ) {}
  async create(createUserDto: CreateUserDto) {
    try {
      const { password, ...userData } = createUserDto;

      const user = this.userRepository.create({
        ...userData,
        password: await bcrypt.hashSync(password, 10),
      });
      await this.userRepository.save(user);
      delete user.password;
      return {
        ...user,
        token: this.getJwtToken({ id: user.id }),
      };
      //TODO: retornar el JWT
    } catch (error) {
      this.handleDBError(error);
    }
  }

  async login(loginUserDto: LoginUserDto): Promise<LoginResponse> {
    const { password, email } = loginUserDto;

    const user = await this.userRepository.findOne({
      where: { email },
      select: {
        email: true,
        password: true,
        id: true,
        fullName: true,
        isActive: true,
        roles: true,
      }, //! OJO!
    });

    if (!user)
      throw new UnauthorizedException(
        'Las credenciales proporcionadas no son válidas. Por favor, verifica tu dirección de correo electrónico.',
      );

    if (!bcrypt.compareSync(password, user.password))
      throw new UnauthorizedException(
        'La contraseña ingresada no es correcta. Por favor, intenta nuevamente.',
      );

    return {
      user,
      token: this.getJwtToken({ id: user.id }),
    };
  }

  async checkAuthStatus(user: User) {
    return {
      ...user,
      token: this.getJwtToken({ id: user.id }),
    };
  }

  private getJwtToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload);
  }

  private handleDBError(error: any): never {
    if (error.code === '23505') {
      throw new BadRequestException(error.detail);
    }
    console.log(error);
    throw new InternalServerErrorException(
      'Por favor, revisa los logs del servidor',
    );
  }
  // async login(loginUserDto: LoginUserDto): Promise<LoginResponse> {
  //   const { password, email } = loginUserDto;
  //   const user = await this.userRepository.findOne({
  //     where: { email },
  //     select: { email: true, password: true, id: true },
  //   });

  //   if (!user) throw new UnauthorizedException('Invalid credentials');

  //   if (!bcrypt.compareSync(password, user.password))
  //     throw new UnauthorizedException('Invalid credentials pw');
  //   return {
  //     ...user,
  //     token: this.getJwtToken({ id: user.id }),
  //   };
  //   //TODO: JWt
  // }
  // private getJwtToken(payload: JwtPayload) {
  //   const token = this.jwtService.sign(payload);
  //   return token;
  // }

  // private handleDBError(error: any): never {
  //   if (error.code === '23505') throw new BadRequestException(error.detail);
  //   console.log(error);
  //   throw new InternalServerErrorException('Please ckech server logs');
  // }
}
