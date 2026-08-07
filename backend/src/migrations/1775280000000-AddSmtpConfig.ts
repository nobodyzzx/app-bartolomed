import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSmtpConfig1775280000000 implements MigrationInterface {
  name = 'AddSmtpConfig1775280000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "smtp_config" (
        "id"          integer NOT NULL DEFAULT 1,
        "host"        character varying NOT NULL DEFAULT '',
        "port"        integer NOT NULL DEFAULT 587,
        "secure"      boolean NOT NULL DEFAULT false,
        "user"        character varying NOT NULL DEFAULT '',
        "pass"        character varying NOT NULL DEFAULT '',
        "from_name"   character varying NOT NULL DEFAULT 'Bartolomed',
        "from_email"  character varying NOT NULL DEFAULT '',
        "enabled"     boolean NOT NULL DEFAULT false,
        "updated_at"  TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_smtp_config" PRIMARY KEY ("id")
      )
    `);
    /* Insertar fila inicial vacía (id=1) para que GET siempre devuelva algo */
    await queryRunner.query(`INSERT INTO "smtp_config" ("id") VALUES (1) ON CONFLICT DO NOTHING`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "smtp_config"`);
  }
}
