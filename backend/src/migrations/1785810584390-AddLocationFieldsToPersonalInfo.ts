import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLocationFieldsToPersonalInfo1785810584390 implements MigrationInterface {
    name = 'AddLocationFieldsToPersonalInfo1785810584390'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "personal_info" ADD "city" text`);
        await queryRunner.query(`ALTER TABLE "personal_info" ADD "state" text`);
        await queryRunner.query(`ALTER TABLE "personal_info" ADD "country" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "personal_info" DROP COLUMN "country"`);
        await queryRunner.query(`ALTER TABLE "personal_info" DROP COLUMN "state"`);
        await queryRunner.query(`ALTER TABLE "personal_info" DROP COLUMN "city"`);
    }
}
