import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLogs1774958400000 implements MigrationInterface {
  name = 'CreateAuditLogs1774958400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE audit_logs (
        id              UUID          NOT NULL DEFAULT gen_random_uuid(),
        action          VARCHAR(20)   NOT NULL,
        resource        VARCHAR(120)  NOT NULL,
        "resourceId"    VARCHAR(255),
        "userId"        VARCHAR(255),
        "userEmail"     VARCHAR(255),
        "userName"      VARCHAR(255),
        "clinicId"      VARCHAR(255),
        details         JSONB,
        "ipAddress"     VARCHAR(50),
        method          VARCHAR(10)   NOT NULL,
        path            VARCHAR(500)  NOT NULL,
        "statusCode"    INTEGER       NOT NULL,
        status          VARCHAR(10)   NOT NULL DEFAULT 'success',
        "createdAt"     TIMESTAMP     NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY (id)
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_createdAt"  ON audit_logs ("createdAt" DESC)`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_userEmail"  ON audit_logs ("userEmail")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_action"     ON audit_logs (action)`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_resource"   ON audit_logs (resource)`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_status"     ON audit_logs (status)`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_clinicId"   ON audit_logs ("clinicId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs`);
  }
}
