import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * La clínica no procesa estos exámenes: los deriva al Laboratorio Clínico
 * Apfelbacher y espera el resultado. El flujo no reflejaba ese tramo, así que
 * una orden derivada pasaba de "muestra tomada" a "en proceso" y se quedaba
 * ahí varios días sin que nadie pudiera saber si llegó a enviarse.
 *
 * Tres cosas:
 *  - `service_prices.provider_name` marca qué estudios se derivan y a quién.
 *  - Estado `sent_to_provider` con su fecha de envío.
 *  - `expected_result_date`: cuándo debería estar el resultado, para poder
 *    decírselo al paciente y detectar las órdenes que se pasaron de plazo.
 *
 * El valor del enum se agrega con `ADD VALUE`, igual que en
 * `AddQrToPaymentMethod`: Postgres no permite quitarlo después sin recrear el
 * tipo, pero pasa a estar en uso real desde el primer envío.
 */
export class AddProviderDerivation1786160000000 implements MigrationInterface {
  name = 'AddProviderDerivation1786160000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "lab_orders_status_enum" ADD VALUE IF NOT EXISTS 'sent_to_provider' AFTER 'sample_collected'`,
    );

    await queryRunner.query(`ALTER TABLE "service_prices" ADD "provider_name" text`);
    await queryRunner.query(`ALTER TABLE "lab_orders" ADD "sent_to_provider_at" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "lab_orders" ADD "expected_result_date" date`);
    // Se copia al ítem al crear la orden, igual que el precio: así el informe
    // puede decir a qué laboratorio se mandó aunque el convenio cambie después.
    await queryRunner.query(`ALTER TABLE "lab_order_items" ADD "provider_name" text`);

    // Los 110 estudios del tarifario real vienen de ese convenio: se reconocen
    // porque son los únicos de laboratorio con costo de convenio registrado.
    await queryRunner.query(`
      UPDATE "service_prices"
      SET "provider_name" = 'Laboratorio Clínico Apfelbacher'
      WHERE "category" = 'laboratory' AND "cost_price" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Las órdenes que estén en 'sent_to_provider' no podrían volver a un estado
    // válido por sí solas: se devuelven al tramo anterior antes de nada.
    await queryRunner.query(
      `UPDATE "lab_orders" SET "status" = 'sample_collected' WHERE "status" = 'sent_to_provider'`,
    );
    await queryRunner.query(`ALTER TABLE "lab_order_items" DROP COLUMN "provider_name"`);
    await queryRunner.query(`ALTER TABLE "lab_orders" DROP COLUMN "expected_result_date"`);
    await queryRunner.query(`ALTER TABLE "lab_orders" DROP COLUMN "sent_to_provider_at"`);
    await queryRunner.query(`ALTER TABLE "service_prices" DROP COLUMN "provider_name"`);
    // El valor del enum se queda: quitarlo exige recrear el tipo y reescribir
    // la columna, y ya no hay ninguna fila que lo use.
  }
}
