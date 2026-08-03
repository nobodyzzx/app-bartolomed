import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * assets.service.ts validaba serialNumber único solo a nivel de aplicación
 * (check-then-act sin lock) y sin filtrar por clínica — dos creaciones
 * concurrentes con el mismo serial podían pasar ambas la validación, y de
 * paso impedía sin querer que dos clínicas usaran el mismo número de serie.
 * Índice único parcial (ignora NULLs, serialNumber es opcional) scoped por
 * clínica, para que Postgres sea la fuente de verdad final.
 */
export class AddAssetSerialNumberUniquePerClinicIndex1785716169369 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_assets_serial_number_per_clinic"
            ON "assets" ("serialNumber", "clinic_id")
            WHERE "serialNumber" IS NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."UQ_assets_serial_number_per_clinic"`);
    }

}
