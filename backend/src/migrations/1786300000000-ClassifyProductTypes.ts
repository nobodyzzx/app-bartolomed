import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Clasifica el catálogo entre insumo, cuidado personal y medicamento.
 *
 * Solo se marca **lo que no deja duda**: material clínico por su nombre
 * (jeringa, gasa, bajalengua, barbijo, sonda…) y venta de mostrador que no es
 * clínica (biberón, cepillo dental, protector solar…). Todo lo demás se queda
 * como `medication`, que es el valor por defecto.
 *
 * No se intenta adivinar el resto. Hay ~130 productos cuyo nombre no dice la
 * forma farmacéutica —marcas comerciales como "Aliviax" o "Bactifen"— mezclados
 * con algún insumo suelto ("aspirador nasal", "ajuar para bebé"). Clasificar
 * eso por heurística sería inventarse una ficha: los revisa el usuario desde la
 * pantalla, que para eso ahora tiene el campo.
 *
 * `ILIKE` con acentos: los nombres del inventario los escribió gente distinta y
 * conviven "Bisturí" y "Bisturi", así que los patrones evitan las vocales
 * acentuadas donde puede haberlas.
 */
export class ClassifyProductTypes1786300000000 implements MigrationInterface {
  name = 'ClassifyProductTypes1786300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Insumos: material clínico ───────────────────────────────────────────
    await queryRunner.query(`
      UPDATE "medications" SET "product_type" = 'supply'
      WHERE "name" ~* '(insumo|jeringa|gasa|venda|algod|baja ?lengua|barbijo|guante|sonda|cateter|catéter|branula|bránula|bistur|aguja|esparadrapo|aposito|apósito|gorro|campo quir|venoclisis|llave de|clam|bolsa colectora|microgotero|term[oó]metro|lanceta|colector|mascarilla|nebulizador|torniquete|electrodo|sutura|prueba para|test de|aspirador nasal|dep[oó]sito)'
    `);

    // ── Cuidado personal: venta de mostrador que no es clínica ──────────────
    // Va después de insumos y con `product_type = 'medication'` en el WHERE
    // para no pisar lo ya marcado: "pañal" aparece en los dos mundos y aquí
    // manda el segundo criterio solo si el primero no lo reclamó.
    await queryRunner.query(`
      UPDATE "medications" SET "product_type" = 'personal_care'
      WHERE "product_type" = 'medication'
        AND "name" ~* '(jab[oó]n|shampoo|champ[uú]|desodorante|antitranspirante|biber[oó]n|toalla|pa[ñn]al|protector solar|chup[oó]n|talco|colonia|pasta dental|cepillo|hisopo|ajuar|dove|nivea)'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Vuelve todo al valor por defecto, que es como estaba el catálogo antes de
    // clasificarlo. No se puede ser más fino: la clasificación no se derivaba de
    // ningún dato previo, se calculó aquí.
    await queryRunner.query(`UPDATE "medications" SET "product_type" = 'medication'`);
  }
}
