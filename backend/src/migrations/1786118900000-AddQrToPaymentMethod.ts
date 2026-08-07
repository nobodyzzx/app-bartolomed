import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * La caja general no podía registrar un cobro por QR: `payments_method_enum` no
 * tenía ese valor, aunque QR es una de las dos formas de pago que la clínica usa
 * de verdad (la otra es efectivo). El enum de farmacia sí lo tenía desde
 * 1775201687863-AddQrPaymentMethod — este arregla el que faltaba.
 *
 * Los valores en desuso (`credit_card`, `debit_card`, `bank_transfer`, `check`,
 * `insurance`, `other`) se conservan a propósito: ya hay pagos registrados con
 * ellos y los reportes agrupan por método, así que quitarlos rompería el
 * historial. Dejan de ofrecerse en la interfaz, que es lo que hacía falta.
 */
export class AddQrToPaymentMethod1786118900000 implements MigrationInterface {
  name = 'AddQrToPaymentMethod1786118900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "payments_method_enum" ADD VALUE IF NOT EXISTS 'qr'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Postgres no sabe quitar un valor de un enum: habría que recrear el tipo y
    // reescribir la columna. No compensa para un valor que, además, pasa a estar
    // en uso real en cuanto se cobre el primer QR.
  }
}
