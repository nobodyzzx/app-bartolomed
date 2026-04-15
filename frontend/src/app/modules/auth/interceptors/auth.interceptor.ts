import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { Observable, catchError, switchMap, throwError } from 'rxjs'
import { AuthService } from '../services/auth.service'

let isRefreshing = false

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private auth = inject(AuthService)

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        // Intentar refresh SOLO en 401 (no en 403). Un 403 no es un problema de token.
        if (error.status === 401 && !isRefreshing) {
          isRefreshing = true
          return this.auth.refreshAccessToken().pipe(
            switchMap(success => {
              isRefreshing = false
              if (success) {
                const newToken = localStorage.getItem('token') || sessionStorage.getItem('token')
                const retried = newToken
                  ? authReq.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } })
                  : authReq
                return next.handle(retried)
              }
              this.auth.logout()
              return throwError(() => error)
            }),
            catchError(() => {
              isRefreshing = false
              this.auth.logout()
              return throwError(() => error)
            }),
          )
        }
        // Para 403 y otros códigos, no forzar logout aquí; propagar el error al consumidor
        return throwError(() => error)
      }),
    )
  }
}
