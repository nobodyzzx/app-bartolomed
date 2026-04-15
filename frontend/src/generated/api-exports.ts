/**
 * Re-exports amigables de los tipos generados automáticamente desde el Swagger del backend.
 *
 * NO editar este archivo manualmente.
 * Para regenerar: npm run generate-types (requiere backend corriendo en :3000)
 *
 * Fuente: frontend/src/generated/api-types.ts (generado por openapi-typescript)
 */

import type { components } from './api-types'

// ─── Auth ────────────────────────────────────────────────────────────────────
export type ApiCreateUserDto = components['schemas']['CreateUserDto']
export type ApiLoginUserDto = components['schemas']['LoginUserDto']
export type ApiPersonalInfoDto = components['schemas']['PersonalInfoDto']
export type ApiProfessionalInfoDto = components['schemas']['ProfessionalInfoDto']

// ─── Entidades core ───────────────────────────────────────────────────────────
export type ApiUser = components['schemas']['User']
export type ApiPersonalInfo = components['schemas']['PersonalInfo']
export type ApiProfessionalInfo = components['schemas']['ProfessionalInfo']
export type ApiClinic = components['schemas']['Clinic']
export type ApiCreateClinicDto = components['schemas']['CreateClinicDto']
export type ApiAddClinicMemberDto = components['schemas']['AddClinicMemberDto']

// ─── Pacientes ────────────────────────────────────────────────────────────────
export type ApiPatient = components['schemas']['Patient']
export type ApiCreatePatientDto = components['schemas']['CreatePatientDto']
export type ApiUpdatePatientDto = components['schemas']['UpdatePatientDto']

// ─── Citas médicas ────────────────────────────────────────────────────────────
export type ApiAppointment = components['schemas']['Appointment']
export type ApiCreateAppointmentDto = components['schemas']['CreateAppointmentDto']
export type ApiUpdateAppointmentDto = components['schemas']['UpdateAppointmentDto']

// ─── Historial clínico ────────────────────────────────────────────────────────
export type ApiMedicalRecord = components['schemas']['MedicalRecord']
export type ApiCreateMedicalRecordDto = components['schemas']['CreateMedicalRecordDto']
export type ApiConsentForm = components['schemas']['ConsentForm']
export type ApiCreateConsentFormDto = components['schemas']['CreateConsentFormDto']

// ─── Prescripciones ───────────────────────────────────────────────────────────
export type ApiPrescription = components['schemas']['Prescription']
export type ApiCreatePrescriptionDto = components['schemas']['CreatePrescriptionDto']

// ─── Farmacia ─────────────────────────────────────────────────────────────────
export type ApiMedication = components['schemas']['Medication']
export type ApiMedicationStock = components['schemas']['MedicationStock']
export type ApiCreateMedicationDto = components['schemas']['CreateMedicationDto']
export type ApiCreateMedicationStockDto = components['schemas']['CreateMedicationStockDto']
export type ApiTransferStockDto = components['schemas']['TransferStockDto']
export type ApiSupplier = components['schemas']['Supplier']
export type ApiCreateSupplierDto = components['schemas']['CreateSupplierDto']
export type ApiPurchaseOrder = components['schemas']['PurchaseOrder']
export type ApiPurchaseOrderItem = components['schemas']['PurchaseOrderItem']
export type ApiCreatePurchaseOrderDto = components['schemas']['CreatePurchaseOrderDto']
export type ApiPharmacySale = components['schemas']['PharmacySale']
export type ApiPharmacySaleItem = components['schemas']['PharmacySaleItem']
export type ApiCreatePharmacySaleDto = components['schemas']['CreatePharmacySaleDto']
export type ApiPharmacyInvoice = components['schemas']['PharmacyInvoice']
export type ApiCreatePharmacyInvoiceDto = components['schemas']['CreatePharmacyInvoiceDto']

// ─── Facturación ──────────────────────────────────────────────────────────────
export type ApiInvoice = components['schemas']['Invoice']
export type ApiCreateInvoiceDto = components['schemas']['CreateInvoiceDto']
export type ApiCreateInvoiceItemDto = components['schemas']['CreateInvoiceItemDto']
export type ApiPayment = components['schemas']['Payment']
export type ApiCreatePaymentDto = components['schemas']['CreatePaymentDto']

// ─── Activos ──────────────────────────────────────────────────────────────────
export type ApiAsset = components['schemas']['Asset']
export type ApiCreateAssetDto = components['schemas']['CreateAssetDto']
export type ApiAssetMaintenance = components['schemas']['AssetMaintenance']
export type ApiAssetReport = components['schemas']['AssetReport']

// ─── Roles ────────────────────────────────────────────────────────────────────
export type ApiRole = components['schemas']['Role']
