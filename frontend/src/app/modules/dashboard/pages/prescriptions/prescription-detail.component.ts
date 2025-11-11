import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { PrescriptionsService } from './prescriptions.service'

@Component({
  selector: 'app-prescription-detail',
  templateUrl: './prescription-detail.component.html',
  styleUrls: ['./prescription-detail.component.css'],
})
export class PrescriptionDetailComponent implements OnInit {
  loading = false
  prescription: any

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private svc: PrescriptionsService,
    private alert: AlertService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!
    this.fetch(id)
  }

  fetch(id: string) {
    this.loading = true
    this.svc.get(id).subscribe({
      next: p => {
        this.loading = false
        this.prescription = p
      },
      error: () => (this.loading = false),
    })
  }

  goBack() {
    this.router.navigate(['../list'], { relativeTo: this.route })
  }

  getDaysUntilExpiry(dateStr: string): number {
    const today = new Date()
    const expiry = new Date(dateStr)
    const diffTime = expiry.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  isExpired(dateStr: string): boolean {
    return this.getDaysUntilExpiry(dateStr) <= 0
  }

  getStatusBadgeClass(status: string): string {
    const classes: any = {
      draft: 'bg-slate-100 text-slate-700',
      active: 'bg-emerald-100 text-emerald-700',
      dispensed: 'bg-blue-100 text-blue-700',
      completed: 'bg-purple-100 text-purple-700',
      cancelled: 'bg-red-100 text-red-700',
      expired: 'bg-orange-100 text-orange-700',
    }
    return classes[status] || 'bg-slate-100 text-slate-700'
  }

  canRefill(p: any): boolean {
    return (
      p?.status === 'active' &&
      !this.isExpired(p?.expiryDate) &&
      (p?.refillsAllowed || 0) > (p?.refillsUsed || 0)
    )
  }

  changeStatus(status: string) {
    this.alert
      .fire({
        icon: 'question',
        title: '¿Confirmar cambio de estado?',
        text: `La receta pasará a estado ${status}.`,
        showCancelButton: true,
        confirmButtonText: 'Confirmar',
        cancelButtonText: 'Cancelar',
      })
      .then(res => {
        if (res.isConfirmed) {
          this.svc.setStatus(this.prescription.id, status).subscribe({
            next: () => {
              this.alert
                .success('Estado actualizado', 'La receta fue actualizada.')
                .then(() => this.fetch(this.prescription.id))
            },
          })
        }
      })
  }

  doRefill() {
    this.alert
      .fire({
        icon: 'question',
        title: '¿Agregar resurtido?',
        text: 'Se incrementará el contador de resurtidos.',
        showCancelButton: true,
        confirmButtonText: 'Confirmar',
        cancelButtonText: 'Cancelar',
      })
      .then(res => {
        if (res.isConfirmed) {
          this.svc.refill(this.prescription.id).subscribe({
            next: () => {
              this.alert
                .success('Resurtido registrado', 'La receta fue resurtida.')
                .then(() => this.fetch(this.prescription.id))
            },
          })
        }
      })
  }

  // --- Impresión ---
  async print() {
    if (!this.prescription) return

    const p = this.prescription

    // QR functionality removed: imprimir sin código QR

    const fmt = (d: any) => {
      if (!d) return ''
      const dt = new Date(d)
      const dd = String(dt.getDate()).padStart(2, '0')
      const mm = String(dt.getMonth() + 1).padStart(2, '0')
      const yyyy = dt.getFullYear()
      return `${dd}/${mm}/${yyyy}`
    }

    const clinicName = p.clinic?.name || 'Clínica'
    const clinicAddress = p.clinic?.address || ''
    const clinicPhone = p.clinic?.phone || ''
    const clinicEmail = p.clinic?.email || ''
    // Si hubiera NIT u otros, podrían venir en description u otro campo
    const nit = ''
    const doctor = p.doctor || {}
    const doctorName = doctor?.personalInfo?.firstName
      ? `${doctor.personalInfo.firstName} ${doctor.personalInfo.lastName || ''}`.trim()
      : doctor?.email || ''
    const patientName = `${p.patient?.firstName || ''} ${p.patient?.lastName || ''}`.trim()
    const signatureUrl =
      (doctor?.professionalInfo as any)?.signatureUrl ||
      (doctor?.id ? `/assets/signatures/${doctor.id}.png` : '')

    const itemsRows = (p.items || [])
      .map(
        (it: any, idx: number) => `
        <tr>
          <td>${idx + 1}</td>
          <td>
            <div><strong>${it.medicationName || ''} ${it.strength || ''}</strong></div>
            <div class="muted">${it.dosage || ''} • ${it.frequency || ''}</div>
          </td>
          <td>${it.quantity || ''}</td>
          <td>${it.route || ''}</td>
          <td>${it.duration ? it.duration + ' días' : ''}</td>
          <td>${it.instructions || ''}</td>
        </tr>`,
      )
      .join('')

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receta ${p.prescriptionNumber || ''}</title>
  <base href="${location.origin}/" />
  <style>
    @page { margin: 18mm; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"; color: #0f172a; }
    .muted { color: #64748b; font-size: 11px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 16px; }
    .clinic h1 { margin: 0; font-size: 20px; }
    .clinic .muted { margin-top: 2px; }
    .meta { text-align:right; font-size: 12px; }
  .logo { width: 64px; height: 64px; object-fit: contain; margin-right: 12px; }
  .header-left { display:flex; align-items:center; }
    .box { border:1px solid #e2e8f0; border-radius:10px; padding:12px; margin-top: 8px; }
    .section-title { font-weight: 600; font-size: 14px; margin: 18px 0 8px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border:1px solid #e2e8f0; padding:8px; font-size: 12px; vertical-align: top; }
    th { background:#f8fafc; text-align:left; }
  .signs { display:flex; justify-content:space-between; margin-top: 40px; align-items:flex-end; }
  .line { border-top: 1px solid #94a3b8; width: 48%; padding-top: 6px; text-align: center; font-size: 12px; color:#64748b; }
  .signature { max-width: 220px; max-height: 100px; object-fit: contain; margin: 0 auto 8px; display:block; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <img class="logo" src="/assets/images/logo-bartolomed.png" onerror="this.onerror=null;this.src='/assets/images/logo-horizontal-bartolomed.webp'" alt="logo" />
      <div class="clinic">
        <h1>${clinicName}</h1>
        <div class="muted">${clinicAddress}</div>
        <div class="muted">${clinicPhone}${clinicEmail ? ' • ' + clinicEmail : ''}</div>
        ${nit ? `<div class="muted">NIT: ${nit}</div>` : ''}
      </div>
    </div>
    <div class="meta">
      <div><strong>Receta:</strong> ${p.prescriptionNumber || ''}</div>
      <div><strong>Emisión:</strong> ${fmt(p.prescriptionDate)}</div>
      <div><strong>Expira:</strong> ${fmt(p.expiryDate)}</div>
      <div><strong>Estado:</strong> ${(p.status || '').toUpperCase()}</div>
    </div>
  </div>

  <!-- QR removed -->

  <div class="box">
    <div><strong>Paciente:</strong> ${patientName || '-'}</div>
    <div class="muted">CI: ${p.patient?.documentNumber || '-'}</div>
  </div>

  <div class="box">
    <div><strong>Médico:</strong> ${doctorName || '-'}</div>
  </div>

  <div class="section-title">Medicamentos</div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Medicamento</th>
        <th>Cant.</th>
        <th>Vía</th>
        <th>Duración</th>
        <th>Instrucciones</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
  </table>

  ${p.diagnosis ? `<div class="section-title">Diagnóstico</div><div class="box">${p.diagnosis}</div>` : ''}
  ${p.patientInstructions ? `<div class="section-title">Indicaciones para el paciente</div><div class="box">${p.patientInstructions}</div>` : ''}
  ${p.pharmacyInstructions ? `<div class="section-title">Indicaciones para farmacia</div><div class="box">${p.pharmacyInstructions}</div>` : ''}
  ${p.notes ? `<div class="section-title">Notas</div><div class="box">${p.notes}</div>` : ''}

  <div class="signs">
    <div>
      <div class="line">Firma del paciente</div>
    </div>
    <div>
      ${signatureUrl ? `<img src="${signatureUrl}" alt="firma" class="signature" onerror="this.style.display='none'"/>` : ''}
      <div class="line">Firma y sello del médico</div>
    </div>
  </div>

  
</body>
</html>`

    // Usamos un iframe oculto para evitar bloqueos de popup e imprimir de forma confiable
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    // Cargar contenido
    iframe.srcdoc = html
    document.body.appendChild(iframe)

    const onLoad = () => {
      try {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
      } finally {
        // Quitar iframe luego de un breve lapso para permitir al diálogo de impresión abrirse
        setTimeout(() => {
          try {
            document.body.removeChild(iframe)
          } catch {}
        }, 1000)
      }
    }
    // onload de iframe asegura que el HTML y recursos estén listos
    iframe.onload = onLoad
  }

  copyVerificationLink() {
    // Verification link / QR removed from project
  }
  // ensureQrLib removed
}
