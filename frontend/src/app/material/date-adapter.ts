import { NativeDateAdapter } from '@angular/material/core'
import { Injectable } from '@angular/core'

/**
 * DateAdapter que acepta entrada manual en formato DD/MM/YYYY (es-BO).
 * También acepta DDMMYYYY, D/M/YYYY y separadores punto o guión.
 */
@Injectable()
export class BolivianDateAdapter extends NativeDateAdapter {

  override parse(value: any): Date | null {
    if (value instanceof Date) return value
    if (!value || typeof value !== 'string') return null

    const s = value.trim()

    // Intentar con separadores: / - .
    const withSep = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/)
    if (withSep) {
      const [, d, m, y] = withSep
      const year  = y.length === 2 ? 2000 + parseInt(y, 10) : parseInt(y, 10)
      const month = parseInt(m, 10) - 1
      const day   = parseInt(d, 10)
      const date  = new Date(year, month, day)
      return this._isValidDate(date, day, month, year) ? date : null
    }

    // Sin separadores: DDMMYYYY
    const noSep = s.match(/^(\d{2})(\d{2})(\d{4})$/)
    if (noSep) {
      const [, d, m, y] = noSep
      const year  = parseInt(y, 10)
      const month = parseInt(m, 10) - 1
      const day   = parseInt(d, 10)
      const date  = new Date(year, month, day)
      return this._isValidDate(date, day, month, year) ? date : null
    }

    // Fallback: dejar que el adaptador nativo intente
    return super.parse(value)
  }

  override format(date: Date, displayFormat: string): string {
    if (displayFormat === 'input') {
      const d = date.getDate().toString().padStart(2, '0')
      const m = (date.getMonth() + 1).toString().padStart(2, '0')
      const y = date.getFullYear()
      return `${d}/${m}/${y}`
    }
    return super.format(date, displayFormat)
  }

  private _isValidDate(date: Date, day: number, month: number, year: number): boolean {
    return (
      !isNaN(date.getTime()) &&
      date.getDate()     === day   &&
      date.getMonth()    === month &&
      date.getFullYear() === year
    )
  }
}

export const BO_DATE_FORMATS = {
  parse: {
    dateInput: 'input',
  },
  display: {
    dateInput:          'input',
    monthYearLabel:     { year: 'numeric', month: 'short' },
    dateA11yLabel:      { year: 'numeric', month: 'long',  day: 'numeric' },
    monthYearA11yLabel: { year: 'numeric', month: 'long'  },
  },
}
