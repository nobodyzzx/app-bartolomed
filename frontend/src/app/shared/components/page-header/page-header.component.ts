import { CommonModule } from '@angular/common'
import { Component, EventEmitter, Input, Output } from '@angular/core'

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './page-header.component.html',
})
export class PageHeaderComponent {
  @Input() title = ''
  @Input() subtitle = ''
  @Input() showBack = true

  @Output() back = new EventEmitter<void>()
}
