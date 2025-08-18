import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable } from 'rxjs';
import { MedicalRecord, ConsentForm, RecordStatus, RecordType } from '../interfaces';
import { MedicalRecordsService } from '../services/medical-records.service';

@Component({
  selector: 'app-medical-record-view',
  templateUrl: './medical-record-view.component.html',
  styleUrls: ['./medical-record-view.component.css']
})
export class MedicalRecordViewComponent implements OnInit {
  medicalRecord: MedicalRecord | null = null;
  consentForms: ConsentForm[] = [];
  loading = false;
  recordId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private medicalRecordsService: MedicalRecordsService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.recordId = this.route.snapshot.paramMap.get('id');
    if (this.recordId) {
      this.loadMedicalRecord();
      this.loadConsentForms();
    }
  }

  private loadMedicalRecord(): void {
    if (!this.recordId) return;
    
    this.loading = true;
    this.medicalRecordsService.getMedicalRecordById(this.recordId).subscribe({
      next: (record) => {
        this.medicalRecord = record;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error cargando expediente:', error);
        this.snackBar.open('Error al cargar el expediente médico', 'Cerrar', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  private loadConsentForms(): void {
    if (!this.recordId) return;
    
    this.medicalRecordsService.getConsentForms(this.recordId).subscribe({
      next: (consents) => {
        this.consentForms = consents;
      },
      error: (error) => {
        console.error('Error cargando consentimientos:', error);
      }
    });
  }

  editRecord(): void {
    if (this.recordId) {
      this.router.navigate(['/dashboard/medical-records', this.recordId, 'edit']);
    }
  }

  exportRecord(): void {
    if (!this.recordId) return;
    
    this.medicalRecordsService.exportMedicalRecord(this.recordId, 'pdf').subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `expediente-${this.medicalRecord?.patient?.lastName}-${this.medicalRecord?.patient?.firstName}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        console.error('Error exportando expediente:', error);
        this.snackBar.open('Error al exportar el expediente', 'Cerrar', { duration: 3000 });
      }
    });
  }

  downloadConsentDocument(consent: ConsentForm): void {
    if (!consent.id) return;
    
    this.medicalRecordsService.downloadConsentDocument(consent.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `consentimiento-${consent.consentType}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        console.error('Error descargando documento:', error);
        this.snackBar.open('Error al descargar el documento', 'Cerrar', { duration: 3000 });
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/medical-records']);
  }

  getStatusColor(status: RecordStatus): string {
    switch (status) {
      case RecordStatus.DRAFT:
        return 'warn';
      case RecordStatus.COMPLETED:
        return 'primary';
      case RecordStatus.REVIEWED:
        return 'accent';
      case RecordStatus.ARCHIVED:
        return 'basic';
      default:
        return 'basic';
    }
  }

  getStatusText(status: RecordStatus): string {
    switch (status) {
      case RecordStatus.DRAFT:
        return 'Borrador';
      case RecordStatus.COMPLETED:
        return 'Completado';
      case RecordStatus.REVIEWED:
        return 'Revisado';
      case RecordStatus.ARCHIVED:
        return 'Archivado';
      default:
        return status;
    }
  }

  getTypeText(type: RecordType): string {
    switch (type) {
      case RecordType.CONSULTATION:
        return 'Consulta';
      case RecordType.EMERGENCY:
        return 'Emergencia';
      case RecordType.SURGERY:
        return 'Cirugía';
      case RecordType.FOLLOW_UP:
        return 'Seguimiento';
      case RecordType.LABORATORY:
        return 'Laboratorio';
      case RecordType.IMAGING:
        return 'Imagenología';
      case RecordType.OTHER:
        return 'Otro';
      default:
        return type;
    }
  }

  calculateBMI(weight?: number, height?: number): number | null {
    if (weight && height) {
      const heightInMeters = height / 100;
      return weight / (heightInMeters * heightInMeters);
    }
    return null;
  }

  getBMICategory(bmi: number): string {
    if (bmi < 18.5) return 'Bajo peso';
    if (bmi < 25) return 'Normal';
    if (bmi < 30) return 'Sobrepeso';
    return 'Obesidad';
  }
}
