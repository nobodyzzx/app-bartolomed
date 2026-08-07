import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPasswordResetToUsers1775098235088 implements MigrationInterface {
    name = 'AddPasswordResetToUsers1775098235088'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "passwordResetToken" text`);
        await queryRunner.query(`ALTER TABLE "users" ADD "passwordResetExpiresAt" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "passwordResetExpiresAt"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "passwordResetToken"`);
    }

}
