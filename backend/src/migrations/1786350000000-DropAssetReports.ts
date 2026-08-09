import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Retira la tabla `asset_reports` y sus tres enums.
 *
 * Era el generador de informes archivados del control de activos: se creaba una
 * fila, se guardaba dentro una copia de los datos consultados y se descargaba
 * después en PDF/Excel/CSV/JSON. Se retira por dos motivos.
 *
 * El primero es que cuatro de sus seis tipos no tenían de qué hablar contra el
 * inventario real, cargado como conteo físico por ambiente: Depreciación y
 * Financiero imprimían Bs 0,00 en las 290 filas (ningún activo tiene precio de
 * compra), Obsoletos filtraba por una condición que nadie cargó y Mantenimiento
 * no tenía un solo registro. Los reemplazan cinco informes que se apoyan en el
 * dato que sí existe — ver `AssetPrintReportsService`.
 *
 * El segundo es que archivar el resultado hace que un activo corregido deje
 * atrás un PDF que lo contradice; los nuevos se compilan al vuelo, el mismo
 * criterio que ya se aplicó al informe de resultados de laboratorio.
 *
 * Se pierde el histórico de informes generados. Son snapshots ya descargados,
 * no registros clínicos ni contables, y el `down()` recrea la estructura vacía.
 */
export class DropAssetReports1786350000000 implements MigrationInterface {
  name = 'DropAssetReports1786350000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "asset_reports"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."asset_reports_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."asset_reports_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."asset_reports_format_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."asset_reports_type_enum" AS ENUM('Por Ubicación', 'Por Estado', 'Mantenimiento', 'Depreciación', 'Obsoletos', 'Financiero')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."asset_reports_status_enum" AS ENUM('Pendiente', 'Generando', 'Completado', 'Fallido')`,
    );
    await queryRunner.query(`CREATE TYPE "public"."asset_reports_format_enum" AS ENUM('PDF', 'EXCEL', 'CSV', 'JSON')`);
    await queryRunner.query(`
      CREATE TABLE "asset_reports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying(200) NOT NULL,
        "description" text,
        "type" "public"."asset_reports_type_enum" NOT NULL DEFAULT 'Por Estado',
        "status" "public"."asset_reports_status_enum" NOT NULL DEFAULT 'Pendiente',
        "format" "public"."asset_reports_format_enum" NOT NULL DEFAULT 'PDF',
        "date" date NOT NULL,
        "dateFrom" date,
        "dateTo" date,
        "parameters" json,
        "filters" json,
        "data" json,
        "filePath" character varying(500),
        "fileSize" bigint,
        "fileName" character varying(100),
        "executionTime" text,
        "recordCount" integer,
        "errorMessage" text,
        "notes" text,
        "isScheduled" boolean NOT NULL DEFAULT false,
        "isRecurring" boolean NOT NULL DEFAULT false,
        "scheduleExpression" text,
        "nextExecutionDate" date,
        "isActive" boolean NOT NULL DEFAULT true,
        "generated_by" uuid,
        "clinic_id" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_asset_reports" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_asset_reports_clinic" ON "asset_reports" ("clinic_id")`);
    await queryRunner.query(
      `ALTER TABLE "asset_reports" ADD CONSTRAINT "FK_asset_reports_generated_by" FOREIGN KEY ("generated_by") REFERENCES "users"("id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_reports" ADD CONSTRAINT "FK_asset_reports_clinic" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id")`,
    );
  }
}
