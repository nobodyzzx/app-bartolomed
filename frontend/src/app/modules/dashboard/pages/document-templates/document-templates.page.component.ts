import { Component } from '@angular/core'
import { Router } from '@angular/router'

@Component({
    selector: 'app-document-templates-page',
    templateUrl: './document-templates.page.component.html',
    styleUrls: ['./document-templates.page.component.css'],
    standalone: false
})
export class DocumentTemplatesPageComponent {
  constructor(private router: Router) {}

  goBack(): void {
    this.router.navigate(['/dashboard'])
  }
}
