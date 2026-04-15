import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQrPaymentMethod1775201687863 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."pharmacy_sales_paymentmethod_enum" ADD VALUE IF NOT EXISTS 'qr'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL no permite eliminar valores de un enum.
    // Para revertir, recrear el tipo sin 'qr' y actualizar la columna.
  }
}
