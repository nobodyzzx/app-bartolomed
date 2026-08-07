import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

// Antes update() recibía `Partial<CreateUserDto>` (utility type, no una clase
// real) — sin metadata de diseño real, ValidationPipe no podía validar nada
// del body (roles, email, password quedaban sin chequear). PartialType sí
// genera una clase real con los decoradores de CreateUserDto heredados.
export class UpdateUserDto extends PartialType(CreateUserDto) {}
