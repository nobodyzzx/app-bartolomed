import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { AuditLog } from '../../audit/entities/audit-log.entity';
import { Charge, ChargeStatus } from '../../charges/entities/charge.entity';
import { ReportFilters } from './reports.service';

const ORIGIN_LABELS: Record<string, string> = {
  consultation: 'Consultas',
  laboratory: 'Laboratorio',
  pharmacy: 'Farmacia',
  other: 'Otros',
};

/**
 * Control de ingresos sobre los **cargos**, no sobre las facturas.
 *
 * Es lo que hace posible la pregunta que originó todo el plan — *"¿cuánto
 * ingresó hoy la clínica y por qué concepto?"* — porque el cargo sabe de qué
 * módulo salió, mientras que la factura solo tiene un total. El reporte
 * financiero anterior leía facturas sin desglose y no podía responderla.
 */
@Injectable()
export class RevenueReportsService {
  constructor(
    @InjectRepository(Charge)
    private readonly chargeRepository: Repository<Charge>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  private requireClinicId(filters: ReportFilters): string {
    if (!filters.clinicId) throw new BadRequestException('clinicId is required');
    return filters.clinicId;
  }

  private baseQuery(clinicId: string, filters: ReportFilters): SelectQueryBuilder<Charge> {
    const qb = this.chargeRepository.createQueryBuilder('c').where('c.clinic_id = :clinicId', { clinicId });

    if (filters.dateRange) {
      qb.andWhere('c."createdAt" BETWEEN :start AND :end', {
        start: filters.dateRange.startDate,
        end: filters.dateRange.endDate,
      });
    }
    return qb;
  }

  /**
   * Ingresos por origen. Distingue lo **cobrado** (cargos facturados) de lo
   * **pendiente**, porque un cargo generado no es plata en caja.
   */
  async getRevenueByOrigin(filters: ReportFilters) {
    const clinicId = this.requireClinicId(filters);

    const rows = await this.baseQuery(clinicId, filters)
      .select('c.origin', 'origin')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(c.list_price * c.quantity)', 'gross')
      .addSelect('SUM(c.discount_amount)', 'discount')
      .addSelect(`SUM(CASE WHEN c.status = '${ChargeStatus.INVOICED}' THEN c.total ELSE 0 END)`, 'collected')
      .addSelect(`SUM(CASE WHEN c.status = '${ChargeStatus.PENDING}' THEN c.total ELSE 0 END)`, 'pending')
      .addSelect(`SUM(CASE WHEN c.status = '${ChargeStatus.CANCELLED}' THEN c.total ELSE 0 END)`, 'cancelled')
      .groupBy('c.origin')
      .orderBy('collected', 'DESC')
      .getRawMany();

    const byOrigin = rows.map(r => ({
      origin: r.origin,
      label: ORIGIN_LABELS[r.origin] ?? r.origin,
      count: Number(r.count),
      gross: this.num(r.gross),
      discount: this.num(r.discount),
      collected: this.num(r.collected),
      pending: this.num(r.pending),
      cancelled: this.num(r.cancelled),
    }));

    const totals = byOrigin.reduce(
      (acc, r) => ({
        count: acc.count + r.count,
        gross: acc.gross + r.gross,
        discount: acc.discount + r.discount,
        collected: acc.collected + r.collected,
        pending: acc.pending + r.pending,
        cancelled: acc.cancelled + r.cancelled,
      }),
      { count: 0, gross: 0, discount: 0, collected: 0, pending: 0, cancelled: 0 },
    );

    return {
      byOrigin,
      summary: {
        ...this.round(totals),
        // Cuánto del ingreso potencial se dejó de cobrar por descuentos.
        discountRate: totals.gross > 0 ? this.round2((totals.discount / totals.gross) * 100) : 0,
      },
    };
  }

  /**
   * Descuentos otorgados, por usuario y motivo.
   *
   * **No es un reporte opcional**: la clínica decidió que cualquiera que cobre
   * puede descontar sin tope, así que no hay prevención — este registro es la
   * única defensa que queda. Incluye los descuentos "absorbidos", que en el
   * recibo no aparecen pero acá sí.
   */
  async getDiscountsReport(filters: ReportFilters) {
    const clinicId = this.requireClinicId(filters);

    const discounted = this.baseQuery(clinicId, filters).andWhere('c.discount_amount > 0');

    const byUser = await discounted
      .clone()
      .leftJoin('users', 'u', 'u.id = c.discount_authorized_by')
      .select('c.discount_authorized_by', 'userId')
      .addSelect('u.email', 'userEmail')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(c.discount_amount)', 'total')
      .addSelect('MAX(c.discount_amount)', 'max')
      .groupBy('c.discount_authorized_by')
      .addGroupBy('u.email')
      .orderBy('total', 'DESC')
      .getRawMany();

    const byReason = await discounted
      .clone()
      .select('c.discount_reason', 'reason')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(c.discount_amount)', 'total')
      .groupBy('c.discount_reason')
      .orderBy('total', 'DESC')
      .limit(20)
      .getRawMany();

    const detail = await discounted
      .clone()
      .leftJoin('users', 'u', 'u.id = c.discount_authorized_by')
      .select([
        'c.id AS "id"',
        'c."createdAt" AS "date"',
        'c.description AS "description"',
        'c.list_price AS "listPrice"',
        'c.discount_amount AS "discount"',
        'c.total AS "total"',
        'c.discount_reason AS "reason"',
        'c.discount_display AS "display"',
        'u.email AS "authorizedBy"',
      ])
      .orderBy('c."createdAt"', 'DESC')
      .limit(200)
      .getRawMany();

    const total = byUser.reduce((sum, r) => sum + this.num(r.total), 0);

    return {
      byUser: byUser.map(r => ({
        userId: r.userId,
        userEmail: r.userEmail ?? 'Sin registrar',
        count: Number(r.count),
        total: this.num(r.total),
        max: this.num(r.max),
      })),
      byReason: byReason.map(r => ({
        reason: r.reason ?? 'Sin motivo',
        count: Number(r.count),
        total: this.num(r.total),
      })),
      detail: detail.map(r => ({
        ...r,
        listPrice: this.num(r.listPrice),
        discount: this.num(r.discount),
        total: this.num(r.total),
        // Un descuento absorbido no se ve en el recibo del paciente; acá sí.
        hidden: r.display === 'absorbed',
      })),
      summary: {
        totalDiscounted: this.round2(total),
        operations: detail.length,
        hiddenOperations: detail.filter(r => r.display === 'absorbed').length,
      },
    };
  }

  /** Cuentas por cobrar: lo que está generado y todavía no se cobró. */
  async getReceivables(filters: ReportFilters) {
    const clinicId = this.requireClinicId(filters);

    const rows = await this.chargeRepository
      .createQueryBuilder('c')
      .leftJoin('c.patient', 'p')
      .where('c.clinic_id = :clinicId', { clinicId })
      .andWhere('c.status = :status', { status: ChargeStatus.PENDING })
      .select('COALESCE(c.patient_id::text, c.patient_name)', 'key')
      .addSelect('MAX(COALESCE(p."firstName" || \' \' || p."lastName", c.patient_name))', 'patient')
      .addSelect('c.patient_id', 'patientId')
      .addSelect('COUNT(*)', 'charges')
      .addSelect('SUM(c.total)', 'amount')
      .addSelect('MIN(c."createdAt")', 'oldest')
      .groupBy('COALESCE(c.patient_id::text, c.patient_name)')
      .addGroupBy('c.patient_id')
      .orderBy('amount', 'DESC')
      .getRawMany();

    const items = rows.map(r => ({
      patientId: r.patientId,
      patient: r.patient ?? 'Sin identificar',
      charges: Number(r.charges),
      amount: this.num(r.amount),
      oldest: r.oldest,
      daysOutstanding: r.oldest ? Math.floor((Date.now() - new Date(r.oldest).getTime()) / 86_400_000) : 0,
    }));

    return {
      items,
      summary: {
        patients: items.length,
        charges: items.reduce((s, i) => s + i.charges, 0),
        amount: this.round2(items.reduce((s, i) => s + i.amount, 0)),
      },
    };
  }

  /**
   * Cargos que **no se generaron** por falta de tarifa. La generación de cargos
   * nunca lanza para no bloquear un acto clínico, así que sin este dato una
   * consulta sin tarifa configurada simplemente deja de cobrarse en silencio.
   * Se reconstruye desde el log de la aplicación vía audit trail.
   */
  async getUnbilledWarnings(filters: ReportFilters) {
    const clinicId = this.requireClinicId(filters);

    const qb = this.auditLogRepository
      .createQueryBuilder('a')
      .where('a."clinicId" = :clinicId', { clinicId })
      .andWhere('a.action = :action', { action: 'PRICE_CHANGED' });

    if (filters.dateRange) {
      qb.andWhere('a."createdAt" BETWEEN :start AND :end', {
        start: filters.dateRange.startDate,
        end: filters.dateRange.endDate,
      });
    }

    const priceChanges = await qb.orderBy('a."createdAt"', 'DESC').limit(50).getMany();

    return {
      priceChanges: priceChanges.map(log => ({
        date: log.createdAt,
        user: log.userEmail,
        details: log.details,
      })),
    };
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  /** Los `SUM()` de Postgres llegan como string; sin esto la aritmética da NaN. */
  private num(value: unknown): number {
    const n = parseFloat(String(value ?? 0));
    return isNaN(n) ? 0 : n;
  }

  private round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private round<T extends Record<string, number>>(obj: T): T {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, this.round2(v)])) as T;
  }
}
