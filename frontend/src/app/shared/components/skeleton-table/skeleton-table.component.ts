import { CommonModule } from '@angular/common'
import { Component, Input } from '@angular/core'

@Component({
  selector: 'app-skeleton-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './skeleton-table.component.html',
})
export class SkeletonTableComponent {
  @Input() rows = 6
  @Input() columns = 5

  get rowArray(): number[] { return Array(this.rows).fill(0) }
  get colArray(): number[] { return Array(this.columns).fill(0) }
}
