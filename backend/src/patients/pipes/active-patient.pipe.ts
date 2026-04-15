import { BadRequestException, Inject, Injectable, NotFoundException, PipeTransform, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { resolveClinicId } from '../../auth/decorators/clinic-roles.decorator';
import { Patient } from '../entities/patient.entity';

@Injectable({ scope: Scope.REQUEST })
export class ActivePatientPipe implements PipeTransform {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @Inject(REQUEST)
    private readonly request: Request,
  ) {}

  async transform(patientId: string): Promise<Patient> {
    if (!patientId) throw new BadRequestException('patientId es requerido');
    const clinicId = resolveClinicId(this.request as any);
    const patient = await this.patientRepo.findOne({
      where: { id: patientId, isActive: true, clinic: { id: clinicId } },
    });
    if (!patient) throw new NotFoundException('Paciente no encontrado o inactivo en esta clínica');
    return patient;
  }
}
