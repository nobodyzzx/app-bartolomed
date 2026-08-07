import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveOtherFromPatientGender1785603975161 implements MigrationInterface {
    name = 'RemoveOtherFromPatientGender1785603975161'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."patients_gender_enum" RENAME TO "patients_gender_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."patients_gender_enum" AS ENUM('male', 'female')`);
        await queryRunner.query(`ALTER TABLE "patients" ALTER COLUMN "gender" TYPE "public"."patients_gender_enum" USING "gender"::"text"::"public"."patients_gender_enum"`);
        await queryRunner.query(`DROP TYPE "public"."patients_gender_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."patients_gender_enum_old" AS ENUM('male', 'female', 'other')`);
        await queryRunner.query(`ALTER TABLE "patients" ALTER COLUMN "gender" TYPE "public"."patients_gender_enum_old" USING "gender"::"text"::"public"."patients_gender_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."patients_gender_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."patients_gender_enum_old" RENAME TO "patients_gender_enum"`);
    }

}
