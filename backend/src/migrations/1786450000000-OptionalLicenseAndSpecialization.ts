import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * La matrícula profesional y la especialidad dejan de ser obligatorias.
 *
 * La ficha profesional se diseñó pensando en el médico, que tiene título,
 * especialidad y matrícula. Pero el mismo formulario da de alta a enfermería,
 * recepción y administración, que no llevan matrícula, y los exigía igual. La
 * salida obligada era inventarla —«N/A», «SIN MATRÍCULA»—, y un dato inventado
 * es peor que un dato ausente: después no se distingue a quien no tiene
 * matrícula de aquel a quien no se la cargamos.
 *
 * El único consumidor de estos dos campos es el PDF de la receta, que ya
 * imprime «—» cuando faltan, así que nada se rompe por dejarlos nulos.
 *
 * El **título sí sigue siendo obligatorio**: todo el mundo tiene uno
 * —licenciado en enfermería, técnico, administrador— y es lo que identifica
 * el puesto.
 */
export class OptionalLicenseAndSpecialization1786450000000 implements MigrationInterface {
  name = 'OptionalLicenseAndSpecialization1786450000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "professional_info" ALTER COLUMN "license" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "professional_info" ALTER COLUMN "specialization" DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Volver a NOT NULL con filas en nulo haría fallar el ALTER, así que se
    // rellenan primero. Queda constancia de que el dato no existía, en vez de
    // una cadena vacía que parecería un descuido de carga.
    await queryRunner.query(`UPDATE "professional_info" SET "license" = 'SIN MATRICULA' WHERE "license" IS NULL`);
    await queryRunner.query(
      `UPDATE "professional_info" SET "specialization" = 'SIN ESPECIALIDAD' WHERE "specialization" IS NULL`,
    );
    await queryRunner.query(`ALTER TABLE "professional_info" ALTER COLUMN "license" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "professional_info" ALTER COLUMN "specialization" SET NOT NULL`);
  }
}
