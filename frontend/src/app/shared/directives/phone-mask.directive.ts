import { Directive, ElementRef, HostListener } from '@angular/core'

@Directive({
  selector: '[appPhoneMask]',
})
export class PhoneMaskDirective {
  constructor(private el: ElementRef<HTMLInputElement>) {}

  @HostListener('input', ['$event'])
  onInput(e: Event) {
    const input = this.el.nativeElement
    const raw = input.value

    // Preserve leading + if present
    const hasPlus = raw.trim().startsWith('+')
    // Strip everything except digits
    const digits = (raw.match(/\d+/g) || []).join('')

    if (!digits) {
      input.value = hasPlus ? '+' : ''
      return
    }

    // Split into country code (up to 3) and rest
    const cc = digits.substring(0, Math.min(3, digits.length))
    const rest = digits.substring(cc.length)

    let formatted = ''
    if (hasPlus || cc.length >= 1) {
      formatted = `+${cc}`
      if (rest.length > 0) formatted += `-${rest}`
    } else {
      formatted = digits
    }

    input.value = formatted
  }
}
