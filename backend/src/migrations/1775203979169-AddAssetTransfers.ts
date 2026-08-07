import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAssetTransfers1775203979169 implements MigrationInterface {
    name = 'AddAssetTransfers1775203979169'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."asset_transfers_status_enum" AS ENUM('requested', 'in_transit', 'completed', 'rejected', 'returned')`);
        await queryRunner.query(`CREATE TABLE "asset_transfers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "transferNumber" character varying(20) NOT NULL, "source_clinic_id" uuid NOT NULL, "target_clinic_id" uuid NOT NULL, "status" "public"."asset_transfers_status_enum" NOT NULL DEFAULT 'requested', "notes" text, "requested_by_id" uuid NOT NULL, "dispatched_by_id" uuid, "dispatchedAt" TIMESTAMP WITH TIME ZONE, "received_by_id" uuid, "receivedAt" TIMESTAMP WITH TIME ZONE, "rejectionReason" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_931f13b6ce7b1d8bf789a4c2bbd" UNIQUE ("transferNumber"), CONSTRAINT "PK_ba9dc8ea271c20ab7375000e4af" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5604b6be6003612fda388f23ca" ON "asset_transfers" ("target_clinic_id", "createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_50e202135c8778560af6e72bff" ON "asset_transfers" ("source_clinic_id", "createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_fc163c2730ced5cffe78f52552" ON "asset_transfers" ("target_clinic_id", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_79bb628cc53d516a4600313aa3" ON "asset_transfers" ("source_clinic_id", "status") `);
        await queryRunner.query(`CREATE TABLE "asset_transfer_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "transfer_id" uuid NOT NULL, "asset_id" uuid NOT NULL, "notes" text, CONSTRAINT "PK_8897232b72cf8fbbe22a91071d7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."asset_transfer_audit_logs_action_enum" AS ENUM('requested', 'dispatched', 'completed', 'rejected', 'returned')`);
        await queryRunner.query(`CREATE TABLE "asset_transfer_audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "transfer_id" character varying NOT NULL, "action" "public"."asset_transfer_audit_logs_action_enum" NOT NULL, "actor_id" uuid NOT NULL, "actor_clinic_id" uuid NOT NULL, "snapshot" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d317fc3dd0eb2ced69de7d07367" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0ec8dba17f9c293225eff2ef4b" ON "asset_transfer_audit_logs" ("transfer_id", "createdAt") `);
        await queryRunner.query(`ALTER TYPE "public"."pharmacy_sales_paymentmethod_enum" RENAME TO "pharmacy_sales_paymentmethod_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."pharmacy_sales_paymentmethod_enum" AS ENUM('cash', 'card', 'transfer', 'insurance', 'mixed', 'qr')`);
        await queryRunner.query(`ALTER TABLE "pharmacy_sales" ALTER COLUMN "paymentMethod" TYPE "public"."pharmacy_sales_paymentmethod_enum" USING "paymentMethod"::"text"::"public"."pharmacy_sales_paymentmethod_enum"`);
        await queryRunner.query(`DROP TYPE "public"."pharmacy_sales_paymentmethod_enum_old"`);
        await queryRunner.query(`ALTER TABLE "asset_transfers" ADD CONSTRAINT "FK_0680522b7bbbd8dfee7c167ef2f" FOREIGN KEY ("source_clinic_id") REFERENCES "clinics"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_transfers" ADD CONSTRAINT "FK_8b9cd6599a1406d00fcea1bf241" FOREIGN KEY ("target_clinic_id") REFERENCES "clinics"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_transfers" ADD CONSTRAINT "FK_81deb26f37e7c172f387294b5fd" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_transfers" ADD CONSTRAINT "FK_f5bcc3e8211c11b0656a16622e3" FOREIGN KEY ("dispatched_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_transfers" ADD CONSTRAINT "FK_964035fbaeb355cefaf5d3b1c80" FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_transfer_items" ADD CONSTRAINT "FK_36c5029589ef2ad7e1708f642f2" FOREIGN KEY ("transfer_id") REFERENCES "asset_transfers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_transfer_items" ADD CONSTRAINT "FK_6f5c5f63ef102af37259acf276c" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_transfer_audit_logs" ADD CONSTRAINT "FK_aaae291ba67140c0fec9953ab24" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_transfer_audit_logs" ADD CONSTRAINT "FK_41d5c64a9e023feded243661c41" FOREIGN KEY ("actor_clinic_id") REFERENCES "clinics"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "asset_transfer_audit_logs" DROP CONSTRAINT "FK_41d5c64a9e023feded243661c41"`);
        await queryRunner.query(`ALTER TABLE "asset_transfer_audit_logs" DROP CONSTRAINT "FK_aaae291ba67140c0fec9953ab24"`);
        await queryRunner.query(`ALTER TABLE "asset_transfer_items" DROP CONSTRAINT "FK_6f5c5f63ef102af37259acf276c"`);
        await queryRunner.query(`ALTER TABLE "asset_transfer_items" DROP CONSTRAINT "FK_36c5029589ef2ad7e1708f642f2"`);
        await queryRunner.query(`ALTER TABLE "asset_transfers" DROP CONSTRAINT "FK_964035fbaeb355cefaf5d3b1c80"`);
        await queryRunner.query(`ALTER TABLE "asset_transfers" DROP CONSTRAINT "FK_f5bcc3e8211c11b0656a16622e3"`);
        await queryRunner.query(`ALTER TABLE "asset_transfers" DROP CONSTRAINT "FK_81deb26f37e7c172f387294b5fd"`);
        await queryRunner.query(`ALTER TABLE "asset_transfers" DROP CONSTRAINT "FK_8b9cd6599a1406d00fcea1bf241"`);
        await queryRunner.query(`ALTER TABLE "asset_transfers" DROP CONSTRAINT "FK_0680522b7bbbd8dfee7c167ef2f"`);
        await queryRunner.query(`CREATE TYPE "public"."pharmacy_sales_paymentmethod_enum_old" AS ENUM('cash', 'card', 'transfer', 'insurance', 'mixed')`);
        await queryRunner.query(`ALTER TABLE "pharmacy_sales" ALTER COLUMN "paymentMethod" TYPE "public"."pharmacy_sales_paymentmethod_enum_old" USING "paymentMethod"::"text"::"public"."pharmacy_sales_paymentmethod_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."pharmacy_sales_paymentmethod_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."pharmacy_sales_paymentmethod_enum_old" RENAME TO "pharmacy_sales_paymentmethod_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0ec8dba17f9c293225eff2ef4b"`);
        await queryRunner.query(`DROP TABLE "asset_transfer_audit_logs"`);
        await queryRunner.query(`DROP TYPE "public"."asset_transfer_audit_logs_action_enum"`);
        await queryRunner.query(`DROP TABLE "asset_transfer_items"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_79bb628cc53d516a4600313aa3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fc163c2730ced5cffe78f52552"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_50e202135c8778560af6e72bff"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5604b6be6003612fda388f23ca"`);
        await queryRunner.query(`DROP TABLE "asset_transfers"`);
        await queryRunner.query(`DROP TYPE "public"."asset_transfers_status_enum"`);
    }

}
