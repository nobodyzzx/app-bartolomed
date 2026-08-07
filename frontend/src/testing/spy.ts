import type { MockedObject } from 'vitest'

/**
 * Equivalente a `jasmine.SpyObj<T>`: el objeto expone la misma forma que `T`,
 * pero cada método es un mock de Vitest.
 */
export type SpyObj<T> = MockedObject<T>

/**
 * Equivalente a `jasmine.createSpyObj`. Crea un doble de prueba con los métodos
 * indicados, cada uno como `vi.fn()`.
 *
 * El nombre solo sirve para leer mejor los tests; Vitest no lo usa.
 */
export function createSpyObj<T>(_name: string, methods: readonly string[]): SpyObj<T> {
  const spy: Record<string, unknown> = {}

  for (const method of methods) {
    spy[method] = vi.fn()
  }

  return spy as SpyObj<T>
}
