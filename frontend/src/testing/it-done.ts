/**
 * Equivalente al callback `done` de Jasmine, que Vitest ya no soporta.
 *
 * El test no termina hasta que se llama a `done()`, así que sigue fallando por
 * timeout si el callback asíncrono nunca se ejecuta — que es justo la garantía
 * que aporta este estilo de test.
 *
 * En tests nuevos prefiere `async`/`await`; esto existe para los que ya
 * estaban escritos con `done`.
 */
export function itDone(name: string, fn: (done: () => void) => void, timeout?: number): void {
  it(
    name,
    async () => {
      let done!: () => void
      const finished = new Promise<void>(resolve => (done = resolve))

      fn(done)

      await finished
    },
    timeout,
  )
}
