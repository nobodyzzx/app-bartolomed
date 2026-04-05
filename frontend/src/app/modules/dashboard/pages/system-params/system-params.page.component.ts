import { Component, OnInit, inject } from '@angular/core'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { HttpClient } from '@angular/common/http'
import { AlertService } from '../../../../core/services/alert.service'
import { environment } from '../../../../environments/environments'

@Component({
  selector: 'app-system-params-page',
  templateUrl: './system-params.page.component.html',
  styleUrls: ['./system-params.page.component.css'],
  standalone: false,
})
export class SystemParamsPageComponent implements OnInit {
  private fb     = inject(FormBuilder)
  private http   = inject(HttpClient)
  private alert  = inject(AlertService)

  form!: FormGroup
  loading    = false
  saving     = false
  testing    = false
  hidePass   = true

  ngOnInit() {
    this.form = this.fb.group({
      host:      ['', Validators.required],
      port:      [587, [Validators.required, Validators.min(1), Validators.max(65535)]],
      secure:    [false],
      user:      ['', Validators.required],
      pass:      [''],
      fromName:  ['Bartolomed', Validators.required],
      fromEmail: ['', [Validators.required, Validators.email]],
      enabled:   [false],
    })
    this.loadConfig()
  }

  loadConfig() {
    this.loading = true
    this.http.get<any>(`${environment.baseUrl}/smtp-config`).subscribe({
      next: (cfg) => {
        if (cfg) {
          this.form.patchValue({
            host:      cfg.host      ?? '',
            port:      cfg.port      ?? 587,
            secure:    cfg.secure    ?? false,
            user:      cfg.user      ?? '',
            fromName:  cfg.fromName  ?? 'Bartolomed',
            fromEmail: cfg.fromEmail ?? '',
            enabled:   cfg.enabled   ?? false,
          })
        }
        this.loading = false
      },
      error: () => { this.loading = false },
    })
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return }
    this.saving = true
    const payload = this.form.value
    // No enviar pass vacío (no sobreescribir si el usuario no lo modificó)
    if (!payload.pass) delete payload.pass
    this.http.put<any>(`${environment.baseUrl}/smtp-config`, payload).subscribe({
      next: () => {
        this.saving = false
        this.alert.fire({ icon: 'success', title: 'Configuración guardada', timer: 2000, showConfirmButton: false })
      },
      error: () => {
        this.saving = false
        this.alert.fire({ icon: 'error', title: 'Error', text: 'No se pudo guardar la configuración.' })
      },
    })
  }

  testConnection() {
    this.testing = true
    this.http.post<{ ok: boolean; error?: string }>(`${environment.baseUrl}/smtp-config/test`, {}).subscribe({
      next: (res) => {
        this.testing = false
        if (res.ok) {
          this.alert.fire({ icon: 'success', title: 'Conexión exitosa', text: 'El servidor SMTP respondió correctamente.', timer: 3000, showConfirmButton: false })
        } else {
          this.alert.fire({ icon: 'error', title: 'Conexión fallida', text: res.error ?? 'No se pudo conectar al servidor SMTP.' })
        }
      },
      error: () => {
        this.testing = false
        this.alert.fire({ icon: 'error', title: 'Error', text: 'No se pudo verificar la conexión.' })
      },
    })
  }

  goBack() { history.back() }
}
