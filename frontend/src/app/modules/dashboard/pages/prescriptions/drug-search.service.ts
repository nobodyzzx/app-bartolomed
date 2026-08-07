import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { Observable, of } from 'rxjs'
import { catchError, debounceTime, distinctUntilChanged, map, switchMap } from 'rxjs/operators'

export interface DrugSuggestion {
  name: string
}

@Injectable({ providedIn: 'root' })
export class DrugSearchService {
  private readonly API_URL = 'https://clinicaltables.nlm.nih.gov/api/rxterms/v3/search'

  constructor(private http: HttpClient) {}

  search(term: string): Observable<string[]> {
    const trimmed = (term || '').trim()
    if (trimmed.length < 2) return of([])

    return this.http
      .get<any[]>(this.API_URL, {
        params: { terms: trimmed, ef: 'DISPLAY_NAME', maxList: '10' },
      })
      .pipe(
        map(response => {
          // Response: [total, [codes], {DISPLAY_NAME: [[...]]}, [[name, ...]]]
          // Index 3 → array of display tuples; first element is the drug name
          const list: any[][] = response[3] || []
          return list.map((item: any[]) => item[0] as string)
        }),
        catchError(() => of([])),
      )
  }

  searchAsStream(input$: Observable<string>): Observable<string[]> {
    return input$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(term => this.search(term)),
    )
  }
}
