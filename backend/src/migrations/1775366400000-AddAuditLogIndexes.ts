import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Índices compuestos sobre `audit_logs` para las queries más frecuentes:
 *   - listados/stats por clínica + rango de fechas
 *   - actividad por usuario ordenada cronológicamente
 *   - filtros globales por rango de fechas
 *
 * Sin estos índices, una tabla de auditoría con 100k+ filas obliga a
 * full-scan en cada llamada al dashboard de auditoría.
 */
export class AddAuditLogIndexes1775366400000 implements MigrationInterface {
  name = 'AddAuditLogIndexes1775366400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_clinic_created" ON "audit_logs" ("clinicId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_user_created" ON "audit_logs" ("userId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_created_at" ON "audit_logs" ("createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_created_at"`);
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_user_created"`);
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_clinic_created"`);
  }
}
