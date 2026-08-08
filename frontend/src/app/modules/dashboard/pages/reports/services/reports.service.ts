import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
import { environment } from '../../../../../environments/environments'
import { todayLocalISO } from '../../../../../shared/utils/date-format.util'
import { openPdfInNewTab } from '../../../../../shared/utils/pdf-viewer.util'

@Injectable({
  providedIn: 'root',
})
export class ReportsService {
  private apiUrl = `${environment.baseUrl}/reports`

  constructor(private http: HttpClient) {}

  // ─── Descarga de reportes en PDF ──────────────────────────────────────────

  /**
   * Pide un reporte en PDF y lo abre en el visor del navegador, para verlo antes
   * de imprimirlo o guardarlo. Antes lo descargaba a ciegas, a diferencia del
   * resto de PDF de la app (recetas, resultados, consentimiento).
   *
   * (El nombre anterior era `downloadReportPdf`: los PDF se generan con
   * Typst desde la migración, Puppeteer ya no está en el proyecto.)
   * @param endpoint Sufijo después de /api/reports/export/pdf/
   * @param filename Nombre con el que se guardaría desde el visor
   * @param params Parámetros de query opcionales (startDate, endDate, etc.)
   */
  downloadReportPdf(
    endpoint: string,
    filename: string,
    params: Record<string, string> = {},
  ): Observable<Blob> {
    const query = new URLSearchParams(params).toString()
    const url = `${this.apiUrl}/export/pdf/${endpoint}${query ? '?' + query : ''}`
    return this.http
      .get(url, { responseType: 'blob' })
      .pipe(tap(blob => openPdfInNewTab(blob, filename)))
  }

  downloadFinancialPdf(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadReportPdf('financial', `reporte-financiero-${date}.pdf`, params)
  }

  /** Control de ingresos: origen, descuentos y cuentas por cobrar. */
  downloadRevenueControlPdf(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadReportPdf('revenue-control', `control-ingresos-${date}.pdf`, params)
  }

  downloadDemographicsPdf(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadReportPdf('demographics', `demografia-pacientes-${date}.pdf`, params)
  }

  downloadDoctorPerformancePdf(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadReportPdf('doctor-performance', `rendimiento-medicos-${date}.pdf`, params)
  }

  downloadAppointmentsPdf(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadReportPdf('appointments', `estadisticas-citas-${date}.pdf`, params)
  }

  downloadMedicalRecordsPdf(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadReportPdf('medical-records', `registros-medicos-${date}.pdf`, params)
  }

  downloadDashboardPdf(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadReportPdf('dashboard', `dashboard-${date}.pdf`, params)
  }

  downloadCriticalStockPdf(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadReportPdf('critical-stock', `stock-critico-${date}.pdf`, params)
  }

  downloadTransferEfficiencyPdf(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadReportPdf('transfer-efficiency', `eficiencia-traslados-${date}.pdf`, params)
  }

  /**
   * Descarga directa, sin visor: esto sirve los Excel, que el navegador no sabe
   * mostrar. Solo los PDF se abren en pestaña (ver `downloadReportPdf`).
   */
  private downloadBlob(path: string, filename: string, params: Record<string, string> = {}): Observable<Blob> {
    const query = new URLSearchParams(params).toString()
    const url = `${this.apiUrl}/${path}${query ? '?' + query : ''}`
    return this.http.get(url, { responseType: 'blob' }).pipe(
      tap(blob => {
        const objUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = objUrl
        a.download = filename
        a.click()
        URL.revokeObjectURL(objUrl)
      }),
    )
  }

  downloadCriticalStockExcel(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadBlob('export/excel/critical-stock', `stock-critico-${date}.xlsx`, params)
  }

  downloadPharmacyConsumptionExcel(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadBlob('export/excel/pharmacy-consumption', `consumo-farmacia-${date}.xlsx`, params)
  }

  // ─── Farmacia: nuevos PDFs (F1-R1..F3-R13) ───────────────────────────────

  downloadRotationPdf(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadReportPdf('pharmacy-rotation', `rotacion-stock-${date}.pdf`, params)
  }

  downloadMarginsPdf(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadReportPdf('pharmacy-margins', `margenes-producto-${date}.pdf`, params)
  }

  downloadDailySalesPdf(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadReportPdf('pharmacy-daily-sales', `ventas-diarias-${date}.pdf`, params)
  }

  downloadExpiryBucketsPdf(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadReportPdf('pharmacy-expiry-buckets', `vencimientos-${date}.pdf`, params)
  }

  downloadProfitabilityPdf(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadReportPdf('pharmacy-profitability', `rentabilidad-mensual-${date}.pdf`, params)
  }

  // ─── Farmacia: nuevos Excels ──────────────────────────────────────────────

  downloadRotationExcel(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadBlob('export/excel/pharmacy-rotation', `rotacion-stock-${date}.xlsx`, params)
  }

  downloadMarginsExcel(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadBlob('export/excel/pharmacy-margins', `margenes-producto-${date}.xlsx`, params)
  }

  downloadTopSellingExcel(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadBlob('export/excel/pharmacy-top-selling', `top-vendidos-${date}.xlsx`, params)
  }

  downloadStockMovementsExcel(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadBlob('export/excel/pharmacy-stock-movements', `kardex-${date}.xlsx`, params)
  }

  // ─── A1: Ventas por farmacéutico ─────────────────────────────────────────

  downloadSalesByPharmacistPdf(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadReportPdf('pharmacy-by-pharmacist', `ventas-farmaceutico-${date}.pdf`, params)
  }

  downloadSalesByPharmacistExcel(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadBlob('export/excel/pharmacy-by-pharmacist', `ventas-farmaceutico-${date}.xlsx`, params)
  }

  // ─── A2: Encargado × Día × Medicamento ───────────────────────────────────

  downloadPharmacistDayMedicationPdf(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadReportPdf('pharmacy-pharmacist-day', `encargado-dia-medicamento-${date}.pdf`, params)
  }

  downloadPharmacistDayMedicationExcel(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadBlob('export/excel/pharmacy-pharmacist-day', `encargado-dia-medicamento-${date}.xlsx`, params)
  }

  // ─── B1: Inventario valorizado ────────────────────────────────────────────

  downloadValorizedInventoryPdf(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadReportPdf('pharmacy-inventory-valorized', `inventario-valorizado-${date}.pdf`, params)
  }

  downloadValorizedInventoryExcel(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadBlob('export/excel/pharmacy-inventory-valorized', `inventario-valorizado-${date}.xlsx`, params)
  }

  // ─── B2: Inventario por categoría ────────────────────────────────────────

  downloadInventoryByCategoryPdf(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadReportPdf('pharmacy-inventory-by-category', `inventario-categorias-${date}.pdf`, params)
  }

  // ─── B3: Sin movimiento ───────────────────────────────────────────────────

  downloadNoMovementPdf(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadReportPdf('pharmacy-no-movement', `sin-movimiento-${date}.pdf`, params)
  }

  downloadNoMovementExcel(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadBlob('export/excel/pharmacy-no-movement', `sin-movimiento-${date}.xlsx`, params)
  }

  // ─── C1: Ventas por medicamento detalle ──────────────────────────────────

  downloadMedicationDetailPdf(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadReportPdf('pharmacy-medication-detail', `ventas-medicamento-${date}.pdf`, params)
  }

  downloadMedicationDetailExcel(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadBlob('export/excel/pharmacy-medication-detail', `ventas-medicamento-${date}.xlsx`, params)
  }

  // ─── C2: Receta vs Venta libre ────────────────────────────────────────────

  downloadPrescriptionVsFreePdf(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadReportPdf('pharmacy-prescription-vs-free', `receta-vs-libre-${date}.pdf`, params)
  }

  // ─── Datos reales para el hub de reportes ─────────────────────────────────

  getPatientStats(params: Record<string, string> = {}): Observable<any> {
    const query = new URLSearchParams(params).toString()
    return this.http.get<any>(`${this.apiUrl}/patients/demographics${query ? '?' + query : ''}`)
  }

  getAppointmentStats(params: Record<string, string> = {}): Observable<any> {
    const query = new URLSearchParams(params).toString()
    return this.http.get<any>(`${this.apiUrl}/appointments/statistics${query ? '?' + query : ''}`)
  }

  getFinancialStats(params: Record<string, string> = {}): Observable<any> {
    const query = new URLSearchParams(params).toString()
    return this.http.get<any>(`${this.apiUrl}/financial/summary${query ? '?' + query : ''}`)
  }

  // ─── Control de ingresos (sobre cargos, no sobre facturas) ────────────────

  /** Ingresos por origen: consulta, laboratorio, farmacia. */
  getRevenueByOrigin(params: Record<string, string> = {}): Observable<any> {
    const query = new URLSearchParams(params).toString()
    return this.http.get<any>(`${this.apiUrl}/revenue/by-origin${query ? '?' + query : ''}`)
  }

  /**
   * Descuentos otorgados, incluidos los "absorbidos" que el recibo del
   * paciente no muestra.
   */
  getDiscountsReport(params: Record<string, string> = {}): Observable<any> {
    const query = new URLSearchParams(params).toString()
    return this.http.get<any>(`${this.apiUrl}/revenue/discounts${query ? '?' + query : ''}`)
  }

  /** Cuentas por cobrar: cargos generados que aún nadie pagó. */
  getReceivables(params: Record<string, string> = {}): Observable<any> {
    const query = new URLSearchParams(params).toString()
    return this.http.get<any>(`${this.apiUrl}/revenue/receivables${query ? '?' + query : ''}`)
  }

  getStockStats(params: Record<string, string> = {}): Observable<any> {
    const query = new URLSearchParams(params).toString()
    return this.http.get<any>(`${this.apiUrl}/inventory/stock${query ? '?' + query : ''}`)
  }

  getPaymentMethodStats(params: Record<string, string> = {}): Observable<any> {
    const query = new URLSearchParams(params).toString()
    return this.http.get<any>(`${this.apiUrl}/financial/payment-methods${query ? '?' + query : ''}`)
  }

  // ─── C3: Ventas por método de pago ───────────────────────────────────────

  // Bug real: pasaban '/reports/export/pdf/...' a downloadReportPdf(), que ya
  // antepone this.apiUrl (…/reports) — el prefijo quedaba duplicado
  // (…/reports/export/pdf//reports/export/pdf/...) y los 2 botones PDF de esta
  // sección daban 404 siempre. downloadSalesByPaymentExcel/
  // downloadMonthlySalesComparisonExcel tenían el mismo problema, además de
  // pasar una URL ya armada como si fuera un "path" relativo a downloadBlob()
  // (que también antepone apiUrl), duplicándolo una segunda vez.
  downloadSalesByPaymentPdf(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadReportPdf('pharmacy-sales-by-payment', `ventas-metodo-pago-${date}.pdf`, params)
  }

  downloadSalesByPaymentExcel(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadBlob('export/excel/pharmacy-sales-by-payment', `ventas-metodo-pago-${date}.xlsx`, params)
  }

  // ─── C6: Comparativo mensual ─────────────────────────────────────────────

  downloadMonthlySalesComparisonPdf(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadReportPdf('pharmacy-monthly-comparison', `comparativo-mensual-${date}.pdf`, params)
  }

  downloadMonthlySalesComparisonExcel(params: Record<string, string> = {}): Observable<Blob> {
    const date = todayLocalISO()
    return this.downloadBlob('export/excel/pharmacy-monthly-comparison', `comparativo-mensual-${date}.xlsx`, params)
  }
}
