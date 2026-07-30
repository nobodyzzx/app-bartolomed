import { Component, EventEmitter, Input, Output } from '@angular/core'

@Component({
  selector: 'app-page-header',
  imports: [],
  templateUrl: './page-header.component.html',
})
export class PageHeaderComponent {
  @Input() title = ''
  @Input() subtitle = ''
  @Input() showBack = true

  @Output() back = new EventEmitter<void>()
}
