import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateLabOrders1785842543674 implements MigrationInterface {
    name = 'CreateLabOrders1785842543674'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."lab_orders_status_enum" AS ENUM('requested', 'sample_collected', 'in_progress', 'completed', 'cancelled')`);
        await queryRunner.query(`CREATE TABLE "lab_orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "orderNumber" text NOT NULL, "status" "public"."lab_orders_status_enum" NOT NULL DEFAULT 'requested', "orderDate" date NOT NULL, "clinicalNotes" text, "isUrgent" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "patient_id" uuid, "doctor_id" uuid, "clinic_id" uuid, "medical_record_id" uuid, "created_by" uuid, CONSTRAINT "PK_a488d533e758e6ba02958198f1c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ff518a7619912ab46178539373" ON "lab_orders" ("clinic_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_f6b7ba8ab832741b68ad60fedb" ON "lab_orders" ("clinic_id", "createdAt") `);
        await queryRunner.query(`CREATE TYPE "public"."lab_order_items_category_enum" AS ENUM('blood', 'imaging', 'other')`);
        await queryRunner.query(`CREATE TABLE "lab_order_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "testName" text NOT NULL, "category" "public"."lab_order_items_category_enum" NOT NULL DEFAULT 'other', "specimenType" text, "resultValue" text, "resultUnit" text, "referenceRange" text, "isAbnormal" boolean NOT NULL DEFAULT false, "resultNotes" text, "resultFileUrl" text, "collectedAt" TIMESTAMP WITH TIME ZONE, "resultedAt" TIMESTAMP WITH TIME ZONE, "validatedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "entered_by" uuid, "validated_by" uuid, "order_id" uuid, CONSTRAINT "PK_3447771b48b27a3882eb689b41d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "lab_orders" ADD CONSTRAINT "FK_b2d20a4e73dd2b139e08db51e8f" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lab_orders" ADD CONSTRAINT "FK_67ddcdf2806aefa07f6e9b3db8a" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lab_orders" ADD CONSTRAINT "FK_ff518a7619912ab46178539373c" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lab_orders" ADD CONSTRAINT "FK_96ad2b94ed32a6a166e52d0feec" FOREIGN KEY ("medical_record_id") REFERENCES "medical_records"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lab_orders" ADD CONSTRAINT "FK_a3a7e9603f0c542d71fdc0cd702" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lab_order_items" ADD CONSTRAINT "FK_49f7b8ef0cb4833a7b1ee05a6bc" FOREIGN KEY ("entered_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lab_order_items" ADD CONSTRAINT "FK_ab05d6ac24b86d3045df3f46aab" FOREIGN KEY ("validated_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lab_order_items" ADD CONSTRAINT "FK_9ec251f9ba811b2e24bb0c41a7e" FOREIGN KEY ("order_id") REFERENCES "lab_orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lab_order_items" DROP CONSTRAINT "FK_9ec251f9ba811b2e24bb0c41a7e"`);
        await queryRunner.query(`ALTER TABLE "lab_order_items" DROP CONSTRAINT "FK_ab05d6ac24b86d3045df3f46aab"`);
        await queryRunner.query(`ALTER TABLE "lab_order_items" DROP CONSTRAINT "FK_49f7b8ef0cb4833a7b1ee05a6bc"`);
        await queryRunner.query(`ALTER TABLE "lab_orders" DROP CONSTRAINT "FK_a3a7e9603f0c542d71fdc0cd702"`);
        await queryRunner.query(`ALTER TABLE "lab_orders" DROP CONSTRAINT "FK_96ad2b94ed32a6a166e52d0feec"`);
        await queryRunner.query(`ALTER TABLE "lab_orders" DROP CONSTRAINT "FK_ff518a7619912ab46178539373c"`);
        await queryRunner.query(`ALTER TABLE "lab_orders" DROP CONSTRAINT "FK_67ddcdf2806aefa07f6e9b3db8a"`);
        await queryRunner.query(`ALTER TABLE "lab_orders" DROP CONSTRAINT "FK_b2d20a4e73dd2b139e08db51e8f"`);
        await queryRunner.query(`DROP TABLE "lab_order_items"`);
        await queryRunner.query(`DROP TYPE "public"."lab_order_items_category_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f6b7ba8ab832741b68ad60fedb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ff518a7619912ab46178539373"`);
        await queryRunner.query(`DROP TABLE "lab_orders"`);
        await queryRunner.query(`DROP TYPE "public"."lab_orders_status_enum"`);
    }

}
