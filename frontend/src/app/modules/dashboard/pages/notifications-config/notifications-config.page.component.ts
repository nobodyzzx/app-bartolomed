import { Component } from '@angular/core'
import { Router } from '@angular/router'

@Component({
    selector: 'app-notifications-config-page',
    templateUrl: './notifications-config.page.component.html',
    styleUrls: ['./notifications-config.page.component.css'],
    standalone: false
})
export class NotificationsConfigPageComponent {
  constructor(private router: Router) {}

  goBack(): void {
    this.router.navigate(['/dashboard'])
  }
}
