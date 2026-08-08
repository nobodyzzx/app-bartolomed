import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sanea el saldo de las facturas anuladas y devueltas que arrastran un
 * `remainingAmount` vivo.
 *
 * `Invoice.calculateAmounts()` es un hook `@BeforeUpdate` y recalculaba
 * `remainingAmount = totalAmount - paidAmount` siempre, fuera del `if` que
 * respeta los estados terminales. Como el hook corre después del servicio,
 * deshacía en silencio el `remainingAmount = 0` que `voidInvoice()` acababa de
 * asignar: toda factura anulada conservaba su saldo, aunque se hubiera anulado
 * por el camino correcto, con motivo y auditoría. El hook ya está corregido, pero
 * las filas escritas antes siguen mal y no se corrigen solas — el dashboard las
 * seguiría contando como dinero por cobrar.
 *
 * Solo se toca `remainingAmount`, que es el campo derivado y el único que el hook
 * pisaba. `paidAmount` no: en una factura anulada `voidInvoice()` ya lo dejó en
 * cero, y en una devuelta representa dinero que de verdad se cobró — ponerlo a
 * cero borraría ingresos reales del histórico.
 */
export class ZeroBalanceOnVoidedInvoices1786200000000 implements MigrationInterface {
  name = 'ZeroBalanceOnVoidedInvoices1786200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "invoices"
      SET "remainingAmount" = 0
      WHERE "status" IN ('cancelled', 'refunded')
        AND "remainingAmount" <> 0
    `);
  }

  /**
   * Revertir devuelve el saldo al valor que tenía con el bug —
   * `totalAmount - paidAmount`, que es justo lo que el hook recalculaba—, porque
   * ese importe es derivado y no se guardó ningún original que restaurar. No es
   * una vuelta atrás a datos buenos: es volver a los datos rotos, y solo tiene
   * sentido si hay que deshacer el despliegue entero.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "invoices"
      SET "remainingAmount" = "totalAmount" - "paidAmount"
      WHERE "status" IN ('cancelled', 'refunded')
    `);
  }
}
