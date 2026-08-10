import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Las dos piezas que le faltaban al inventario para dejar de ser una foto.
 *
 * **`asset_movements`** — traspasos entre ambientes de la misma clínica. Es lo
 * que pasa a diario y no dejaba rastro: mover una silla del Consultorio 1 a la
 * Sala de Espera era editar el campo Ambiente, sin registro de quién ni cuándo.
 * El flujo de `asset_transfers` no cubre esto —exige clínica destino distinta y
 * pasa por solicitud, despacho y recepción— y se conserva para lo que sí es un
 * traslado entre clínicas.
 *
 * **`inventory_counts` / `inventory_count_items`** — la toma de inventario
 * físico. La hoja de conteo se imprimía, alguien la recorría con un lápiz y el
 * papel terminaba en un cajón: no había dónde cargar el resultado ni forma de
 * responder qué faltó desde la última vez. Ahora el conteo congela lo esperado
 * al abrirse, se cargan las unidades halladas y al cerrarlo ajusta el inventario
 * dejando el acta de diferencias.
 *
 * `countedQuantity` admite NULL a propósito: "sin contar todavía" no es lo mismo
 * que "contado cero", que es un ítem que no apareció.
 */
export class AddMovementsAndCounts1786400000000 implements MigrationInterface {
  name = 'AddMovementsAndCounts1786400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "asset_movements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "asset_id" uuid NOT NULL,
        "assetName" text NOT NULL,
        "fromLocation" text,
        "toLocation" text NOT NULL,
        "quantity" integer NOT NULL,
        "target_asset_id" uuid,
        "notes" text,
        "moved_by" uuid,
        "clinic_id" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_asset_movements" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_asset_movements_quantity_positive" CHECK ("quantity" > 0)
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "asset_movements" ADD CONSTRAINT "FK_asset_movements_asset" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_movements" ADD CONSTRAINT "FK_asset_movements_moved_by" FOREIGN KEY ("moved_by") REFERENCES "users"("id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_movements" ADD CONSTRAINT "FK_asset_movements_clinic" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_asset_movements_clinic_created" ON "asset_movements" ("clinic_id", "createdAt")`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."inventory_counts_status_enum" AS ENUM('open', 'closed', 'cancelled')`,
    );
    await queryRunner.query(`
      CREATE TABLE "inventory_counts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "countNumber" text NOT NULL,
        "location" text,
        "status" "public"."inventory_counts_status_enum" NOT NULL DEFAULT 'open',
        "notes" text,
        "started_by" uuid,
        "closed_by" uuid,
        "closedAt" TIMESTAMP,
        "clinic_id" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_inventory_counts" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_inventory_counts_number" UNIQUE ("countNumber")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "inventory_counts" ADD CONSTRAINT "FK_inventory_counts_started_by" FOREIGN KEY ("started_by") REFERENCES "users"("id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_counts" ADD CONSTRAINT "FK_inventory_counts_closed_by" FOREIGN KEY ("closed_by") REFERENCES "users"("id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_counts" ADD CONSTRAINT "FK_inventory_counts_clinic" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inventory_counts_clinic_created" ON "inventory_counts" ("clinic_id", "createdAt")`,
    );

    await queryRunner.query(`
      CREATE TABLE "inventory_count_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "count_id" uuid NOT NULL,
        "asset_id" uuid NOT NULL,
        "assetName" text NOT NULL,
        "assetTag" text,
        "expectedQuantity" integer NOT NULL,
        "countedQuantity" integer,
        "notes" text,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_inventory_count_items" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_inventory_count_items_asset" UNIQUE ("count_id", "asset_id"),
        CONSTRAINT "CHK_inventory_count_items_counted_not_negative" CHECK ("countedQuantity" IS NULL OR "countedQuantity" >= 0)
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "inventory_count_items" ADD CONSTRAINT "FK_inventory_count_items_count" FOREIGN KEY ("count_id") REFERENCES "inventory_counts"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_count_items" ADD CONSTRAINT "FK_inventory_count_items_asset" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inventory_count_items_count" ON "inventory_count_items" ("count_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_count_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_counts"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."inventory_counts_status_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "asset_movements"`);
  }
}
