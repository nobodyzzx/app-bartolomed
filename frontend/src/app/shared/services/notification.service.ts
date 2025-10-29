import { Injectable } from '@angular/core'

export type NotificationType = 'success' | 'error' | 'warning' | 'info'

interface ToastNotification {
  id: string
  type: NotificationType
  message: string
  duration: number
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private notifications: ToastNotification[] = []
  private notificationSubject = new Map<string, any>()

  show(type: NotificationType, message: string, duration: number = 5000) {
    const id = this.generateId()
    const notification: ToastNotification = { id, type, message, duration }

    this.notifications.push(notification)
    this.createToastElement(notification)

    if (duration > 0) {
      const timeout = setTimeout(() => {
        this.remove(id)
      }, duration)
      this.notificationSubject.set(id, timeout)
    }
  }

  success(message: string, duration?: number) {
    this.show('success', message, duration)
  }

  error(message: string, duration?: number) {
    this.show('error', message, duration)
  }

  warning(message: string, duration?: number) {
    this.show('warning', message, duration)
  }

  info(message: string, duration?: number) {
    this.show('info', message, duration)
  }

  remove(id: string) {
    const timeout = this.notificationSubject.get(id)
    if (timeout) {
      clearTimeout(timeout)
      this.notificationSubject.delete(id)
    }

    this.notifications = this.notifications.filter(n => n.id !== id)
    const element = document.getElementById(`toast-${id}`)
    if (element) {
      element.classList.add('toast-exit')
      setTimeout(() => element.remove(), 300)
    }
  }

  private createToastElement(notification: ToastNotification) {
    const container = this.getOrCreateContainer()

    const toast = document.createElement('div')
    toast.id = `toast-${notification.id}`
    toast.className = `toast toast-${notification.type}`
    toast.innerHTML = `
      <div class="toast-content">
        <div class="toast-icon">${this.getIcon(notification.type)}</div>
        <div class="toast-message">${notification.message}</div>
        <button class="toast-close" onclick="this.parentElement.parentElement.remove()">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    `

    container.appendChild(toast)

    // Trigger animation
    setTimeout(() => toast.classList.add('toast-show'), 10)
  }

  private getOrCreateContainer(): HTMLElement {
    let container = document.getElementById('toast-container')
    if (!container) {
      container = document.createElement('div')
      container.id = 'toast-container'
      document.body.appendChild(container)
    }
    return container
  }

  private getIcon(type: NotificationType): string {
    const icons = {
      success: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="2"/>
        <path d="M6 10L9 13L14 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
      error: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="2"/>
        <path d="M10 6V10M10 14H10.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>`,
      warning: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 2L2 17H18L10 2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        <path d="M10 8V11M10 14H10.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>`,
      info: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="2"/>
        <path d="M10 10V14M10 6H10.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>`,
    }
    return icons[type]
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}
