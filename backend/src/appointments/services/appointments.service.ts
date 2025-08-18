import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Not } from 'typeorm';
import { Appointment, AppointmentStatus } from '../entities/appointment.entity';
import { CreateAppointmentDto, UpdateAppointmentDto } from '../dto';
import { User } from '../../users/entities/user.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';

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

    // Verificar que el paciente existe
    const patient = await this.patientRepository.findOne({
      where: { id: patientId, isActive: true },
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    // Verificar que el doctor existe y tiene rol de doctor
    const doctor = await this.userRepository.findOne({
      where: { id: doctorId, isActive: true },
    });
    if (!doctor || !doctor.roles.includes('doctor')) {
      throw new NotFoundException('Doctor not found or invalid role');
    }

    // Verificar que la clínica existe
    const clinic = await this.clinicRepository.findOne({
      where: { id: clinicId, isActive: true },
    });
    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }

    // Verificar disponibilidad del doctor
    const appointmentStart = new Date(appointmentDate);
    const appointmentEnd = new Date(appointmentStart.getTime() + duration * 60000);

    const conflictingAppointment = await this.appointmentRepository.findOne({
      where: {
        doctor: { id: doctorId },
        appointmentDate: Between(
          new Date(appointmentStart.getTime() - 15 * 60000), // 15 min buffer antes
          appointmentEnd
        ),
        status: AppointmentStatus.SCHEDULED || AppointmentStatus.CONFIRMED,
        isActive: true,
      },
    });

    if (conflictingAppointment) {
      throw new ConflictException('Doctor is not available at the requested time');
    }

    try {
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
    } catch (error) {
      throw new BadRequestException('Error creating appointment');
    }
  }

  async findAll(
    clinicId?: string,
    doctorId?: string,
    patientId?: string,
    status?: AppointmentStatus,
    startDate?: string,
    endDate?: string,
  ): Promise<Appointment[]> {
    const queryBuilder = this.appointmentRepository.createQueryBuilder('appointment');

    queryBuilder
      .leftJoinAndSelect('appointment.patient', 'patient')
      .leftJoinAndSelect('appointment.doctor', 'doctor')
      .leftJoinAndSelect('appointment.clinic', 'clinic')
      .where('appointment.isActive = :isActive', { isActive: true });

    if (clinicId) {
      queryBuilder.andWhere('clinic.id = :clinicId', { clinicId });
    }

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

    return await queryBuilder
      .orderBy('appointment.appointmentDate', 'ASC')
      .getMany();
  }

  async findOne(id: string): Promise<Appointment> {
    const appointment = await this.appointmentRepository.findOne({
      where: { id, isActive: true },
      relations: ['patient', 'doctor', 'clinic', 'createdBy'],
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    return appointment;
  }

  async update(id: string, updateAppointmentDto: UpdateAppointmentDto, user: User): Promise<Appointment> {
    const appointment = await this.findOne(id);

    // Si se está actualizando la fecha/hora, verificar disponibilidad
    if (updateAppointmentDto.appointmentDate || updateAppointmentDto.duration) {
      const newDate = updateAppointmentDto.appointmentDate 
        ? new Date(updateAppointmentDto.appointmentDate)
        : appointment.appointmentDate;
      const newDuration = updateAppointmentDto.duration || appointment.duration;
      
      const appointmentEnd = new Date(newDate.getTime() + newDuration * 60000);

      const conflictingAppointment = await this.appointmentRepository.findOne({
        where: {
          doctor: { id: appointment.doctor.id },
          appointmentDate: Between(
            new Date(newDate.getTime() - 15 * 60000),
            appointmentEnd
          ),
          status: AppointmentStatus.SCHEDULED || AppointmentStatus.CONFIRMED,
          isActive: true,
          id: Not(id), // Excluir la cita actual
        },
      });

      if (conflictingAppointment) {
        throw new ConflictException('Doctor is not available at the requested time');
      }
    }

    Object.assign(appointment, {
      ...updateAppointmentDto,
      updatedBy: user,
    });

    return await this.appointmentRepository.save(appointment);
  }

  async cancel(id: string, cancellationReason: string, user: User): Promise<Appointment> {
    const appointment = await this.findOne(id);

    if (!appointment.canBeCancelled()) {
      throw new BadRequestException('Appointment cannot be cancelled in its current status');
    }

    appointment.status = AppointmentStatus.CANCELLED;
    appointment.cancellationReason = cancellationReason;
    appointment.cancelledAt = new Date();
    appointment.updatedBy = user;

    return await this.appointmentRepository.save(appointment);
  }

  async confirm(id: string, user: User): Promise<Appointment> {
    const appointment = await this.findOne(id);

    if (appointment.status !== AppointmentStatus.SCHEDULED) {
      throw new BadRequestException('Only scheduled appointments can be confirmed');
    }

    appointment.status = AppointmentStatus.CONFIRMED;
    appointment.confirmedAt = new Date();
    appointment.updatedBy = user;

    return await this.appointmentRepository.save(appointment);
  }

  async complete(id: string, user: User): Promise<Appointment> {
    const appointment = await this.findOne(id);

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
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const queryBuilder = this.appointmentRepository.createQueryBuilder('appointment')
      .where('appointment.doctor.id = :doctorId', { doctorId })
      .andWhere('appointment.appointmentDate BETWEEN :startOfDay AND :endOfDay', {
        startOfDay,
        endOfDay,
      })
      .andWhere('appointment.status IN (:...statuses)', {
        statuses: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS],
      })
      .andWhere('appointment.isActive = :isActive', { isActive: true });

    if (clinicId) {
      queryBuilder.andWhere('appointment.clinic.id = :clinicId', { clinicId });
    }

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
    const queryBuilder = this.appointmentRepository.createQueryBuilder('appointment');

    queryBuilder.where('appointment.isActive = :isActive', { isActive: true });

    if (clinicId) {
      queryBuilder.andWhere('appointment.clinic.id = :clinicId', { clinicId });
    }

    if (doctorId) {
      queryBuilder.andWhere('appointment.doctor.id = :doctorId', { doctorId });
    }

    if (startDate && endDate) {
      queryBuilder.andWhere('appointment.appointmentDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    const totalAppointments = await queryBuilder.getCount();

    const statusStats = await queryBuilder
      .select('appointment.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('appointment.status')
      .getRawMany();

    const typeStats = await queryBuilder
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

  async remove(id: string): Promise<void> {
    const appointment = await this.findOne(id);
    appointment.isActive = false;
    await this.appointmentRepository.save(appointment);
  }
}
