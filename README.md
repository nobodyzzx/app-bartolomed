# 🏥 Bartolomé App - Sistema de Gestión Médica

Un sistema integral de gestión médica desarrollado con **Angular + NestJS + PostgreSQL**, completamente dockerizado para facilitar el desarrollo y despliegue.

## 🚀 Inicio Rápido

⚠️ **IMPORTANTE**: Este proyecto está completamente dockerizado. **NO uses comandos npm directos**.

### Verificar Estado del Sistema
```bash
./check-status.sh
```

### Acceso a la Aplicación
- **Frontend**: http://localhost
- **Backend API**: http://localhost:3000  
- **Health Check**: http://localhost:3000/health

## 📋 Módulos Completados (100%)

### ✅ Gestión del Consultorio Médico
- **Pacientes**: Registro, historial, búsqueda avanzada
- **Expedientes Médicos**: Creación, edición, consulta
- **Calendario de Citas**: Programación y gestión
- **Recetas Electrónicas**: Generación y seguimiento
- **Facturación y Pagos**: Control financiero

### ✅ Control de Farmacia (4 Sub-módulos)
- **Inventario**: Control de stock y medicamentos
- **Generación de Pedidos**: Automatización de compras
- **Ventas y Dispensación**: Punto de venta integrado
- **Facturación**: Gestión de ventas y reportes

### ✅ Sistema de Reportes (3 Tipos)
- **Informes Médicos**: Estadísticas clínicas
- **Reportes Financieros**: Análisis económico  
- **Control de Stock**: Inventarios y movimientos

### ✅ Control de Activos (4 Sub-módulos) - RECIÉN COMPLETADO
- **Registro de Activos**: CRUD completo con validaciones
- **Mantenimiento de Activos**: Programación y seguimiento
- **Control de Inventario**: Dashboard con métricas
- **Reportes de Activos**: 6 tipos de reportes (PDF/Excel/CSV)

### ✅ Administración del Sistema
- **Gestión de Usuarios**: Roles y permisos
- **Gestión de Clínicas**: Multi-ubicación
- **Configuración**: Parámetros del sistema

## 🛠️ Stack Tecnológico

### Frontend
- **Angular 17+** con TypeScript
- **Angular Material** para UI/UX
- **Tailwind CSS** para estilos
- **RxJS** para programación reactiva

### Backend  
- **NestJS** con TypeScript
- **TypeORM** para manejo de base de datos
- **PostgreSQL** como base de datos principal
- **JWT** para autenticación

### DevOps
- **Docker & Docker Compose** para containerización
- **Nginx** como servidor web y proxy reverso
- **Hot Reload** configurado para desarrollo

## 🐳 Arquitectura Docker

```
├── frontend/     → Contenedor Angular + Nginx
├── backend/      → Contenedor NestJS + Node.js  
├── database/     → Contenedor PostgreSQL
└── nginx/        → Configuración de proxy
```

## 📁 Estructura del Proyecto

```
app-bartolomed/
├── frontend/               # Aplicación Angular
│   ├── src/app/modules/
│   │   ├── dashboard/      # Módulo principal
│   │   ├── auth/          # Autenticación
│   │   └── shared/        # Componentes compartidos
│   └── ...
├── backend/               # API NestJS
│   ├── src/
│   │   ├── assets/        # Módulo de activos
│   │   ├── pharmacy/      # Módulo de farmacia
│   │   ├── reports/       # Módulo de reportes
│   │   └── ...
└── database/             # Configuración PostgreSQL
```

## 🎯 Características Principales

### Seguridad
- ✅ Autenticación JWT
- ✅ Control de roles (Admin, Super User, User)
- ✅ Guards de rutas protegidas
- ✅ Validación de permisos por módulo

### UI/UX
- ✅ Diseño Material Design
- ✅ Responsive para móviles y tablets
- ✅ Dark/Light theme (preparado)
- ✅ Navegación intuitiva con sidebar

### Funcionalidad
- ✅ CRUD completo en todos los módulos
- ✅ Búsqueda y filtrado avanzado
- ✅ Generación de reportes múltiples formatos
- ✅ Dashboard con métricas en tiempo real
- ✅ Sistema de notificaciones

## 🚀 Comandos Útiles

### Verificación del Sistema
```bash
# Verificar estado de contenedores
./check-status.sh

# Ver logs en tiempo real
docker-compose logs -f

# Verificar salud de la API
curl http://localhost:3000/health
```

### Gestión de Contenedores
```bash
# Reiniciar servicios
docker-compose restart

# Reconstruir contenedores (solo si es necesario)
docker-compose up --build

# Detener todos los servicios
docker-compose down
```

## 📊 Métricas del Proyecto

- **Módulos**: 6 principales + 11 sub-módulos
- **Componentes Angular**: 50+ componentes
- **Entidades Backend**: 20+ entidades
- **Endpoints API**: 100+ endpoints
- **Pantallas**: 30+ pantallas funcionales

## 🔄 Estado de Desarrollo

| Módulo | Estado | Funcionalidades |
|--------|--------|----------------|
| Dashboard | ✅ 100% | Métricas, navegación, perfil |
| Usuarios | ✅ 100% | CRUD, roles, permisos |
| Pacientes | ✅ 100% | Registro, historial, búsqueda |
| Expedientes | ✅ 100% | Creación, edición, consulta |
| Farmacia | ✅ 100% | 4 sub-módulos completos |
| Reportes | ✅ 100% | 3 tipos de reportes |
| Activos | ✅ 100% | 4 sub-módulos completos |
| Clínicas | ✅ 100% | Multi-ubicación |

## 📝 Documentación Adicional

- 📄 `.development-notice.md` - Avisos importantes de desarrollo
- 📄 `.env.example` - Variables de entorno de ejemplo  
- 📄 `docker-compose.yml` - Configuración de contenedores
- 📄 `check-status.sh` - Script de verificación

## 👥 Contribución

Este es un proyecto privado de desarrollo. Para contribuir:

1. Verifica que Docker esté ejecutándose
2. Ejecuta `./check-status.sh` para verificar el estado
3. Realiza cambios y verifica que se reflejen automáticamente
4. Los cambios se aplican con hot reload

---

**Última actualización**: 3 de Septiembre, 2025  
**Módulo completado**: Control de Activos (4 sub-módulos)  
**Estado**: Proyecto completamente funcional y dockerizado ✅
