import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FilterAuditDto } from './dto/filter-audit.dto';
import { AuditLog } from './entities/audit-log.entity';

export interface CreateAuditLogDto {
  action: string;
  resource: string;
  resourceId?: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  clinicId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  method: string;
  path: string;
  statusCode: number;
  status: string;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  /** Persiste un evento de auditoría. Nunca lanza excepción para no interrumpir el flujo principal. */
  async log(dto: CreateAuditLogDto): Promise<void> {
    try {
      const entry = this.auditLogRepository.create(dto);
      await this.auditLogRepository.save(entry);
    } catch {
      // Los logs de auditoría no deben cortar el flujo de la aplicación
    }
  }

  async findAll(filter: FilterAuditDto) {
    const { page = 1, pageSize = 50, action, resource, status, userEmail, search, startDate, endDate } = filter;
    const skip = (page - 1) * pageSize;

    const qb = this.auditLogRepository
      .createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC')
      .skip(skip)
      .take(pageSize);

    if (action) qb.andWhere('log.action = :action', { action });
    if (resource) qb.andWhere('log.resource = :resource', { resource });
    if (status) qb.andWhere('log.status = :status', { status });
    if (userEmail) qb.andWhere('log.userEmail ILIKE :userEmail', { userEmail: `%${userEmail}%` });
    if (search) {
      qb.andWhere(
        '(log.userEmail ILIKE :search OR log.resource ILIKE :search OR log.path ILIKE :search OR log.userName ILIKE :search)',
        { search: `%${search}%` },
      );
    }
    if (startDate) {
      qb.andWhere('log.createdAt >= :startDate', { startDate: new Date(startDate) });
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      qb.andWhere('log.createdAt <= :endDate', { endDate: end });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async getStats(startDate?: string, endDate?: string) {
    const start = startDate
      ? new Date(startDate)
      : (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();

    const end = endDate
      ? (() => { const d = new Date(endDate); d.setHours(23, 59, 59, 999); return d; })()
      : (() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; })();

    const [total, errors, logins, failedLogins] = await Promise.all([
      this.auditLogRepository.createQueryBuilder('log')
        .where('log.createdAt >= :start', { start })
        .andWhere('log.createdAt <= :end', { end })
        .getCount(),
      this.auditLogRepository.createQueryBuilder('log')
        .where('log.status = :status', { status: 'failure' })
        .andWhere('log.createdAt >= :start', { start })
        .andWhere('log.createdAt <= :end', { end })
        .getCount(),
      this.auditLogRepository.createQueryBuilder('log')
        .where('log.action = :action', { action: 'LOGIN' })
        .andWhere('log.createdAt >= :start', { start })
        .andWhere('log.createdAt <= :end', { end })
        .getCount(),
      this.auditLogRepository.createQueryBuilder('log')
        .where('log.action = :action', { action: 'LOGIN' })
        .andWhere('log.status = :status', { status: 'failure' })
        .andWhere('log.createdAt >= :start', { start })
        .andWhere('log.createdAt <= :end', { end })
        .getCount(),
    ]);

    const [topUsersRaw, topResourcesRaw, topIpRaw] = await Promise.all([
      this.auditLogRepository.createQueryBuilder('log')
        .select('log.userEmail', 'email')
        .addSelect('COUNT(*)', 'count')
        .where('log.createdAt >= :start', { start })
        .andWhere('log.createdAt <= :end', { end })
        .andWhere('log.userEmail IS NOT NULL')
        .groupBy('log.userEmail')
        .orderBy('count', 'DESC')
        .limit(5)
        .getRawMany(),
      this.auditLogRepository.createQueryBuilder('log')
        .select('log.resource', 'resource')
        .addSelect('COUNT(*)', 'count')
        .where('log.createdAt >= :start', { start })
        .andWhere('log.createdAt <= :end', { end })
        .groupBy('log.resource')
        .orderBy('count', 'DESC')
        .limit(5)
        .getRawMany(),
      this.auditLogRepository.createQueryBuilder('log')
        .select('log.ipAddress', 'ip')
        .addSelect('COUNT(*)', 'count')
        .where('log.createdAt >= :start', { start })
        .andWhere('log.createdAt <= :end', { end })
        .andWhere('log.ipAddress IS NOT NULL')
        .groupBy('log.ipAddress')
        .orderBy('count', 'DESC')
        .limit(1)
        .getRawOne(),
    ]);

    return {
      totalToday: total,
      errorsToday: errors,
      loginsToday: logins,
      mutationsToday: total - logins,
      failedLogins,
      topIp: topIpRaw ? { ip: topIpRaw.ip as string, count: Number(topIpRaw.count) } : null,
      topUsers: topUsersRaw.map(r => ({ email: r.email as string, count: Number(r.count) })),
      topResources: topResourcesRaw.map(r => ({ resource: r.resource as string, count: Number(r.count) })),
    };
  }

  async getDailyActivity(startDate?: string, endDate?: string) {
    const start = startDate
      ? new Date(startDate)
      : (() => { const d = new Date(); d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0); return d; })();

    const end = endDate
      ? (() => { const d = new Date(endDate); d.setHours(23, 59, 59, 999); return d; })()
      : (() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; })();

    const raw = await this.auditLogRepository
      .createQueryBuilder('log')
      .select("TO_CHAR(log.createdAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'total')
      .addSelect("SUM(CASE WHEN log.status = 'failure' THEN 1 ELSE 0 END)", 'errors')
      .where('log.createdAt >= :start', { start })
      .andWhere('log.createdAt <= :end', { end })
      .groupBy("TO_CHAR(log.createdAt, 'YYYY-MM-DD')")
      .orderBy('date', 'ASC')
      .getRawMany();

    return raw.map(r => ({
      date: r.date as string,
      total: Number(r.total),
      errors: Number(r.errors),
    }));
  }

  async getDistinctValues() {
    const [resources, actions] = await Promise.all([
      this.auditLogRepository
        .createQueryBuilder('log')
        .select('DISTINCT log.resource', 'resource')
        .orderBy('log.resource', 'ASC')
        .getRawMany()
        .then(rows => rows.map(r => r.resource as string)),
      this.auditLogRepository
        .createQueryBuilder('log')
        .select('DISTINCT log.action', 'action')
        .orderBy('log.action', 'ASC')
        .getRawMany()
        .then(rows => rows.map(r => r.action as string)),
    ]);
    return { resources, actions };
  }
}
