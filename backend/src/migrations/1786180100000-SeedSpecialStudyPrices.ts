import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Da de alta los tres estudios especiales en el tarifario de cada clínica.
 *
 * Va en una migración aparte de `AddSpecialStudies` a propósito: Postgres no
 * deja usar un valor de enum recién añadido dentro de la misma transacción que
 * lo creó ("unsafe use of new value"), y `special_study` se agrega allí.
 *
 * **Inactivos y sin precio**: no hay tarifa acordada todavía. Así no aparecen
 * en el selector de estudios y nadie puede pedirlos —ni generar un cargo de
 * Bs 0— hasta que se les fije precio desde el tarifario y se activen.
 *
 * La cauterización no está: es un procedimiento terapéutico, no un estudio
 * diagnóstico, y no pertenece a este catálogo.
 */
export class SeedSpecialStudyPrices1786180100000 implements MigrationInterface {
  name = 'SeedSpecialStudyPrices1786180100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "service_prices"
        ("code", "name", "description", "category", "price", "is_active",
         "turnaround_min_days", "turnaround_max_days", "clinic_id")
      SELECT v.code, v.name, v.description, 'special_study', 0, false, v.tmin, v.tmax, c.id
      FROM "clinics" c
      CROSS JOIN (VALUES
        ('ESP-ECO', 'Ecografía', 'Estudio por ultrasonido', 0, 0),
        ('ESP-COL', 'Colonoscopía', 'Endoscopía baja; requiere preparación previa y consentimiento', 1, 3),
        ('ESP-ECG', 'Electrocardiograma', 'Registro de la actividad eléctrica del corazón', 0, 0)
      ) AS v(code, name, description, tmin, tmax)
      ON CONFLICT ON CONSTRAINT "uq_service_price_clinic_code" DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "service_prices" WHERE "code" IN ('ESP-ECO', 'ESP-COL', 'ESP-ECG')`,
    );
  }
}
