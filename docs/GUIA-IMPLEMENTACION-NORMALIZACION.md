# 🔧 GUÍA DE IMPLEMENTACIÓN - Normalización de Datos del Cliente

Esta guía te ayudará a procesar la información recibida del cliente e importarla al sistema Bartolomed.

---

## 📋 FASE 1: PREPARACIÓN Y ENVÍO

### ✅ Checklist Pre-envío

- [ ] Revisar que las plantillas estén actualizadas con la estructura de la BD
- [ ] Personalizar el email template con datos del cliente
- [ ] Establecer fecha límite realista (sugerido: 7-10 días)
- [ ] Preparar carpeta compartida si es necesario
- [ ] Enviar email con plantillas adjuntas

### 📤 Archivos a Enviar al Cliente

```
📧 EMAIL-TEMPLATE-CLIENTE.md (personalizado)
📄 PLANTILLA-NORMALIZACION-DATOS.md
📁 plantillas-csv/
   ├── 1_medicamentos.csv
   ├── 2_stock_inicial.csv
   ├── 3_proveedores.csv
   ├── 4_activos.csv
   ├── 5_mantenimiento_historial.csv
   ├── 6_usuarios.csv
   └── README.md
```

---

## 📥 FASE 2: RECEPCIÓN Y VALIDACIÓN

### 1. Validación de Archivos Recibidos

#### A. Verificar Completitud

```bash
# Checklist de archivos recibidos
- [ ] 1_medicamentos.csv o .xlsx
- [ ] 2_stock_inicial.csv o .xlsx
- [ ] 3_proveedores.csv o .xlsx
- [ ] 4_activos.csv o .xlsx
- [ ] 5_mantenimiento_historial.csv (opcional)
- [ ] 6_usuarios.csv o .xlsx
```

#### B. Validación de Formato

```bash
# Convertir XLSX a CSV si es necesario
# En Python (ejemplo):
import pandas as pd

# Leer Excel
df = pd.read_excel('medicamentos.xlsx')

# Guardar como CSV
df.to_csv('medicamentos.csv', index=False, encoding='utf-8')
```

#### C. Validación de Datos Obligatorios

**Para Medicamentos:**

```typescript
// Campos obligatorios
const required = [
  'Codigo',
  'Nombre_Comercial',
  'Concentracion',
  'Forma_Farmaceutica',
  'Categoria',
];

// Validar que no estén vacíos
data.forEach((row) => {
  required.forEach((field) => {
    if (!row[field]) {
      console.error(
        `Falta ${field} en medicamento: ${row.Codigo || 'sin código'}`,
      );
    }
  });
});
```

**Para Activos:**

```typescript
// Campos obligatorios
const required = [
  'Etiqueta',
  'Nombre',
  'Tipo',
  'Estado',
  'Condicion',
  'Precio_Compra',
  'Fecha_Compra',
];
```

#### D. Validación de Códigos Únicos

```typescript
// Verificar duplicados
const codigos = data.map((row) => row.Codigo);
const duplicados = codigos.filter(
  (item, index) => codigos.indexOf(item) !== index,
);

if (duplicados.length > 0) {
  console.error('Códigos duplicados:', duplicados);
}
```

#### E. Validación de Fechas

```typescript
// Validar formato de fechas AAAA-MM-DD
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

data.forEach((row) => {
  if (row.Fecha_Vencimiento && !datePattern.test(row.Fecha_Vencimiento)) {
    console.error(`Fecha inválida en ${row.Codigo}: ${row.Fecha_Vencimiento}`);
  }
});
```

#### F. Validación de Valores Predefinidos

```typescript
const categorias_validas = [
  'Analgésico',
  'Antibiótico',
  'Antiviral',
  'Antihistamínico',
  'Cardiovascular',
  'Gastrointestinal',
  'Respiratorio',
  'Neurológico',
  'Dermatológico',
  'Endocrino',
  'Vacuna',
  'Suplemento',
  'Controlado',
  'Otro',
];

data.forEach((row) => {
  if (!categorias_validas.includes(row.Categoria)) {
    console.warn(`Categoría no estándar en ${row.Codigo}: ${row.Categoria}`);
  }
});
```

---

## 🔄 FASE 3: TRANSFORMACIÓN DE DATOS

### 1. Mapeo de Campos CSV → Base de Datos

#### Medicamentos

```typescript
// Mapeo de campos
const mappingMedicamentos = {
  Codigo: 'code',
  Nombre_Comercial: 'name',
  Nombre_Generico: 'genericName',
  Marca: 'brandName',
  Concentracion: 'strength',
  Forma_Farmaceutica: 'dosageForm',
  Categoria: 'category',
  Fabricante: 'manufacturer',
  Proveedor_Principal: 'supplier',
  Descripcion: 'description',
  Ingredientes_Activos: 'activeIngredients',
  Indicaciones: 'indications',
  Contraindicaciones: 'contraindications',
  Efectos_Secundarios: 'sideEffects',
  Instrucciones_Dosificacion: 'dosageInstructions',
  Condicion_Almacenamiento: 'storageCondition',
  Requiere_Receta: 'requiresPrescription',
  Sustancia_Controlada: 'isControlledSubstance',
  Programa_Control: 'controlledSubstanceSchedule',
};
```

#### Stock de Medicamentos

```typescript
const mappingStock = {
  Codigo_Medicamento: 'medication_id', // Requiere lookup
  Numero_Lote: 'batchNumber',
  Cantidad: 'quantity',
  Costo_Unitario: 'unitCost',
  Precio_Venta: 'sellingPrice',
  Fecha_Vencimiento: 'expiryDate',
  Fecha_Recepcion: 'receivedDate',
  Lote_Proveedor: 'supplierBatch',
  Ubicacion_Fisica: 'location',
  Stock_Minimo: 'minimumStock',
};
```

#### Activos

```typescript
const mappingActivos = {
  Etiqueta: 'assetTag',
  Nombre: 'name',
  Descripcion: 'description',
  Tipo: 'type',
  Categoria: 'category',
  Sub_Categoria: 'subCategory',
  Fabricante: 'manufacturer',
  Modelo: 'model',
  Numero_Serie: 'serialNumber',
  Codigo_Barras: 'barcodeNumber',
  Estado: 'status',
  Condicion: 'condition',
  Precio_Compra: 'purchasePrice',
  Fecha_Compra: 'purchaseDate',
  Proveedor: 'vendor',
  // ... continuar según entidad Asset
};
```

### 2. Transformación de Enums

```typescript
// Mapeo de valores en español a valores del sistema
const categoryMapping = {
  Analgésico: 'analgesic',
  Antibiótico: 'antibiotic',
  Antiviral: 'antiviral',
  Antihistamínico: 'antihistamine',
  Cardiovascular: 'cardiovascular',
  Gastrointestinal: 'gastrointestinal',
  Respiratorio: 'respiratory',
  Neurológico: 'neurological',
  Dermatológico: 'dermatological',
  Endocrino: 'endocrine',
  Vacuna: 'vaccine',
  Suplemento: 'supplement',
  Controlado: 'controlled',
  Otro: 'other',
};

const storageMapping = {
  'Temperatura Ambiente': 'room_temperature',
  Refrigerado: 'refrigerated',
  Congelado: 'frozen',
  'Temperatura Controlada': 'controlled_temperature',
  'Lugar Seco': 'dry_place',
  'Protegido de la Luz': 'light_protected',
};

const assetTypeMapping = {
  'Equipo Médico': 'medical_equipment',
  Mobiliario: 'furniture',
  Computador: 'computer',
  Vehículo: 'vehicle',
  Edificio: 'building',
  Otro: 'other',
};

const assetStatusMapping = {
  Activo: 'active',
  Inactivo: 'inactive',
  Mantenimiento: 'maintenance',
  Retirado: 'retired',
  Vendido: 'sold',
  Perdido: 'lost',
  Dañado: 'damaged',
};

const assetConditionMapping = {
  Excelente: 'excellent',
  Bueno: 'good',
  Regular: 'fair',
  Malo: 'poor',
  Crítico: 'critical',
};
```

### 3. Conversión de Tipos de Datos

```typescript
function transformRow(csvRow: any, mapping: any): any {
  const transformed: any = {};

  for (const [csvField, dbField] of Object.entries(mapping)) {
    let value = csvRow[csvField];

    // Convertir vacíos a null
    if (value === '' || value === 'N/A' || value === undefined) {
      value = null;
    }

    // Convertir booleanos
    if (
      dbField === 'requiresPrescription' ||
      dbField === 'isControlledSubstance'
    ) {
      value = value === 'Sí' || value === 'Yes' || value === true;
    }

    // Convertir números
    if (
      dbField.includes('price') ||
      dbField.includes('cost') ||
      dbField.includes('Quantity') ||
      dbField.includes('stock')
    ) {
      value = value ? parseFloat(value) : 0;
    }

    // Convertir fechas
    if (dbField.includes('Date') || dbField.includes('date')) {
      value = value ? new Date(value).toISOString() : null;
    }

    transformed[dbField] = value;
  }

  return transformed;
}
```

---

## 💾 FASE 4: IMPORTACIÓN A BASE DE DATOS

### Opción A: Script de Seed (Recomendado)

Crear script en `backend/src/seed/import-client-data.seed.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as csvParser from 'csv-parser';
import { Medication } from '../pharmacy/entities/pharmacy.entity';
import { Asset } from '../assets/entities/asset.entity';
import { Supplier } from '../pharmacy/entities/supplier.entity';
import { Clinic } from '../clinics/entities/clinic.entity';

@Injectable()
export class ImportClientDataSeed {
  constructor(
    @InjectRepository(Medication)
    private medicationRepo: Repository<Medication>,
    @InjectRepository(Asset)
    private assetRepo: Repository<Asset>,
    @InjectRepository(Supplier)
    private supplierRepo: Repository<Supplier>,
    @InjectRepository(Clinic)
    private clinicRepo: Repository<Clinic>,
  ) {}

  async run(clinicId: string, dataPath: string) {
    console.log('🚀 Iniciando importación de datos del cliente...');

    try {
      // 1. Importar proveedores primero
      await this.importSuppliers(clinicId, `${dataPath}/3_proveedores.csv`);

      // 2. Importar medicamentos
      await this.importMedications(clinicId, `${dataPath}/1_medicamentos.csv`);

      // 3. Importar stock de medicamentos
      await this.importMedicationStock(
        clinicId,
        `${dataPath}/2_stock_inicial.csv`,
      );

      // 4. Importar activos
      await this.importAssets(clinicId, `${dataPath}/4_activos.csv`);

      // 5. Importar historial de mantenimiento (opcional)
      if (fs.existsSync(`${dataPath}/5_mantenimiento_historial.csv`)) {
        await this.importMaintenanceHistory(
          clinicId,
          `${dataPath}/5_mantenimiento_historial.csv`,
        );
      }

      console.log('✅ Importación completada exitosamente');
    } catch (error) {
      console.error('❌ Error en la importación:', error);
      throw error;
    }
  }

  private async importMedications(clinicId: string, filePath: string) {
    console.log('📦 Importando medicamentos...');

    return new Promise<void>((resolve, reject) => {
      const medications: any[] = [];

      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (row) => {
          const medication = this.medicationRepo.create({
            code: row.Codigo,
            name: row.Nombre_Comercial,
            genericName: row.Nombre_Generico,
            brandName: row.Marca,
            strength: row.Concentracion,
            dosageForm: row.Forma_Farmaceutica,
            category: this.mapCategory(row.Categoria),
            manufacturer: row.Fabricante,
            supplier: row.Proveedor_Principal,
            description: row.Descripcion,
            activeIngredients: row.Ingredientes_Activos,
            indications: row.Indicaciones,
            contraindications: row.Contraindicaciones,
            sideEffects: row.Efectos_Secundarios,
            dosageInstructions: row.Instrucciones_Dosificacion,
            storageCondition: this.mapStorageCondition(
              row.Condicion_Almacenamiento,
            ),
            requiresPrescription: row.Requiere_Receta === 'Sí',
            isControlledSubstance: row.Sustancia_Controlada === 'Sí',
            controlledSubstanceSchedule: row.Programa_Control,
            isActive: true,
          });

          medications.push(medication);
        })
        .on('end', async () => {
          try {
            await this.medicationRepo.save(medications);
            console.log(`✅ ${medications.length} medicamentos importados`);
            resolve();
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject);
    });
  }

  // Métodos similares para importSuppliers, importAssets, etc.

  private mapCategory(category: string): string {
    const mapping = {
      Analgésico: 'analgesic',
      Antibiótico: 'antibiotic',
      // ... resto del mapeo
    };
    return mapping[category] || 'other';
  }

  private mapStorageCondition(condition: string): string {
    const mapping = {
      'Temperatura Ambiente': 'room_temperature',
      Refrigerado: 'refrigerated',
      // ... resto del mapeo
    };
    return mapping[condition] || 'room_temperature';
  }
}
```

### Opción B: Endpoint de Importación (API)

Crear endpoint en backend para importación vía API:

```typescript
// backend/src/import/import.controller.ts
@Controller('import')
@Auth(ValidRoles.SUPER_ADMIN, ValidRoles.ADMIN)
export class ImportController {
  constructor(private importService: ImportService) {}

  @Post('medications')
  @UseInterceptors(FileInterceptor('file'))
  async importMedications(
    @UploadedFile() file: Express.Multer.File,
    @GetUser() user: User,
  ) {
    return this.importService.importMedicationsFromCsv(
      file.buffer,
      user.clinic.id,
    );
  }

  @Post('assets')
  @UseInterceptors(FileInterceptor('file'))
  async importAssets(
    @UploadedFile() file: Express.Multer.File,
    @GetUser() user: User,
  ) {
    return this.importService.importAssetsFromCsv(file.buffer, user.clinic.id);
  }
}
```

---

## 🧪 FASE 5: PRUEBAS Y VERIFICACIÓN

### Checklist de Verificación Post-Importación

#### 1. Verificar Conteos

```sql
-- Medicamentos
SELECT COUNT(*) FROM medications WHERE clinic_id = 'xxx';

-- Stock
SELECT COUNT(*) FROM medication_stock WHERE clinic_id = 'xxx';

-- Proveedores
SELECT COUNT(*) FROM suppliers WHERE clinic_id = 'xxx';

-- Activos
SELECT COUNT(*) FROM assets WHERE clinic_id = 'xxx';
```

#### 2. Verificar Relaciones

```sql
-- Stock sin medicamento
SELECT * FROM medication_stock
WHERE medication_id NOT IN (SELECT id FROM medications);

-- Verificar integridad
SELECT ms.*, m.name
FROM medication_stock ms
LEFT JOIN medications m ON ms.medication_id = m.id
WHERE m.id IS NULL;
```

#### 3. Verificar Datos Críticos

```sql
-- Medicamentos sin código
SELECT * FROM medications WHERE code IS NULL OR code = '';

-- Stock con fecha de vencimiento pasada
SELECT * FROM medication_stock WHERE expiry_date < NOW();

-- Activos sin etiqueta
SELECT * FROM assets WHERE asset_tag IS NULL OR asset_tag = '';
```

#### 4. Verificar Enums

```sql
-- Categorías no reconocidas
SELECT DISTINCT category FROM medications;
SELECT DISTINCT type FROM assets;
SELECT DISTINCT status FROM assets;
```

---

## 📊 FASE 6: REPORTE AL CLIENTE

### Crear Reporte de Importación

```markdown
# 📊 REPORTE DE IMPORTACIÓN DE DATOS

**Cliente**: [Nombre del Cliente]
**Fecha**: [Fecha]
**Clínica ID**: [ID]

## Resumen de Importación

### ✅ Datos Importados Exitosamente

| Categoría               | Cantidad          | Estado      |
| ----------------------- | ----------------- | ----------- |
| Medicamentos            | 150               | ✅ Completo |
| Stock (Lotes)           | 245               | ✅ Completo |
| Proveedores             | 12                | ✅ Completo |
| Activos Médicos         | 87                | ✅ Completo |
| Historial Mantenimiento | 45                | ✅ Completo |
| **TOTAL**               | **539 registros** | ✅          |

### ⚠️ Advertencias y Observaciones

1. **Medicamentos con vencimiento próximo**: 8 lotes vencen en los próximos 30 días
2. **Stock bajo**: 12 medicamentos están bajo el nivel mínimo
3. **Activos sin mantenimiento**: 5 activos requieren mantenimiento
4. **Datos faltantes**: 3 medicamentos sin información de proveedor

### 📋 Próximos Pasos

1. ✅ Verificar datos importados en el sistema
2. ⏳ Configurar alertas de stock bajo
3. ⏳ Programar mantenimientos pendientes
4. ⏳ Capacitación de usuarios (fecha: [xxx])

### 🔗 Acceso al Sistema

**URL**: https://[dominio]/dashboard
**Usuarios creados**: 6

## Notas Adicionales

[Incluir cualquier observación relevante]

---

**Responsable**: [Tu nombre]
**Contacto**: [Tu email/teléfono]
```

---

## 🛠️ HERRAMIENTAS ÚTILES

### Script de Validación en Terminal

```bash
# Contar líneas (registros)
wc -l *.csv

# Ver primeras líneas
head -5 medicamentos.csv

# Buscar campos vacíos
grep ',,' medicamentos.csv

# Verificar codificación
file -i medicamentos.csv
```

### Script Python de Validación Rápida

```python
import pandas as pd

# Leer CSV
df = pd.read_csv('medicamentos.csv')

# Campos obligatorios
required = ['Codigo', 'Nombre_Comercial', 'Concentracion']

# Verificar nulos
print("Campos con valores faltantes:")
print(df[required].isnull().sum())

# Verificar duplicados
print(f"\nCódigos duplicados: {df['Codigo'].duplicated().sum()}")

# Ver resumen
print("\nResumen:")
print(df.info())
```

---

## 📞 SOPORTE POST-IMPLEMENTACIÓN

### Checklist de Cierre

- [ ] Datos importados y verificados
- [ ] Reporte enviado al cliente
- [ ] Usuarios creados y notificados
- [ ] Sesión de capacitación agendada
- [ ] Documentación entregada
- [ ] Crear backup de los datos importados
- [ ] Archivar CSVs originales del cliente

---

**Última actualización**: Febrero 2026
