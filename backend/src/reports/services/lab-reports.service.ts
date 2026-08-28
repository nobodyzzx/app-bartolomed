import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { round2 } from '../../billing/utils/discount-proration.util';
import { ReportFilters } from './reports.service';

/**
 * `lab_orders."createdAt"` es `timestamp without time zone` guardado en hora
 * UTC del reloj del servidor, no de Bolivia — mismo problema documentado en
 * `advanced-reports.service.ts` (SALE_DATE_BO). Se repite acá en vez de
 * importarlo de allá porque son servicios de dominios distintos (farmacia vs.
 * laboratorio) y esta constante no tiene nada de farmacia.
 */
const ORDER_DATE_BO = `(lo."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')`;

const ORDER_TYPE_LABELS: Record<string, string> = {
  lab: 'Laboratorio',
  special: 'Estudio Especial',
};

const STATUS_LABELS: Record<string, string> = {
  requested: 'Solicitada',
  sample_collected: 'Muestra Tomada',
  sent_to_provider: 'Enviada a Proveedor',
  in_progress: 'En Proceso',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

/**
 * Reportes de Laboratorio y Estudios Especiales.
 *
 * Antes no existía NINGUNO: los dos módulos comparten `lab_orders`
 * (`order_type: 'lab' | 'special'`) desde que existen, pero "Reportes" se
 * construyó primero y casi solo alrededor de Farmacia — Laboratorio y
 * Estudios Especiales nunca tuvieron ni un permiso propio (`ReportsLab`,
 * agregado junto con este servicio) ni una sola pantalla.
 */
@Injectable()
export class LabReportsService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private requireClinicId(filters: ReportFilters): string {
    if (!filters.clinicId) throw new BadRequestException('clinicId es requerido');
    return filters.clinicId;
  }

  /**
   * Volumen por tipo y estado, tiempo de respuesta (orden → resultado) y
   * exámenes/estudios más pedidos, con quién los solicitó.
   *
   * El tiempo de respuesta se mide de `lo."createdAt"` (cuándo se pidió) a
   * `loi."resultedAt"` (cuándo se cargó el resultado): es la pregunta que le
   * importa a quien indica el examen — "¿cuánto tardan en darme el
   * resultado?" —, no cuánto tarda el laboratorio una vez que ya tiene la
   * muestra en mano. `resultedAt` es `timestamptz` (instante real) y
   * `createdAt` guarda hora UTC ya consistente con la sesión (`SHOW timezone`
   * = UTC): la resta funciona sin conversión extra, verificado contra datos
   * reales (una orden resuelta en 14 minutos dio 0.24 horas, no un valor
   * corrido por zona horaria).
   */
  async getLabActivityReport(filters: ReportFilters) {
    const clinicId = this.requireClinicId(filters);
    const { dateRange } = filters;
    const startDate = dateRange?.startDate;
    const endDate = dateRange?.endDate;
    const dateFilter = `
      ${startDate ? `AND ${ORDER_DATE_BO} >= '${startDate}'` : ''}
      ${endDate ? `AND ${ORDER_DATE_BO} < ('${endDate}'::date + INTERVAL '1 day')` : ''}
    `;

    const [byTypeAndStatus, turnaround, topTests, byDoctor]: [
      Array<Record<string, unknown>>,
      Array<Record<string, unknown>>,
      Array<Record<string, unknown>>,
      Array<Record<string, unknown>>,
    ] = await Promise.all([
      // Volumen: cuántas órdenes de cada tipo, en cada estado.
      this.dataSource.query(
        `
        SELECT lo.order_type AS "orderType", lo.status, COUNT(DISTINCT lo.id)::int AS count
        FROM lab_orders lo
        WHERE lo.clinic_id = $1
          AND lo."deletedAt" IS NULL
          ${dateFilter}
        GROUP BY lo.order_type, lo.status
        ORDER BY lo.order_type, lo.status
      `,
        [clinicId],
      ),

      // Tiempo de respuesta promedio por tipo, solo sobre lo que ya tiene
      // resultado — una orden todavía en curso no tiene nada que promediar.
      this.dataSource.query(
        `
        SELECT
          lo.order_type AS "orderType",
          COUNT(*)::int AS "resultedCount",
          ROUND(AVG(EXTRACT(EPOCH FROM (loi."resultedAt" - lo."createdAt")) / 3600)::numeric, 1) AS "avgResponseHours"
        FROM lab_orders lo
        JOIN lab_order_items loi ON loi.order_id = lo.id
        WHERE lo.clinic_id = $1
          AND lo."deletedAt" IS NULL
          AND loi."resultedAt" IS NOT NULL
          ${dateFilter}
        GROUP BY lo.order_type
      `,
        [clinicId],
      ),

      // Exámenes/estudios más pedidos.
      this.dataSource.query(
        `
        SELECT loi."testName", lo.order_type AS "orderType", COUNT(*)::int AS count
        FROM lab_orders lo
        JOIN lab_order_items loi ON loi.order_id = lo.id
        WHERE lo.clinic_id = $1
          AND lo."deletedAt" IS NULL
          ${dateFilter}
        GROUP BY loi."testName", lo.order_type
        ORDER BY count DESC
        LIMIT 20
      `,
        [clinicId],
      ),

      // Por médico solicitante — "doctor_id" es quien indicó el examen, no
      // quien lo registró (created_by): eso es lo que responde "¿quién pide
      // más laboratorio/estudios?".
      this.dataSource.query(
        `
        SELECT
          u.id AS "doctorId",
          pi."firstName" || ' ' || COALESCE(pi."lastName", '') AS "doctorName",
          lo.order_type AS "orderType",
          COUNT(DISTINCT lo.id)::int AS "orderCount"
        FROM lab_orders lo
        JOIN users u ON u.id = lo.doctor_id
        JOIN personal_info pi ON pi.id = u."personalInfoId"
        WHERE lo.clinic_id = $1
          AND lo."deletedAt" IS NULL
          ${dateFilter}
        GROUP BY u.id, pi."firstName", pi."lastName", lo.order_type
        ORDER BY "orderCount" DESC
      `,
        [clinicId],
      ),
    ]);

    const totalOrders = byTypeAndStatus.reduce((s, r) => s + Number(r['count'] ?? 0), 0);
    const cancelledOrders = byTypeAndStatus
      .filter(r => r['status'] === 'cancelled')
      .reduce((s, r) => s + Number(r['count'] ?? 0), 0);
    const completedOrders = byTypeAndStatus
      .filter(r => r['status'] === 'completed')
      .reduce((s, r) => s + Number(r['count'] ?? 0), 0);

    return {
      byTypeAndStatus: byTypeAndStatus.map(r => ({
        ...r,
        orderTypeLabel: ORDER_TYPE_LABELS[r['orderType'] as string] ?? r['orderType'],
        statusLabel: STATUS_LABELS[r['status'] as string] ?? r['status'],
      })),
      turnaround: turnaround.map(r => ({
        ...r,
        orderTypeLabel: ORDER_TYPE_LABELS[r['orderType'] as string] ?? r['orderType'],
        avgResponseHours: Number(r['avgResponseHours'] ?? 0),
      })),
      topTests: topTests.map(r => ({
        ...r,
        orderTypeLabel: ORDER_TYPE_LABELS[r['orderType'] as string] ?? r['orderType'],
      })),
      byDoctor: byDoctor.map(r => ({
        ...r,
        orderTypeLabel: ORDER_TYPE_LABELS[r['orderType'] as string] ?? r['orderType'],
      })),
      summary: {
        totalOrders,
        completedOrders,
        cancelledOrders,
        cancellationRate: totalOrders > 0 ? round2((cancelledOrders / totalOrders) * 100) : 0,
      },
    };
  }
}
