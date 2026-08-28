import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PharmacySale } from '../../pharmacy/entities/pharmacy-sale.entity';
import { PharmacySaleItem } from '../../pharmacy/entities/pharmacy-sale.entity';
import { MedicationStock } from '../../pharmacy/entities/pharmacy.entity';
import { Prescription } from '../../prescriptions/entities/prescription.entity';
import { PrescriptionItem } from '../../prescriptions/entities/prescription.entity';
import { StockTransfer } from '../../transfers/entities/stock-transfer.entity';
import { addCalendarDays, todayInClinicTz } from '../../common/utils/date-format.util';
import { round2 } from '../../billing/utils/discount-proration.util';
import { ReportFilters } from './reports.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Etiqueta del tipo de producto, en español, para los informes.
 *
 * Los informes mostraban `med.category`, que es la clase farmacológica
 * (analgésico, antibiótico…) y que en el catálogo real está en `other` para los
 * 485 productos: la columna "Categoría" salía con `other` en todas las filas y
 * el informe "Inventario por categoría" agrupaba todo en un solo montón. Lo que
 * de verdad separa el catálogo es `product_type`, que sí está clasificado.
 *
 * Se traduce en SQL y no en la capa de PDF para que JSON, PDF y Excel digan lo
 * mismo sin repetir el mapeo en tres sitios.
 */
const TIPO_PRODUCTO_SQL = `CASE med.product_type
        WHEN 'medication'    THEN 'Medicamento'
        WHEN 'supply'        THEN 'Insumo'
        WHEN 'personal_care' THEN 'Cuidado personal'
        ELSE 'Sin clasificar'
      END`;

/**
 * `pharmacy_sales."saleDate"` es `timestamp without time zone`, pero el backend
 * corre en UTC y la escribe con `new Date()`: el valor guardado es la hora UTC
 * del reloj del servidor, no la hora de Bolivia. Agrupar o filtrar por
 * DATE(...)/TO_CHAR(...'YYYY-MM') directo sobre esa columna corta el día a las
 * 20:00 hora boliviana (medianoche UTC) en vez de medianoche real: una venta
 * de las 21:00 en La Paz queda contabilizada en el día — o el mes, cerca de
 * fin de mes — siguiente.
 *
 * Mismo root cause que el comentario de `date-format.util.ts` ("pasaba en todo
 * el sistema"), pero ese util solo corrige el formateo para el usuario; acá
 * es el agrupamiento SQL mismo, que ese util no toca. Se usa solo donde el
 * valor se trunca a un día/mes de calendario — comparaciones relativas a
 * NOW() (últimos 7/30 días, etc.) no lo necesitan: ambos lados ya son
 * consistentes en base UTC.
 *
 * Segundo bug, independiente del anterior (encontrado el 2026-08-27 al pedir
 * "hoy" con startDate=endDate y no traer ningún resultado): comparar un
 * timestamp contra `<= 'YYYY-MM-DD'` compara contra la MEDIANOCHE de ese día
 * (`'2026-08-27'` = `'2026-08-27 00:00:00'`), así que cualquier fila con hora
 * después de medianoche queda excluida — es decir, casi todas. Filtrar un
 * único día (startDate = endDate = hoy) no traía nada aunque hubiera ventas
 * esa misma mañana. Por eso el límite superior de todo filtro de fecha en
 * este archivo usa `< (fecha::date + INTERVAL '1 day')` en vez de `<= fecha`.
 */
const SALE_DATE_BO = `(ps."saleDate" AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')`;

/** Mismo ajuste que SALE_DATE_BO, para `charges.createdAt` (alias `c`). */
const CHARGE_DATE_BO = `(c."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')`;

/** Mismo ajuste que SALE_DATE_BO, para `stock_transfers.createdAt` (alias `t`). */
const TRANSFER_DATE_BO = `(t."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')`;

/**
 * Normaliza pharmacy_sales.paymentMethod (cash/card/transfer/insurance/
 * mixed/qr) y payments.method (cash/credit_card/debit_card/bank_transfer/
 * check/insurance/other/qr) a una misma etiqueta en español, para poder
 * combinar el desglose por método de pago de farmacia y clínica en un solo
 * reporte sin que "card" y "credit_card" salgan como filas separadas.
 */
const PHARMACY_PAYMENT_METHOD_SQL = `CASE ps."paymentMethod"
        WHEN 'cash'      THEN 'Efectivo'
        WHEN 'card'      THEN 'Tarjeta'
        WHEN 'transfer'  THEN 'Transferencia'
        WHEN 'insurance' THEN 'Seguro'
        WHEN 'qr'        THEN 'QR'
        WHEN 'mixed'     THEN 'Mixto'
        ELSE 'Otro'
      END`;

const CLINIC_PAYMENT_METHOD_SQL = `CASE p.method
        WHEN 'cash'          THEN 'Efectivo'
        WHEN 'credit_card'   THEN 'Tarjeta'
        WHEN 'debit_card'    THEN 'Tarjeta'
        WHEN 'bank_transfer' THEN 'Transferencia'
        WHEN 'insurance'     THEN 'Seguro'
        WHEN 'qr'            THEN 'QR'
        WHEN 'check'         THEN 'Cheque'
        ELSE 'Otro'
      END`;

@Injectable()
export class AdvancedReportsService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(MedicationStock)
    private readonly stockRepo: Repository<MedicationStock>,
    @InjectRepository(PharmacySale)
    private readonly saleRepo: Repository<PharmacySale>,
    @InjectRepository(PharmacySaleItem)
    private readonly saleItemRepo: Repository<PharmacySaleItem>,
    @InjectRepository(Prescription)
    private readonly prescriptionRepo: Repository<Prescription>,
    @InjectRepository(PrescriptionItem)
    private readonly prescriptionItemRepo: Repository<PrescriptionItem>,
    @InjectRepository(StockTransfer)
    private readonly transferRepo: Repository<StockTransfer>,
  ) {}

  // ─── R-09: Consumo de Farmacia ────────────────────────────────────────────
  // Salida de medicamentos por ventas vs. ingresos por traspasos recibidos.

  async getPharmacyConsumptionReport(filters: ReportFilters) {
    const { clinicId, dateRange } = filters;
    if (!clinicId) throw new BadRequestException('clinicId es requerido');

    // Salidas por ventas completadas
    const dispatchQb = this.saleItemRepo
      .createQueryBuilder('item')
      .select('med.id',              'medicationId')
      .addSelect('med.name',         'medicationName')
      .addSelect('med."genericName"', 'genericName')
      .addSelect('SUM(item.quantity)',                          'totalDispensed')
      .addSelect('SUM(item.quantity * item."unitPrice")',       'totalRevenue')
      .innerJoin('medication_stock', 'ms',  'ms.id = item.medication_stock_id')
      .innerJoin('medications',      'med', 'med.id = ms.medication_id')
      .innerJoin('pharmacy_sales',   'ps',  'ps.id = item.sale_id')
      .where('ps.clinic_id = :clinicId', { clinicId })
      .andWhere("ps.status = 'completed'")
      .groupBy('med.id, med.name, med."genericName"')
      .orderBy('SUM(item.quantity)', 'DESC');

    // Ver SALE_DATE_BO más arriba: ps."saleDate" guarda hora UTC del reloj del
    // servidor, no de Bolivia — hay que convertir antes de comparar contra un
    // límite de calendario.
    if (dateRange?.startDate) dispatchQb.andWhere(`${SALE_DATE_BO} >= :startDate`, { startDate: dateRange.startDate });
    // < día+1, no <=: 'YYYY-MM-DD' compara contra medianoche, así que <= excluía
    // todo lo que no fuera exactamente medianoche (ver comentario de SALE_DATE_BO).
    if (dateRange?.endDate)   dispatchQb.andWhere(`${SALE_DATE_BO} < (:endDate::date + INTERVAL '1 day')`, { endDate: dateRange.endDate });

    const dispensed = await dispatchQb.getRawMany();

    // Ingresos por traspasos completados hacia esta clínica
    const receivedQb = this.dataSource
      .createQueryBuilder()
      .select('med.id',              'medicationId')
      .addSelect('med.name',         'medicationName')
      .addSelect('SUM(sti."receivedQuantity")', 'totalReceived')
      .from('stock_transfer_items', 'sti')
      .innerJoin('stock_transfers',  'st',  'st.id = sti.transfer_id')
      .innerJoin('medication_stock', 'ms',  'ms.id = sti.source_stock_id')
      .innerJoin('medications',      'med', 'med.id = ms.medication_id')
      .where('st.target_clinic_id = :clinicId', { clinicId })
      .andWhere("st.status = 'completed'")
      .groupBy('med.id, med.name');

    // st."receivedAt" tiene el mismo problema que ps."saleDate": timestamp sin
    // zona guardado en hora del servidor (UTC), no de Bolivia — y el límite
    // superior necesita < día+1, no <=, por la misma razón documentada en
    // SALE_DATE_BO.
    const RECEIVED_AT_BO = `(st."receivedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')`;
    if (dateRange?.startDate) receivedQb.andWhere(`${RECEIVED_AT_BO} >= :startDate`, { startDate: dateRange.startDate });
    if (dateRange?.endDate)   receivedQb.andWhere(`${RECEIVED_AT_BO} < (:endDate::date + INTERVAL '1 day')`, { endDate: dateRange.endDate });

    const received = await receivedQb.getRawMany();

    // Total de stock actual por clínica
    const currentStockRaw = await this.stockRepo
      .createQueryBuilder('ms')
      .select('SUM(ms.availableQuantity * ms.unitCost)', 'totalStockValue')
      .addSelect('SUM(ms.availableQuantity)',             'totalUnits')
      .innerJoin('ms.clinic', 'clinic')
      .where('clinic.id = :clinicId', { clinicId })
      .andWhere('ms.isActive = true')
      .getRawOne();

    return {
      dispensed,   // top medicamentos salientes
      received,    // ingresos por traspaso
      stockSummary: {
        totalStockValue: Number(currentStockRaw?.totalStockValue ?? 0),
        totalUnits: Number(currentStockRaw?.totalUnits ?? 0),
      },
    };
  }

  // ─── R-10: Timeline del Paciente ──────────────────────────────────────────
  // Historial unificado de citas, registros médicos, recetas y ventas.

  async getPatientTimeline(patientId: string, clinicId: string) {
    if (!patientId) throw new BadRequestException('patientId es requerido');
    if (!clinicId) throw new BadRequestException('clinicId es requerido');

    // Usamos SQL nativo con UNION ALL porque TypeORM QB no soporta UNION.
    // Bug real (tres capas, todas causaban 500 — nunca antes se había
    // ejecutado este endpoint, sin consumidor en el frontend):
    // (1) las 4 ramas usaban nombres de columna en snake_case
    // (appointment_date, is_active, created_at, deleted_at, prescription_date,
    // prescription_number, sale_date, sale_number) que no existen — las
    // columnas reales están en camelCase (verificado con \d contra la DB
    // real). medical_records tampoco tiene "title" ni "content"; se usan
    // chiefComplaint y notes, que sí existen.
    // (2) event_date mezclaba tipos incompatibles entre ramas —
    // appointmentDate es timestamptz, createdAt/saleDate son timestamp sin
    // zona y prescriptionDate es date; Postgres no resuelve un tipo común
    // automáticamente para ese UNION (42804). Se castea cada uno a
    // timestamptz explícitamente.
    // (3) COALESCE(mr."chiefComplaint", mr.status) fallaba porque status es
    // un enum de Postgres (medical_records_status_enum), no text — Postgres
    // no puede unificar tipos dentro de un COALESCE tampoco. Cast a ::text.
    //
    // Bug real (auditoría de interrelación de módulos, 2026-08-04): ninguna
    // de las 4 ramas filtraba por clinic_id (solo se seleccionaba para
    // mostrarlo) — cualquier usuario con acceso a ESTE endpoint en CUALQUIER
    // clínica podía leer el timeline clínico completo (citas, diagnósticos,
    // ventas) de un paciente de OTRA clínica con solo su UUID. Había una
    // variable `belongsToClinic` calculada pero nunca aplicada (el `if` que
    // debía filtrar tenía el cuerpo vacío). Ahora clinic_id se filtra en las
    // 5 ramas (se agrega también lab_orders, que no existía cuando se separó
    // este endpoint del resto y quedó sin la rama correspondiente).
    const rows = await this.dataSource.query<Array<Record<string, unknown>>>(`
      SELECT
        'appointment'    AS event_type,
        a.id             AS event_id,
        a."appointmentDate"::timestamptz AS event_date,
        a.clinic_id,
        c.name           AS clinic_name,
        CONCAT('Cita: ', a.type, ' — ', a.status) AS summary,
        a.notes          AS detail
      FROM appointments a
      LEFT JOIN clinics c ON c.id = a.clinic_id
      WHERE a.patient_id = $1
        AND a.clinic_id = $2
        AND a."isActive" = true

      UNION ALL

      SELECT
        'medical_record' AS event_type,
        mr.id            AS event_id,
        mr."createdAt"::timestamptz AS event_date,
        mr.clinic_id,
        c.name           AS clinic_name,
        CONCAT('Registro: ', mr.type, ' — ', COALESCE(mr."chiefComplaint", mr.status::text)) AS summary,
        mr.notes         AS detail
      FROM medical_records mr
      LEFT JOIN clinics c ON c.id = mr.clinic_id
      WHERE mr.patient_id = $1
        AND mr.clinic_id = $2
        AND mr."deletedAt" IS NULL

      UNION ALL

      SELECT
        'prescription'   AS event_type,
        p.id             AS event_id,
        p."prescriptionDate"::timestamptz AS event_date,
        p.clinic_id,
        c.name           AS clinic_name,
        CONCAT('Receta: ', p."prescriptionNumber", ' — ', p.status) AS summary,
        p.diagnosis      AS detail
      FROM prescriptions p
      LEFT JOIN clinics c ON c.id = p.clinic_id
      WHERE p.patient_id = $1
        AND p.clinic_id = $2
        AND p."deletedAt" IS NULL

      UNION ALL

      SELECT
        'pharmacy_sale'  AS event_type,
        ps.id            AS event_id,
        ps."saleDate"::timestamptz AS event_date,
        ps.clinic_id,
        c.name           AS clinic_name,
        CONCAT('Venta farmacia: ', ps."saleNumber") AS summary,
        ps.notes         AS detail
      FROM pharmacy_sales ps
      LEFT JOIN clinics c ON c.id = ps.clinic_id
      WHERE ps.patient_id = $1
        AND ps.clinic_id = $2

      UNION ALL

      SELECT
        'lab_order'      AS event_type,
        lo.id            AS event_id,
        lo."orderDate"::timestamptz AS event_date,
        lo.clinic_id,
        c.name           AS clinic_name,
        CONCAT('Orden de laboratorio: ', lo."orderNumber", ' — ', lo.status::text) AS summary,
        -- El timeline solo decía el número y el estado, así que el médico tenía
        -- que abrir la orden para enterarse de qué salió. Se listan los estudios
        -- con su valor, y se marca el que está fuera de rango, que es lo que
        -- hace falta leer de un vistazo.
        NULLIF(
          CONCAT_WS(
            ' — ',
            NULLIF(lo."clinicalNotes", ''),
            (
              SELECT string_agg(
                CONCAT(
                  loi."testName",
                  CASE
                    WHEN loi."resultedAt" IS NULL THEN ': pendiente'
                    ELSE CONCAT(': ', COALESCE(loi."resultValue", '—'), COALESCE(' ' || loi."resultUnit", ''))
                  END,
                  CASE WHEN loi."isAbnormal" THEN ' (fuera de rango)' ELSE '' END
                ),
                ' · '
                ORDER BY loi."createdAt"
              )
              FROM lab_order_items loi
              WHERE loi.order_id = lo.id
            )
          ),
          ''
        ) AS detail
      FROM lab_orders lo
      LEFT JOIN clinics c ON c.id = lo.clinic_id
      WHERE lo.patient_id = $1
        AND lo.clinic_id = $2
        AND lo."deletedAt" IS NULL

      ORDER BY event_date DESC
      LIMIT 200
    `, [patientId, clinicId]);

    return {
      patientId,
      totalEvents: rows.length,
      clinicsInvolved: [...new Set(rows.map(r => r['clinic_name']).filter(Boolean))],
      timeline: rows,
    };
  }

  // ─── R-11: Eficiencia de Traspasos (KPI) ──────────────────────────────────

  async getTransferEfficiencyReport(filters: ReportFilters) {
    const { clinicId, dateRange } = filters;
    if (!clinicId) throw new BadRequestException('clinicId es requerido');

    const dateFilter = `
      ${dateRange?.startDate ? `AND ${TRANSFER_DATE_BO} >= '${dateRange.startDate}'` : ''}
      ${dateRange?.endDate   ? `AND ${TRANSFER_DATE_BO} < ('${dateRange.endDate}'::date + INTERVAL '1 day')` : ''}
    `;

    // KPI por par origen-destino
    const kpiByRoute: Array<Record<string, unknown>> = await this.dataSource.query(`
      SELECT
        t.source_clinic_id,
        sc.name                                                          AS source_clinic_name,
        t.target_clinic_id,
        tc.name                                                          AS target_clinic_name,
        COUNT(*)                                                         AS total_completed,
        ROUND(AVG(EXTRACT(EPOCH FROM (t."dispatchedAt" - t."createdAt"))/3600)::numeric, 2)
                                                                         AS avg_hrs_to_dispatch,
        ROUND(AVG(EXTRACT(EPOCH FROM (t."receivedAt"   - t."dispatchedAt"))/3600)::numeric, 2)
                                                                         AS avg_hrs_in_transit,
        ROUND(AVG(EXTRACT(EPOCH FROM (t."receivedAt"   - t."createdAt"))/3600)::numeric, 2)
                                                                         AS avg_total_hrs,
        PERCENTILE_CONT(0.95) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (t."receivedAt" - t."dispatchedAt"))/3600
        )                                                                AS p95_hrs_in_transit,
        COALESCE(SUM(sti."dispatchedQuantity" - sti."receivedQuantity"), 0) AS total_discrepancy_units,
        COUNT(CASE WHEN t."receivedAt" - t."dispatchedAt" > INTERVAL '48 hours' THEN 1 END)
                                                                         AS delayed_count
      FROM stock_transfers t
      JOIN clinics sc  ON sc.id  = t.source_clinic_id
      JOIN clinics tc  ON tc.id  = t.target_clinic_id
      LEFT JOIN stock_transfer_items sti ON sti.transfer_id = t.id
      WHERE t.status = 'completed'
        AND (t.source_clinic_id = $1 OR t.target_clinic_id = $1)
        ${dateFilter}
      GROUP BY t.source_clinic_id, sc.name, t.target_clinic_id, tc.name
      ORDER BY avg_total_hrs DESC
    `, [clinicId]);

    // Traspasos "eternos": en tránsito hace más de 48h
    const stalled: Array<Record<string, unknown>> = await this.dataSource.query(`
      SELECT
        t.id,
        t."transferNumber",
        t.source_clinic_id,
        sc.name                                                          AS source_clinic_name,
        t.target_clinic_id,
        tc.name                                                          AS target_clinic_name,
        t."dispatchedAt",
        ROUND((EXTRACT(EPOCH FROM (NOW() - t."dispatchedAt"))/3600)::numeric, 1)
                                                                         AS hrs_waiting
      FROM stock_transfers t
      JOIN clinics sc ON sc.id = t.source_clinic_id
      JOIN clinics tc ON tc.id = t.target_clinic_id
      WHERE t.status = 'in_transit'
        AND t."dispatchedAt" < NOW() - INTERVAL '48 hours'
        AND (t.source_clinic_id = $1 OR t.target_clinic_id = $1)
      ORDER BY t."dispatchedAt" ASC
    `, [clinicId]);

    return {
      kpiByRoute,
      stalledTransfers: stalled,
      stalledCount: stalled.length,
    };
  }

  // ─── R-12: Stock Crítico / Próximos a Vencer ──────────────────────────────

  async getCriticalStockReport(filters: ReportFilters, expiryDays = 60) {
    const { clinicId } = filters;
    if (!clinicId) throw new BadRequestException('clinicId es requerido');

    const expiryThreshold = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
    const criticalThresholdMultiplier = 1.5; // alerta cuando stock <= 1.5x minimumStock

    const qb = this.stockRepo
      .createQueryBuilder('ms')
      .leftJoinAndSelect('ms.medication', 'med')
      .innerJoin('ms.clinic', 'clinic')
      .where('clinic.id = :clinicId', { clinicId })
      .andWhere('ms.isActive = true');

    const [belowMinimum, expiringSoon, expired] = await Promise.all([
      // Stock bajo el mínimo
      qb.clone()
        .andWhere('ms.availableQuantity <= ms.minimumStock * CAST(:multiplier AS numeric)',
          { multiplier: criticalThresholdMultiplier })
        .orderBy('ms.availableQuantity', 'ASC')
        .getMany(),

      // Próximos a vencer (dentro de expiryDays días)
      qb.clone()
        .andWhere('ms.expiryDate <= :expiryThreshold', { expiryThreshold })
        .andWhere('ms.expiryDate > NOW()')
        .andWhere('ms.availableQuantity > 0')
        .orderBy('ms.expiryDate', 'ASC')
        .getMany(),

      // Ya vencidos con stock positivo (no se han dado de baja)
      qb.clone()
        .andWhere('ms.expiryDate < NOW()')
        .andWhere('ms.availableQuantity > 0')
        .orderBy('ms.expiryDate', 'ASC')
        .getMany(),
    ]);

    const totalAtRiskValue = [...belowMinimum, ...expiringSoon, ...expired]
      .reduce((sum, s) => sum + (s.availableQuantity * Number(s.unitCost)), 0);

    return {
      belowMinimum,
      expiringSoon,
      expired,
      summary: {
        belowMinimumCount: belowMinimum.length,
        expiringSoonCount: expiringSoon.length,
        expiredCount:      expired.length,
        totalAtRiskValue:  Math.round(totalAtRiskValue * 100) / 100,
      },
    };
  }

  // ─── F1-R1: Rotación y días de stock ─────────────────────────────────────

  async getRotationReport(filters: ReportFilters) {
    const { clinicId, dateRange } = filters;
    if (!clinicId) throw new BadRequestException('clinicId es requerido');

    // `todayInClinicTz` en vez de `new Date().toISOString().slice(0, 10)`: el
    // backend corre en UTC, así que ese slice da la fecha de calendario UTC,
    // no la de Bolivia (mismo problema documentado en date-format.util.ts).
    const startDate = dateRange?.startDate ?? addCalendarDays(todayInClinicTz(), -30);
    const endDate   = dateRange?.endDate   ?? todayInClinicTz();

    const rows: Array<Record<string, unknown>> = await this.dataSource.query(`
      SELECT
        med.name                            AS "medicationName",
        med."genericName"                   AS "genericName",
        ${TIPO_PRODUCTO_SQL}                        AS category,
        ms."availableQuantity"              AS "availableQty",
        ms."unitCost"                       AS "unitCost",
        COALESCE(sold.total_sold, 0)        AS "totalSold30d",
        ROUND(COALESCE(sold.total_sold, 0) / 30.0, 4) AS "avgDailySales",
        CASE
          WHEN COALESCE(sold.total_sold, 0) = 0 THEN 9999
          ELSE ROUND(ms."availableQuantity" / (COALESCE(sold.total_sold, 0) / 30.0), 1)
        END                                 AS "daysRemaining"
      FROM medication_stock ms
      JOIN medications med ON med.id = ms.medication_id
      LEFT JOIN (
        SELECT psi."medicationStockId", SUM(psi.quantity) AS total_sold
        FROM pharmacy_sale_items psi
        JOIN pharmacy_sales ps ON ps.id = psi.sale_id
        WHERE ps.clinic_id = $1
          AND ps.status = 'completed'
          AND ${SALE_DATE_BO} >= $2
          AND ${SALE_DATE_BO} < ($3::date + INTERVAL '1 day')
        GROUP BY psi."medicationStockId"
      ) sold ON sold."medicationStockId" = ms.id
      WHERE ms.clinic_id = $1
        AND ms."isActive" = true
        AND ms."availableQuantity" > 0
      ORDER BY "daysRemaining" ASC
    `, [clinicId, startDate, endDate]);

    return rows.map(r => ({
      ...r,
      alertLevel: Number(r['daysRemaining']) < 7 ? 'critical'
        : Number(r['daysRemaining']) < 30 ? 'warning'
        : 'ok',
    }));
  }

  // ─── F1-R4: Resumen ventas por día ───────────────────────────────────────

  /**
   * "Ventas Diarias" solo miraba `pharmacy_sales`: el resto del ingreso de la
   * clínica (consultas, laboratorio, otros — todo lo que pasa por el punto de
   * cobro) vive en `charges`/`invoices` y no aparecía nunca, aunque fuera la
   * mayor parte de lo facturado. Se agrega ese lado como `clinicRevenue`.
   *
   * `origin != 'pharmacy'` es necesario para no contar dos veces: una venta
   * de farmacia "a cuenta" (chargeToAccount) YA se cuenta en pharmacy_sales y
   * además genera un charge con origin='pharmacy' que termina invoiced — sin
   * este filtro esa venta aparecería en ambos lados. `status = 'invoiced'`
   * es el equivalente de status='completed' en pharmacy_sales: un cargo
   * `pending` es todavía una cuenta abierta, no una venta realizada.
   */
  async getDailySalesSummary(filters: ReportFilters) {
    const { clinicId, dateRange } = filters;
    if (!clinicId) throw new BadRequestException('clinicId es requerido');

    const startDate = dateRange?.startDate;
    const endDate   = dateRange?.endDate;

    const dateFilter = `
      ${startDate ? `AND ${SALE_DATE_BO} >= '${startDate}'` : ''}
      ${endDate   ? `AND ${SALE_DATE_BO} < ('${endDate}'::date + INTERVAL '1 day')` : ''}
    `;
    const chargeDateFilter = `
      ${startDate ? `AND ${CHARGE_DATE_BO} >= '${startDate}'` : ''}
      ${endDate   ? `AND ${CHARGE_DATE_BO} <= '${endDate}'`   : ''}
    `;
    // payments."paymentDate" ya es `timestamp with time zone` (un instante
    // real) — a diferencia de saleDate/createdAt no hace falta el doble
    // AT TIME ZONE 'UTC', basta reexpresarlo en hora de Bolivia.
    const paymentDateFilter = `
      ${startDate ? `AND (p."paymentDate" AT TIME ZONE 'America/La_Paz') >= '${startDate}'` : ''}
      ${endDate   ? `AND (p."paymentDate" AT TIME ZONE 'America/La_Paz') < ('${endDate}'::date + INTERVAL '1 day')` : ''}
    `;

    const [pharmacyDaily, clinicDaily, paymentBreakdown]: [
      Array<Record<string, unknown>>,
      Array<Record<string, unknown>>,
      Array<Record<string, unknown>>,
    ] = await Promise.all([
      this.dataSource.query(`
        SELECT
          DATE(${SALE_DATE_BO}) AS date,
          SUM(ps.total)         AS revenue,
          COUNT(*)              AS tickets
        FROM pharmacy_sales ps
        WHERE ps.clinic_id = $1
          AND ps.status = 'completed'
          ${dateFilter}
        GROUP BY DATE(${SALE_DATE_BO})
      `, [clinicId]),

      this.dataSource.query(`
        SELECT
          DATE(${CHARGE_DATE_BO})                                    AS date,
          SUM(c.total)                                               AS revenue,
          COUNT(DISTINCT COALESCE(c.invoice_id::text, c.id::text))   AS tickets
        FROM charges c
        WHERE c.clinic_id = $1
          AND c.origin != 'pharmacy'
          AND c.status = 'invoiced'
          ${chargeDateFilter}
        GROUP BY DATE(${CHARGE_DATE_BO})
      `, [clinicId]),

      // Farmacia (pharmacy_sales.paymentMethod: cash/card/transfer/insurance/
      // mixed/qr) y clínica (payments.method: cash/credit_card/debit_card/
      // bank_transfer/check/insurance/other/qr) usan catálogos de método
      // distintos — PAYMENT_METHOD_LABEL_SQL normaliza ambos a la misma
      // etiqueta en español para poder sumarlos en una sola fila por método.
      //
      // El `EXISTS` excluye pagos de facturas 100% de farmacia (misma razón
      // que origin != 'pharmacy' arriba: una venta "a cuenta" ya se cuenta
      // del lado de pharmacy_sales). Una factura mixta (farmacia + clínica en
      // el mismo cobro) es hoy imposible de generar desde la UI, pero si
      // llegara a existir, este EXISTS la deja pasar completa — sobreconteo
      // menor y acotado, preferible a excluirla entera y subcontar la parte
      // real de clínica.
      this.dataSource.query(`
        SELECT method, SUM(total) AS total, COUNT(*) AS count
        FROM (
          SELECT ${PHARMACY_PAYMENT_METHOD_SQL} AS method, ps.total AS total
          FROM pharmacy_sales ps
          WHERE ps.clinic_id = $1
            AND ps.status = 'completed'
            ${dateFilter}

          UNION ALL

          SELECT ${CLINIC_PAYMENT_METHOD_SQL} AS method, p.amount AS total
          FROM payments p
          JOIN invoices i ON i.id = p.invoice_id
          WHERE i.clinic_id = $1
            AND p.status = 'completed'
            AND EXISTS (SELECT 1 FROM charges c WHERE c.invoice_id = i.id AND c.origin != 'pharmacy')
            ${paymentDateFilter}
        ) combined
        GROUP BY method
        ORDER BY SUM(total) DESC
      `, [clinicId]),
    ]);

    return { dailySales: this.mergeDailySales(pharmacyDaily, clinicDaily), paymentBreakdown };
  }

  /** Combina farmacia + clínica por fecha, dejando ambos lados visibles además del total. */
  private mergeDailySales(
    pharmacy: Array<Record<string, unknown>>,
    clinic: Array<Record<string, unknown>>,
  ): Array<{
    date: string;
    pharmacyRevenue: number;
    clinicRevenue: number;
    totalRevenue: number;
    ticketCount: number;
    avgTicket: number;
  }> {
    const byDate = new Map<string, { pharmacyRevenue: number; clinicRevenue: number; pharmacyTickets: number; clinicTickets: number }>();

    const dateKey = (value: unknown): string =>
      value instanceof Date ? value.toISOString().slice(0, 10) : String(value);

    for (const row of pharmacy) {
      const key = dateKey(row['date']);
      const entry = byDate.get(key) ?? { pharmacyRevenue: 0, clinicRevenue: 0, pharmacyTickets: 0, clinicTickets: 0 };
      entry.pharmacyRevenue = Number(row['revenue'] ?? 0);
      entry.pharmacyTickets = Number(row['tickets'] ?? 0);
      byDate.set(key, entry);
    }
    for (const row of clinic) {
      const key = dateKey(row['date']);
      const entry = byDate.get(key) ?? { pharmacyRevenue: 0, clinicRevenue: 0, pharmacyTickets: 0, clinicTickets: 0 };
      entry.clinicRevenue = Number(row['revenue'] ?? 0);
      entry.clinicTickets = Number(row['tickets'] ?? 0);
      byDate.set(key, entry);
    }

    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, e]) => {
        const totalRevenue = round2(e.pharmacyRevenue + e.clinicRevenue);
        const ticketCount = e.pharmacyTickets + e.clinicTickets;
        return {
          date,
          pharmacyRevenue: round2(e.pharmacyRevenue),
          clinicRevenue: round2(e.clinicRevenue),
          totalRevenue,
          ticketCount,
          avgTicket: ticketCount > 0 ? round2(totalRevenue / ticketCount) : 0,
        };
      });
  }

  // ─── F1-R5: Vencimientos por bucket ──────────────────────────────────────

  async getExpiryBucketReport(filters: ReportFilters) {
    const { clinicId } = filters;
    if (!clinicId) throw new BadRequestException('clinicId es requerido');

    const rows: Array<Record<string, unknown>> = await this.dataSource.query(`
      SELECT
        ms.id,
        med.name                   AS "medicationName",
        med."genericName"          AS "genericName",
        ${TIPO_PRODUCTO_SQL}               AS category,
        ms."batchNumber"           AS "batchNumber",
        ms."expiryDate"            AS "expiryDate",
        ms."availableQuantity"     AS "availableQuantity",
        ms."unitCost"              AS "unitCost",
        ms."availableQuantity" * ms."unitCost" AS "stockValue",
        CASE
          WHEN ms."expiryDate" < NOW()                                THEN 'already_expired'
          WHEN ms."expiryDate" < NOW() + INTERVAL '30 days'          THEN 'expires_lt30'
          WHEN ms."expiryDate" < NOW() + INTERVAL '60 days'          THEN 'expires_30_60'
          WHEN ms."expiryDate" < NOW() + INTERVAL '90 days'          THEN 'expires_60_90'
          ELSE                                                             'ok'
        END                        AS bucket
      FROM medication_stock ms
      JOIN medications med ON med.id = ms.medication_id
      WHERE ms.clinic_id = $1
        AND ms."isActive" = true
        AND ms."availableQuantity" > 0
        AND ms."expiryDate" IS NOT NULL
      ORDER BY ms."expiryDate" ASC
    `, [clinicId]);

    const buckets: Record<string, typeof rows> = {
      already_expired: [],
      expires_lt30:    [],
      expires_30_60:   [],
      expires_60_90:   [],
    };
    for (const r of rows) {
      const b = r['bucket'] as string;
      if (buckets[b]) buckets[b].push(r);
    }

    const valueOf = (items: typeof rows) =>
      items.reduce((s, r) => s + Number(r['stockValue'] ?? 0), 0);

    return {
      already_expired: buckets.already_expired,
      expires_lt30:    buckets.expires_lt30,
      expires_30_60:   buckets.expires_30_60,
      expires_60_90:   buckets.expires_60_90,
      summary: {
        alreadyExpiredCount: buckets.already_expired.length,
        lt30Count:           buckets.expires_lt30.length,
        bt30_60Count:        buckets.expires_30_60.length,
        bt60_90Count:        buckets.expires_60_90.length,
        alreadyExpiredValue: Math.round(valueOf(buckets.already_expired) * 100) / 100,
        lt30Value:           Math.round(valueOf(buckets.expires_lt30) * 100) / 100,
        bt30_60Value:        Math.round(valueOf(buckets.expires_30_60) * 100) / 100,
        bt60_90Value:        Math.round(valueOf(buckets.expires_60_90) * 100) / 100,
      },
    };
  }

  // ─── F2-R6: Compras vs consumo mensual ───────────────────────────────────

  async getPurchaseVsConsumption(filters: ReportFilters) {
    const { clinicId, dateRange } = filters;
    if (!clinicId) throw new BadRequestException('clinicId es requerido');

    const startDate = dateRange?.startDate;
    const endDate   = dateRange?.endDate;

    const dateFilterPO = `
      ${startDate ? `AND po."orderDate" >= '${startDate}'` : ''}
      ${endDate   ? `AND po."orderDate" <= '${endDate}'`   : ''}
    `;
    const dateFilterPS = `
      ${startDate ? `AND ${SALE_DATE_BO} >= '${startDate}'` : ''}
      ${endDate   ? `AND ${SALE_DATE_BO} < ('${endDate}'::date + INTERVAL '1 day')` : ''}
    `;

    const [purchased, sold]: [Array<Record<string, unknown>>, Array<Record<string, unknown>>] = await Promise.all([
      this.dataSource.query(`
        SELECT
          TO_CHAR(po."orderDate", 'YYYY-MM')  AS month,
          med.name                             AS "medicationName",
          SUM(poi."receivedQuantity")          AS "qtyPurchased"
        FROM purchase_orders po
        JOIN purchase_order_items poi ON poi.order_id = po.id
        -- poi."medicationId" es text (guarda el uuid como cadena); sin el cast
        -- Postgres corta con "operator does not exist: uuid = text".
        JOIN medications med          ON med.id::text = poi."medicationId"
        WHERE po."clinicId" = $1
          AND po.status = 'received'
          ${dateFilterPO}
        GROUP BY TO_CHAR(po."orderDate", 'YYYY-MM'), med.id, med.name
        ORDER BY month, med.name
      `, [clinicId]),

      this.dataSource.query(`
        SELECT
          TO_CHAR(${SALE_DATE_BO}, 'YYYY-MM')  AS month,
          med.name                            AS "medicationName",
          SUM(psi.quantity)                   AS "qtySold"
        FROM pharmacy_sale_items psi
        JOIN pharmacy_sales ps   ON ps.id  = psi.sale_id
        JOIN medication_stock ms ON ms.id  = psi.medication_stock_id
        JOIN medications med     ON med.id = ms.medication_id
        WHERE ps.clinic_id = $1
          AND ps.status = 'completed'
          ${dateFilterPS}
        GROUP BY TO_CHAR(${SALE_DATE_BO}, 'YYYY-MM'), med.id, med.name
        ORDER BY month, med.name
      `, [clinicId]),
    ]);

    // Merge by month + medicationName
    const key = (month: string, name: string) => `${month}||${name}`;
    const map = new Map<string, { month: string; medicationName: string; qtyPurchased: number; qtySold: number }>();

    for (const r of purchased) {
      const k = key(r['month'] as string, r['medicationName'] as string);
      map.set(k, { month: r['month'] as string, medicationName: r['medicationName'] as string, qtyPurchased: Number(r['qtyPurchased'] ?? 0), qtySold: 0 });
    }
    for (const r of sold) {
      const k = key(r['month'] as string, r['medicationName'] as string);
      const existing = map.get(k);
      if (existing) {
        existing.qtySold = Number(r['qtySold'] ?? 0);
      } else {
        map.set(k, { month: r['month'] as string, medicationName: r['medicationName'] as string, qtyPurchased: 0, qtySold: Number(r['qtySold'] ?? 0) });
      }
    }

    return [...map.values()].map(v => ({ ...v, balance: v.qtyPurchased - v.qtySold }))
      .sort((a, b) => a.month.localeCompare(b.month) || a.medicationName.localeCompare(b.medicationName));
  }

  // ─── F2-R7: Ventas por categoría ─────────────────────────────────────────

  async getSalesByCategory(filters: ReportFilters) {
    const { clinicId, dateRange } = filters;
    if (!clinicId) throw new BadRequestException('clinicId es requerido');

    const startDate = dateRange?.startDate;
    const endDate   = dateRange?.endDate;

    const dateFilter = `
      ${startDate ? `AND ${SALE_DATE_BO} >= '${startDate}'` : ''}
      ${endDate   ? `AND ${SALE_DATE_BO} < ('${endDate}'::date + INTERVAL '1 day')` : ''}
    `;

    return this.dataSource.query(`
      SELECT
        ${TIPO_PRODUCTO_SQL}                                                          AS category,
        SUM(psi.quantity)                                                     AS "totalQty",
        SUM(psi.subtotal)                                                     AS "totalRevenue",
        COUNT(DISTINCT med.id)                                                AS "itemCount",
        CASE
          WHEN SUM(psi."unitPrice" * psi.quantity) = 0 THEN 0
          ELSE ROUND(SUM((psi."unitPrice" - ms."unitCost") * psi.quantity)
               / SUM(psi."unitPrice" * psi.quantity) * 100, 2)
        END                                                                   AS "marginPct"
      FROM pharmacy_sale_items psi
      JOIN pharmacy_sales ps   ON ps.id  = psi.sale_id
      JOIN medication_stock ms ON ms.id  = psi.medication_stock_id
      JOIN medications med     ON med.id = ms.medication_id
      WHERE ps.clinic_id = $1
        AND ps.status = 'completed'
        ${dateFilter}
      GROUP BY med.product_type
      ORDER BY SUM(psi.subtotal) DESC
    `, [clinicId]);
  }

  // ─── F2-R8: Movimientos de stock (kardex simplificado) ───────────────────

  async getStockMovementsReport(filters: ReportFilters & { medicationId?: string }) {
    const { clinicId, dateRange, medicationId } = filters;
    if (!clinicId) throw new BadRequestException('clinicId es requerido');
    // Un `medicationId` que no sea uuid es una petición mal formada: se rechaza
    // con 400 en vez de dejar que el cast de Postgres devuelva un 500.
    if (medicationId && !UUID_RE.test(medicationId)) {
      throw new BadRequestException('medicationId debe ser un uuid válido');
    }

    const startDate = dateRange?.startDate;
    const endDate   = dateRange?.endDate;

    // `medicationId` llega crudo del cliente: parametrizado, no interpolado. Con
    // interpolación un `medicationId` malicioso inyectaba SQL (y de paso, un uuid
    // inválido tumbaba la consulta con un 500). Las fechas salen del propio
    // servidor, pero se parametrizan igual por coherencia.
    const params: unknown[] = [clinicId];
    const cond: string[] = [];
    // sm."movementDate" sí es `timestamptz` (un instante real) — a diferencia
    // de saleDate/createdAt no hace falta el doble AT TIME ZONE 'UTC': basta
    // interpretar el límite de calendario como medianoche de Bolivia. Y el
    // superior usa < día+1 en vez de <=, mismo motivo que en SALE_DATE_BO.
    if (startDate) { params.push(startDate); cond.push(`AND sm."movementDate" >= ($${params.length}::date AT TIME ZONE 'America/La_Paz')`); }
    if (endDate)   { params.push(endDate);   cond.push(`AND sm."movementDate" < (($${params.length}::date + INTERVAL '1 day') AT TIME ZONE 'America/La_Paz')`); }
    if (medicationId) { params.push(medicationId); cond.push(`AND ms.medication_id = $${params.length}`); }

    return this.dataSource.query(`
      SELECT
        sm."movementDate"              AS date,
        sm.type,
        med.name                       AS "medicationName",
        med."genericName"              AS "genericName",
        ms."batchNumber"               AS "batchNumber",
        sm.quantity,
        sm."unitPrice"                 AS "unitPrice",
        sm."totalAmount"               AS "totalAmount",
        sm.reason,
        sm.reference
      FROM stock_movements sm
      JOIN medication_stock ms ON ms.id  = sm.stock_id
      JOIN medications med     ON med.id = ms.medication_id
      WHERE ms.clinic_id = $1
        ${cond.join('\n        ')}
      ORDER BY sm."movementDate" DESC
    `, params);
  }

  // ─── F2-R9: Análisis de proveedores ──────────────────────────────────────

  async getSupplierAnalysis(filters: ReportFilters) {
    const { clinicId } = filters;
    if (!clinicId) throw new BadRequestException('clinicId es requerido');

    return this.dataSource.query(`
      SELECT
        COALESCE(med.supplier, med.manufacturer, 'Sin proveedor')   AS supplier,
        COUNT(DISTINCT med.id)                                       AS "skuCount",
        SUM(ms."availableQuantity" * ms."unitCost")                  AS "totalStockValue",
        ROUND(AVG(ms."unitCost"), 2)                                 AS "avgUnitCost",
        MAX(ms."receivedDate")                                       AS "lastReceived"
      FROM medication_stock ms
      JOIN medications med ON med.id = ms.medication_id
      WHERE ms.clinic_id = $1
        AND ms."isActive" = true
      GROUP BY COALESCE(med.supplier, med.manufacturer, 'Sin proveedor')
      ORDER BY SUM(ms."availableQuantity" * ms."unitCost") DESC
    `, [clinicId]);
  }

  // ─── F2-R10: Resumen despacho de recetas (KPI simplificado) ──────────────

  async getPrescriptionDispensingSummary(filters: ReportFilters) {
    const { clinicId } = filters;
    if (!clinicId) throw new BadRequestException('clinicId es requerido');

    // Columnas reales: `prescriptionDate` y `deletedAt` son camelCase entrecomillado.
    const [row]: Array<Record<string, unknown>> = await this.dataSource.query(`
      SELECT
        COUNT(*) FILTER (WHERE p.status NOT IN ('dispensed','cancelled')) AS "totalActive",
        COUNT(*) FILTER (WHERE p.status = 'dispensed')                   AS "totalDispensed",
        COUNT(*) FILTER (
          WHERE p.status NOT IN ('dispensed','cancelled')
            AND p."prescriptionDate" < NOW() - INTERVAL '30 days'
        )                                                                  AS "totalExpiredUndispensed"
      FROM prescriptions p
      WHERE p.clinic_id = $1
        AND p."deletedAt" IS NULL
    `, [clinicId]);

    const totalActive     = Number(row?.['totalActive'] ?? 0);
    const totalDispensed  = Number(row?.['totalDispensed'] ?? 0);
    const totalExpired    = Number(row?.['totalExpiredUndispensed'] ?? 0);
    const total           = totalActive + totalDispensed;

    return {
      totalActive,
      totalDispensed,
      totalExpiredUndispensed: totalExpired,
      dispensingRate: total > 0 ? Math.round((totalDispensed / total) * 100) : 0,
    };
  }

  // ─── F3-R11: Ventas al crédito pendientes ────────────────────────────────

  async getCreditSales(filters: ReportFilters) {
    const { clinicId } = filters;
    if (!clinicId) throw new BadRequestException('clinicId es requerido');

    const rows: Array<Record<string, unknown>> = await this.dataSource.query(`
      SELECT
        ps.id,
        ps."saleNumber"               AS "saleNumber",
        ps."patientName"              AS "patientName",
        ps."saleDate"                 AS "saleDate",
        ps.total,
        ps."amountPaid"               AS "amountPaid",
        ps.total - ps."amountPaid"    AS "pendingAmount",
        ps.status,
        CASE
          WHEN ps."saleDate" >= NOW() - INTERVAL '7 days'  THEN '0-7d'
          WHEN ps."saleDate" >= NOW() - INTERVAL '30 days' THEN '7-30d'
          ELSE '+30d'
        END                           AS bucket
      FROM pharmacy_sales ps
      WHERE ps.clinic_id = $1
        AND ps.status != 'completed'
        AND ps."amountPaid" < ps.total
      ORDER BY ps."saleDate" ASC
    `, [clinicId]);

    const buckets: Record<string, typeof rows> = { '0-7d': [], '7-30d': [], '+30d': [] };
    for (const r of rows) {
      const b = r['bucket'] as string;
      if (buckets[b]) buckets[b].push(r);
    }

    const totalOf = (items: typeof rows) =>
      items.reduce((s, r) => s + Number(r['pendingAmount'] ?? 0), 0);

    return [
      { bucket: '0-7d',  count: buckets['0-7d'].length,  totalPending: Math.round(totalOf(buckets['0-7d']) * 100) / 100,  sales: buckets['0-7d'] },
      { bucket: '7-30d', count: buckets['7-30d'].length, totalPending: Math.round(totalOf(buckets['7-30d']) * 100) / 100, sales: buckets['7-30d'] },
      { bucket: '+30d',  count: buckets['+30d'].length,  totalPending: Math.round(totalOf(buckets['+30d']) * 100) / 100,  sales: buckets['+30d'] },
    ];
  }

  // ─── F3-R13: Rentabilidad mensual farmacia ────────────────────────────────

  async getMonthlyProfitability(filters: ReportFilters) {
    const { clinicId, dateRange } = filters;
    if (!clinicId) throw new BadRequestException('clinicId es requerido');

    const startDate = dateRange?.startDate;
    const endDate   = dateRange?.endDate;

    const dateFilter = `
      ${startDate ? `AND ${SALE_DATE_BO} >= '${startDate}'` : ''}
      ${endDate   ? `AND ${SALE_DATE_BO} < ('${endDate}'::date + INTERVAL '1 day')` : ''}
    `;

    const rows: Array<Record<string, unknown>> = await this.dataSource.query(`
      SELECT
        TO_CHAR(${SALE_DATE_BO}, 'YYYY-MM')               AS month,
        SUM(ps.total)                                    AS revenue,
        SUM(psi.quantity * ms."unitCost")                AS cogs,
        SUM(ps.total) - SUM(psi.quantity * ms."unitCost") AS "grossMargin"
      FROM pharmacy_sales ps
      JOIN pharmacy_sale_items psi ON psi.sale_id = ps.id
      JOIN medication_stock ms     ON ms.id = psi.medication_stock_id
      WHERE ps.clinic_id = $1
        AND ps.status = 'completed'
        ${dateFilter}
      GROUP BY TO_CHAR(${SALE_DATE_BO}, 'YYYY-MM')
      ORDER BY month ASC
    `, [clinicId]);

    return rows.map(r => {
      const revenue     = Number(r['revenue'] ?? 0);
      const cogs        = Number(r['cogs'] ?? 0);
      const grossMargin = Number(r['grossMargin'] ?? 0);
      return {
        month: r['month'],
        revenue:          Math.round(revenue * 100) / 100,
        cogs:             Math.round(cogs * 100) / 100,
        grossMargin:      Math.round(grossMargin * 100) / 100,
        grossMarginPct:   revenue > 0 ? Math.round((grossMargin / revenue) * 100 * 10) / 10 : 0,
      };
    });
  }

  // ─── R-13: Auditoría Recetado vs Entregado ────────────────────────────────
  // Detecta recetas con discrepancias entre lo prescrito y lo despachado en farmacia.

  async getPrescriptionDispensationAudit(filters: ReportFilters) {
    const { clinicId, doctorId, dateRange } = filters;
    if (!clinicId) throw new BadRequestException('clinicId es requerido');

    // Recetas con sus ítems + ventas de farmacia asociadas vía prescription_id FK.
    // Los identificadores son `alias.propiedad` de la entidad (TypeORM los mapea a
    // su columna real), no nombres de columna sueltos: el paciente guarda su
    // nombre en columnas propias —no tiene relación `personalInfo` como el
    // usuario— y las columnas son camelCase entrecomillado en la base.
    const qb = this.prescriptionItemRepo
      .createQueryBuilder('pi')
      .select('p.id',                  'prescriptionId')
      .addSelect('p.prescriptionNumber', 'prescriptionNumber')
      .addSelect('p.status',           'prescriptionStatus')
      .addSelect('p.prescriptionDate', 'prescriptionDate')
      .addSelect("CONCAT(up.firstName, ' ', up.lastName)", 'doctorName')
      .addSelect("CONCAT(pat.firstName, ' ', pat.lastName)", 'patientName')
      .addSelect('pi.medicationName',  'medicationName')
      .addSelect('pi.quantity',        'prescribedQty')   // text field en esta entidad
      .addSelect('COALESCE(SUM(psi.quantity), 0)', 'dispensedQty')
      .innerJoin('pi.prescription',    'p')
      .innerJoin('p.clinic',           'clinic')
      .innerJoin('p.doctor',           'doctor')
      .innerJoin('doctor.personalInfo','up')
      .innerJoin('p.patient',          'pat')
      .leftJoin('pharmacy_sales', 'ps',
        'ps.prescription_id = p.id AND ps.status = :saleStatus', { saleStatus: 'completed' })
      .leftJoin('pharmacy_sale_items', 'psi', 'psi.sale_id = ps.id')
      .where('clinic.id = :clinicId', { clinicId })
      .groupBy('p.id')
      .addGroupBy('p.prescriptionNumber')
      .addGroupBy('p.status')
      .addGroupBy('p.prescriptionDate')
      .addGroupBy('up.firstName')
      .addGroupBy('up.lastName')
      .addGroupBy('pat.firstName')
      .addGroupBy('pat.lastName')
      .addGroupBy('pi.id')
      .addGroupBy('pi.medicationName')
      .addGroupBy('pi.quantity')
      .orderBy('p.prescriptionDate', 'DESC');

    if (doctorId) qb.andWhere('doctor.id = :doctorId', { doctorId });
    if (dateRange?.startDate) qb.andWhere('p.prescriptionDate >= :startDate', { startDate: dateRange.startDate });
    if (dateRange?.endDate)   qb.andWhere('p.prescriptionDate <= :endDate',   { endDate: dateRange.endDate });

    const rows = await qb.getRawMany();

    // Separar con discrepancias de las sin discrepancias
    // Nota: prescribedQty es texto libre ("2 comprimidos"), dispensedQty es numérico
    const withDiscrepancy = rows.filter(r => Number(r['dispensedQty']) === 0 && r['prescriptionStatus'] === 'dispensed');
    const fullyDispensed  = rows.filter(r => Number(r['dispensedQty']) > 0);
    const neverDispensed  = rows.filter(r => Number(r['dispensedQty']) === 0 && r['prescriptionStatus'] !== 'dispensed');

    return {
      summary: {
        total:              rows.length,
        fullyDispensed:     fullyDispensed.length,
        withDiscrepancy:    withDiscrepancy.length,
        neverDispensed:     neverDispensed.length,
      },
      withDiscrepancy,
      neverDispensed,
      fullyDispensed,
    };
  }

  // ─── A1: Ventas por farmacéutico ──────────────────────────────────────────

  async getSalesByPharmacist(filters: ReportFilters) {
    const { clinicId, dateRange } = filters;
    if (!clinicId) throw new BadRequestException('clinicId es requerido');

    const startDate = dateRange?.startDate;
    const endDate   = dateRange?.endDate;
    const dateFilter = `
      ${startDate ? `AND ${SALE_DATE_BO} >= '${startDate}'` : ''}
      ${endDate   ? `AND ${SALE_DATE_BO} < ('${endDate}'::date + INTERVAL '1 day')` : ''}
    `;

    const rows: Array<Record<string, unknown>> = await this.dataSource.query(`
      SELECT
        u.id                                                              AS "userId",
        pi."firstName" || ' ' || COALESCE(pi."lastName", '')             AS "pharmacistName",
        COUNT(DISTINCT ps.id)::int                                        AS "salesCount",
        ROUND(SUM(ps.total)::numeric, 2)                                  AS "totalRevenue",
        ROUND(AVG(ps.total)::numeric, 2)                                  AS "avgTicket",
        COUNT(DISTINCT DATE(${SALE_DATE_BO}))::int                          AS "workDays",
        SUM(psi.quantity)::int                                            AS "totalUnits",
        MIN(ps."saleDate")                                                AS "firstSale",
        MAX(ps."saleDate")                                                AS "lastSale"
      FROM pharmacy_sales ps
      JOIN users u          ON u.id  = ps."soldById"
      JOIN personal_info pi ON pi.id = u."personalInfoId"
      JOIN pharmacy_sale_items psi ON psi.sale_id = ps.id
      WHERE ps.clinic_id = $1
        AND ps.status = 'completed'
        ${dateFilter}
      GROUP BY u.id, pi."firstName", pi."lastName"
      ORDER BY "totalRevenue" DESC
    `, [clinicId]);

    const grandTotal = rows.reduce((s, r) => s + Number(r['totalRevenue'] ?? 0), 0);
    return rows.map(r => ({
      ...r,
      revenuePct: grandTotal > 0 ? Math.round((Number(r['totalRevenue'] ?? 0) / grandTotal) * 1000) / 10 : 0,
    }));
  }

  // ─── A2: Ventas encargado × día × medicamento ─────────────────────────────

  async getSalesByPharmacistMedicationDay(filters: ReportFilters) {
    const { clinicId, dateRange } = filters;
    if (!clinicId) throw new BadRequestException('clinicId es requerido');

    const startDate = dateRange?.startDate;
    const endDate   = dateRange?.endDate;
    const dateFilter = `
      ${startDate ? `AND ${SALE_DATE_BO} >= '${startDate}'` : ''}
      ${endDate   ? `AND ${SALE_DATE_BO} < ('${endDate}'::date + INTERVAL '1 day')` : ''}
    `;

    const rows: Array<Record<string, unknown>> = await this.dataSource.query(`
      SELECT
        pi."firstName" || ' ' || COALESCE(pi."lastName", '')  AS "pharmacistName",
        DATE(${SALE_DATE_BO})                                    AS "saleDay",
        med.name                                               AS "medicationName",
        med."genericName"                                      AS "genericName",
        ${TIPO_PRODUCTO_SQL}                                           AS category,
        SUM(psi.quantity)::int                                 AS "qtySold",
        ROUND(SUM(psi.subtotal)::numeric, 2)                   AS "totalRevenue",
        ROUND(AVG(psi."unitPrice")::numeric, 2)                AS "unitPrice"
      FROM pharmacy_sales ps
      JOIN users u               ON u.id  = ps."soldById"
      JOIN personal_info pi      ON pi.id = u."personalInfoId"
      JOIN pharmacy_sale_items psi ON psi.sale_id = ps.id
      JOIN medication_stock ms   ON ms.id = psi.medication_stock_id
      JOIN medications med       ON med.id = ms.medication_id
      WHERE ps.clinic_id = $1
        AND ps.status = 'completed'
        ${dateFilter}
      GROUP BY pi."firstName", pi."lastName", DATE(${SALE_DATE_BO}),
               med.id, med.name, med."genericName", med.product_type
      ORDER BY "saleDay" DESC, "pharmacistName", "totalRevenue" DESC
    `, [clinicId]);

    // Agrupar por farmacéutico para la vista de resumen
    const byPharmacist = new Map<string, { pharmacistName: string; days: Map<string, any[]> }>();
    for (const r of rows) {
      const name = r['pharmacistName'] as string;
      const day  = r['saleDay'] instanceof Date
        ? (r['saleDay'] as Date).toISOString().slice(0, 10)
        : String(r['saleDay'] ?? '-');
      if (!byPharmacist.has(name)) byPharmacist.set(name, { pharmacistName: name, days: new Map() });
      const ph = byPharmacist.get(name)!;
      if (!ph.days.has(day)) ph.days.set(day, []);
      ph.days.get(day)!.push({ ...r, saleDay: day });
    }

    return {
      rows: rows.map(r => ({
        ...r,
        saleDay: r['saleDay'] instanceof Date
          ? (r['saleDay'] as Date).toISOString().slice(0, 10)
          : String(r['saleDay'] ?? '-'),
      })),
      byPharmacist: [...byPharmacist.values()].map(ph => ({
        pharmacistName: ph.pharmacistName,
        days: [...ph.days.entries()].map(([day, items]) => ({
          day,
          totalRevenue: Math.round(items.reduce((s, i) => s + Number(i.totalRevenue ?? 0), 0) * 100) / 100,
          totalUnits: items.reduce((s, i) => s + Number(i.qtySold ?? 0), 0),
          medications: items,
        })),
      })),
    };
  }

  // ─── B1: Inventario general valorizado ───────────────────────────────────

  async getValorizedInventory(filters: ReportFilters) {
    const { clinicId } = filters;
    if (!clinicId) throw new BadRequestException('clinicId es requerido');

    const rows: Array<Record<string, unknown>> = await this.dataSource.query(`
      SELECT
        med.name                                                          AS "medicationName",
        med."genericName"                                                 AS "genericName",
        ${TIPO_PRODUCTO_SQL}                                                      AS category,
        med."dosageForm"                                                  AS "dosageForm",
        ms."batchNumber"                                                  AS "batchNumber",
        ms."availableQuantity"                                            AS "availableQuantity",
        ms."minimumStock"                                                 AS "minimumStock",
        ROUND(ms."unitCost"::numeric, 2)                                  AS "unitCost",
        ROUND(ms."sellingPrice"::numeric, 2)                              AS "sellingPrice",
        ROUND((ms."availableQuantity" * ms."unitCost")::numeric, 2)       AS "costValue",
        ROUND((ms."availableQuantity" * ms."sellingPrice")::numeric, 2)   AS "saleValue",
        ms."expiryDate"                                                   AS "expiryDate",
        CASE
          WHEN ms."availableQuantity" <= 0                                   THEN 'sin_stock'
          WHEN ms."availableQuantity" <= ms."minimumStock"                   THEN 'critico'
          WHEN ms."expiryDate" IS NOT NULL
               AND ms."expiryDate" < NOW() + INTERVAL '30 days'             THEN 'por_vencer'
          ELSE 'ok'
        END                                                               AS status
      FROM medication_stock ms
      JOIN medications med ON med.id = ms.medication_id
      WHERE ms.clinic_id = $1
        AND ms."isActive" = true
      ORDER BY med.product_type, med.name
    `, [clinicId]);

    const totalCostValue = rows.reduce((s, r) => s + Number(r['costValue'] ?? 0), 0);
    const totalSaleValue = rows.reduce((s, r) => s + Number(r['saleValue'] ?? 0), 0);
    return {
      rows,
      summary: {
        totalProducts: rows.length,
        totalCostValue:  Math.round(totalCostValue * 100) / 100,
        totalSaleValue:  Math.round(totalSaleValue * 100) / 100,
        potentialMargin: Math.round((totalSaleValue - totalCostValue) * 100) / 100,
        sinStock:   rows.filter(r => r['status'] === 'sin_stock').length,
        critico:    rows.filter(r => r['status'] === 'critico').length,
        porVencer:  rows.filter(r => r['status'] === 'por_vencer').length,
        ok:         rows.filter(r => r['status'] === 'ok').length,
      },
    };
  }

  // ─── B2: Inventario por categoría ────────────────────────────────────────

  async getInventoryByCategory(filters: ReportFilters) {
    const { clinicId } = filters;
    if (!clinicId) throw new BadRequestException('clinicId es requerido');

    return this.dataSource.query(`
      SELECT
        ${TIPO_PRODUCTO_SQL}                        AS category,
        COUNT(DISTINCT med.id)::int                                          AS "productCount",
        SUM(ms."availableQuantity")::int                                     AS "totalUnits",
        ROUND(SUM(ms."availableQuantity" * ms."unitCost")::numeric, 2)       AS "totalCostValue",
        ROUND(SUM(ms."availableQuantity" * ms."sellingPrice")::numeric, 2)   AS "totalSaleValue",
        COUNT(CASE WHEN ms."availableQuantity" <= ms."minimumStock" THEN 1 END)::int
                                                                             AS "lowStockCount",
        COUNT(CASE WHEN ms."expiryDate" IS NOT NULL
                        AND ms."expiryDate" < NOW() + INTERVAL '30 days'
                        AND ms."expiryDate" > NOW() THEN 1 END)::int         AS "expiringSoonCount"
      FROM medication_stock ms
      JOIN medications med ON med.id = ms.medication_id
      WHERE ms.clinic_id = $1
        AND ms."isActive" = true
      GROUP BY med.product_type
      ORDER BY "totalCostValue" DESC
    `, [clinicId]);
  }

  // ─── B3: Medicamentos sin movimiento ─────────────────────────────────────

  async getMedicationsWithoutMovement(filters: ReportFilters, days = 30) {
    const { clinicId } = filters;
    if (!clinicId) throw new BadRequestException('clinicId es requerido');

    const rows: Array<Record<string, unknown>> = await this.dataSource.query(`
      SELECT
        med.name                                                           AS "medicationName",
        med."genericName"                                                  AS "genericName",
        ${TIPO_PRODUCTO_SQL}                                                       AS category,
        ms."batchNumber"                                                   AS "batchNumber",
        ms."availableQuantity"                                             AS "availableQuantity",
        ROUND((ms."availableQuantity" * ms."unitCost")::numeric, 2)        AS "stockValue",
        ms."expiryDate"                                                    AS "expiryDate",
        MAX(ps."saleDate")                                                 AS "lastSaleDate"
      FROM medication_stock ms
      JOIN medications med        ON med.id = ms.medication_id
      LEFT JOIN pharmacy_sale_items psi ON psi.medication_stock_id = ms.id
      LEFT JOIN pharmacy_sales ps       ON ps.id = psi.sale_id AND ps.status = 'completed'
      WHERE ms.clinic_id = $1
        AND ms."isActive" = true
        AND ms."availableQuantity" > 0
      GROUP BY med.id, med.name, med."genericName", med.product_type,
               ms.id, ms."batchNumber", ms."availableQuantity", ms."unitCost", ms."expiryDate"
      HAVING MAX(ps."saleDate") < NOW() - INTERVAL '${days} days'
          OR MAX(ps."saleDate") IS NULL
      ORDER BY "stockValue" DESC
    `, [clinicId]);

    const totalStockValue = rows.reduce((s, r) => s + Number(r['stockValue'] ?? 0), 0);
    return { days, rows, totalStockValue: Math.round(totalStockValue * 100) / 100 };
  }

  // ─── C1: Detalle de ventas por medicamento ────────────────────────────────

  async getSalesByMedicationDetail(filters: ReportFilters) {
    const { clinicId, dateRange } = filters;
    if (!clinicId) throw new BadRequestException('clinicId es requerido');

    const startDate = dateRange?.startDate;
    const endDate   = dateRange?.endDate;
    const dateFilter = `
      ${startDate ? `AND ${SALE_DATE_BO} >= '${startDate}'` : ''}
      ${endDate   ? `AND ${SALE_DATE_BO} < ('${endDate}'::date + INTERVAL '1 day')` : ''}
    `;

    return this.dataSource.query(`
      SELECT
        med.name                                                              AS "medicationName",
        med."genericName"                                                     AS "genericName",
        ${TIPO_PRODUCTO_SQL}                                                          AS category,
        med."dosageForm"                                                      AS "dosageForm",
        SUM(psi.quantity)::int                                                AS "qtySold",
        ROUND(SUM(psi.subtotal)::numeric, 2)                                  AS "totalRevenue",
        ROUND(AVG(psi."unitPrice")::numeric, 2)                               AS "avgUnitPrice",
        ROUND(AVG(ms."unitCost")::numeric, 2)                                 AS "avgUnitCost",
        ROUND((SUM(psi.subtotal) - SUM(psi.quantity * ms."unitCost"))::numeric, 2)
                                                                              AS "grossMargin",
        CASE WHEN SUM(psi.subtotal) > 0
             THEN ROUND(((SUM(psi.subtotal) - SUM(psi.quantity * ms."unitCost"))
                         / SUM(psi.subtotal) * 100)::numeric, 2)
             ELSE 0 END                                                       AS "marginPct",
        COUNT(DISTINCT ps.id)::int                                            AS "saleCount"
      FROM pharmacy_sale_items psi
      JOIN pharmacy_sales ps     ON ps.id  = psi.sale_id
      JOIN medication_stock ms   ON ms.id  = psi.medication_stock_id
      JOIN medications med       ON med.id = ms.medication_id
      WHERE ps.clinic_id = $1
        AND ps.status = 'completed'
        ${dateFilter}
      GROUP BY med.id, med.name, med."genericName", med.product_type, med."dosageForm"
      ORDER BY "totalRevenue" DESC
    `, [clinicId]);
  }

  // ─── C2: Ventas con receta vs ventas libres ───────────────────────────────

  async getPrescriptionVsFreeSales(filters: ReportFilters) {
    const { clinicId, dateRange } = filters;
    if (!clinicId) throw new BadRequestException('clinicId es requerido');

    const startDate = dateRange?.startDate;
    const endDate   = dateRange?.endDate;
    const dateFilter = `
      ${startDate ? `AND ${SALE_DATE_BO} >= '${startDate}'` : ''}
      ${endDate   ? `AND ${SALE_DATE_BO} < ('${endDate}'::date + INTERVAL '1 day')` : ''}
    `;

    const [summary, byMedication]: [Array<Record<string, unknown>>, Array<Record<string, unknown>>] =
      await Promise.all([
        this.dataSource.query(`
          SELECT
            CASE WHEN ps.prescription_id IS NOT NULL THEN 'con_receta' ELSE 'libre' END AS type,
            COUNT(DISTINCT ps.id)::int           AS "salesCount",
            ROUND(SUM(ps.total)::numeric, 2)     AS "totalRevenue",
            ROUND(AVG(ps.total)::numeric, 2)     AS "avgTicket",
            SUM(psi.quantity)::int               AS "totalUnits"
          FROM pharmacy_sales ps
          JOIN pharmacy_sale_items psi ON psi.sale_id = ps.id
          WHERE ps.clinic_id = $1
            AND ps.status = 'completed'
            ${dateFilter}
          GROUP BY type
        `, [clinicId]),

        this.dataSource.query(`
          SELECT
            CASE WHEN ps.prescription_id IS NOT NULL THEN 'con_receta' ELSE 'libre' END AS type,
            med.name                                AS "medicationName",
            SUM(psi.quantity)::int                  AS "qtySold",
            ROUND(SUM(psi.subtotal)::numeric, 2)    AS revenue
          FROM pharmacy_sale_items psi
          JOIN pharmacy_sales ps     ON ps.id  = psi.sale_id
          JOIN medication_stock ms   ON ms.id  = psi.medication_stock_id
          JOIN medications med       ON med.id = ms.medication_id
          WHERE ps.clinic_id = $1
            AND ps.status = 'completed'
            ${dateFilter}
          GROUP BY type, med.id, med.name
          ORDER BY type, revenue DESC
          LIMIT 40
        `, [clinicId]),
      ]);

    const grandTotal = summary.reduce((s, r) => s + Number(r['totalRevenue'] ?? 0), 0);
    return {
      summary: summary.map(r => ({
        ...r,
        pct: grandTotal > 0 ? Math.round((Number(r['totalRevenue'] ?? 0) / grandTotal) * 1000) / 10 : 0,
      })),
      byMedication,
    };
  }

  // ─── C3: Ventas por método de pago (detallado) ───────────────────────────

  /**
   * Consolidado con lo que era F3-R12 (`getSalesByPaymentMethod`, sin ningún
   * botón en el frontend — quedó huérfano): ese solo tenía `byMethod` +
   * `monthly`, y este ya traía lo mismo en `summary` con más columnas
   * (avgTicket, totalChange) más el desglose diario. Se le agrega acá el
   * `monthly` que era lo único que no tenía, en vez de mantener dos
   * endpoints casi idénticos.
   */
  async getSalesByPaymentDetailed(filters: ReportFilters) {
    const { clinicId, dateRange } = filters;
    if (!clinicId) throw new BadRequestException('clinicId es requerido');

    const startDate = dateRange?.startDate;
    const endDate   = dateRange?.endDate;
    const dateFilter = `
      ${startDate ? `AND ${SALE_DATE_BO} >= '${startDate}'` : ''}
      ${endDate   ? `AND ${SALE_DATE_BO} < ('${endDate}'::date + INTERVAL '1 day')` : ''}
    `;

    const [summary, daily, monthly]: [
      Array<Record<string, unknown>>,
      Array<Record<string, unknown>>,
      Array<Record<string, unknown>>,
    ] = await Promise.all([
        this.dataSource.query(`
          SELECT
            ps."paymentMethod"                          AS method,
            COUNT(DISTINCT ps.id)::int                 AS "salesCount",
            ROUND(SUM(ps.total)::numeric, 2)           AS "totalRevenue",
            ROUND(AVG(ps.total)::numeric, 2)           AS "avgTicket",
            ROUND(SUM(ps.change)::numeric, 2)          AS "totalChange"
          FROM pharmacy_sales ps
          WHERE ps.clinic_id = $1
            AND ps.status = 'completed'
            ${dateFilter}
          GROUP BY ps."paymentMethod"
          ORDER BY "totalRevenue" DESC
        `, [clinicId]),

        this.dataSource.query(`
          SELECT
            DATE(${SALE_DATE_BO})                         AS "saleDay",
            ps."paymentMethod"                          AS method,
            COUNT(DISTINCT ps.id)::int                 AS "salesCount",
            ROUND(SUM(ps.total)::numeric, 2)           AS "totalRevenue"
          FROM pharmacy_sales ps
          WHERE ps.clinic_id = $1
            AND ps.status = 'completed'
            ${dateFilter}
          GROUP BY DATE(${SALE_DATE_BO}), ps."paymentMethod"
          ORDER BY "saleDay" DESC, "totalRevenue" DESC
        `, [clinicId]),

        this.dataSource.query(`
          SELECT
            TO_CHAR(${SALE_DATE_BO}, 'YYYY-MM')  AS month,
            ps."paymentMethod"                 AS method,
            SUM(ps.total)                      AS total,
            COUNT(*)                           AS count
          FROM pharmacy_sales ps
          WHERE ps.clinic_id = $1
            AND ps.status = 'completed'
            ${dateFilter}
          GROUP BY TO_CHAR(${SALE_DATE_BO}, 'YYYY-MM'), ps."paymentMethod"
          ORDER BY month, method
        `, [clinicId]),
      ]);

    const grandTotal = summary.reduce((s, r) => s + Number(r['totalRevenue'] ?? 0), 0);
    const fmtDay = (d: any) => d instanceof Date ? d.toISOString().slice(0, 10) : String(d ?? '-');

    return {
      summary: summary.map(r => ({
        ...r,
        pct: grandTotal > 0 ? Math.round((Number(r['totalRevenue'] ?? 0) / grandTotal) * 1000) / 10 : 0,
      })),
      daily: daily.map(r => ({ ...r, saleDay: fmtDay(r['saleDay']) })),
      monthly,
      grandTotal: Math.round(grandTotal * 100) / 100,
    };
  }

  // ─── C6: Comparativo mensual (últimos 6 meses) ────────────────────────────

  async getMonthlySalesComparison(filters: ReportFilters) {
    const { clinicId } = filters;
    if (!clinicId) throw new BadRequestException('clinicId es requerido');

    const rows: Array<Record<string, unknown>> = await this.dataSource.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', ${SALE_DATE_BO}), 'YYYY-MM') AS month,
        COUNT(DISTINCT ps.id)::int                             AS "salesCount",
        SUM(psi.quantity)::int                                 AS "totalUnits",
        ROUND(SUM(ps.total)::numeric, 2)                       AS "totalRevenue",
        ROUND(AVG(ps.total)::numeric, 2)                       AS "avgTicket",
        COUNT(DISTINCT ps."soldById")::int                     AS "activePharmacists",
        COUNT(DISTINCT ps.patient_id)::int                     AS "uniquePatients",
        COUNT(DISTINCT CASE WHEN ps.prescription_id IS NOT NULL THEN ps.id END)::int AS "prescriptionSales"
      FROM pharmacy_sales ps
      JOIN pharmacy_sale_items psi ON psi.sale_id = ps.id
      WHERE ps.clinic_id = $1
        AND ps.status = 'completed'
        AND ps."saleDate" >= DATE_TRUNC('month', NOW()) - INTERVAL '5 months'
      GROUP BY DATE_TRUNC('month', ${SALE_DATE_BO})
      ORDER BY month ASC
    `, [clinicId]);

    // Calcular variación mes a mes
    const enriched = rows.map((r, i) => {
      const prev = i > 0 ? rows[i - 1] : null;
      const rev = Number(r['totalRevenue'] ?? 0);
      const prevRev = prev ? Number(prev['totalRevenue'] ?? 0) : null;
      const growth = prevRev && prevRev > 0 ? Math.round(((rev - prevRev) / prevRev) * 1000) / 10 : null;
      return { ...r, revenueGrowth: growth };
    });

    const totalRevenue = enriched.reduce((s, r) => s + Number(r['totalRevenue'] ?? 0), 0);
    const totalSales   = enriched.reduce((s, r) => s + Number(r['salesCount'] ?? 0), 0);
    const bestMonth    = enriched.reduce((best, r) =>
      Number(r['totalRevenue'] ?? 0) > Number(best['totalRevenue'] ?? 0) ? r : best,
      enriched[0] ?? {},
    );

    return {
      rows: enriched,
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalSales,
        avgMonthlyRevenue: enriched.length > 0
          ? Math.round((totalRevenue / enriched.length) * 100) / 100 : 0,
        bestMonth: bestMonth?.['month'] ?? '-',
      },
    };
  }

  // ─── D1: Reporte individual de turno ──────────────────────────────────────

  /**
   * Corte de turno de una persona: en esta clínica no hay roles estancos —
   * "quien cobra" suele ser el mismo médico haciendo de recepcionista,
   * laboratorista, etc., a veces todo a la vez. No tiene sentido un reporte
   * "por farmacéutico" o "por recepcionista" separados: hace falta uno solo,
   * por persona, que junte todo lo que esa persona cobró en el rango — venta
   * de farmacia (pharmacy_sales.soldById) y todo lo demás del punto de cobro
   * (charges.createdById: consultas, laboratorio, otros) — para que alguien
   * que entra en la mañana y otra persona que entra en la tarde puedan sacar
   * cada quien su propio corte al cerrar su turno.
   *
   * `clinicCharges` solo cuenta como ingreso real (`clinicRevenue`) los que ya
   * están `invoiced` — un cargo `pending` es una cuenta todavía abierta, se
   * informa aparte en `clinicPending` para que no se sume como si ya se
   * hubiera cobrado.
   */
  async getStaffShiftDetail(filters: ReportFilters & { userId?: string }) {
    const { clinicId, dateRange, userId } = filters;
    if (!clinicId) throw new BadRequestException('clinicId es requerido');
    if (!userId) throw new BadRequestException('userId es requerido');

    const startDate = dateRange?.startDate;
    const endDate   = dateRange?.endDate;
    const pharmacyDateFilter = `
      ${startDate ? `AND ${SALE_DATE_BO} >= '${startDate}'` : ''}
      ${endDate   ? `AND ${SALE_DATE_BO} < ('${endDate}'::date + INTERVAL '1 day')` : ''}
    `;
    const chargeDateFilter = `
      ${startDate ? `AND ${CHARGE_DATE_BO} >= '${startDate}'` : ''}
      ${endDate   ? `AND ${CHARGE_DATE_BO} < ('${endDate}'::date + INTERVAL '1 day')` : ''}
    `;

    const [staff, pharmacySales, clinicCharges]: [
      Array<Record<string, unknown>>,
      Array<Record<string, unknown>>,
      Array<Record<string, unknown>>,
    ] = await Promise.all([
      this.dataSource.query(`
        SELECT u.id, pi."firstName" || ' ' || COALESCE(pi."lastName", '') AS name
        FROM users u
        JOIN personal_info pi ON pi.id = u."personalInfoId"
        WHERE u.id = $1
      `, [userId]),

      this.dataSource.query(`
        SELECT
          ps.id, ps."saleNumber", ps."patientName", ps.total, ps."paymentMethod",
          -- Formateado acá y no en JS: saleDate es naive-pero-UTC (ver
          -- SALE_DATE_BO) y pasar el Date crudo al PDF arriesga reinterpretarlo
          -- en la zona del proceso Node en vez de la de Bolivia.
          TO_CHAR(DATE(${SALE_DATE_BO}), 'DD/MM/YYYY') AS "saleDateFmt",
          TO_CHAR(${SALE_DATE_BO}, 'HH24:MI') AS "saleTimeFmt",
          (
            SELECT json_agg(json_build_object(
              'product', psi."productName", 'quantity', psi.quantity,
              'unitPrice', psi."unitPrice", 'subtotal', psi.subtotal
            ) ORDER BY psi."createdAt")
            FROM pharmacy_sale_items psi
            WHERE psi.sale_id = ps.id
          ) AS items
        FROM pharmacy_sales ps
        WHERE ps.clinic_id = $1
          AND ps."soldById" = $2
          AND ps.status = 'completed'
          ${pharmacyDateFilter}
        ORDER BY ps."saleDate" ASC
      `, [clinicId, userId]),

      this.dataSource.query(`
        SELECT c.id, c.origin, c.description, c.quantity, c.total, c.status,
               c.patient_name AS "patientName",
               TO_CHAR(DATE(${CHARGE_DATE_BO}), 'DD/MM/YYYY') AS "chargeDateFmt",
               TO_CHAR(${CHARGE_DATE_BO}, 'HH24:MI') AS "chargeTimeFmt"
        FROM charges c
        WHERE c.clinic_id = $1
          AND c.created_by = $2
          AND c.origin != 'pharmacy'
          ${chargeDateFilter}
        ORDER BY c."createdAt" ASC
      `, [clinicId, userId]),
    ]);

    const pharmacyRevenue = round2(pharmacySales.reduce((s, r) => s + Number(r['total'] ?? 0), 0));
    const invoicedCharges = clinicCharges.filter(c => c['status'] === 'invoiced');
    const pendingCharges  = clinicCharges.filter(c => c['status'] === 'pending');
    const clinicRevenue = round2(invoicedCharges.reduce((s, r) => s + Number(r['total'] ?? 0), 0));
    const clinicPending = round2(pendingCharges.reduce((s, r) => s + Number(r['total'] ?? 0), 0));

    return {
      userId,
      userName: (staff[0]?.['name'] as string) ?? null,
      pharmacySales,
      clinicCharges,
      summary: {
        pharmacyRevenue,
        pharmacyCount: pharmacySales.length,
        clinicRevenue,
        clinicPending,
        clinicCount: clinicCharges.length,
        totalRevenue: round2(pharmacyRevenue + clinicRevenue),
      },
    };
  }
}
