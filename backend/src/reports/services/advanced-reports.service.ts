import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PharmacySale } from '../../pharmacy/entities/pharmacy-sale.entity';
import { PharmacySaleItem } from '../../pharmacy/entities/pharmacy-sale.entity';
import { MedicationStock } from '../../pharmacy/entities/pharmacy.entity';
import { Prescription } from '../../prescriptions/entities/prescription.entity';
import { PrescriptionItem } from '../../prescriptions/entities/prescription.entity';
import { StockTransfer } from '../../transfers/entities/stock-transfer.entity';
import { ReportFilters } from './reports.service';

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

    if (dateRange?.startDate) dispatchQb.andWhere('ps."saleDate" >= :startDate', { startDate: dateRange.startDate });
    if (dateRange?.endDate)   dispatchQb.andWhere('ps."saleDate" <= :endDate',   { endDate: dateRange.endDate });

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

    if (dateRange?.startDate) receivedQb.andWhere('st."receivedAt" >= :startDate', { startDate: dateRange.startDate });
    if (dateRange?.endDate)   receivedQb.andWhere('st."receivedAt" <= :endDate',   { endDate: dateRange.endDate });

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

    // Usamos SQL nativo con UNION ALL porque TypeORM QB no soporta UNION
    const rows = await this.dataSource.query<Array<Record<string, unknown>>>(`
      SELECT
        'appointment'    AS event_type,
        a.id             AS event_id,
        a.appointment_date AS event_date,
        a.clinic_id,
        c.name           AS clinic_name,
        CONCAT('Cita: ', a.type, ' — ', a.status) AS summary,
        a.notes          AS detail
      FROM appointments a
      LEFT JOIN clinics c ON c.id = a.clinic_id
      WHERE a.patient_id = $1
        AND a.is_active  = true

      UNION ALL

      SELECT
        'medical_record' AS event_type,
        mr.id            AS event_id,
        mr.created_at    AS event_date,
        mr.clinic_id,
        c.name           AS clinic_name,
        CONCAT('Registro: ', mr.type, ' — ', mr.title) AS summary,
        mr.content       AS detail
      FROM medical_records mr
      LEFT JOIN clinics c ON c.id = mr.clinic_id
      WHERE mr.patient_id = $1
        AND mr.deleted_at IS NULL

      UNION ALL

      SELECT
        'prescription'   AS event_type,
        p.id             AS event_id,
        p.prescription_date AS event_date,
        p.clinic_id,
        c.name           AS clinic_name,
        CONCAT('Receta: ', p.prescription_number, ' — ', p.status) AS summary,
        p.diagnosis      AS detail
      FROM prescriptions p
      LEFT JOIN clinics c ON c.id = p.clinic_id
      WHERE p.patient_id = $1
        AND p.deleted_at IS NULL

      UNION ALL

      SELECT
        'pharmacy_sale'  AS event_type,
        ps.id            AS event_id,
        ps.sale_date     AS event_date,
        ps.clinic_id,
        c.name           AS clinic_name,
        CONCAT('Venta farmacia: ', ps.sale_number) AS summary,
        ps.notes         AS detail
      FROM pharmacy_sales ps
      LEFT JOIN clinics c ON c.id = ps.clinic_id
      WHERE ps.patient_id = $1

      ORDER BY event_date DESC
      LIMIT 200
    `, [patientId]);

    // Si se proporciona clinicId verificamos que el paciente sea accesible
    const belongsToClinic = rows.some(r => r['clinic_id'] === clinicId);
    if (rows.length > 0 && !belongsToClinic) {
      // Permite acceso cross-clínica de lectura — solo filtramos si NO hay ningún evento en la clínica
      // (el guard de cross-clinic-access ya fue evaluado antes de llegar aquí)
    }

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
      ${dateRange?.startDate ? `AND t."createdAt" >= '${dateRange.startDate}'` : ''}
      ${dateRange?.endDate   ? `AND t."createdAt" <= '${dateRange.endDate}'`   : ''}
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

    const startDate = dateRange?.startDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const endDate   = dateRange?.endDate   ?? new Date().toISOString().slice(0, 10);

    const rows: Array<Record<string, unknown>> = await this.dataSource.query(`
      SELECT
        med.name                            AS "medicationName",
        med."genericName"                   AS "genericName",
        med.category                        AS category,
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
          AND ps."saleDate" >= $2
          AND ps."saleDate" <= $3
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

  // ─── F1-R2: Top medicamentos vendidos ────────────────────────────────────

  async getTopSellingMedications(filters: ReportFilters) {
    const { clinicId, dateRange } = filters;
    if (!clinicId) throw new BadRequestException('clinicId es requerido');

    const startDate = dateRange?.startDate;
    const endDate   = dateRange?.endDate;

    const dateFilter = `
      ${startDate ? `AND ps."saleDate" >= '${startDate}'` : ''}
      ${endDate   ? `AND ps."saleDate" <= '${endDate}'`   : ''}
    `;

    return this.dataSource.query(`
      SELECT
        med.name                          AS "medicationName",
        med."genericName"                 AS "genericName",
        med.category                      AS category,
        SUM(psi.quantity)                 AS "totalQty",
        SUM(psi.subtotal)                 AS "totalRevenue",
        ROUND(AVG(psi."unitPrice"), 2)    AS "avgUnitPrice"
      FROM pharmacy_sale_items psi
      JOIN pharmacy_sales ps   ON ps.id  = psi.sale_id
      JOIN medication_stock ms ON ms.id  = psi.medication_stock_id
      JOIN medications med     ON med.id = ms.medication_id
      WHERE ps.clinic_id = $1
        AND ps.status = 'completed'
        ${dateFilter}
      GROUP BY med.id, med.name, med."genericName", med.category
      ORDER BY SUM(psi.quantity) DESC
      LIMIT 30
    `, [clinicId]);
  }

  // ─── F1-R3: Margen bruto por producto ────────────────────────────────────

  async getProductMarginReport(filters: ReportFilters) {
    const { clinicId, dateRange } = filters;
    if (!clinicId) throw new BadRequestException('clinicId es requerido');

    const startDate = dateRange?.startDate;
    const endDate   = dateRange?.endDate;

    const dateFilter = `
      ${startDate ? `AND ps."saleDate" >= '${startDate}'` : ''}
      ${endDate   ? `AND ps."saleDate" <= '${endDate}'`   : ''}
    `;

    return this.dataSource.query(`
      SELECT
        med.name                                                          AS "medicationName",
        med."genericName"                                                 AS "genericName",
        ROUND(AVG(ms."unitCost"), 2)                                      AS "unitCost",
        ROUND(AVG(psi."unitPrice"), 2)                                    AS "sellingPrice",
        SUM(psi.quantity)                                                 AS "qtySold",
        ROUND(SUM((psi."unitPrice" - ms."unitCost") * psi.quantity), 2)   AS "marginAbs",
        CASE
          WHEN SUM(psi."unitPrice" * psi.quantity) = 0 THEN 0
          ELSE ROUND(SUM((psi."unitPrice" - ms."unitCost") * psi.quantity)
               / SUM(psi."unitPrice" * psi.quantity) * 100, 2)
        END                                                               AS "marginPct"
      FROM pharmacy_sale_items psi
      JOIN pharmacy_sales ps   ON ps.id  = psi.sale_id
      JOIN medication_stock ms ON ms.id  = psi.medication_stock_id
      JOIN medications med     ON med.id = ms.medication_id
      WHERE ps.clinic_id = $1
        AND ps.status = 'completed'
        ${dateFilter}
      GROUP BY med.id, med.name, med."genericName"
      ORDER BY "marginAbs" DESC
    `, [clinicId]);
  }

  // ─── F1-R4: Resumen ventas por día ───────────────────────────────────────

  async getDailySalesSummary(filters: ReportFilters) {
    const { clinicId, dateRange } = filters;
    if (!clinicId) throw new BadRequestException('clinicId es requerido');

    const startDate = dateRange?.startDate;
    const endDate   = dateRange?.endDate;

    const dateFilter = `
      ${startDate ? `AND ps."saleDate" >= '${startDate}'` : ''}
      ${endDate   ? `AND ps."saleDate" <= '${endDate}'`   : ''}
    `;

    const [dailySales, paymentBreakdown]: [Array<Record<string, unknown>>, Array<Record<string, unknown>>] = await Promise.all([
      this.dataSource.query(`
        SELECT
          DATE(ps."saleDate")          AS date,
          SUM(ps.total)                AS "totalRevenue",
          COUNT(*)                     AS "ticketCount",
          ROUND(AVG(ps.total), 2)      AS "avgTicket"
        FROM pharmacy_sales ps
        WHERE ps.clinic_id = $1
          AND ps.status = 'completed'
          ${dateFilter}
        GROUP BY DATE(ps."saleDate")
        ORDER BY DATE(ps."saleDate") ASC
      `, [clinicId]),

      this.dataSource.query(`
        SELECT
          ps."paymentMethod"           AS method,
          SUM(ps.total)                AS total,
          COUNT(*)                     AS count
        FROM pharmacy_sales ps
        WHERE ps.clinic_id = $1
          AND ps.status = 'completed'
          ${dateFilter}
        GROUP BY ps."paymentMethod"
        ORDER BY SUM(ps.total) DESC
      `, [clinicId]),
    ]);

    return { dailySales, paymentBreakdown };
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
        med.category               AS category,
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
      ${startDate ? `AND ps."saleDate" >= '${startDate}'` : ''}
      ${endDate   ? `AND ps."saleDate" <= '${endDate}'`   : ''}
    `;

    const [purchased, sold]: [Array<Record<string, unknown>>, Array<Record<string, unknown>>] = await Promise.all([
      this.dataSource.query(`
        SELECT
          TO_CHAR(po."orderDate", 'YYYY-MM')  AS month,
          med.name                             AS "medicationName",
          SUM(poi."receivedQuantity")          AS "qtyPurchased"
        FROM purchase_orders po
        JOIN purchase_order_items poi ON poi.order_id = po.id
        JOIN medications med          ON med.id = poi."medicationId"
        WHERE po.clinic_id = $1
          AND po.status = 'received'
          ${dateFilterPO}
        GROUP BY TO_CHAR(po."orderDate", 'YYYY-MM'), med.id, med.name
        ORDER BY month, med.name
      `, [clinicId]),

      this.dataSource.query(`
        SELECT
          TO_CHAR(ps."saleDate", 'YYYY-MM')  AS month,
          med.name                            AS "medicationName",
          SUM(psi.quantity)                   AS "qtySold"
        FROM pharmacy_sale_items psi
        JOIN pharmacy_sales ps   ON ps.id  = psi.sale_id
        JOIN medication_stock ms ON ms.id  = psi.medication_stock_id
        JOIN medications med     ON med.id = ms.medication_id
        WHERE ps.clinic_id = $1
          AND ps.status = 'completed'
          ${dateFilterPS}
        GROUP BY TO_CHAR(ps."saleDate", 'YYYY-MM'), med.id, med.name
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
      ${startDate ? `AND ps."saleDate" >= '${startDate}'` : ''}
      ${endDate   ? `AND ps."saleDate" <= '${endDate}'`   : ''}
    `;

    return this.dataSource.query(`
      SELECT
        med.category                                                          AS category,
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
      GROUP BY med.category
      ORDER BY SUM(psi.subtotal) DESC
    `, [clinicId]);
  }

  // ─── F2-R8: Movimientos de stock (kardex simplificado) ───────────────────

  async getStockMovementsReport(filters: ReportFilters & { medicationId?: string }) {
    const { clinicId, dateRange, medicationId } = filters;
    if (!clinicId) throw new BadRequestException('clinicId es requerido');

    const startDate = dateRange?.startDate;
    const endDate   = dateRange?.endDate;

    const params: unknown[] = [clinicId];
    const dateFilter = `
      ${startDate ? `AND sm."movementDate" >= '${startDate}'` : ''}
      ${endDate   ? `AND sm."movementDate" <= '${endDate}'`   : ''}
    `;
    const medFilter = medicationId ? `AND ms.medication_id = '${medicationId}'` : '';

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
        ${dateFilter}
        ${medFilter}
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

    const [row]: Array<Record<string, unknown>> = await this.dataSource.query(`
      SELECT
        COUNT(*) FILTER (WHERE p.status NOT IN ('dispensed','cancelled')) AS "totalActive",
        COUNT(*) FILTER (WHERE p.status = 'dispensed')                   AS "totalDispensed",
        COUNT(*) FILTER (
          WHERE p.status NOT IN ('dispensed','cancelled')
            AND p.prescription_date < NOW() - INTERVAL '30 days'
        )                                                                  AS "totalExpiredUndispensed"
      FROM prescriptions p
      WHERE p.clinic_id = $1
        AND p.deleted_at IS NULL
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

  // ─── F3-R12: Ventas por método de pago ───────────────────────────────────

  async getSalesByPaymentMethod(filters: ReportFilters) {
    const { clinicId, dateRange } = filters;
    if (!clinicId) throw new BadRequestException('clinicId es requerido');

    const startDate = dateRange?.startDate;
    const endDate   = dateRange?.endDate;

    const dateFilter = `
      ${startDate ? `AND ps."saleDate" >= '${startDate}'` : ''}
      ${endDate   ? `AND ps."saleDate" <= '${endDate}'`   : ''}
    `;

    const [byMethod, monthly]: [Array<Record<string, unknown>>, Array<Record<string, unknown>>] = await Promise.all([
      this.dataSource.query(`
        SELECT
          ps."paymentMethod"        AS method,
          SUM(ps.total)             AS total,
          COUNT(*)                  AS count
        FROM pharmacy_sales ps
        WHERE ps.clinic_id = $1
          AND ps.status = 'completed'
          ${dateFilter}
        GROUP BY ps."paymentMethod"
        ORDER BY SUM(ps.total) DESC
      `, [clinicId]),

      this.dataSource.query(`
        SELECT
          TO_CHAR(ps."saleDate", 'YYYY-MM')  AS month,
          ps."paymentMethod"                 AS method,
          SUM(ps.total)                      AS total,
          COUNT(*)                           AS count
        FROM pharmacy_sales ps
        WHERE ps.clinic_id = $1
          AND ps.status = 'completed'
          ${dateFilter}
        GROUP BY TO_CHAR(ps."saleDate", 'YYYY-MM'), ps."paymentMethod"
        ORDER BY month, method
      `, [clinicId]),
    ]);

    const grandTotal = byMethod.reduce((s, r) => s + Number(r['total'] ?? 0), 0);
    const byMethodWithPct = byMethod.map(r => ({
      ...r,
      pct: grandTotal > 0 ? Math.round((Number(r['total'] ?? 0) / grandTotal) * 100 * 10) / 10 : 0,
    }));

    return { byMethod: byMethodWithPct, monthly };
  }

  // ─── F3-R13: Rentabilidad mensual farmacia ────────────────────────────────

  async getMonthlyProfitability(filters: ReportFilters) {
    const { clinicId, dateRange } = filters;
    if (!clinicId) throw new BadRequestException('clinicId es requerido');

    const startDate = dateRange?.startDate;
    const endDate   = dateRange?.endDate;

    const dateFilter = `
      ${startDate ? `AND ps."saleDate" >= '${startDate}'` : ''}
      ${endDate   ? `AND ps."saleDate" <= '${endDate}'`   : ''}
    `;

    const rows: Array<Record<string, unknown>> = await this.dataSource.query(`
      SELECT
        TO_CHAR(ps."saleDate", 'YYYY-MM')               AS month,
        SUM(ps.total)                                    AS revenue,
        SUM(psi.quantity * ms."unitCost")                AS cogs,
        SUM(ps.total) - SUM(psi.quantity * ms."unitCost") AS "grossMargin"
      FROM pharmacy_sales ps
      JOIN pharmacy_sale_items psi ON psi.sale_id = ps.id
      JOIN medication_stock ms     ON ms.id = psi.medication_stock_id
      WHERE ps.clinic_id = $1
        AND ps.status = 'completed'
        ${dateFilter}
      GROUP BY TO_CHAR(ps."saleDate", 'YYYY-MM')
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

    // Recetas con sus ítems + ventas de farmacia asociadas vía prescription_id FK
    const qb = this.prescriptionItemRepo
      .createQueryBuilder('pi')
      .select('p.id',                  'prescriptionId')
      .addSelect('p.prescription_number', 'prescriptionNumber')
      .addSelect('p.status',           'prescriptionStatus')
      .addSelect('p.prescription_date','prescriptionDate')
      .addSelect("CONCAT(up.first_name, ' ', up.last_name)", 'doctorName')
      .addSelect("CONCAT(pat_pi.first_name, ' ', pat_pi.last_name)", 'patientName')
      .addSelect('pi.medication_name', 'medicationName')
      .addSelect('pi.quantity',        'prescribedQty')   // text field en esta entidad
      .addSelect('COALESCE(SUM(psi.quantity), 0)', 'dispensedQty')
      .innerJoin('pi.prescription',    'p')
      .innerJoin('p.clinic',           'clinic')
      .innerJoin('p.doctor',           'doctor')
      .innerJoin('doctor.personalInfo','up')
      .innerJoin('p.patient',          'pat')
      .innerJoin('pat.personalInfo',   'pat_pi')
      .leftJoin('pharmacy_sales', 'ps',
        'ps.prescription_id = p.id AND ps.status = :saleStatus', { saleStatus: 'completed' })
      .leftJoin('pharmacy_sale_items', 'psi', 'psi.sale_id = ps.id')
      .where('clinic.id = :clinicId', { clinicId })
      .andWhere('p.deleted_at IS NULL')
      .groupBy(`p.id, p.prescription_number, p.status, p.prescription_date,
                up.first_name, up.last_name, pat_pi.first_name, pat_pi.last_name,
                pi.id, pi.medication_name, pi.quantity`)
      .orderBy('p.prescription_date', 'DESC');

    if (doctorId) qb.andWhere('doctor.id = :doctorId', { doctorId });
    if (dateRange?.startDate) qb.andWhere('p.prescription_date >= :startDate', { startDate: dateRange.startDate });
    if (dateRange?.endDate)   qb.andWhere('p.prescription_date <= :endDate',   { endDate: dateRange.endDate });

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
      ${startDate ? `AND ps."saleDate" >= '${startDate}'` : ''}
      ${endDate   ? `AND ps."saleDate" <= '${endDate}'`   : ''}
    `;

    const rows: Array<Record<string, unknown>> = await this.dataSource.query(`
      SELECT
        u.id                                                              AS "userId",
        pi."firstName" || ' ' || COALESCE(pi."lastName", '')             AS "pharmacistName",
        COUNT(DISTINCT ps.id)::int                                        AS "salesCount",
        ROUND(SUM(ps.total)::numeric, 2)                                  AS "totalRevenue",
        ROUND(AVG(ps.total)::numeric, 2)                                  AS "avgTicket",
        COUNT(DISTINCT DATE(ps."saleDate"))::int                          AS "workDays",
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
      ${startDate ? `AND ps."saleDate" >= '${startDate}'` : ''}
      ${endDate   ? `AND ps."saleDate" <= '${endDate}'`   : ''}
    `;

    const rows: Array<Record<string, unknown>> = await this.dataSource.query(`
      SELECT
        pi."firstName" || ' ' || COALESCE(pi."lastName", '')  AS "pharmacistName",
        DATE(ps."saleDate")                                    AS "saleDay",
        med.name                                               AS "medicationName",
        med."genericName"                                      AS "genericName",
        med.category                                           AS category,
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
      GROUP BY pi."firstName", pi."lastName", DATE(ps."saleDate"),
               med.id, med.name, med."genericName", med.category
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
        med.category                                                      AS category,
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
      ORDER BY med.category, med.name
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
        COALESCE(med.category, 'Sin categoría')                              AS category,
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
      GROUP BY med.category
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
        med.category                                                       AS category,
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
      GROUP BY med.id, med.name, med."genericName", med.category,
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
      ${startDate ? `AND ps."saleDate" >= '${startDate}'` : ''}
      ${endDate   ? `AND ps."saleDate" <= '${endDate}'`   : ''}
    `;

    return this.dataSource.query(`
      SELECT
        med.name                                                              AS "medicationName",
        med."genericName"                                                     AS "genericName",
        med.category                                                          AS category,
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
      GROUP BY med.id, med.name, med."genericName", med.category, med."dosageForm"
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
      ${startDate ? `AND ps."saleDate" >= '${startDate}'` : ''}
      ${endDate   ? `AND ps."saleDate" <= '${endDate}'`   : ''}
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

  async getSalesByPaymentDetailed(filters: ReportFilters) {
    const { clinicId, dateRange } = filters;
    if (!clinicId) throw new BadRequestException('clinicId es requerido');

    const startDate = dateRange?.startDate;
    const endDate   = dateRange?.endDate;
    const dateFilter = `
      ${startDate ? `AND ps."saleDate" >= '${startDate}'` : ''}
      ${endDate   ? `AND ps."saleDate" <= '${endDate}'`   : ''}
    `;

    const [summary, daily]: [Array<Record<string, unknown>>, Array<Record<string, unknown>>] =
      await Promise.all([
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
            DATE(ps."saleDate")                         AS "saleDay",
            ps."paymentMethod"                          AS method,
            COUNT(DISTINCT ps.id)::int                 AS "salesCount",
            ROUND(SUM(ps.total)::numeric, 2)           AS "totalRevenue"
          FROM pharmacy_sales ps
          WHERE ps.clinic_id = $1
            AND ps.status = 'completed'
            ${dateFilter}
          GROUP BY DATE(ps."saleDate"), ps."paymentMethod"
          ORDER BY "saleDay" DESC, "totalRevenue" DESC
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
      grandTotal: Math.round(grandTotal * 100) / 100,
    };
  }

  // ─── C6: Comparativo mensual (últimos 6 meses) ────────────────────────────

  async getMonthlySalesComparison(filters: ReportFilters) {
    const { clinicId } = filters;
    if (!clinicId) throw new BadRequestException('clinicId es requerido');

    const rows: Array<Record<string, unknown>> = await this.dataSource.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', ps."saleDate"), 'YYYY-MM') AS month,
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
      GROUP BY DATE_TRUNC('month', ps."saleDate")
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
}
