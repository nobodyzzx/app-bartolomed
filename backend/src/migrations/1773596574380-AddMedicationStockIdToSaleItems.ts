import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMedicationStockIdToSaleItems1773596574380 implements MigrationInterface {
    name = 'AddMedicationStockIdToSaleItems1773596574380'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pharmacy_sale_items" ADD "medicationStockId" uuid`);
        await queryRunner.query(`ALTER TABLE "pharmacy_sale_items" ADD "medication_stock_id" uuid`);
        await queryRunner.query(`ALTER TABLE "pharmacy_sale_items" ADD CONSTRAINT "FK_7252a4b1e1cead0586fab4fbe6c" FOREIGN KEY ("medication_stock_id") REFERENCES "medication_stock"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pharmacy_sale_items" DROP CONSTRAINT "FK_7252a4b1e1cead0586fab4fbe6c"`);
        await queryRunner.query(`ALTER TABLE "pharmacy_sale_items" DROP COLUMN "medication_stock_id"`);
        await queryRunner.query(`ALTER TABLE "pharmacy_sale_items" DROP COLUMN "medicationStockId"`);
    }

}
