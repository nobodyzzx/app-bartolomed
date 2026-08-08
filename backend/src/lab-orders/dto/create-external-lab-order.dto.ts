import { OmitType } from '@nestjs/mapped-types';
import { IsString, Length } from 'class-validator';
import { CreateLabOrderDto } from './create-lab-order.dto';

/**
 * Solicitud que no nace de una indicación médica de la casa: el paciente llega
 * con una orden en papel de otro consultorio, o se paga el examen sin consulta
 * previa.
 *
 * Hereda todo lo demás de `CreateLabOrderDto` — mismo paciente (ficha o nombre
 * libre), mismos estudios contra el tarifario, misma clínica — y solo cambia
 * el solicitante: en vez de `doctorId` (un usuario del sistema, que aquí no
 * existe) pide `referringDoctorName` como texto. Es deliberado que no se pueda
 * enviar `doctorId` por esta vía: quien registra la solicitud nunca debe
 * quedar grabado como quien indicó el examen.
 */
export class CreateExternalLabOrderDto extends OmitType(CreateLabOrderDto, ['doctorId'] as const) {
  @IsString({ message: 'Indique quién solicitó el examen' })
  @Length(3, 160)
  referringDoctorName: string;
}
