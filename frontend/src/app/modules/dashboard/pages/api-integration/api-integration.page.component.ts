import { Component } from '@angular/core'
import { Router } from '@angular/router'

@Component({
    selector: 'app-api-integration-page',
    templateUrl: './api-integration.page.component.html',
    styleUrls: ['./api-integration.page.component.css'],
    standalone: false
})
export class ApiIntegrationPageComponent {
  constructor(private router: Router) {}

  goBack(): void {
    this.router.navigate(['/dashboard'])
  }
}
