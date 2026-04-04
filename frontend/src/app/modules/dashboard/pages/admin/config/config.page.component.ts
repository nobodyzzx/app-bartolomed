import { Component, inject } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { AlertService } from '../../../../../core/services/alert.service'
import { environment } from '../../../../../environments/environments'

@Component({
    selector: 'app-config-page',
    templateUrl: './config.page.component.html',
    styleUrls: ['./config.page.component.css'],
    standalone: false
})
export class ConfigPageComponent {
  private http = inject(HttpClient)
  private alert = inject(AlertService)

  loading = false
  resetDone = false

  async poblarDemo() {
    const result = await this.alert.fire({
      icon: 'question',
      title: '¿Poblar datos demo?',
      html: 'Se crearán 2 clínicas, usuarios, pacientes, ventas y más datos de ejemplo.<br><br><strong>Los datos actuales serán reemplazados.</strong>',
      showCancelButton: true,
      confirmButtonText: 'Sí, poblar',
      cancelButtonText: 'Cancelar',
    })
    if (!result.isConfirmed) return

    this.loading = true
    this.http.get(`${environment.baseUrl}/seed`).subscribe({
      next: () => {
        this.loading = false
        this.alert.fire({ icon: 'success', title: '¡Listo!', text: 'Datos demo cargados correctamente.', timer: 2500, showConfirmButton: false })
      },
      error: () => {
        this.loading = false
        this.alert.fire({ icon: 'error', title: 'Error', text: 'No se pudieron cargar los datos demo.' })
      }
    })
  }

  async resetearDatos() {
    const result = await this.alert.fire({
      icon: 'warning',
      title: '¿Resetear todos los datos?',
      html: 'Esta acción <strong>eliminará todos los datos</strong> del sistema excepto el usuario administrador.<br><br>Esta acción no se puede deshacer.',
      showCancelButton: true,
      confirmButtonText: 'Sí, resetear',
      cancelButtonText: 'Cancelar',
    })
    if (!result.isConfirmed) return

    this.loading = true
    this.http.get(`${environment.baseUrl}/seed/reset`).subscribe({
      next: () => {
        this.loading = false
        this.resetDone = true
        this.alert.fire({ icon: 'success', title: 'Datos reseteados', text: 'El sistema ha sido limpiado. Solo queda el usuario administrador.', timer: 3000, showConfirmButton: false })
      },
      error: () => {
        this.loading = false
        this.alert.fire({ icon: 'error', title: 'Error', text: 'No se pudo resetear el sistema.' })
      }
    })
  }
}
