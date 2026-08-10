import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reduce la ficha del activo a lo que la clínica usa, y retira el mantenimiento.
 *
 * La entidad venía de un registro de activos fijos contable: 40 columnas con
 * precio y fecha de compra, proveedor, factura, garantía, método de
 * depreciación, vida útil, valor residual, valor actual, depreciación acumulada
 * y mensual, categoría, subcategoría, código de barras, edificio, piso, sala,
 * responsable asignado, adjuntos y especificaciones.
 *
 * Sobre los 235 ítems reales de producción, **ninguna de esas columnas tenía un
 * solo dato** — se verificó antes de escribir esta migración. El inventario se
 * lleva contando existencias por ambiente: qué hay, cuántos, dónde y si sirve.
 * Se conservan `serialNumber`, `manufacturer` y `model`, hoy también vacíos, por
 * decisión explícita: son los que el equipamiento médico caro va a necesitar.
 *
 * `asset_maintenance` se retira entera: cero registros desde que existe, y con
 * ella se van ~740 líneas de entidad, DTOs, endpoints y pantalla que había que
 * mantener y migrar en cada cambio.
 *
 * El `down()` recrea la estructura, no los datos — que eran NULL en todas las
 * filas, así que no hay nada que restituir.
 */
export class SlimDownAssets1786390000000 implements MigrationInterface {
  name = 'SlimDownAssets1786390000000';

  private readonly columnas = [
    'description',
    'category',
    'subCategory',
    'barcodeNumber',
    'purchasePrice',
    'purchaseDate',
    'vendor',
    'invoiceNumber',
    'warrantyInfo',
    'warrantyExpiry',
    'depreciationMethod',
    'usefulLifeYears',
    'salvageValue',
    'currentValue',
    'accumulatedDepreciation',
    'monthlyDepreciation',
    'room',
    'building',
    'floor',
    'lastMaintenanceDate',
    'nextMaintenanceDate',
    'maintenanceIntervalMonths',
    'totalMaintenanceCost',
    'specifications',
    'attachments',
    'assigned_to',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "asset_maintenance"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."asset_maintenance_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."asset_maintenance_status_enum"`);

    for (const columna of this.columnas) {
      await queryRunner.query(`ALTER TABLE "assets" DROP COLUMN IF EXISTS "${columna}"`);
    }
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."assets_depreciationmethod_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."assets_depreciationmethod_enum" AS ENUM('straight_line', 'declining_balance', 'units_of_production', 'no_depreciation')`,
    );
    await queryRunner.query(`
      ALTER TABLE "assets"
        ADD COLUMN "description" text,
        ADD COLUMN "category" text,
        ADD COLUMN "subCategory" text,
        ADD COLUMN "barcodeNumber" text,
        ADD COLUMN "purchasePrice" numeric(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN "purchaseDate" date,
        ADD COLUMN "vendor" text,
        ADD COLUMN "invoiceNumber" text,
        ADD COLUMN "warrantyInfo" text,
        ADD COLUMN "warrantyExpiry" date,
        ADD COLUMN "depreciationMethod" "public"."assets_depreciationmethod_enum" NOT NULL DEFAULT 'straight_line',
        ADD COLUMN "usefulLifeYears" integer NOT NULL DEFAULT 5,
        ADD COLUMN "salvageValue" numeric(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN "currentValue" numeric(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN "accumulatedDepreciation" numeric(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN "monthlyDepreciation" numeric(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN "room" text,
        ADD COLUMN "building" text,
        ADD COLUMN "floor" text,
        ADD COLUMN "lastMaintenanceDate" date,
        ADD COLUMN "nextMaintenanceDate" date,
        ADD COLUMN "maintenanceIntervalMonths" integer NOT NULL DEFAULT 12,
        ADD COLUMN "totalMaintenanceCost" numeric(10,2) NOT NULL DEFAULT 0,
        ADD COLUMN "specifications" json,
        ADD COLUMN "attachments" json,
        ADD COLUMN "assigned_to" uuid
    `);
    await queryRunner.query(
      `ALTER TABLE "assets" ADD CONSTRAINT "FK_assets_assigned_to" FOREIGN KEY ("assigned_to") REFERENCES "users"("id")`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."asset_maintenance_type_enum" AS ENUM('Preventivo', 'Correctivo', 'Emergencia', 'Calibración', 'Inspección')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."asset_maintenance_status_enum" AS ENUM('Programado', 'En Progreso', 'Completado', 'Cancelado', 'Retrasado')`,
    );
    await queryRunner.query(`
      CREATE TABLE "asset_maintenance" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" text NOT NULL,
        "description" text,
        "type" "public"."asset_maintenance_type_enum" NOT NULL DEFAULT 'Preventivo',
        "status" "public"."asset_maintenance_status_enum" NOT NULL DEFAULT 'Programado',
        "scheduledDate" date NOT NULL,
        "completedDate" date,
        "estimatedCost" numeric(10,2),
        "actualCost" numeric(10,2),
        "technician" text,
        "vendor" text,
        "workPerformed" text,
        "partsReplaced" text,
        "notes" text,
        "priority" integer NOT NULL DEFAULT 2,
        "nextScheduledDate" date,
        "isActive" boolean NOT NULL DEFAULT true,
        "asset_id" uuid,
        "scheduled_by" uuid,
        "completed_by" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_asset_maintenance" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "asset_maintenance" ADD CONSTRAINT "FK_asset_maintenance_asset" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE`,
    );
  }
}
