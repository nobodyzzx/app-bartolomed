import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment, AppointmentStatus } from '../entities/appointment.entity';
import { CreateAppointmentDto, UpdateAppointmentDto } from '../dto/index';
import { User } from '../../users/entities/user.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';

const BLOCKING_APPOINTMENT_STATUSES = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.IN_PROGRESS,
];

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
  ) {}

  async create(createAppointmentDto: CreateAppointmentDto, user: User): Promise<Appointment> {
    const { patientId, doctorId, clinicId, appointmentDate, duration, ...appointmentData } = createAppointmentDto;
    const appointmentStart = this.parseAppointmentDate(appointmentDate);
    const appointmentEnd = new Date(appointmentStart.getTime() + duration * 60000);
    if (appointmentStart < new Date()) {
      throw new BadRequestException('Appointment date cannot be in the past');
    }

    const patient = await this.patientRepository.findOne({
      where: { id: patientId, isActive: true, clinic: { id: clinicId } },
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const doctor = await this.userRepository.findOne({
      where: { id: doctorId, isActive: true },
    });
    if (!doctor || !doctor.roles.includes('doctor')) {
      throw new NotFoundException('Doctor not found or invalid role');
    }

    const clinic = await this.clinicRepository.findOne({
      where: { id: clinicId, isActive: true },
    });
    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }

    await this.assertDoctorAvailability(doctorId, clinicId, appointmentStart, appointmentEnd);

    const appointment = this.appointmentRepository.create({
      ...appointmentData,
      appointmentDate: appointmentStart,
      duration,
      patient,
      doctor,
      clinic,
      createdBy: user,
    });

    return await this.appointmentRepository.save(appointment);
  }

  async findAll(
    clinicId?: string,
    doctorId?: string,
    patientId?: string,
    status?: AppointmentStatus,
    startDate?: string,
    endDate?: string,
  ): Promise<Appointment[]> {
    if (!clinicId) {
      throw new BadRequestException('clinicId is required');
    }

    const queryBuilder = this.appointmentRepository.createQueryBuilder('appointment');

    queryBuilder
      .leftJoinAndSelect('appointment.patient', 'patient')
      .leftJoinAndSelect('appointment.doctor', 'doctor')
      .leftJoinAndSelect('appointment.clinic', 'clinic')
      .where('appointment.isActive = :isActive', { isActive: true });

    queryBuilder.andWhere('clinic.id = :clinicId', { clinicId });

    if (doctorId) {
      queryBuilder.andWhere('doctor.id = :doctorId', { doctorId });
    }

    if (patientId) {
      queryBuilder.andWhere('patient.id = :patientId', { patientId });
    }

    if (status) {
      queryBuilder.andWhere('appointment.status = :status', { status });
    }

    if (startDate && endDate) {
      queryBuilder.andWhere('appointment.appointmentDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    } else if (startDate) {
      queryBuilder.andWhere('appointment.appointmentDate >= :startDate', { startDate });
    } else if (endDate) {
      queryBuilder.andWhere('appointment.appointmentDate <= :endDate', { endDate });
    }

    return await queryBuilder.orderBy('appointment.appointmentDate', 'ASC').getMany();
  }

  async findOne(id: string, clinicId?: string): Promise<Appointment> {
    if (!clinicId) {
      throw new BadRequestException('clinicId is required');
    }

    const appointment = await this.appointmentRepository.findOne({
      where: { id, isActive: true, clinic: { id: clinicId } },
      relations: ['patient', 'doctor', 'clinic', 'createdBy', 'updatedBy'],
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    return appointment;
  }

  async update(id: string, updateAppointmentDto: UpdateAppointmentDto, user: User, clinicId?: string): Promise<Appointment> {
    const appointment = await this.findOne(id, clinicId);
    const doctorChanged = !!updateAppointmentDto.doctorId && updateAppointmentDto.doctorId !== appointment.doctor.id;
    const { patientId, doctorId, clinicId: nextClinicId, status, ...updateData } = updateAppointmentDto;

    if (status && status !== appointment.status) {
      throw new BadRequestException('Use dedicated endpoints to change appointment status');
    }

    if (nextClinicId && nextClinicId !== appointment.clinic.id) {
      throw new BadRequestException('Changing clinic for an existing appointment is not allowed');
    }

    if (patientId && patientId !== appointment.patient.id) {
      const patient = await this.patientRepository.findOne({
        where: { id: patientId, isActive: true, clinic: { id: appointment.clinic.id } },
      });
      if (!patient) {
        throw new NotFoundException('Patient not found');
      }
      appointment.patient = patient;
    }

    if (doctorId && doctorId !== appointment.doctor.id) {
      const doctor = await this.userRepository.findOne({
        where: { id: doctorId, isActive: true },
      });
      if (!doctor || !doctor.roles.includes('doctor')) {
        throw new NotFoundException('Doctor not found or invalid role');
      }
      appointment.doctor = doctor;
    }

    const targetStart = updateAppointmentDto.appointmentDate
      ? this.parseAppointmentDate(updateAppointmentDto.appointmentDate)
      : appointment.appointmentDate;
    const targetDuration = updateAppointmentDto.duration ?? appointment.duration;
    const targetEnd = new Date(targetStart.getTime() + targetDuration * 60000);
    const targetDoctorId = appointment.doctor.id;
    if (updateAppointmentDto.appointmentDate && targetStart < new Date()) {
      throw new BadRequestException('Appointment date cannot be in the past');
    }

    if (
      updateAppointmentDto.appointmentDate ||
      updateAppointmentDto.duration !== undefined ||
      doctorChanged
    ) {
      await this.assertDoctorAvailability(targetDoctorId, appointment.clinic.id, targetStart, targetEnd, appointment.id);
    }

    Object.assign(appointment, {
      ...updateData,
      appointmentDate: targetStart,
      duration: targetDuration,
      updatedBy: user,
    });

    return await this.appointmentRepository.save(appointment);
  }

  async cancel(id: string, cancellationReason: string, user: User, clinicId?: string): Promise<Appointment> {
    const appointment = await this.findOne(id, clinicId);

    if (!appointment.canBeCancelled()) {
      throw new BadRequestException('Appointment cannot be cancelled in its current status');
    }

    appointment.status = AppointmentStatus.CANCELLED;
    appointment.cancellationReason = cancellationReason;
    appointment.cancelledAt = new Date();
    appointment.updatedBy = user;

    return await this.appointmentRepository.save(appointment);
  }

  async confirm(id: string, user: User, clinicId?: string): Promise<Appointment> {
    const appointment = await this.findOne(id, clinicId);

    if (appointment.status !== AppointmentStatus.SCHEDULED) {
      throw new BadRequestException('Only scheduled appointments can be confirmed');
    }

    appointment.status = AppointmentStatus.CONFIRMED;
    appointment.confirmedAt = new Date();
    appointment.updatedBy = user;

    return await this.appointmentRepository.save(appointment);
  }

  async complete(id: string, user: User, clinicId?: string): Promise<Appointment> {
    const appointment = await this.findOne(id, clinicId);

    if (![AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS].includes(appointment.status)) {
      throw new BadRequestException('Only confirmed or in-progress appointments can be completed');
    }

    appointment.status = AppointmentStatus.COMPLETED;
    appointment.completedAt = new Date();
    appointment.updatedBy = user;

    return await this.appointmentRepository.save(appointment);
  }

  async getDoctorAvailability(
    doctorId: string,
    date: string,
    clinicId?: string,
  ): Promise<{ available: boolean; conflictingAppointments: Appointment[] }> {
    if (!clinicId) {
      throw new BadRequestException('clinicId is required');
    }

    const startOfDay = this.parseAppointmentDate(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const queryBuilder = this.appointmentRepository
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.doctor', 'doctor')
      .leftJoinAndSelect('appointment.clinic', 'clinic')
      .where('doctor.id = :doctorId', { doctorId })
      .andWhere('clinic.id = :clinicId', { clinicId })
      .andWhere('appointment.appointmentDate BETWEEN :startOfDay AND :endOfDay', {
        startOfDay,
        endOfDay,
      })
      .andWhere('appointment.status IN (:...statuses)', {
        statuses: BLOCKING_APPOINTMENT_STATUSES,
      })
      .andWhere('appointment.isActive = :isActive', { isActive: true });

    const conflictingAppointments = await queryBuilder.getMany();

    return {
      available: conflictingAppointments.length === 0,
      conflictingAppointments,
    };
  }

  async getAppointmentStatistics(
    clinicId?: string,
    doctorId?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<any> {
    if (!clinicId) {
      throw new BadRequestException('clinicId is required');
    }

    const queryBuilder = this.appointmentRepository
      .createQueryBuilder('appointment')
      .leftJoin('appointment.clinic', 'clinic')
      .leftJoin('appointment.doctor', 'doctor')
      .where('appointment.isActive = :isActive', { isActive: true })
      .andWhere('clinic.id = :clinicId', { clinicId });

    if (doctorId) {
      queryBuilder.andWhere('doctor.id = :doctorId', { doctorId });
    }

    if (startDate && endDate) {
      queryBuilder.andWhere('appointment.appointmentDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    const totalAppointments = await queryBuilder.clone().getCount();

    const statusStats = await queryBuilder
      .clone()
      .select('appointment.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('appointment.status')
      .getRawMany();

    const typeStats = await queryBuilder
      .clone()
      .select('appointment.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('appointment.type')
      .getRawMany();

    return {
      totalAppointments,
      statusStats,
      typeStats,
    };
  }

  async remove(id: string, clinicId?: string): Promise<void> {
    const appointment = await this.findOne(id, clinicId);
    appointment.isActive = false;
    await this.appointmentRepository.save(appointment);
  }

  private parseAppointmentDate(value: string): Date {
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException('Invalid appointment date');
    }
    return parsedDate;
  }

  private async assertDoctorAvailability(
    doctorId: string,
    clinicId: string,
    requestedStart: Date,
    requestedEnd: Date,
    excludeAppointmentId?: string,
  ): Promise<void> {
    const queryBuilder = this.appointmentRepository
      .createQueryBuilder('appointment')
      .leftJoin('appointment.doctor', 'doctor')
      .leftJoin('appointment.clinic', 'clinic')
      .where('doctor.id = :doctorId', { doctorId })
      .andWhere('clinic.id = :clinicId', { clinicId })
      .andWhere('appointment.isActive = :isActive', { isActive: true })
      .andWhere('appointment.status IN (:...statuses)', {
        statuses: BLOCKING_APPOINTMENT_STATUSES,
      })
      .andWhere('appointment.appointmentDate < :requestedEnd', { requestedEnd })
      .andWhere("(appointment.appointmentDate + (appointment.duration * interval '1 minute')) > :requestedStart", {
        requestedStart,
      });

    if (excludeAppointmentId) {
      queryBuilder.andWhere('appointment.id != :excludeAppointmentId', { excludeAppointmentId });
    }

    const conflictingAppointment = await queryBuilder.getOne();
    if (conflictingAppointment) {
      throw new ConflictException('Doctor is not available at the requested time');
    }
  }
}
