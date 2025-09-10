# Default User Seeder

Este proyecto incluye un seeder automático que crea un usuario por defecto cuando la aplicación se inicia.

## Usuario por Defecto

**Credenciales de acceso:**
- **Email:** `doctor@example.com`
- **Contraseña:** `Abc123`
- **Roles:** `super_user`, `admin`, `user`
- **Nombre:** Doctor Default

## Funcionamiento

El seeder se ejecuta automáticamente en cada inicio de la aplicación a través de `main.ts`. Verifica si existe un usuario con el email `doctor@example.com`, y si no existe, lo crea con las credenciales especificadas.

### Logs de consola

Al iniciar la aplicación, verás uno de estos mensajes:

- ✅ `Default user already exists: doctor@example.com` - Si el usuario ya existe
- 🌱 `Creating default user...` - Si se está creando el usuario
- ✅ `Default user created successfully:` - Si el usuario fue creado exitosamente
- ❌ `Error creating default user:` - Si hubo un error

## Para Coolify

Este seeder garantiza que siempre tengas un usuario administrador disponible en el despliegue de producción, sin necesidad de configuración manual.

### Variables de entorno recomendadas

En Coolify, asegúrate de configurar estas variables:

```env
# Base de datos
DB_HOST=database
DB_PORT=5432
DB_USER=bartolomed_user
DB_PASS=bartolomed_pass
DB_NAME=bartolomed_db

# JWT
JWT_SECRET=tu-clave-secreta-muy-segura-para-produccion

# Puerto
PORT=3000
```

## Seguridad

⚠️ **IMPORTANTE:** En producción, cambia la contraseña del usuario por defecto inmediatamente después del primer acceso.

El seeder solo crea el usuario si no existe, por lo que es seguro ejecutarlo múltiples veces.
