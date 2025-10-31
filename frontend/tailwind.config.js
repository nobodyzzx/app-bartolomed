/** @type {import('tailwindcss').Config} */
// Carga opcional de DaisyUI: evita fallas en entornos donde no se instalan devDependencies
const plugins = []
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const daisyui = require('daisyui')
  plugins.push(daisyui)
} catch (_) {
  // DaisyUI no instalado: continuar sin el plugin
}

module.exports = {
  important: true, // Esto asegura que Tailwind tenga prioridad cuando sea necesario
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {},
  },
  plugins,
  // Previene conflictos con clases específicas de Angular Material
  corePlugins: {
    preflight: false, // Esto evita que Tailwind resetee los estilos base que usa Material
  },
}
