import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-patient-dashboard',
  templateUrl: './patient-dashboard.component.html',
  styleUrl: './patient-dashboard.component.css'
})
export class PatientDashboardComponent implements OnInit {
  totalPatients = 156;
  activePatients = 142;
  newPatientsThisMonth = 23;
  appointmentsToday = 12;

  recentPatients = [
    { id: 1, name: 'Juan Pérez', age: 45, lastVisit: new Date('2024-08-15') },
    { id: 2, name: 'María García', age: 32, lastVisit: new Date('2024-08-14') },
    { id: 3, name: 'Carlos López', age: 58, lastVisit: new Date('2024-08-13') }
  ];

  constructor() { }

  ngOnInit(): void {
  }
}
