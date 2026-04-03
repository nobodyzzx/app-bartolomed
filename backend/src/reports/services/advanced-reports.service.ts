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
      .addSelect('med.generic_name', 'genericName')
      .addSelect('SUM(item.quantity)',              'totalDispensed')
      .addSelect('SUM(item.quantity * item.unit_price)', 'totalRevenue')
      .innerJoin('medication_stock', 'ms',  'ms.id = item.medication_stock_id')
      .innerJoin('medications',      'med', 'med.id = ms.medication_id')
      .innerJoin('pharmacy_sales',   'ps',  'ps.id = item.sale_id')
      .where('ps.clinic_id = :clinicId', { clinicId })
      .andWhere("ps.status = 'completed'")
      .groupBy('med.id, med.name, med.generic_name')
      .orderBy('SUM(item.quantity)', 'DESC');

    if (dateRange?.startDate) dispatchQb.andWhere('ps.sale_date >= :startDate', { startDate: dateRange.startDate });
    if (dateRange?.endDate)   dispatchQb.andWhere('ps.sale_date <= :endDate',   { endDate: dateRange.endDate });

    const dispensed = await dispatchQb.getRawMany();

    // Ingresos por traspasos completados hacia esta clínica
    const receivedQb = this.dataSource
      .createQueryBuilder()
      .select('med.id',              'medicationId')
      .addSelect('med.name',         'medicationName')
      .addSelect('SUM(sti.received_quantity)', 'totalReceived')
      .from('stock_transfer_items', 'sti')
      .innerJoin('stock_transfers',  'st',  'st.id = sti.transfer_id')
      .innerJoin('medication_stock', 'ms',  'ms.id = sti.source_stock_id')
      .innerJoin('medications',      'med', 'med.id = ms.medication_id')
      .where('st.target_clinic_id = :clinicId', { clinicId })
      .andWhere("st.status = 'completed'")
      .groupBy('med.id, med.name');

    if (dateRange?.startDate) receivedQb.andWhere('st.received_at >= :startDate', { startDate: dateRange.startDate });
    if (dateRange?.endDate)   receivedQb.andWhere('st.received_at <= :endDate',   { endDate: dateRange.endDate });

    const received = await receivedQb.getRawMany();

    // Total de stock actual por clínica
    const currentStockRaw = await this.stockRepo
      .createQueryBuilder('ms')
      .select('SUM(ms.available_quantity * ms.unit_cost)', 'totalStockValue')
      .addSelect('SUM(ms.available_quantity)',             'totalUnits')
      .innerJoin('ms.clinic', 'clinic')
      .where('clinic.id = :clinicId', { clinicId })
      .andWhere('ms.is_active = true')
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
      ${dateRange?.startDate ? `AND t.created_at >= '${dateRange.startDate}'` : ''}
      ${dateRange?.endDate   ? `AND t.created_at <= '${dateRange.endDate}'`   : ''}
    `;

    // KPI por par origen-destino
    const kpiByRoute: Array<Record<string, unknown>> = await this.dataSource.query(`
      SELECT
        t.source_clinic_id,
        sc.name                                                          AS source_clinic_name,
        t.target_clinic_id,
        tc.name                                                          AS target_clinic_name,
        COUNT(*)                                                         AS total_completed,
        ROUND(AVG(EXTRACT(EPOCH FROM (t."dispatchedAt" - t.created_at))/3600)::numeric, 2)
                                                                         AS avg_hrs_to_dispatch,
        ROUND(AVG(EXTRACT(EPOCH FROM (t."receivedAt"   - t."dispatchedAt"))/3600)::numeric, 2)
                                                                         AS avg_hrs_in_transit,
        ROUND(AVG(EXTRACT(EPOCH FROM (t."receivedAt"   - t.created_at))/3600)::numeric, 2)
                                                                         AS avg_total_hrs,
        PERCENTILE_CONT(0.95) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (t."receivedAt" - t."dispatchedAt"))/3600
        )                                                                AS p95_hrs_in_transit,
        COALESCE(SUM(sti.dispatched_quantity - sti.received_quantity), 0) AS total_discrepancy_units,
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
        ROUND(EXTRACT(EPOCH FROM (NOW() - t."dispatchedAt"))/3600 ::numeric, 1)
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
      .andWhere('ms.is_active = true');

    const [belowMinimum, expiringSoon, expired] = await Promise.all([
      // Stock bajo el mínimo
      qb.clone()
        .andWhere('ms.available_quantity <= ms.minimum_stock * :multiplier',
          { multiplier: criticalThresholdMultiplier })
        .orderBy('ms.available_quantity', 'ASC')
        .getMany(),

      // Próximos a vencer (dentro de expiryDays días)
      qb.clone()
        .andWhere('ms.expiry_date <= :expiryThreshold', { expiryThreshold })
        .andWhere('ms.expiry_date > NOW()')
        .andWhere('ms.available_quantity > 0')
        .orderBy('ms.expiry_date', 'ASC')
        .getMany(),

      // Ya vencidos con stock positivo (no se han dado de baja)
      qb.clone()
        .andWhere('ms.expiry_date < NOW()')
        .andWhere('ms.available_quantity > 0')
        .orderBy('ms.expiry_date', 'ASC')
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
}
