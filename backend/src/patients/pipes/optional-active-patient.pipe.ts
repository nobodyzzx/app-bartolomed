import { Inject, Injectable, NotFoundException, PipeTransform, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { resolveClinicId } from '../../auth/decorators/clinic-roles.decorator';
import { Patient } from '../entities/patient.entity';

/**
 * Igual que `ActivePatientPipe`, pero acepta que no venga paciente.
 *
 * Necesario para el laboratorio, que atiende **derivados de otro consultorio**
 * sin ficha en esta clínica. Cuando sí llega un `patientId` se valida igual de
 * estricto (activo y de la clínica del request); cuando no llega, devuelve
 * `undefined` y es el DTO el que exige un `patientName` en su lugar.
 */
@Injectable({ scope: Scope.REQUEST })
export class OptionalActivePatientPipe implements PipeTransform {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @Inject(REQUEST)
    private readonly request: Request,
  ) {}

  async transform(patientId?: string): Promise<Patient | undefined> {
    if (!patientId) return undefined;

    const clinicId = resolveClinicId(this.request as any);
    const patient = await this.patientRepo.findOne({
      where: { id: patientId, isActive: true, clinic: { id: clinicId } },
    });
    if (!patient) throw new NotFoundException('Paciente no encontrado o inactivo en esta clínica');
    return patient;
  }
}
