import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * AssetInventory (tabla asset_inventory) nunca tuvo un controller/service que
 * la usara — quedó registrada en TypeORM (app.module.ts/data-source.ts) sin
 * ningún endpoint REST, con 0 filas desde que se creó. El frontend tenía un
 * servicio completo en paralelo (AssetInventoryControlService) apuntando a
 * endpoints /assets/inventory/* que tampoco existían. Se eliminan ambos lados
 * huérfanos; acá se dropea la tabla y sus enums.
 */
export class DropOrphanedAssetInventoryTable1785716800784 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "asset_inventory"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."asset_inventory_type_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."asset_inventory_status_enum"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."asset_inventory_type_enum" AS ENUM ('Periódico', 'Anual', 'Auditoría', 'Puntual')`);
        await queryRunner.query(`CREATE TYPE "public"."asset_inventory_status_enum" AS ENUM ('Pendiente', 'En Proceso', 'Completado', 'Con Discrepancias')`);
        await queryRunner.query(`
            CREATE TABLE "asset_inventory" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "title" character varying(200) NOT NULL,
                "description" text,
                "type" "public"."asset_inventory_type_enum" NOT NULL DEFAULT 'Periódico',
                "status" "public"."asset_inventory_status_enum" NOT NULL DEFAULT 'Pendiente',
                "inventoryDate" date NOT NULL,
                "quantity" integer NOT NULL DEFAULT 1,
                "previousQuantity" integer,
                "countedQuantity" integer,
                "variance" integer,
                "location" character varying(200),
                "previousLocation" character varying(200),
                "condition" character varying(100),
                "previousCondition" character varying(100),
                "unitValue" numeric(12,2),
                "totalValue" numeric(12,2),
                "notes" text,
                "discrepancyReason" text,
                "requiresVerification" boolean NOT NULL DEFAULT false,
                "isVerified" boolean NOT NULL DEFAULT false,
                "verificationDate" date,
                "metadata" json,
                "asset_id" uuid NOT NULL,
                "clinic_id" uuid,
                "performed_by" uuid,
                "verified_by" uuid,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_891962d9ab0269bdb51433ceb47" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_54db93dd64727defaf77568c4a" ON "asset_inventory" ("clinic_id")`);
        await queryRunner.query(`ALTER TABLE "asset_inventory" ADD CONSTRAINT "FK_500971475743fe0b9dcf6af7478" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_inventory" ADD CONSTRAINT "FK_54db93dd64727defaf77568c4a3" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_inventory" ADD CONSTRAINT "FK_5d7596ec93f18acc0fd22dbc9f5" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_inventory" ADD CONSTRAINT "FK_76c7f6c61effb9836d14f1d7685" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
