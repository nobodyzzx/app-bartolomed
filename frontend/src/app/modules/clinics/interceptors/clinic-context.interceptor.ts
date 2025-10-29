import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { Observable } from 'rxjs'
import { ClinicContextService } from '../services/clinic-context.service'

@Injectable()
export class ClinicContextInterceptor implements HttpInterceptor {
  private ctx = inject(ClinicContextService)

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const clinicId = this.ctx.clinicId
    if (!clinicId) return next.handle(req)
    const cloned = req.clone({ setHeaders: { 'X-Clinic-Id': clinicId } })
    return next.handle(cloned)
  }
}
