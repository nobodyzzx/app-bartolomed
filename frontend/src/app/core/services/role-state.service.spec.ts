import { TestBed } from '@angular/core/testing'
import { Router } from '@angular/router'
import { UserRoles } from '../enums/user-roles.enum'
import { Permission } from '../enums/permission.enum'
import { RoleStateService } from './role-state.service'
import { createSpyObj } from '../../../testing/spy'

describe('RoleStateService', () => {
  let service: RoleStateService

  beforeEach(() => {
    localStorage.clear()
    TestBed.configureTestingModule({
      providers: [RoleStateService, { provide: Router, useValue: createSpyObj('Router', ['navigate']) }],
    })
    service = TestBed.inject(RoleStateService)
  })

  afterEach(() => localStorage.clear())

  describe('normalizeRoles', () => {
    it('reconoce todos los roles del enum UserRoles, incluido laboratory', () => {
      // Bug real: el switch de normalizeRoles tenía una lista fija que no incluía
      // 'laboratory' — el rol se descartaba en silencio. Un usuario solo-laboratorio
      // quedaba con roles=[] (isAuthenticated=false pese a tener un JWT válido) y no
      // veía el ítem "Laboratorio" del menú aunque el backend sí le diera el permiso.
      const result = service.normalizeRoles(['laboratory'])
      expect(result).toEqual([UserRoles.LABORATORY])
    })

    it('conserva laboratory junto a otros roles del mismo usuario (usuario híbrido)', () => {
      const result = service.normalizeRoles(['pharmacist', 'laboratory'])
      expect(result).toContain(UserRoles.PHARMACIST)
      expect(result).toContain(UserRoles.LABORATORY)
      expect(result.length).toBe(2)
    })

    it('descarta valores desconocidos sin lanzar', () => {
      const result = service.normalizeRoles(['rol-inventado', 'doctor'])
      expect(result).toEqual([UserRoles.DOCTOR])
    })
  })

  describe('syncRoles + permisos', () => {
    it('un usuario solo-laboratorio queda autenticado y con permisos de laboratorio', () => {
      service.syncRoles(['laboratory'] as any)

      expect(service.isAuthenticated()).toBe(true)
      expect(service.currentUserRoles()).toEqual([UserRoles.LABORATORY])
      expect(service.hasPermission(Permission.LabRead)).toBe(true)
      expect(service.hasPermission(Permission.LabResultEnter)).toBe(true)
    })
  })
})
