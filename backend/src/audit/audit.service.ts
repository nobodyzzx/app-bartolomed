import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { ValidRoles } from '../auth/interfaces';
import { User } from '../users/entities/user.entity';
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
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  /** Columnas por las que se puede ordenar el registro. Espeja el `@IsIn` del DTO. */
  private static readonly COLUMNAS_ORDENABLES = [
    'createdAt', 'userEmail', 'action', 'resource', 'method', 'statusCode', 'status', 'ipAddress',
  ];

  /** Persiste un evento de auditoría. Nunca lanza excepción para no interrumpir el flujo principal. */
  async log(dto: CreateAuditLogDto): Promise<void> {
    try {
      const entry = this.auditLogRepository.create(dto);
      await this.auditLogRepository.save(entry);
    } catch (error) {
      // No propagamos (un log de auditoría no debe cortar el flujo de la app), pero sí lo dejamos visible.
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Fallo al persistir audit log (action=${dto.action}, resource=${dto.resource}): ${message}`);
    }
  }

  private isSuperAdmin(actor: User): boolean {
    return actor.roles?.includes(ValidRoles.SUPER_ADMIN) ?? false;
  }

  // SUPER_ADMIN audita el sistema completo; un ADMIN solo su propia clínica
  // activa — antes ningún endpoint de consulta filtraba por clinicId pese a
  // que la entidad tiene la columna e índice pensados exactamente para esto.
  private scopeToClinic(qb: SelectQueryBuilder<AuditLog>, actor: User, clinicId: string): SelectQueryBuilder<AuditLog> {
    if (this.isSuperAdmin(actor)) return qb;
    return qb.andWhere('log.clinicId = :scopedClinicId', { scopedClinicId: clinicId });
  }

  async findAll(filter: FilterAuditDto, actor: User, clinicId: string) {
    const { page = 1, pageSize = 50, action, resource, status, search, startDate, endDate } = filter;
    const skip = (page - 1) * pageSize;

    // Lo más reciente primero mientras no se pida otra cosa: es lo que se mira
    // al abrir el registro. `sortBy` viene de una lista blanca en el DTO —
    // `orderBy()` interpola sin parametrizar—, y aun así se vuelve a comprobar
    // aquí para que este método sea seguro llamándolo desde donde sea.
    const columna = AuditService.COLUMNAS_ORDENABLES.includes(filter.sortBy ?? '')
      ? filter.sortBy!
      : 'createdAt';
    const sentido = filter.sortDir === 'ASC' ? 'ASC' : 'DESC';

    const qb = this.scopeToClinic(
      this.auditLogRepository.createQueryBuilder('log'),
      actor,
      clinicId,
    )
      // `NULLS LAST`: Postgres pone los nulos primero al ordenar descendiendo, y
      // una columna con la mitad vacía se llenaría de huecos arriba. El mismo
      // criterio que el comparador del navegador — el hueco estorba en los dos
      // sentidos, así que va al final en los dos.
      .orderBy(`log.${columna}`, sentido, 'NULLS LAST')
      // Desempate estable: sin él, dos eventos con el mismo estado pueden
      // cambiar de sitio entre página y página y aparecer repetidos o
      // desaparecer al pasar de una a otra.
      .addOrderBy('log.id', 'DESC')
      .skip(skip)
      .take(pageSize);

    if (action) qb.andWhere('log.action = :action', { action });
    if (resource) qb.andWhere('log.resource = :resource', { resource });
    if (status) qb.andWhere('log.status = :status', { status });
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

  async getStats(startDate: string | undefined, endDate: string | undefined, actor: User, clinicId: string) {
    const start = startDate
      ? new Date(startDate)
      : (() => {
          const d = new Date();
          d.setHours(0, 0, 0, 0);
          return d;
        })();

    const end = endDate
      ? (() => {
          const d = new Date(endDate);
          d.setHours(23, 59, 59, 999);
          return d;
        })()
      : (() => {
          const d = new Date();
          d.setHours(23, 59, 59, 999);
          return d;
        })();

    const scoped = () => this.scopeToClinic(this.auditLogRepository.createQueryBuilder('log'), actor, clinicId);

    const [total, errors, logins, failedLogins] = await Promise.all([
      scoped()
        .where('log.createdAt >= :start', { start })
        .andWhere('log.createdAt <= :end', { end })
        .getCount(),
      scoped()
        .where('log.status = :status', { status: 'failure' })
        .andWhere('log.createdAt >= :start', { start })
        .andWhere('log.createdAt <= :end', { end })
        .getCount(),
      scoped()
        .where('log.action = :action', { action: 'LOGIN' })
        .andWhere('log.createdAt >= :start', { start })
        .andWhere('log.createdAt <= :end', { end })
        .getCount(),
      scoped()
        .where('log.action = :action', { action: 'LOGIN' })
        .andWhere('log.status = :status', { status: 'failure' })
        .andWhere('log.createdAt >= :start', { start })
        .andWhere('log.createdAt <= :end', { end })
        .getCount(),
    ]);

    const [topUsersRaw, topResourcesRaw, topIpRaw] = await Promise.all([
      scoped()
        .select('log.userEmail', 'email')
        .addSelect('COUNT(*)', 'count')
        .where('log.createdAt >= :start', { start })
        .andWhere('log.createdAt <= :end', { end })
        .andWhere('log.userEmail IS NOT NULL')
        .groupBy('log.userEmail')
        .orderBy('count', 'DESC')
        .limit(5)
        .getRawMany(),
      scoped()
        .select('log.resource', 'resource')
        .addSelect('COUNT(*)', 'count')
        .where('log.createdAt >= :start', { start })
        .andWhere('log.createdAt <= :end', { end })
        .groupBy('log.resource')
        .orderBy('count', 'DESC')
        .limit(5)
        .getRawMany(),
      scoped()
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

  async getDailyActivity(startDate: string | undefined, endDate: string | undefined, actor: User, clinicId: string) {
    const start = startDate
      ? new Date(startDate)
      : (() => {
          const d = new Date();
          d.setDate(d.getDate() - 6);
          d.setHours(0, 0, 0, 0);
          return d;
        })();

    const end = endDate
      ? (() => {
          const d = new Date(endDate);
          d.setHours(23, 59, 59, 999);
          return d;
        })()
      : (() => {
          const d = new Date();
          d.setHours(23, 59, 59, 999);
          return d;
        })();

    const raw = await this.scopeToClinic(this.auditLogRepository.createQueryBuilder('log'), actor, clinicId)
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

  async getDistinctValues(actor: User, clinicId: string) {
    const [resources, actions] = await Promise.all([
      this.scopeToClinic(this.auditLogRepository.createQueryBuilder('log'), actor, clinicId)
        .select('DISTINCT log.resource', 'resource')
        .orderBy('log.resource', 'ASC')
        .getRawMany()
        .then(rows => rows.map(r => r.resource as string)),
      this.scopeToClinic(this.auditLogRepository.createQueryBuilder('log'), actor, clinicId)
        .select('DISTINCT log.action', 'action')
        .orderBy('log.action', 'ASC')
        .getRawMany()
        .then(rows => rows.map(r => r.action as string)),
    ]);
    return { resources, actions };
  }
}
