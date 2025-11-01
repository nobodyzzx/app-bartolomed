import { Component, OnInit } from '@angular/core'
import { PrescriptionsService } from './prescriptions.service'

interface Prescription {
  id: string
  prescriptionNumber?: string
  prescriptionDate?: string
  patient?: { id: string; firstName?: string; lastName?: string }
  doctor?: { id: string; personalInfo?: any }
  status?: string
}

@Component({
  selector: 'app-prescription-list',
  templateUrl: './prescription-list.component.html',
  styleUrls: ['./prescription-list.component.css'],
})
export class PrescriptionListComponent implements OnInit {
  items: Prescription[] = []
  loading = false
  page = 1
  pageSize = 10
  total = 0

  constructor(private svc: PrescriptionsService) {}

  ngOnInit(): void {
    this.load()
  }

  load() {
    this.loading = true
    this.svc.list(this.page, this.pageSize).subscribe({
      next: (res: any) => {
        this.items = res.items || []
        this.total = res.total || 0
        this.loading = false
      },
      error: () => (this.loading = false),
    })
  }

  prev() {
    if (this.page > 1) {
      this.page--
      this.load()
    }
  }

  next() {
    if (this.page * this.pageSize < this.total) {
      this.page++
      this.load()
    }
  }

  statusBadge(status: string | undefined) {
    const map: any = {
      active: 'bg-green-100 text-green-700',
      dispensed: 'bg-sky-100 text-sky-700',
      cancelled: 'bg-red-100 text-red-700',
    }
    return map[(status as string) || ''] || 'bg-slate-100 text-slate-700'
  }
}
