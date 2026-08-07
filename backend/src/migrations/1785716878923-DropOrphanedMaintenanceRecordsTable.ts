import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * `maintenance_records` era una segunda tabla de mantenimiento, paralela y sin
 * relación con `asset_maintenance` (la que sí usa AssetsService). La clase
 * MaintenanceRecord que la mapeaba en código (asset.entity.ts) nunca estuvo
 * registrada en app.module.ts/data-source.ts — TypeORM nunca la tocó, 0 filas
 * desde su creación. Remanente confuso de un refactor previo; se elimina.
 */
export class DropOrphanedMaintenanceRecordsTable1785716878923 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "maintenance_records"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "maintenance_records" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "type" text NOT NULL,
                "description" text NOT NULL,
                "scheduledDate" date NOT NULL,
                "completedDate" date,
                "cost" numeric(10,2) NOT NULL,
                "vendor" text,
                "technician" text,
                "workPerformed" text,
                "partsReplaced" text,
                "notes" text,
                "status" text NOT NULL DEFAULT 'scheduled',
                "isActive" boolean NOT NULL DEFAULT true,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "asset_id" uuid,
                "scheduled_by" uuid,
                "completed_by" uuid,
                CONSTRAINT "PK_287b838a22e8c8804262ccdb6a1" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`ALTER TABLE "maintenance_records" ADD CONSTRAINT "FK_1ac733e3894ecbb2059fcaaeeb7" FOREIGN KEY ("scheduled_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "maintenance_records" ADD CONSTRAINT "FK_b3b2598eb0923a5a7a9f2151596" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "maintenance_records" ADD CONSTRAINT "FK_cd619a2867190f188d9347c896f" FOREIGN KEY ("completed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
