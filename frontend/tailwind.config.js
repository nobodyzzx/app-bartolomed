/** @type {import('tailwindcss').Config} */
module.exports = {
  important: true, // Esto asegura que Tailwind tenga prioridad cuando sea necesario
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  // Previene conflictos con clases específicas de Angular Material
  corePlugins: {
    preflight: false, // Esto evita que Tailwind resetee los estilos base que usa Material
  },
}
