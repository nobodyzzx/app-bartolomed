import { Injectable } from '@angular/core'
import { AlertService } from '@core/services/alert.service'
import { User } from '../../../../auth/interfaces/user.interface'
import { Patient } from '../../patients/interfaces'

export interface SummaryPrintData {
  patient: Patient | undefined
  doctor: User | undefined
  recordType: string
  isEmergency: boolean
  chiefComplaint: string
  clinicalData: Record<string, any>
  evaluation: Record<string, any>
}

@Injectable({ providedIn: 'root' })
export class ConsentTemplatesService {
  constructor(private alert: AlertService) {}

  printConsent(
    patient: Patient | undefined,
    doctor: User | undefined,
    consentFormValue: Record<string, any>,
  ): void {
    const c = consentFormValue
    const template: string = c['printTemplate'] || 'diagnostic'

    let consentDate: Date
    if (c['consentDate']) {
      const d = new Date(c['consentDate'])
      if (c['consentTime']) {
        const [hh, mm] = String(c['consentTime']).split(':')
        d.setHours(Number(hh) || 0, Number(mm) || 0, 0, 0)
      } else {
        const now = new Date()
        d.setHours(now.getHours(), now.getMinutes(), 0, 0)
      }
      consentDate = d
    } else {
      consentDate = new Date()
    }
    const formattedConsentDate = this.formatDateTime(consentDate)

    const today = new Date()
    const expedienteNumber = `EM-${today.getFullYear()}${this.pad2(today.getMonth() + 1)}${this.pad2(today.getDate())}-${Math.floor(1000 + Math.random() * 9000)}`

    const patientName = patient ? `${patient.firstName} ${patient.lastName}` : ''
    const patientDoc = patient?.documentNumber || ''
    const birthDate = patient?.birthDate ? this.formatDate(new Date(patient.birthDate)) : ''
    const addressPhone = [patient?.address, patient?.phone].filter(Boolean).join(' · ')

    const doctorName = doctor
      ? `${doctor.personalInfo?.firstName || ''} ${doctor.personalInfo?.lastName || ''}`.trim()
      : ''
    const doctorLicense = doctor?.professionalInfo?.license || ''

    const procedureName = c['procedureName'] || ''
    const objective = c['objective'] || ''
    const risks = c['risks'] || ''
    const benefits = c['benefits'] || ''
    const freeDescription = c['description'] || ''
    const signedBy = c['signedBy'] || patientName

    const logoUrl = `${window.location.origin}/assets/images/logo-big-horizontal-bartolomed.png`

    const htmlDiagnostic = `
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Consentimiento Informado</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; }
    h1 { font-size: 20px; margin: 0 0 8px; color: #0f172a; }
    h2 { font-size: 14px; margin: 20px 0 6px; color: #0f172a; }
    p, li, td { font-size: 12px; line-height: 1.45; }
    .muted { color: #475569; }
    .small { font-size: 11px; }
    .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #fff; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .row { display: flex; gap: 12px; align-items: flex-start; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 600; }
    .titlebar { display:flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .brand { font-weight: 700; font-size: 14px; color: #0ea5e9; }
    .logo { height: 40px; object-fit: contain; }
    .section { margin-top: 12px; }
    .sign { height: 60px; border-bottom: 1px solid #cbd5e1; margin-bottom: 4px; }
  </style>
  </head>
  <body>
    <div class="titlebar">
      <div>
        <h1>Consentimiento Informado para Procedimiento Diagnóstico (Bajo Riesgo)</h1>
        <div class="small muted">N° Expediente: ${expedienteNumber}</div>
        <div class="small muted">Fecha y hora del consentimiento: ${formattedConsentDate}</div>
      </div>
      <div>
        <img class="logo" src="${logoUrl}" alt="Bartolomed Medical System" />
      </div>
    </div>

    <div class="card section">
      <table>
        <tr>
          <th style="width:40%">CAMPO A LLENAR (SOFTWARE)</th>
          <th>DATOS DEL PACIENTE/REPRESENTANTE</th>
        </tr>
        <tr>
          <td><strong>Nombre Completo del Paciente</strong></td>
          <td>${patientName}</td>
        </tr>
        <tr>
          <td><strong>Nro. Cédula de Identidad/Pasaporte</strong></td>
          <td>${patientDoc}</td>
        </tr>
        <tr>
          <td><strong>Fecha de Nacimiento</strong></td>
          <td>${birthDate}</td>
        </tr>
        <tr>
          <td><strong>Domicilio y Teléfono</strong></td>
          <td>${addressPhone}</td>
        </tr>
        <tr>
          <td><strong>Representante Legal (si aplica)</strong></td>
          <td>${signedBy && signedBy !== patientName ? signedBy : ''}</td>
        </tr>
        <tr>
          <td><strong>Nro. C.I. del Representante</strong></td>
          <td></td>
        </tr>
      </table>
    </div>

    <div class="section card">
      <p><strong>Yo, ${signedBy || '_____________________________'}</strong>, con Nro. de C.I. <strong>${patientDoc || '________________'}</strong>, en calidad de <strong>${signedBy && signedBy !== patientName ? 'Representante Legal/Familiar' : 'Paciente'}</strong>, DECLARO:</p>
      <ol>
        <li>Que el Dr(a)./Lic. <strong>${doctorName || '_____________________________'}</strong>, con matrícula <strong>${doctorLicense || '____________'}</strong>, me ha informado de manera clara y comprensible sobre la necesidad de realizar el siguiente procedimiento: <strong>${procedureName || '_____________________________'}</strong>.</li>
        <li>Que he entendido que el objetivo de este procedimiento es <strong>${objective || (freeDescription ? freeDescription : '_____________________________')}</strong>.</li>
        <li>Que me han explicado los riesgos más comunes asociados a este procedimiento, tales como <strong>${risks || '_____________________________'}</strong>, y sus beneficios esperados <strong>${benefits || '_____________________________'}</strong>.</li>
        <li>Que he tenido la oportunidad de hacer preguntas y que todas han sido respondidas a mi satisfacción.</li>
        <li>Que entiendo que este consentimiento es voluntario y que puedo revocarlo en cualquier momento antes de la realización del procedimiento.</li>
      </ol>
      <p><strong>Por lo expuesto, OTORGO</strong> mi consentimiento libre y voluntario para que se me realice el procedimiento diagnóstico mencionado.</p>
    </div>

    <div class="section card">
      <table>
        <tr>
          <th>FIRMAS</th>
          <th></th>
        </tr>
        <tr>
          <td>
            <div class="sign"></div>
            <div class="small">Firma del Paciente/Representante Legal</div>
            <div class="small muted">Aclaración de Firma: ${signedBy || patientName}</div>
            <div class="small muted">Fecha: ${formattedConsentDate}</div>
          </td>
          <td>
            <div class="sign"></div>
            <div class="small">Firma del Médico/Profesional Informante</div>
            <div class="small muted">Aclaración de Firma: ${doctorName}</div>
            <div class="small muted">Matrícula: ${doctorLicense}</div>
          </td>
        </tr>
      </table>
    </div>
    <div class="small muted section">Documento generado por Bartolomed Medical System. Este formato sigue la normativa boliviana de consentimiento informado para procedimientos diagnósticos de bajo riesgo.</div>
  </body>
</html>`

    const htmlSurgery = `
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Consentimiento Informado para Intervención Quirúrgica</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; }
    h1 { font-size: 20px; margin: 0 0 8px; color: #0f172a; }
    p, li, td { font-size: 12px; line-height: 1.45; }
    .muted { color: #475569; }
    .small { font-size: 11px; }
    .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #fff; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 600; }
    .titlebar { display:flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .brand { font-weight: 700; font-size: 14px; color: #0ea5e9; }
    .logo { height: 40px; object-fit: contain; }
    .section { margin-top: 12px; }
    .sign { height: 60px; border-bottom: 1px solid #cbd5e1; margin-bottom: 4px; }
  </style>
  </head>
  <body>
    <div class="titlebar">
      <div>
        <h1>Consentimiento Informado para Intervención Quirúrgica</h1>
        <div class="small muted">N° Expediente: ${expedienteNumber}</div>
        <div class="small muted">Fecha y hora: ${formattedConsentDate}</div>
      </div>
      <div>
        <img class="logo" src="${logoUrl}" alt="Bartolomed Medical System" />
      </div>
    </div>

    <div class="card section">
      <table>
        <tr>
          <th style="width:40%">CAMPO A LLENAR (SOFTWARE)</th>
          <th>DATOS DE IDENTIFICACIÓN</th>
        </tr>
        <tr><td><strong>Nombre Completo del Paciente</strong></td><td>${patientName}</td></tr>
        <tr><td><strong>Nro. C.I. del Paciente</strong></td><td>${patientDoc}</td></tr>
        <tr><td><strong>Diagnóstico Clínico Actual</strong></td><td>${c['surgicalDiagnosis'] || ''}</td></tr>
        <tr><td><strong>Nombre de la Intervención Quirúrgica Propuesta</strong></td><td>${c['surgicalProcedureName'] || c['procedureName'] || ''}</td></tr>
        <tr><td><strong>Nombre del Cirujano Principal</strong></td><td>${c['leadSurgeonName'] || doctorName}</td></tr>
      </table>
    </div>

    <div class="section card">
      <p><strong>Yo, ${signedBy || patientName}</strong>, con Nro. de C.I. <strong>${patientDoc || '________________'}</strong>, en calidad de <strong>${signedBy && signedBy !== patientName ? 'Representante Legal' : 'Paciente'}</strong>, CERTIFICO que el Dr(a). <strong>${c['leadSurgeonName'] || doctorName}</strong>, con Matrícula <strong>${doctorLicense || '____________'}</strong>, me ha explicado lo siguiente:</p>
      <ol>
        <li><strong>Enfermedad y Tratamiento Propuesto:</strong> Se me ha explicado mi condición de salud, el diagnóstico de <strong>${c['surgicalDiagnosis'] || ''}</strong>, y la necesidad de realizar la Intervención Quirúrgica denominada <strong>${c['surgicalProcedureName'] || c['procedureName'] || ''}</strong>.</li>
        <li><strong>Objetivo:</strong> El propósito de la cirugía es <strong>${c['surgeryObjective'] || c['objective'] || ''}</strong>.</li>
        <li><strong>Riesgos y Complicaciones:</strong> He sido informado(a) detalladamente de los riesgos comunes (ej. dolor, infección de herida, sangrado), graves o poco comunes (ej. lesión de órganos adyacentes, necesidad de transfusión, riesgo de muerte), y de las posibles complicaciones post-operatorias.</li>
        <li><strong>Alternativas y Riesgo de No Operar:</strong> Se me ha informado sobre <strong>${c['surgicalAlternatives'] || ''}</strong> y los riesgos de no realizar la cirugía, siendo estos <strong>${c['consequencesNoSurgery'] || ''}</strong>.</li>
        <li><strong>Procedimientos Adicionales:</strong> Autorizo a que se realicen otros procedimientos no previstos inicialmente, siempre que el equipo médico los considere necesarios e indispensables para preservar mi vida o evitar secuelas graves.</li>
      </ol>
      <p><strong>Por la presente, AUTORIZO</strong> la realización de la Intervención Quirúrgica <strong>${c['surgicalProcedureName'] || c['procedureName'] || ''}</strong>, el uso de anestesia, y la participación de personal de apoyo.</p>
    </div>

    <div class="section card">
      <table>
        <tr><th>FIRMAS</th><th></th></tr>
        <tr>
          <td>
            <div class="sign"></div>
            <div class="small">Firma del Paciente/Representante Legal</div>
            <div class="small muted">Aclaración de Firma: ${signedBy || patientName}</div>
            <div class="small muted">Fecha y Hora: ${formattedConsentDate}</div>
          </td>
          <td>
            <div class="sign"></div>
            <div class="small">Firma del Cirujano Principal</div>
            <div class="small muted">Aclaración de Firma: ${c['leadSurgeonName'] || doctorName}</div>
          </td>
        </tr>
        <tr>
          <td colspan="2" class="small muted">Testigo (Opcional): ${c['surgeryWitnessName'] || ''} ${c['surgeryWitnessCi'] ? '(C.I. ' + c['surgeryWitnessCi'] + ')' : ''}</td>
        </tr>
      </table>
    </div>
    <div class="small muted section">Documento generado por Bartolomed Medical System.</div>
  </body>
</html>`

    const htmlTransfusion = `
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Consentimiento Informado para Transfusión Sanguínea</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; }
    h1 { font-size: 20px; margin: 0 0 8px; color: #0f172a; }
    p, li, td { font-size: 12px; line-height: 1.45; }
    .muted { color: #475569; }
    .small { font-size: 11px; }
    .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #fff; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 600; }
    .titlebar { display:flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .brand { font-weight: 700; font-size: 14px; color: #0ea5e9; }
    .logo { height: 40px; object-fit: contain; }
    .section { margin-top: 12px; }
    .sign { height: 60px; border-bottom: 1px solid #cbd5e1; margin-bottom: 4px; }
  </style>
  </head>
  <body>
    <div class="titlebar">
      <div>
        <h1>Consentimiento Informado para Transfusión Sanguínea</h1>
        <div class="small muted">N° Expediente: ${expedienteNumber}</div>
        <div class="small muted">Fecha y hora: ${formattedConsentDate}</div>
      </div>
      <div>
        <img class="logo" src="${logoUrl}" alt="Bartolomed Medical System" />
      </div>
    </div>

    <div class="card section">
      <table>
        <tr><th style="width:40%">CAMPO A LLENAR (SOFTWARE)</th><th>DATOS DEL PACIENTE</th></tr>
        <tr><td><strong>Nombre Completo del Paciente</strong></td><td>${patientName}</td></tr>
        <tr><td><strong>Nro. C.I. del Paciente</strong></td><td>${patientDoc}</td></tr>
        <tr><td><strong>Diagnóstico/Indicación para Transfusión</strong></td><td>${c['transfusionDiagnosis'] || ''}</td></tr>
        <tr><td><strong>Tipo de Hemoderivado</strong></td><td>${c['bloodProductType'] || ''}</td></tr>
      </table>
    </div>

    <div class="section card">
      <p><strong>Yo, ${signedBy || patientName}</strong>, con Nro. de C.I. <strong>${patientDoc || '________________'}</strong>, en calidad de <strong>${signedBy && signedBy !== patientName ? 'Representante Legal' : 'Paciente'}</strong>, DECLARO:</p>
      <ol>
        <li>Que el Dr(a). <strong>${c['treatingPhysicianName'] || doctorName}</strong> me ha informado que mi estado de salud requiere una <strong>Transfusión Sanguínea</strong> (o de hemoderivados) para tratar <strong>${c['transfusionDiagnosis'] || ''}</strong>.</li>
        <li><strong>Riesgos Conocidos:</strong> He sido informado(a) de los riesgos potenciales, incluyendo, pero no limitándose a, reacciones alérgicas leves (fiebre, escalofríos), y reacciones graves (reacciones hemolíticas agudas, transmisión de enfermedades infecciosas - riesgo mínimo).</li>
        <li><strong>Beneficios y Alternativas:</strong> El beneficio principal es <strong>${c['transfusionBenefits'] || ''}</strong>. Se me ha indicado que las alternativas son <strong>${c['transfusionAlternatives'] || ''}</strong>.</li>
        <li>Comprendo que, en caso de urgencia vital, el médico podrá proceder a la transfusión si no fuera posible obtener mi consentimiento o el de mi representante a tiempo.</li>
      </ol>
      <p><strong>Por lo anterior, ACEPTO</strong> libre y voluntariamente la Transfusión de Sangre y/o Hemoderivados.</p>
    </div>

    <div class="section card">
      <table>
        <tr><th>FIRMAS</th><th></th></tr>
        <tr>
          <td>
            <div class="sign"></div>
            <div class="small">Firma del Paciente/Representante Legal</div>
            <div class="small muted">Aclaración de Firma: ${signedBy || patientName}</div>
            <div class="small muted">Fecha y Hora: ${formattedConsentDate}</div>
          </td>
          <td>
            <div class="sign"></div>
            <div class="small">Firma del Médico Tratante</div>
            <div class="small muted">Aclaración de Firma: ${c['treatingPhysicianName'] || doctorName}</div>
            <div class="small muted">Matrícula: ${doctorLicense}</div>
          </td>
        </tr>
      </table>
    </div>
    <div class="small muted section">Documento generado por Bartolomed Medical System.</div>
  </body>
</html>`

    const htmlRejection = `
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Documento de Rechazo o Revocación de Indicación Médica</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; }
    h1 { font-size: 20px; margin: 0 0 8px; color: #0f172a; }
    p, li, td { font-size: 12px; line-height: 1.45; }
    .muted { color: #475569; }
    .small { font-size: 11px; }
    .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #fff; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 600; }
    .titlebar { display:flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .brand { font-weight: 700; font-size: 14px; color: #0ea5e9; }
    .logo { height: 40px; object-fit: contain; }
    .section { margin-top: 12px; }
    .sign { height: 60px; border-bottom: 1px solid #cbd5e1; margin-bottom: 4px; }
  </style>
  </head>
  <body>
    <div class="titlebar">
      <div>
        <h1>Documento de Rechazo o Revocación de Indicación Médica</h1>
        <div class="small muted">N° Expediente: ${expedienteNumber}</div>
        <div class="small muted">Lugar y Fecha: ${c['rejectionCity'] || ''}, ${formattedConsentDate}</div>
      </div>
      <div>
        <img class="logo" src="${logoUrl}" alt="Bartolomed Medical System" />
      </div>
    </div>

    <div class="card section">
      <table>
        <tr><th style="width:40%">CAMPO A LLENAR (SOFTWARE/MÉDICO)</th><th>INFORMACIÓN REQUERIDA</th></tr>
        <tr><td><strong>Nombre del Establecimiento de Salud</strong></td><td>${c['clinicName'] || ''}</td></tr>
        <tr><td><strong>Nro. de Registro Clínico/Historia Clínica</strong></td><td>${c['clinicalRecordNumber'] || ''}</td></tr>
        <tr><td><strong>Nombre Completo del Paciente</strong></td><td>${patientName}</td></tr>
        <tr><td><strong>Nro. de Cédula de Identidad/Pasaporte</strong></td><td>${patientDoc}</td></tr>
        <tr><td><strong>Nombre del Acto Médico o Tratamiento Rechazado</strong></td><td>${c['rejectedActName'] || ''}</td></tr>
        <tr><td><strong>Nombre del Médico Tratante/Informante</strong></td><td>${c['informingPhysicianName'] || doctorName}</td></tr>
      </table>
    </div>

    <div class="section card">
      <p><strong>Yo, ${signedBy || patientName}</strong>, con C.I. <strong>${patientDoc || '________________'}</strong>, en calidad de <strong>${signedBy && signedBy !== patientName ? 'Representante Legal' : 'Paciente'}</strong>, DECLARO BAJO JURAMENTO:</p>
      <ol>
        <li><strong>Indicación Médica:</strong> El Dr(a). <strong>${c['informingPhysicianName'] || doctorName}</strong> me ha informado sobre mi condición de salud (Diagnóstico: <strong>${c['rejectionDiagnosis'] || ''}</strong>) y me ha indicado el siguiente procedimiento/tratamiento como necesario: <strong>${c['rejectedActName'] || ''}</strong>.</li>
        <li><strong>Información Recibida:</strong> El médico me ha explicado clara y comprensiblemente los beneficios del tratamiento propuesto, y las consecuencias directas y previsibles de mi rechazo, siendo estas: <strong>${c['rejectionConsequences'] || ''}</strong>.</li>
        <li><strong>Decisión Voluntaria:</strong> A pesar de haber comprendido los beneficios y riesgos que implica mi decisión, <strong>HE DECIDIDO LIBRE Y VOLUNTARIAMENTE RECHAZAR/REVOCAR</strong> el tratamiento/procedimiento médico antes mencionado.</li>
        <li><strong>Exoneración de Responsabilidad:</strong> <strong>EXONERO</strong> al médico tratante, al equipo de salud y al establecimiento sanitario de toda responsabilidad que pudiera derivarse de la negativa a someterme al tratamiento o procedimiento, asumiendo yo mismo(a) las consecuencias de mi decisión.</li>
      </ol>
    </div>

    <div class="section card">
      <table>
        <tr><th>FIRMAS</th><th>PROFESIONAL DE SALUD INFORMANDO</th><th>TESTIGO (Obligatorio en Rechazo)</th></tr>
        <tr>
          <td>
            <div class="sign"></div>
            <div class="small">Firma/Huella Digital (Paciente/Representante)</div>
            <div class="small muted">Nombre: ${signedBy || patientName}</div>
            <div class="small muted">C.I.: ${patientDoc}</div>
          </td>
          <td>
            <div class="sign"></div>
            <div class="small">Firma del Médico/Profesional</div>
            <div class="small muted">Nombre: ${c['informingPhysicianName'] || doctorName}</div>
            <div class="small muted">Matrícula: ${doctorLicense}</div>
          </td>
          <td>
            <div class="sign"></div>
            <div class="small">Firma del Testigo</div>
            <div class="small muted">Nombre: ${c['witnessName'] || ''}</div>
            <div class="small muted">C.I.: ${c['witnessCi'] || ''}</div>
          </td>
        </tr>
      </table>
    </div>
    <div class="small muted section">Documento generado por Bartolomed Medical System.</div>
  </body>
</html>`

    let html = htmlDiagnostic
    if (template === 'surgery') html = htmlSurgery
    else if (template === 'blood_transfusion') html = htmlTransfusion
    else if (template === 'rejection') html = htmlRejection

    this.printHtml(html)
  }

  printMedicalRecordSummary(data: SummaryPrintData): void {
    const { patient, doctor, recordType, isEmergency, chiefComplaint, clinicalData: c, evaluation: e } = data
    const now = new Date()
    const printedAt = this.formatDateTime(now)

    const patientName = patient ? `${patient.firstName} ${patient.lastName}` : ''
    const patientDoc = patient?.documentNumber || ''
    const patientBirth = patient?.birthDate ? this.formatDate(new Date(patient.birthDate)) : ''
    const doctorName = doctor
      ? `${doctor.personalInfo?.firstName || ''} ${doctor.personalInfo?.lastName || ''}`.trim()
      : ''
    const doctorLicense = doctor?.professionalInfo?.license || ''

    const vit = {
      temperature: c['temperature'],
      systolicBP: c['systolicBP'],
      diastolicBP: c['diastolicBP'],
      heartRate: c['heartRate'],
      respiratoryRate: c['respiratoryRate'],
      oxygenSaturation: c['oxygenSaturation'],
      weight: c['weight'],
      height: c['height'],
    }

    const logoUrl = `${window.location.origin}/assets/images/logo-big-horizontal-bartolomed.png`

    const html = `
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Resumen de Expediente Médico</title>
  <style>
    @page { size: A4; margin: 16mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; }
    h1 { font-size: 20px; margin: 0 0 8px; color: #0f172a; }
    h2 { font-size: 14px; margin: 18px 0 8px; color: #0f172a; }
    p, li, td { font-size: 12px; line-height: 1.45; }
    small { color: #475569; }
    .muted { color: #475569; }
    .small { font-size: 11px; }
    .titlebar { display:flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .logo { height: 38px; object-fit: contain; }
    .tag { display:inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; border:1px solid #cbd5e1; background:#f1f5f9; color:#0f172a; }
    .tag.emerg { border-color:#fecaca; background:#fee2e2; color:#991b1b; }
    .card { border:1px solid #e2e8f0; border-radius: 8px; padding: 10px; background:#fff; margin-top:10px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f8fafc; font-weight: 600; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
  </style>
  </head>
  <body>
    <div class="titlebar">
      <div>
        <h1>Resumen del Expediente Médico</h1>
        <div class="small muted">Fecha de impresión: ${printedAt}</div>
      </div>
      <div>
        <img class="logo" src="${logoUrl}" alt="Bartolomed Medical System" />
      </div>
    </div>

    <div class="card">
      <h2>Datos del Paciente</h2>
      <div class="grid2">
        <div><strong>Nombre</strong><br/>${patientName || ''}</div>
        <div><strong>Cédula / Pasaporte</strong><br/>${patientDoc || ''}</div>
      </div>
      <div class="grid2" style="margin-top:6px;">
        <div><strong>Fecha de Nacimiento</strong><br/>${patientBirth || ''}</div>
        <div><strong>Profesional Responsable</strong><br/>${doctorName || ''} ${doctorLicense ? '(Mat. ' + doctorLicense + ')' : ''}</div>
      </div>
    </div>

    <div class="card">
      <h2>Consulta</h2>
      <div class="grid2">
        <div><strong>Tipo</strong><br/><span class="tag ${isEmergency ? 'emerg' : ''}">${recordType}</span></div>
        <div><strong>Emergencia</strong><br/>${isEmergency ? 'Sí' : 'No'}</div>
      </div>
      <div style="margin-top:6px;"><strong>Motivo de Consulta</strong><br/>${chiefComplaint || ''}</div>
    </div>

    <div class="card">
      <h2>Historia Clínica</h2>
      <div class="grid2">
        <div><strong>Historia de la Enfermedad Actual</strong><br/>${c['historyOfPresentIllness'] || ''}</div>
        <div><strong>Antecedentes Médicos</strong><br/>${c['pastMedicalHistory'] || ''}</div>
      </div>
      <div class="grid2" style="margin-top:6px;">
        <div><strong>Medicamentos</strong><br/>${c['medications'] || ''}</div>
        <div><strong>Alergias</strong><br/>${c['allergies'] || ''}</div>
      </div>
      <div class="grid2" style="margin-top:6px;">
        <div><strong>Historia Social</strong><br/>${c['socialHistory'] || ''}</div>
        <div><strong>Historia Familiar</strong><br/>${c['familyHistory'] || ''}</div>
      </div>
      <div style="margin-top:6px;"><strong>Revisión por Sistemas</strong><br/>${c['reviewOfSystems'] || ''}</div>
    </div>

    <div class="card">
      <h2>Signos Vitales</h2>
      <table>
        <tr>
          <th>Temperatura</th><th>PA Sistólica</th><th>PA Diastólica</th><th>Frec. Cardíaca</th><th>Frec. Respiratoria</th><th>Sat. O₂</th><th>Peso</th><th>Altura</th>
        </tr>
        <tr>
          <td>${vit.temperature ? vit.temperature + ' °C' : ''}</td>
          <td>${vit.systolicBP ? vit.systolicBP + ' mmHg' : ''}</td>
          <td>${vit.diastolicBP ? vit.diastolicBP + ' mmHg' : ''}</td>
          <td>${vit.heartRate ? vit.heartRate + ' lpm' : ''}</td>
          <td>${vit.respiratoryRate ? vit.respiratoryRate + ' rpm' : ''}</td>
          <td>${vit.oxygenSaturation ? vit.oxygenSaturation + ' %' : ''}</td>
          <td>${vit.weight ? vit.weight + ' kg' : ''}</td>
          <td>${vit.height ? vit.height + ' cm' : ''}</td>
        </tr>
      </table>
      <div class="small muted" style="margin-top:6px;">Valores vacíos no fueron registrados.</div>
    </div>

    <div class="card">
      <h2>Examen Físico</h2>
      <div><strong>Resumen</strong><br/>${e['physicalExamination'] || ''}</div>
      <div class="grid3" style="margin-top:6px;">
        <div><strong>Apariencia General</strong><br/>${e['generalAppearance'] || ''}</div>
        <div><strong>HEENT</strong><br/>${e['heent'] || ''}</div>
        <div><strong>Cardiovascular</strong><br/>${e['cardiovascular'] || ''}</div>
      </div>
      <div class="grid3" style="margin-top:6px;">
        <div><strong>Respiratorio</strong><br/>${e['respiratory'] || ''}</div>
        <div><strong>Abdominal</strong><br/>${e['abdominal'] || ''}</div>
        <div><strong>Neurológico</strong><br/>${e['neurological'] || ''}</div>
      </div>
      <div class="grid3" style="margin-top:6px;">
        <div><strong>Musculoesquelético</strong><br/>${e['musculoskeletal'] || ''}</div>
        <div><strong>Piel</strong><br/>${e['skin'] || ''}</div>
        <div></div>
      </div>
    </div>

    <div class="card">
      <h2>Evaluación y Plan</h2>
      <div><strong>Evaluación</strong><br/>${e['assessment'] || ''}</div>
      <div class="grid2" style="margin-top:6px;">
        <div><strong>Diagnóstico Principal</strong><br/>${e['diagnosis'] || ''}</div>
        <div><strong>Diagnóstico Diferencial</strong><br/>${e['differentialDiagnosis'] || ''}</div>
      </div>
      <div class="grid2" style="margin-top:6px;">
        <div><strong>Plan de Tratamiento</strong><br/>${e['treatmentPlan'] || ''}</div>
        <div><strong>Instrucciones de Seguimiento</strong><br/>${e['followUpInstructions'] || ''}</div>
      </div>
      <div class="grid2" style="margin-top:6px;">
        <div><strong>Educación al Paciente</strong><br/>${e['patientEducation'] || ''}</div>
        <div><strong>Fecha de Seguimiento</strong><br/>${e['followUpDate'] ? this.formatDate(new Date(e['followUpDate'])) : ''}</div>
      </div>
      <div style="margin-top:8px;"><strong>Notas</strong><br/>${e['notes'] || ''}</div>
    </div>

    <div class="small muted" style="margin-top:10px;">Documento generado por Bartolomed Medical System.</div>
  </body>
</html>`

    this.printHtml(html)
  }

  printHtml(html: string): void {
    try {
      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      iframe.setAttribute('aria-hidden', 'true')

      // Registrar onload ANTES de asignar srcdoc para no perder el evento
      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus()
          iframe.contentWindow?.print()
        } finally {
          setTimeout(() => {
            iframe.parentNode?.removeChild(iframe)
          }, 1500)
        }
      }

      iframe.srcdoc = html
      document.body.appendChild(iframe)
    } catch {
      this.alert.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo preparar la impresión. Intente nuevamente.',
        confirmButtonText: 'Aceptar',
      })
    }
  }

  private pad2(n: number): string {
    return n.toString().padStart(2, '0')
  }

  formatDate(d: Date): string {
    const dd = this.pad2(d.getDate())
    const mm = this.pad2(d.getMonth() + 1)
    const yyyy = d.getFullYear()
    return `${dd}/${mm}/${yyyy}`
  }

  formatDateTime(d: Date): string {
    const date = this.formatDate(d)
    const HH = this.pad2(d.getHours())
    const MM = this.pad2(d.getMinutes())
    return `${date} ${HH}:${MM}`
  }
}
