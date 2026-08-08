import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Completa el tarifario de cada clínica con lo que se cobra habitualmente en
 * una clínica boliviana y que hasta ahora no estaba: consultas por
 * especialidad, procedimientos de enfermería y consultorio, y los servicios
 * administrativos (certificados, internación, quirófano) que no encajan en
 * ninguna de las dos.
 *
 * **Todo se da de alta a Bs 0 e inactivo**, igual que los estudios especiales.
 * No es un descuido: las tarifas son decisión de la clínica y ponerles un
 * número inventado sería peor que dejarlas vacías —se cobraría mal sin que
 * nadie se entere—. Inactivo y a cero, el servicio no aparece en el selector
 * del punto de cobro y no puede generar un cargo; el tarifario lo muestra
 * marcado como "Sin precio" para que se le fije tarifa y se active desde ahí.
 *
 * Los tres estudios especiales sí reciben precio aquí: son los únicos con
 * tarifa ya acordada.
 *
 * Incluye también las tarifas base de consulta y los procedimientos elementales
 * que hasta ahora **solo existían en el seed**, y el seed no corre en
 * producción: allí el tarifario tenía los 110 exámenes y nada más. Sin una
 * tarifa de consulta, `findConsultationPrice` no resuelve ninguna y completar
 * una cita no genera cargo — sin error, solo un warning en el log. Es decir,
 * la clínica no podía cobrar una consulta y nada lo delataba.
 *
 * Idempotente por el índice único (clínica, código): repetirla no duplica
 * nada, en desarrollo no toca lo que el seed ya dejó puesto, y aplica también
 * a las clínicas que se den de alta después, en cuanto se vuelva a correr.
 */
export class SeedCommonClinicServices1786220000000 implements MigrationInterface {
  name = 'SeedCommonClinicServices1786220000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Tarifas base de consulta, una por tipo de cita ───────────────────────
    // Estas son las que `findConsultationPrice` busca al completar una cita, y
    // por eso llevan `appointment_type`: sin ellas no hay cobro automático de
    // consulta en absoluto. Existían solo en el seed, así que producción se
    // quedó sin ninguna.
    //
    // A Bs 0 e inactivas como todo lo demás: mientras no se les ponga tarifa
    // el comportamiento es el mismo que ahora (la cita se cierra sin cargo),
    // pero al menos se ven en el tarifario marcadas "Sin precio", en vez de no
    // existir. Activarlas es lo que enciende el cobro de consultas.
    await queryRunner.query(`
      INSERT INTO "service_prices"
        ("code", "name", "description", "category", "appointment_type", "price", "is_active", "clinic_id")
      SELECT v.code, v.name, v.description, 'consultation', v.appointment_type::"service_prices_appointment_type_enum", 0, false, c.id
      FROM "clinics" c
      CROSS JOIN (VALUES
        ('CONS-GEN', 'Consulta general', 'Consulta médica ambulatoria', 'consultation'),
        ('CONS-SEG', 'Consulta de seguimiento', 'Control posterior a una consulta previa', 'follow_up'),
        ('CONS-EME', 'Consulta de emergencia', 'Atención de urgencia', 'emergency'),
        ('CONS-CIR', 'Cirugía menor', 'Intervención quirúrgica ambulatoria', 'surgery'),
        ('CONS-IMG', 'Estudio de imagenología', 'Estudio por imagen', 'imaging'),
        ('CONS-VAC', 'Vacunación', 'Aplicación de vacuna', 'vaccination'),
        ('CONS-TER', 'Sesión de terapia', 'Sesión de terapia o rehabilitación', 'therapy'),
        ('CONS-OTR', 'Otra consulta', 'Atención que no encaja en los tipos anteriores', 'other')
      ) AS v(code, name, description, appointment_type)
      ON CONFLICT ON CONSTRAINT "uq_service_price_clinic_code" DO NOTHING
    `);

    // ── Consultas por especialidad ───────────────────────────────────────────
    // `appointment_type` va en NULL a propósito. Ese campo es lo que permite
    // resolver la tarifa de una cita al completarla, y `findConsultationPrice`
    // usa `findOne`: si dos consultas activas compartieran tipo de cita, la
    // tarifa que se cobra quedaría a merced de cuál devuelva Postgres primero.
    // Las genéricas ya existentes (CONS-GEN, CONS-SEG…) conservan ese vínculo;
    // estas se eligen a mano en el punto de cobro.
    //
    // Medicina general no está: es CONS-GEN, que ya existe y está en servicio.
    await queryRunner.query(`
      INSERT INTO "service_prices"
        ("code", "name", "description", "category", "appointment_type", "price", "is_active", "clinic_id")
      SELECT v.code, v.name, v.description, 'consultation', NULL, 0, false, c.id
      FROM "clinics" c
      CROSS JOIN (VALUES
        ('CONS-PED', 'Consulta de pediatría', 'Atención médica de niños y adolescentes'),
        ('CONS-GIN', 'Consulta de ginecología y obstetricia', 'Control ginecológico y control prenatal'),
        ('CONS-INT', 'Consulta de medicina interna', 'Atención del paciente adulto y del paciente crónico'),
        ('CONS-CGE', 'Consulta de cirugía general', 'Valoración prequirúrgica y control postoperatorio'),
        ('CONS-TRA', 'Consulta de traumatología y ortopedia', 'Lesiones y afecciones del sistema musculoesquelético')
      ) AS v(code, name, description)
      ON CONFLICT ON CONSTRAINT "uq_service_price_clinic_code" DO NOTHING
    `);

    // ── Procedimientos ───────────────────────────────────────────────────────
    // Prácticas terapéuticas y de enfermería, no estudios diagnósticos: la
    // cauterización entra aquí y no en estudios especiales por eso mismo.
    await queryRunner.query(`
      INSERT INTO "service_prices"
        ("code", "name", "description", "category", "price", "is_active", "clinic_id")
      SELECT v.code, v.name, v.description, 'procedure', 0, false, c.id
      FROM "clinics" c
      CROSS JOIN (VALUES
        -- Los cinco elementales venían del seed, así que producción no tenía
        -- ninguno. Se repiten aquí por eso; en desarrollo el ON CONFLICT los
        -- deja como están, con su precio.
        ('PROC-CUR', 'Curación simple', 'Limpieza y cobertura de herida menor'),
        ('PROC-SUT', 'Sutura', 'Cierre de herida con puntos'),
        ('PROC-NEB', 'Nebulización', 'Sesión de nebulización'),
        ('PROC-INY', 'Aplicación de inyectable', 'Vía intramuscular, subcutánea o endovenosa'),
        ('PROC-PRE', 'Control de presión arterial', 'Toma de presión arterial'),
        ('PROC-CUC', 'Curación compleja', 'Herida extensa, quemadura o úlcera; incluye material'),
        ('PROC-RET', 'Retiro de puntos', 'Retiro de material de sutura'),
        ('PROC-CAU', 'Cauterización', 'Cauterización de lesión cutánea o de mucosa'),
        ('PROC-DRE', 'Drenaje de absceso', 'Incisión y drenaje'),
        ('PROC-EXT', 'Extracción de cuerpo extraño', 'Oído, nariz, ojo o piel'),
        ('PROC-UNA', 'Extracción de uña', 'Onicectomía parcial o total'),
        ('PROC-LAV', 'Lavado de oídos', 'Extracción de tapón de cerumen'),
        ('PROC-VEN', 'Venoclisis', 'Colocación de vía periférica y administración de suero endovenoso'),
        ('PROC-OXI', 'Oxigenoterapia', 'Administración de oxígeno, por hora'),
        ('PROC-SON', 'Sondaje vesical', 'Colocación o cambio de sonda Foley'),
        ('PROC-FER', 'Inmovilización con férula o yeso', 'Colocación de férula, yeso o vendaje inmovilizador'),
        ('PROC-PAP', 'Toma de Papanicolaou', 'Toma de muestra citológica cervical'),
        ('PROC-DIU', 'Colocación o retiro de DIU', 'Dispositivo intrauterino'),
        ('PROC-GLU', 'Control de glucemia capilar', 'Medición de glucosa en sangre capilar')
      ) AS v(code, name, description)
      ON CONFLICT ON CONSTRAINT "uq_service_price_clinic_code" DO NOTHING
    `);

    // ── Otros ────────────────────────────────────────────────────────────────
    // Lo que se cobra y no es acto clínico: papeles, estancia y uso de
    // instalaciones. Hoy la categoría `other` estaba vacía y todo esto se
    // cobraba fuera del sistema o no se cobraba.
    await queryRunner.query(`
      INSERT INTO "service_prices"
        ("code", "name", "description", "category", "price", "is_active", "clinic_id")
      SELECT v.code, v.name, v.description, 'other', 0, false, c.id
      FROM "clinics" c
      CROSS JOIN (VALUES
        ('OTR-FICHA', 'Apertura de historia clínica', 'Alta del paciente y ficha nueva'),
        ('OTR-CERT', 'Certificado médico', 'Certificado de atención o de estado de salud'),
        ('OTR-INF', 'Informe médico', 'Informe clínico detallado a solicitud del paciente'),
        ('OTR-COPIA', 'Copia de historia clínica', 'Reproducción del expediente del paciente'),
        ('OTR-BAJA', 'Certificado de incapacidad temporal', 'Baja médica o indicación de reposo'),
        ('OTR-DOM', 'Consulta a domicilio', 'Atención médica en el domicilio del paciente'),
        ('OTR-AMB', 'Traslado en ambulancia', 'Traslado del paciente'),
        ('OTR-INT', 'Día de internación', 'Cama por día; no incluye medicamentos ni insumos'),
        ('OTR-QUI', 'Uso de quirófano', 'Derecho de sala por intervención'),
        ('OTR-MAT', 'Material e insumos', 'Insumos utilizados durante un procedimiento')
      ) AS v(code, name, description)
      ON CONFLICT ON CONSTRAINT "uq_service_price_clinic_code" DO NOTHING
    `);

    // ── Estudios especiales: tarifa de referencia y alta en servicio ─────────
    // Se dieron de alta a Bs 0 e inactivos porque no había tarifa acordada; ya
    // la hay. El `WHERE` los acota a los que siguen tal cual salieron de aquel
    // seed: si alguien ya les puso precio, esta migración no lo pisa.
    await queryRunner.query(`
      UPDATE "service_prices"
      SET "price" = v.price, "is_active" = true
      FROM (VALUES
        ('ESP-ECO', 150.00),
        ('ESP-ECG', 80.00),
        ('ESP-COL', 700.00)
      ) AS v(code, price)
      WHERE "service_prices"."code" = v.code
        AND "service_prices"."price" = 0
        AND "service_prices"."is_active" = false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Solo las que siguen a Bs 0 e inactivas, que es como las dejó el `up`.
    // Varios de estos códigos existen desde antes en desarrollo, puestos por el
    // seed y con su precio: allí el `up` no hizo nada (ON CONFLICT DO NOTHING)
    // y borrarlas aquí no sería deshacer, sería destruir. Lo mismo vale para
    // una tarifa que la clínica haya fijado ya en producción.
    await queryRunner.query(`
      DELETE FROM "service_prices"
      WHERE "price" = 0
        AND "is_active" = false
        AND "code" IN (
          'CONS-GEN','CONS-SEG','CONS-EME','CONS-CIR','CONS-IMG','CONS-VAC','CONS-TER','CONS-OTR',
          'CONS-PED','CONS-GIN','CONS-INT','CONS-CGE','CONS-TRA',
          'PROC-CUR','PROC-SUT','PROC-NEB','PROC-INY','PROC-PRE',
          'PROC-CUC','PROC-RET','PROC-CAU','PROC-DRE','PROC-EXT','PROC-UNA','PROC-LAV',
          'PROC-VEN','PROC-OXI','PROC-SON','PROC-FER','PROC-PAP','PROC-DIU','PROC-GLU',
          'OTR-FICHA','OTR-CERT','OTR-INF','OTR-COPIA','OTR-BAJA','OTR-DOM','OTR-AMB',
          'OTR-INT','OTR-QUI','OTR-MAT'
        )
    `);

    // Vuelve a dejar los estudios especiales como estaban: sin tarifa y fuera
    // de servicio. Solo los que conservan el precio que puso el `up`, para no
    // borrar una tarifa que la clínica haya ajustado después.
    await queryRunner.query(`
      UPDATE "service_prices"
      SET "price" = 0, "is_active" = false
      FROM (VALUES
        ('ESP-ECO', 150.00),
        ('ESP-ECG', 80.00),
        ('ESP-COL', 700.00)
      ) AS v(code, price)
      WHERE "service_prices"."code" = v.code
        AND "service_prices"."price" = v.price
    `);
  }
}
