import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SidenavService {
  private isExpandedSource = new BehaviorSubject<boolean>(true);
  isExpanded$ = this.isExpandedSource.asObservable();

  toggleSidenav() {
    this.isExpandedSource.next(!this.isExpandedSource.value);
  }
}