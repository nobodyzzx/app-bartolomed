import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Catálogo de precios (Fase 1 de facturación unificada).
 *
 * NOTA: `migration:generate` arrastró ruido incidental sin relación con este
 * cambio (índices de `audit_logs`/`purchase_orders`/`assets`, default de
 * `pharmacy_sales.taxRate`) — gotcha recurrente del proyecto. Se filtró a
 * mano. En particular incluía un `DROP COLUMN`+`ADD` sobre
 * `audit_logs.resourceId`/`userId`/`clinicId`, que habría **borrado esos
 * datos en todo el historial de auditoría**.
 *
 * El nombre de la FK es el hash que TypeORM computa por sí mismo, no uno
 * legible: con un nombre propio, cada `migration:generate` posterior
 * arrastraba un rename de esta constraint como falso cambio pendiente.
 */
export class CreateServicePrices1785937806736 implements MigrationInterface {
  name = 'CreateServicePrices1785937806736';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."service_prices_category_enum" AS ENUM('consultation', 'laboratory', 'procedure', 'other')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."service_prices_appointment_type_enum" AS ENUM('consultation', 'follow_up', 'emergency', 'surgery', 'laboratory', 'imaging', 'vaccination', 'therapy', 'other')`,
    );
    await queryRunner.query(
      `CREATE TABLE "service_prices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" text NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "category" "public"."service_prices_category_enum" NOT NULL DEFAULT 'other',
        "appointment_type" "public"."service_prices_appointment_type_enum",
        "price" numeric(10,2) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "clinic_id" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        CONSTRAINT "uq_service_price_clinic_code" UNIQUE ("clinic_id", "code"),
        CONSTRAINT "PK_service_prices" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_service_prices_clinic_category" ON "service_prices" ("clinic_id", "category")`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_prices" ADD CONSTRAINT "FK_d978609b643800c81687dea5f5e" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "service_prices" DROP CONSTRAINT "FK_d978609b643800c81687dea5f5e"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_service_prices_clinic_category"`);
    await queryRunner.query(`DROP TABLE "service_prices"`);
    await queryRunner.query(`DROP TYPE "public"."service_prices_appointment_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."service_prices_category_enum"`);
  }
}
