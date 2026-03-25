import { CommonModule } from '@angular/common'
import { Component, EventEmitter, Input, Output } from '@angular/core'
import { FormsModule } from '@angular/forms'

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search-bar.component.html',
})
export class SearchBarComponent {
  @Input() placeholder = 'Buscar...'
  @Input() value = ''
  @Input() showClear = false

  @Output() valueChange = new EventEmitter<string>()
  @Output() cleared = new EventEmitter<void>()

  onInput(val: string): void {
    this.value = val
    this.valueChange.emit(val)
  }

  clear(): void {
    this.value = ''
    this.valueChange.emit('')
    this.cleared.emit()
  }
}
