# Registro de Usuarios con Asignación de Clínica y Roles

## Descripción General

Se ha implementado la funcionalidad para asignar una clínica y roles específicos durante el registro de un nuevo usuario. Esta característica permite una gestión más completa y organizada de los usuarios del sistema.

## Cambios en el Backend

### 1. DTO de Creación de Usuario

**Archivo**: `backend/src/users/dto/create-user.dto.ts`

Se agregó el campo opcional `clinicId`:

```typescript
@IsOptional()
@IsUUID()
clinicId?: string;
```

Este campo permite especificar el ID de la clínica a la que pertenecerá el usuario.

### 2. Servicio de Usuarios

**Archivo**: `backend/src/users/services/users.service.ts`

Se actualizó el método `create()` para:

- Inyectar el repositorio de `Clinic`
- Verificar que la clínica existe si se proporciona un `clinicId`
- Asignar automáticamente la clínica al usuario
- Manejar errores apropiadamente si la clínica no existe

```typescript
// Si se proporciona clinicId, verificar que la clínica existe
let clinic: Clinic | undefined;
if (clinicId) {
  clinic = await this.clinicRepository.findOne({ where: { id: clinicId } });
  if (!clinic) {
    throw new BadRequestException(`Clinic with id ${clinicId} not found`);
  }
}

const user = this.userRepository.create({
  ...userData,
  password: bcrypt.hashSync(password, 10),
  clinic: clinic,
});
```

También se actualizó el método `update()` para permitir la actualización de la clínica asignada.

### 3. Módulo de Usuarios

**Archivo**: `backend/src/users/users.module.ts`

Se importó la entidad `Clinic` en el módulo para permitir su inyección en el servicio:

```typescript
imports: [
  TypeOrmModule.forFeature([User, PersonalInfo, ProfessionalInfo, Clinic]),
  AuthModule,
];
```

## Cambios en el Frontend

### 1. DTO de Usuario

**Archivo**: `frontend/src/app/modules/dashboard/interfaces/user.dto.ts`

Se agregó el campo opcional `clinicId` al `CreateUserDto`:

```typescript
export interface CreateUserDto {
  email: string;
  password: string;
  personalInfo: {
    firstName: string;
    lastName: string;
  };
  roles?: string[];
  clinicId?: string; // Nuevo campo
}
```

### 2. Componente de Registro

**Archivo**: `frontend/src/app/modules/dashboard/pages/users/register/register.component.ts`

Se realizaron los siguientes cambios:

1. **Inyección del servicio de clínicas**:

```typescript
constructor(
  private usersService: UsersService,
  private clinicsService: ClinicsService,  // Nuevo servicio
  public router: Router,
  // ...
) {}
```

2. **Carga de clínicas activas**:

```typescript
loadClinics() {
  this.clinicsService.findAll(true).subscribe({
    next: (clinics) => {
      this.clinics = clinics
    },
    error: (error) => {
      console.error('Error al cargar clínicas:', error)
    }
  })
}
```

3. **Nuevo campo en el formulario**:

```typescript
public registerForm: FormGroup = new FormGroup({
  email: new FormControl('', [Validators.required, Validators.email]),
  password: new FormControl('', [Validators.required, Validators.minLength(6)]),
  roles: new FormControl([], [Validators.required]),
  clinicId: new FormControl(''),  // Nuevo campo opcional
  // ...
});
```

4. **Limpieza de datos antes de enviar**:

```typescript
const userData = this.registerForm.value;

// Si no se seleccionó clínica, eliminar el campo
if (!userData.clinicId) {
  delete userData.clinicId;
}
```

### 3. Template del Formulario

**Archivo**: `frontend/src/app/modules/dashboard/pages/users/register/register.component.html`

Se agregó un selector de clínica con las siguientes características:

- **Lista desplegable** con todas las clínicas activas
- **Opción "Sin asignar"** para usuarios sin clínica
- **Visualización de información** de cada clínica (nombre y dirección)
- **Campo opcional** que no bloquea el registro si no se selecciona

```html
<mat-form-field
  appearance="outline"
  class="w-full transform transition-all duration-300 hover:-translate-y-1"
>
  <mat-label>Clínica</mat-label>
  <mat-select formControlName="clinicId">
    <mat-option value="">
      <em>Sin asignar</em>
    </mat-option>
    <mat-option *ngFor="let clinic of clinics" [value]="clinic.id">
      <div class="flex items-center gap-2">
        <mat-icon class="text-blue-400">local_hospital</mat-icon>
        <div>
          <div>{{ clinic.name }}</div>
          <small class="text-gray-500">{{ clinic.address }}</small>
        </div>
      </div>
    </mat-option>
  </mat-select>
  <mat-icon matPrefix class="text-blue-400">business</mat-icon>
  <mat-icon matSuffix class="text-blue-400">arrow_drop_down</mat-icon>
  <mat-hint>Opcional: asigne el usuario a una clínica específica</mat-hint>
</mat-form-field>
```

## Flujo de Uso

### Crear Usuario con Clínica

1. **Acceder al formulario de registro**: Navegar a `/dashboard/users/register`
2. **Completar datos básicos**: Email, contraseña, roles
3. **Seleccionar clínica** (opcional): Elegir de la lista desplegable
4. **Completar información personal y profesional**
5. **Enviar formulario**

El backend:

- Validará que la clínica existe
- Creará el usuario con la relación a la clínica
- Retornará el usuario completo incluyendo la información de la clínica

### Crear Usuario sin Clínica

1. Seguir el mismo flujo
2. **Dejar el selector de clínica en "Sin asignar"** o no seleccionar ninguna opción
3. El usuario se creará sin relación a ninguna clínica

### Editar Usuario

El formulario de edición también permite:

- **Cambiar la clínica asignada** a un usuario existente
- **Eliminar la asignación** de clínica seleccionando "Sin asignar"

## Validaciones

### Backend

- ✅ El `clinicId` debe ser un UUID válido
- ✅ La clínica debe existir en la base de datos
- ✅ El campo es opcional (puede ser `null` o `undefined`)
- ✅ Se previenen asignaciones a clínicas inexistentes

### Frontend

- ✅ El selector carga solo clínicas activas
- ✅ Muestra información clara de cada clínica
- ✅ Permite deseleccionar la clínica
- ✅ No es un campo obligatorio

## Manejo de Errores

### Backend

Si se intenta asignar una clínica inexistente:

```json
{
  "statusCode": 400,
  "message": "Clinic with id <uuid> not found",
  "error": "Bad Request"
}
```

### Frontend

El servicio de error mostrará un mensaje amigable al usuario si:

- La clínica no existe
- No hay conexión con el backend
- Hay problemas de permisos

## Mejoras Futuras (Pendientes)

1. **Restricción de roles por permisos**:

   - Solo ADMIN o SUPER_ADMIN deberían poder asignar roles elevados (admin, doctor, etc.)
   - Usuarios normales podrían crear solo usuarios básicos

2. **Filtrado por clínica**:

   - Los usuarios podrían ver solo otros usuarios de su misma clínica
   - Administradores globales verían todos los usuarios

3. **Dashboard de clínicas**:

   - Estadísticas de usuarios por clínica
   - Gestión masiva de asignaciones

4. **Notificaciones**:
   - Alertar a administradores de clínica cuando se asignan nuevos usuarios

## Notas Técnicas

- La relación `User -> Clinic` es de tipo `ManyToOne`
- La relación se carga eager por defecto en las consultas
- El campo `clinicId` se elimina del payload si está vacío antes de enviar
- El backend devuelve el objeto `clinic` completo en la respuesta
