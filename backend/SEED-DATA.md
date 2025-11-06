# Seed de datos de demostración

Este proyecto incluye un seed de datos accesible bajo el endpoint protegido de desarrollo:

- POST /api/seed/demo

Este seed crea/actualiza datos de forma idempotente para facilitar pruebas locales.

## Qué datos se generan

- Clínica principal: "Clínica Central" (teléfono: +591-70000001)
- Usuarios demo:
  - doctor2@example.com (roles: doctor, user)
  - nurse@example.com (roles: nurse, user)
  - reception@example.com (roles: receptionist, user)
- Pacientes: 10 registros con nombres hispanos, CI boliviano (7–8 dígitos) y teléfonos con prefijo +591.
- Citas: ≥ 10 citas futuras (1 hora entre cada una) asignadas al médico demo.
- Recetas: 6 recetas activas con ítems de ejemplo.

Además, el seed garantiza que el usuario admin@bartolomed.com tenga:

- Clínica principal asignada a la "Clínica Central" (si existe el usuario)
- Membresía (UserClinic) con rol "admin" en dicha clínica

## Limpieza automática

Antes de la siembra, se ejecuta una limpieza de datos de prueba heredados:

- Si existe una clínica con nombre exactamente "1212" o con id "1212", se intenta eliminar.
- Si no es posible eliminar por restricciones de integridad referencial, se marca inactiva y se renombra a "Eliminada-<nombre>".

## Formatos estandarizados (Bolivia)

- CI (documento): cadenas numéricas de 7 u 8 dígitos (p. ej., 5537336, 7845123)
- Teléfono: se prefiere el formato con prefijo de país y guion: `+591-7XXXXXXX` u `+591-6XXXXXXX`. El seed utiliza este formato y la UI implementa máscaras acordes.

## Idempotencia

El seed es idempotente:

- Reutiliza la clínica "Clínica Central" si ya existe
- No duplica usuarios/pacientes si ya existen (se busca por email o por número de documento CI)
- No duplica citas con misma fecha/paciente/médico
- No duplica recetas con el mismo número `RX-DEMO-XXX`

## Notas

- Las fechas de citas siempre se ubican en el futuro (>= 24h) para evitar validaciones por huso horario.
- La ejecución del seed no requiere reiniciar contenedores; basta con refrescar el navegador para ver los cambios.
