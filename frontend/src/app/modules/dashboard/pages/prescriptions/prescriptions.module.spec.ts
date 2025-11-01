import { TestBed } from '@angular/core/testing'
import { PrescriptionsModule } from './prescriptions.module'

describe('PrescriptionsModule', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PrescriptionsModule] }).compileComponents()
  })

  it('should compile the module', () => {
    expect(PrescriptionsModule).toBeDefined()
  })
})
