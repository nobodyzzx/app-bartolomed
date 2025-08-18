import { Component, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';

export interface Patient {
  id: number;
  name: string;
  age: number;
  gender: string;
  phone: string;
  email: string;
  lastVisit: Date;
  status: string;
}

@Component({
  selector: 'app-patient-list',
  templateUrl: './patient-list.component.html',
  styleUrl: './patient-list.component.css'
})
export class PatientListComponent implements OnInit {
  displayedColumns: string[] = ['id', 'name', 'age', 'gender', 'phone', 'lastVisit', 'status', 'actions'];
  dataSource: MatTableDataSource<Patient>;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  patients: Patient[] = [
    { id: 1, name: 'Juan Pérez González', age: 45, gender: 'Masculino', phone: '+1234567890', email: 'juan@email.com', lastVisit: new Date('2024-08-15'), status: 'Activo' },
    { id: 2, name: 'María García López', age: 32, gender: 'Femenino', phone: '+1234567891', email: 'maria@email.com', lastVisit: new Date('2024-08-14'), status: 'Activo' },
    { id: 3, name: 'Carlos López Martín', age: 58, gender: 'Masculino', phone: '+1234567892', email: 'carlos@email.com', lastVisit: new Date('2024-08-13'), status: 'Activo' },
    { id: 4, name: 'Ana Rodríguez Silva', age: 28, gender: 'Femenino', phone: '+1234567893', email: 'ana@email.com', lastVisit: new Date('2024-08-12'), status: 'Inactivo' },
    { id: 5, name: 'Luis Martínez Ruiz', age: 67, gender: 'Masculino', phone: '+1234567894', email: 'luis@email.com', lastVisit: new Date('2024-08-11'), status: 'Activo' }
  ];

  constructor() {
    this.dataSource = new MatTableDataSource(this.patients);
  }

  ngOnInit(): void {
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  editPatient(patient: Patient) {
    console.log('Editar paciente:', patient);
  }

  viewPatient(patient: Patient) {
    console.log('Ver paciente:', patient);
  }

  deletePatient(patient: Patient) {
    console.log('Eliminar paciente:', patient);
  }
}
