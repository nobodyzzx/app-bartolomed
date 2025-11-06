import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRelatedRecordToMedicalRecords1730847600000 implements MigrationInterface {
  name = 'AddRelatedRecordToMedicalRecords1730847600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Agregar columna related_record_id con foreign key a la misma tabla
    await queryRunner.query(`
      ALTER TABLE "medical_records" 
      ADD COLUMN "related_record_id" uuid NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "medical_records" 
      ADD CONSTRAINT "FK_medical_records_related_record" 
      FOREIGN KEY ("related_record_id") 
      REFERENCES "medical_records"("id") 
      ON DELETE SET NULL 
      ON UPDATE NO ACTION
    `);

    // Crear índice para mejorar consultas
    await queryRunner.query(`
      CREATE INDEX "IDX_medical_records_related_record" 
      ON "medical_records" ("related_record_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar índice
    await queryRunner.query(`DROP INDEX "IDX_medical_records_related_record"`);

    // Eliminar foreign key
    await queryRunner.query(`
      ALTER TABLE "medical_records" 
      DROP CONSTRAINT "FK_medical_records_related_record"
    `);

    // Eliminar columna
    await queryRunner.query(`ALTER TABLE "medical_records" DROP COLUMN "related_record_id"`);
  }
}
