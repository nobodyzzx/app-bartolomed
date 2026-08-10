import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Clínica de destino en los movimientos de activos.
 *
 * Hasta ahora un movimiento vivía en una sola clínica y por eso solo podía ir de
 * un ambiente a otro de la misma. San Bartolomé y Virgen de las Nieves están a
 * una puerta de distancia y las cosas cruzan a diario, así que el movimiento en
 * un paso —el mismo que ya se usa dentro de la clínica— tiene que poder
 * cruzarla.
 *
 * Nula en los movimientos internos, que son la mayoría: `clinic_id` sigue siendo
 * el origen y esta columna solo se llena cuando el ítem cambió de dueña.
 */
export class AddMovementTargetClinic1786410000000 implements MigrationInterface {
  name = 'AddMovementTargetClinic1786410000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "asset_movements" ADD COLUMN "to_clinic_id" uuid`);
    await queryRunner.query(`
      ALTER TABLE "asset_movements"
        ADD CONSTRAINT "FK_asset_movements_to_clinic"
        FOREIGN KEY ("to_clinic_id") REFERENCES "clinics"("id") ON DELETE SET NULL
    `);
    // El historial se consulta por origen O destino: sin este índice la clínica
    // que recibe hace un recorrido completo de la tabla para ver qué le llegó.
    await queryRunner.query(
      `CREATE INDEX "IDX_asset_movements_to_clinic" ON "asset_movements" ("to_clinic_id", "createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_asset_movements_to_clinic"`);
    await queryRunner.query(`ALTER TABLE "asset_movements" DROP CONSTRAINT "FK_asset_movements_to_clinic"`);
    await queryRunner.query(`ALTER TABLE "asset_movements" DROP COLUMN "to_clinic_id"`);
  }
}
