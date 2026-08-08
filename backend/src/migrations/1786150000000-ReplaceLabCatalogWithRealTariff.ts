import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sustituye el catálogo de laboratorio de demo (10 estudios inventados) por el
 * tarifario real de la clínica: 110 estudios del Laboratorio Clínico
 * Apfelbacher, agrupados en 10 categorías clínicas.
 *
 * Dos precios por estudio, porque son cosas distintas:
 *  - `cost_price` es el **precio de convenio**: lo que ese laboratorio le cobra
 *    a la clínica por procesar el examen derivado.
 *  - `price` es lo que paga el paciente. Se inicializa en costo x 1,5
 *    redondeado hacia arriba a múltiplos de 5 (Bs 30 -> 45, Bs 155 -> 235),
 *    siguiendo el "+50%" anotado a mano en el tarifario impreso.
 *
 * > El 50% es una estimación tomada de esa anotación, no una tarifa acordada.
 * > Los precios hay que revisarlos en la pantalla de tarifario antes de
 * > facturar con ellos: no todos los exámenes llevan el mismo margen.
 *
 * Los 10 estudios anteriores se **desactivan**, no se borran: `charges` y
 * `lab_order_items` guardan su `service_price_id`, y borrarlos dejaría esas
 * referencias apuntando al vacío. Desactivados desaparecen del catálogo, que
 * es lo que se buscaba, sin tocar lo ya cobrado.
 */
export class ReplaceLabCatalogWithRealTariff1786150000000 implements MigrationInterface {
  name = 'ReplaceLabCatalogWithRealTariff1786150000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "service_prices" ADD "cost_price" numeric(10,2)`);
    await queryRunner.query(`ALTER TABLE "service_prices" ADD "lab_category" text`);
    await queryRunner.query(`ALTER TABLE "service_prices" ADD "turnaround_min_days" smallint`);
    await queryRunner.query(`ALTER TABLE "service_prices" ADD "turnaround_max_days" smallint`);
    await queryRunner.query(`ALTER TABLE "service_prices" ADD "turnaround_note" text`);

    // Fuera del catálogo, pero sin romper las referencias de lo ya cobrado.
    await queryRunner.query(
      `UPDATE "service_prices" SET "is_active" = false WHERE "category" = 'laboratory'`,
    );

    // Un juego completo por clínica: el tarifario es de la casa, no global.
    // ON CONFLICT para que reejecutarla no falle contra el único (clinic, code).
    await queryRunner.query(`
      INSERT INTO "service_prices"
        ("code", "name", "category", "lab_category", "price", "cost_price",
         "turnaround_min_days", "turnaround_max_days", "turnaround_note", "is_active", "clinic_id")
      SELECT v.code, v.name, 'laboratory', v.lab_category, v.price, v.cost,
             v.tmin, v.tmax, v.note, true, c.id
      FROM "clinics" c
      CROSS JOIN (VALUES
    ('HEM-001', 'Hemograma completo', 'HEMATOLOGIA', 45, 30.00, 0, 0, NULL),
    ('HEM-002', 'Recuento de plaquetas', 'HEMATOLOGIA', 15, 10.00, 0, 0, NULL),
    ('HEM-003', 'Recuento de reticulocitos', 'HEMATOLOGIA', 40, 25.00, 0, 0, NULL),
    ('HEM-004', 'Gota gruesa', 'HEMATOLOGIA', 25, 15.00, 0, 0, NULL),
    ('HEM-005', 'Frotis periférico', 'HEMATOLOGIA', 15, 10.00, 0, 0, NULL),
    ('HEM-006', 'Grupo sanguíneo y factor Rh', 'HEMATOLOGIA', 15, 10.00, 0, 0, NULL),
    ('HEM-007', 'Hierro sérico', 'HEMATOLOGIA', 235, 155.00, 1, 1, NULL),
    ('HEM-008', 'Ferritina', 'HEMATOLOGIA', 235, 155.00, 1, 1, NULL),
    ('COA-001', 'Tiempo de coagulación, sangría y protrombina (INR)', 'COAGULACION', 55, 35.00, 0, 0, NULL),
    ('COA-002', 'Tiempo parcial de tromboplastina activada (TPTA)', 'COAGULACION', 30, 20.00, 0, 0, NULL),
    ('COA-003', 'Dímero D', 'COAGULACION', 175, 115.00, 1, 1, NULL),
    ('COA-004', 'Fibrinógeno', 'COAGULACION', 235, 155.00, 1, 1, NULL),
    ('QMS-001', 'Glicemia en ayunas', 'QUIMICA_SANGUINEA', 40, 25.00, 0, 0, NULL),
    ('QMS-002', 'Glicemia post prandial', 'QUIMICA_SANGUINEA', 40, 25.00, 0, 0, NULL),
    ('QMS-003', 'Curva de tolerancia a la glucosa', 'QUIMICA_SANGUINEA', 100, 65.00, 0, 0, NULL),
    ('QMS-004', 'Hemoglobina glicosilada (HbA1c)', 'QUIMICA_SANGUINEA', 115, 75.00, 0, 0, NULL),
    ('QMS-005', 'Creatinina', 'QUIMICA_SANGUINEA', 40, 25.00, 0, 0, NULL),
    ('QMS-006', 'Urea', 'QUIMICA_SANGUINEA', 40, 25.00, 0, 0, NULL),
    ('QMS-007', 'Nitrógeno ureico en sangre (NUS)', 'QUIMICA_SANGUINEA', 30, 20.00, 0, 0, NULL),
    ('QMS-008', 'Colesterol total', 'QUIMICA_SANGUINEA', 40, 25.00, 0, 0, NULL),
    ('QMS-009', 'Triglicéridos', 'QUIMICA_SANGUINEA', 40, 25.00, 0, 0, NULL),
    ('QMS-010', 'Perfil lipídico HDL, VLDL, LDL', 'QUIMICA_SANGUINEA', 75, 50.00, 0, 0, NULL),
    ('QMS-011', 'Ácido úrico', 'QUIMICA_SANGUINEA', 40, 25.00, 0, 0, NULL),
    ('QMS-012', 'Proteínas totales', 'QUIMICA_SANGUINEA', 45, 30.00, 0, 0, NULL),
    ('QMS-013', 'Albúmina', 'QUIMICA_SANGUINEA', 45, 30.00, 0, 0, NULL),
    ('QMS-014', 'Globulina', 'QUIMICA_SANGUINEA', 45, 30.00, 0, 0, NULL),
    ('QMS-015', 'Relación albúmina/globulina', 'QUIMICA_SANGUINEA', 45, 30.00, 0, 0, NULL),
    ('QMS-016', 'Electrolitos (Na, K, Cl)', 'QUIMICA_SANGUINEA', 225, 150.00, 1, 1, NULL),
    ('QMS-017', 'Calcio', 'QUIMICA_SANGUINEA', 70, 45.00, 1, 1, NULL),
    ('QMS-018', 'Calcio iónico', 'QUIMICA_SANGUINEA', 100, 65.00, 1, 1, NULL),
    ('QMS-019', 'Procalcitonina', 'QUIMICA_SANGUINEA', 315, 210.00, 1, 1, NULL),
    ('QMS-020', 'Vitaminas', 'QUIMICA_SANGUINEA', 615, 410.00, 2, 3, NULL),
    ('QMS-021', 'Fósforo', 'QUIMICA_SANGUINEA', 70, 45.00, 1, 1, NULL),
    ('QMS-022', 'Magnesio', 'QUIMICA_SANGUINEA', 75, 50.00, 1, 1, NULL),
    ('QMS-023', 'Bilirrubinas total, directa e indirecta', 'QUIMICA_SANGUINEA', 85, 55.00, 0, 0, NULL),
    ('QMS-024', 'Transaminasas (GOT/GPT)', 'QUIMICA_SANGUINEA', 85, 55.00, 0, 0, NULL),
    ('QMS-025', 'Fosfatasa alcalina', 'QUIMICA_SANGUINEA', 40, 25.00, 0, 0, NULL),
    ('QMS-026', 'Gamma glutamil transferasa (GGT)', 'QUIMICA_SANGUINEA', 40, 25.00, 0, 0, NULL),
    ('QMS-027', 'Lactato deshidrogenasa (LDH)', 'QUIMICA_SANGUINEA', 40, 25.00, 0, 0, NULL),
    ('QMS-028', 'Lactato', 'QUIMICA_SANGUINEA', 400, 265.00, 0, 0, NULL),
    ('QMS-029', 'Creatinquinasa total (CK)', 'QUIMICA_SANGUINEA', 100, 65.00, 0, 0, NULL),
    ('QMS-030', 'Creatinquinasa MB (CPK-MB)', 'QUIMICA_SANGUINEA', 100, 65.00, 0, 0, NULL),
    ('QMS-031', 'Amilasa', 'QUIMICA_SANGUINEA', 55, 35.00, 0, 0, NULL),
    ('QMS-032', 'Lipasa', 'QUIMICA_SANGUINEA', 55, 35.00, 0, 0, NULL),
    ('MTU-001', 'Antígeno carcinoembrionario (CEA)', 'MARCADORES_TUMORALES', 130, 85.00, 1, 2, NULL),
    ('MTU-002', 'Alfafetoproteína (AFP)', 'MARCADORES_TUMORALES', 130, 85.00, 1, 2, NULL),
    ('MTU-003', 'CA 19-9', 'MARCADORES_TUMORALES', 145, 95.00, 1, 2, NULL),
    ('MTU-004', 'CA 125', 'MARCADORES_TUMORALES', 145, 95.00, 1, 2, NULL),
    ('MTU-005', 'PSA total y libre', 'MARCADORES_TUMORALES', 235, 155.00, 1, 2, NULL),
    ('HOR-001', 'TSH', 'HORMONAS', 100, 65.00, 1, 3, NULL),
    ('HOR-002', 'T3', 'HORMONAS', 100, 65.00, 1, 3, NULL),
    ('HOR-003', 'T4', 'HORMONAS', 100, 65.00, 1, 3, NULL),
    ('HOR-004', 'T4 libre', 'HORMONAS', 100, 65.00, 1, 3, NULL),
    ('HOR-005', 'Hormona luteinizante (LH)', 'HORMONAS', 100, 65.00, 1, 3, NULL),
    ('HOR-006', 'Hormona foliculoestimulante (FSH)', 'HORMONAS', 100, 65.00, 1, 3, NULL),
    ('HOR-007', 'Prolactina', 'HORMONAS', 100, 65.00, 1, 3, NULL),
    ('HOR-008', 'Estradiol', 'HORMONAS', 130, 85.00, 1, 3, NULL),
    ('HOR-009', 'Progesterona', 'HORMONAS', 100, 65.00, 1, 3, NULL),
    ('HOR-010', 'Testosterona total', 'HORMONAS', 130, 85.00, 1, 3, NULL),
    ('HOR-011', 'Testosterona libre', 'HORMONAS', 235, 155.00, 1, 3, NULL),
    ('HOR-012', 'Paratohormona (PTH)', 'HORMONAS', 235, 155.00, 1, 3, NULL),
    ('HOR-013', 'Cortisol AM', 'HORMONAS', 220, 145.00, 1, 3, NULL),
    ('HOR-014', 'Cortisol PM', 'HORMONAS', 220, 145.00, 1, 3, NULL),
    ('HOR-015', 'Beta HCG cuantitativa', 'HORMONAS', 145, 95.00, 1, 3, NULL),
    ('HOR-016', 'Beta HCG libre', 'HORMONAS', 295, 195.00, 1, 3, NULL),
    ('INM-001', 'ASTO (antiestreptolisina O)', 'INMUNOLOGIA_PRUEBAS_RAPIDAS', 40, 25.00, 0, 0, NULL),
    ('INM-002', 'Proteína C reactiva (PCR)', 'INMUNOLOGIA_PRUEBAS_RAPIDAS', 40, 25.00, 0, 0, NULL),
    ('INM-003', 'Factor reumatoideo (látex)', 'INMUNOLOGIA_PRUEBAS_RAPIDAS', 40, 25.00, 0, 0, NULL),
    ('INM-004', 'RPR / VDRL', 'INMUNOLOGIA_PRUEBAS_RAPIDAS', 40, 25.00, 0, 0, NULL),
    ('INM-005', 'VIH (prueba rápida)', 'INMUNOLOGIA_PRUEBAS_RAPIDAS', 45, 30.00, 0, 0, NULL),
    ('INM-006', 'Hepatitis B', 'INMUNOLOGIA_PRUEBAS_RAPIDAS', 45, 30.00, 0, 0, NULL),
    ('INM-007', 'Dengue IgG / IgM', 'INMUNOLOGIA_PRUEBAS_RAPIDAS', 85, 55.00, 0, 0, NULL),
    ('INM-008', 'Helicobacter pylori en suero', 'INMUNOLOGIA_PRUEBAS_RAPIDAS', 70, 45.00, 0, 0, NULL),
    ('INM-009', 'Helicobacter pylori en heces', 'INMUNOLOGIA_PRUEBAS_RAPIDAS', 75, 50.00, 0, 0, NULL),
    ('INM-010', 'Antígeno nasal COVID-19', 'INMUNOLOGIA_PRUEBAS_RAPIDAS', 100, 65.00, 0, 0, NULL),
    ('INM-011', 'Antígeno influenza', 'INMUNOLOGIA_PRUEBAS_RAPIDAS', 100, 65.00, 0, 0, NULL),
    ('INM-012', 'Test de embarazo', 'INMUNOLOGIA_PRUEBAS_RAPIDAS', 40, 25.00, 0, 0, NULL),
    ('INM-013', 'Test de toxoplasma', 'INMUNOLOGIA_PRUEBAS_RAPIDAS', 45, 30.00, 0, 0, NULL),
    ('INM-014', 'Test de Chagas', 'INMUNOLOGIA_PRUEBAS_RAPIDAS', 45, 30.00, 0, 0, NULL),
    ('ORI-001', 'Examen general de orina', 'ORINA', 30, 20.00, 0, 0, NULL),
    ('ORI-002', 'Proteinuria', 'ORINA', 45, 30.00, 0, 0, NULL),
    ('ORI-003', 'Creatinuria', 'ORINA', 45, 30.00, 0, 0, NULL),
    ('ORI-004', 'Clearance de creatinina', 'ORINA', 160, 105.00, 0, 0, NULL),
    ('ORI-005', 'Uricosuria', 'ORINA', 55, 35.00, 0, 0, NULL),
    ('ORI-006', 'Glucosuria', 'ORINA', 55, 35.00, 0, 0, NULL),
    ('ORI-007', 'Amilasuria', 'ORINA', 60, 40.00, 0, 0, NULL),
    ('ORI-008', 'Electrolitos en orina', 'ORINA', 225, 150.00, 0, 0, NULL),
    ('ORI-009', 'Microalbuminuria', 'ORINA', 205, 135.00, 1, 2, NULL),
    ('ORI-010', 'Antidoping multidrogas', 'ORINA', 325, 215.00, 0, 0, NULL),
    ('HEC-001', 'Coproparasitológico simple', 'HECES_FECALES', 30, 20.00, 0, 0, NULL),
    ('HEC-002', 'Coproparasitológico seriado', 'HECES_FECALES', 90, 60.00, 0, 0, NULL),
    ('HEC-003', 'Amebas en fresco', 'HECES_FECALES', 25, 15.00, 0, 0, NULL),
    ('HEC-004', 'Moco fecal', 'HECES_FECALES', 25, 15.00, 0, 0, NULL),
    ('HEC-005', 'Rotavirus', 'HECES_FECALES', 70, 45.00, 0, 0, NULL),
    ('HEC-006', 'Test de Graham', 'HECES_FECALES', 70, 45.00, 0, 0, NULL),
    ('HEC-007', 'Sangre oculta en heces', 'HECES_FECALES', 45, 30.00, 0, 0, NULL),
    ('BAC-001', 'Urocultivo y antibiograma', 'BACTERIOLOGIA', 220, 145.00, 3, 5, NULL),
    ('BAC-002', 'Cultivos y antibiogramas', 'BACTERIOLOGIA', 220, 145.00, 3, 5, NULL),
    ('BAC-003', 'Tinción Gram', 'BACTERIOLOGIA', 70, 45.00, 0, 0, NULL),
    ('BAC-004', 'Espermiograma', 'BACTERIOLOGIA', 370, 245.00, 0, 0, NULL),
    ('BAC-005', 'Baciloscopía simple', 'BACTERIOLOGIA', 60, 40.00, 1, 1, NULL),
    ('BAC-006', 'Baciloscopía seriada', 'BACTERIOLOGIA', 145, 95.00, NULL, NULL, 'Despues de la tercera muestra'),
    ('BMO-001', 'RT-PCR COVID-19', 'BIOLOGIA_MOLECULAR', 415, 275.00, 1, 2, NULL),
    ('BMO-002', 'Panel VPH (papiloma humano)', 'BIOLOGIA_MOLECULAR', 745, 495.00, 3, 5, NULL),
    ('BMO-003', 'Panel enfermedad celíaca', 'BIOLOGIA_MOLECULAR', 3000, 2000.00, 7, 9, NULL),
    ('BMO-004', 'Carga viral VIH (RTQ)', 'BIOLOGIA_MOLECULAR', 825, 550.00, 7, 9, NULL),
    ('BMO-005', 'Panel tuberculosis', 'BIOLOGIA_MOLECULAR', 750, 500.00, 3, 5, NULL),
    ('BMO-006', 'Test de paternidad', 'BIOLOGIA_MOLECULAR', 3750, 2500.00, 7, 9, NULL),
    ('BMO-007', 'Papanicolaou', 'BIOLOGIA_MOLECULAR', 75, 50.00, 1, 1, NULL),
    ('BMO-008', 'Test de cristalización', 'BIOLOGIA_MOLECULAR', 45, 30.00, 0, 0, NULL)
      ) AS v(code, name, lab_category, price, cost, tmin, tmax, note)
      ON CONFLICT ON CONSTRAINT "uq_service_price_clinic_code" DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Solo se van los del tarifario nuevo (los que tienen costo de convenio);
    // los de demo vuelven a estar activos.
    await queryRunner.query(
      `DELETE FROM "service_prices" WHERE "category" = 'laboratory' AND "cost_price" IS NOT NULL`,
    );
    await queryRunner.query(
      `UPDATE "service_prices" SET "is_active" = true WHERE "category" = 'laboratory'`,
    );
    await queryRunner.query(`ALTER TABLE "service_prices" DROP COLUMN "turnaround_note"`);
    await queryRunner.query(`ALTER TABLE "service_prices" DROP COLUMN "turnaround_max_days"`);
    await queryRunner.query(`ALTER TABLE "service_prices" DROP COLUMN "turnaround_min_days"`);
    await queryRunner.query(`ALTER TABLE "service_prices" DROP COLUMN "lab_category"`);
    await queryRunner.query(`ALTER TABLE "service_prices" DROP COLUMN "cost_price"`);
  }
}
