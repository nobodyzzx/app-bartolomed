import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserClinics1775175864040 implements MigrationInterface {
    name = 'AddUserClinics1775175864040'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_medication_stock_clinic_expiry"`);
        await queryRunner.query(`CREATE TABLE "user_clinics" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "roles" text array NOT NULL DEFAULT '{}', "user_id" uuid, "clinic_id" uuid, CONSTRAINT "uq_user_clinic" UNIQUE ("user_id", "clinic_id"), CONSTRAINT "PK_a2a93ea4c1b877f81238152477b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "user_clinics" ADD CONSTRAINT "FK_0dc6a54f9bef29def00c4039bfc" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_clinics" ADD CONSTRAINT "FK_a083644676487e98d69c7f8f479" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_clinics" DROP CONSTRAINT "FK_a083644676487e98d69c7f8f479"`);
        await queryRunner.query(`ALTER TABLE "user_clinics" DROP CONSTRAINT "FK_0dc6a54f9bef29def00c4039bfc"`);
        await queryRunner.query(`DROP TABLE "user_clinics"`);
        await queryRunner.query(`CREATE INDEX "IDX_medication_stock_clinic_expiry" ON "medication_stock" ("expiryDate", "clinic_id") WHERE ("isActive" = true)`);
    }

}
