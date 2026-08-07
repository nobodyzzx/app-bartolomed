import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cargos + precios en laboratorio (Fase 2 de facturación unificada).
 *
 * `charges` incluye ya los campos de descuento (`list_price`/`unit_price`/
 * `discount_*`) aunque el descuento se aplique recién en la Fase 3: así el
 * punto de cobro no necesita otra migración.
 *
 * NOTA: la migración autogenerada arrastró el ruido incidental de siempre
 * (índices de `audit_logs`/`purchase_orders`/`assets`, default de
 * `pharmacy_sales.taxRate`) — incluido el `DROP COLUMN`+`ADD` sobre
 * `audit_logs` que borraría ese dato en todo el historial. Filtrado a mano.
 * Los nombres de FK son los hashes que computa TypeORM, para que un
 * `migration:generate` posterior no los vea como cambio pendiente.
 */
export class CreateChargesAndLabPricing1785941209995 implements MigrationInterface {
  name = 'CreateChargesAndLabPricing1785941209995';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."charges_origin_enum" AS ENUM('consultation', 'laboratory', 'pharmacy', 'other')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."charges_discount_display_enum" AS ENUM('itemized', 'absorbed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."charges_status_enum" AS ENUM('pending', 'invoiced', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "charges" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "clinic_id" uuid NOT NULL,
        "patient_id" uuid,
        "patient_name" text,
        "origin" "public"."charges_origin_enum" NOT NULL DEFAULT 'other',
        "origin_id" uuid,
        "service_price_id" uuid,
        "description" text NOT NULL,
        "quantity" integer NOT NULL DEFAULT '1',
        "list_price" numeric(10,2) NOT NULL,
        "unit_price" numeric(10,2) NOT NULL,
        "discount_amount" numeric(10,2) NOT NULL DEFAULT '0',
        "discount_reason" text,
        "discount_authorized_by" uuid,
        "discount_display" "public"."charges_discount_display_enum" NOT NULL DEFAULT 'itemized',
        "total" numeric(10,2) NOT NULL,
        "status" "public"."charges_status_enum" NOT NULL DEFAULT 'pending',
        "invoice_id" uuid,
        "created_by" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        CONSTRAINT "PK_0c6feb10df0fa460714f8464dce" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_charges_clinic_created" ON "charges" ("clinic_id", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_charges_clinic_patient_status" ON "charges" ("clinic_id", "patient_id", "status")`,
    );

    // Paciente derivado de otro consultorio: viene solo por el examen y no
    // tiene ficha. `patient_id` ya era nullable en el esquema.
    await queryRunner.query(`ALTER TABLE "lab_orders" ADD "patient_name" text`);
    await queryRunner.query(`ALTER TABLE "lab_order_items" ADD "unit_price" numeric(10,2)`);
    await queryRunner.query(`ALTER TABLE "lab_order_items" ADD "service_price_id" uuid`);

    await queryRunner.query(
      `ALTER TABLE "charges" ADD CONSTRAINT "FK_00d0ff96fc5b5320091eabcf228" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "charges" ADD CONSTRAINT "FK_96d8ab5d4ad79448e2b1fc5da44" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "charges" ADD CONSTRAINT "FK_72765af2108b3e281d8aead9cd9" FOREIGN KEY ("discount_authorized_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "charges" ADD CONSTRAINT "FK_8fa7e7c7b1566945ff58bae7193" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "charges" DROP CONSTRAINT "FK_8fa7e7c7b1566945ff58bae7193"`);
    await queryRunner.query(`ALTER TABLE "charges" DROP CONSTRAINT "FK_72765af2108b3e281d8aead9cd9"`);
    await queryRunner.query(`ALTER TABLE "charges" DROP CONSTRAINT "FK_96d8ab5d4ad79448e2b1fc5da44"`);
    await queryRunner.query(`ALTER TABLE "charges" DROP CONSTRAINT "FK_00d0ff96fc5b5320091eabcf228"`);
    await queryRunner.query(`ALTER TABLE "lab_order_items" DROP COLUMN "service_price_id"`);
    await queryRunner.query(`ALTER TABLE "lab_order_items" DROP COLUMN "unit_price"`);
    await queryRunner.query(`ALTER TABLE "lab_orders" DROP COLUMN "patient_name"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_charges_clinic_patient_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_charges_clinic_created"`);
    await queryRunner.query(`DROP TABLE "charges"`);
    await queryRunner.query(`DROP TYPE "public"."charges_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."charges_discount_display_enum"`);
    await queryRunner.query(`DROP TYPE "public"."charges_origin_enum"`);
  }
}
