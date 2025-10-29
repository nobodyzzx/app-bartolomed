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
    const token = localStorage.getItem('token')
    const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        if ((error.status === 401 || error.status === 403) && !isRefreshing) {
          isRefreshing = true
          return this.auth.refreshAccessToken().pipe(
            switchMap(success => {
              isRefreshing = false
              if (success) {
                const newToken = localStorage.getItem('token')
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
        return throwError(() => error)
      }),
    )
  }
}
