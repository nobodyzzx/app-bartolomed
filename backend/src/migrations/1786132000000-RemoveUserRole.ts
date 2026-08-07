import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Elimina el rol `user`, que no aportaba nada.
 *
 * No daba ningún permiso —su entrada en `ROLE_PERMISSIONS` estaba vacía— pero
 * viajaba como rol secundario en casi todas las cuentas (`{doctor,user}`,
 * `{nurse,user}`…), ensuciando cada listado y cada comprobación sin cambiar
 * nunca el resultado. El enum del frontend ya lo había dejado fuera y
 * `ASSIGNABLE_ROLES` no lo ofrecía, así que ni siquiera se podía asignar desde
 * la interfaz: solo sobrevivía en la base y en el enum del backend.
 *
 * Se quita también el `default` de la columna: desde que el DTO exige al menos
 * un rol explícito, un usuario nunca debería nacer con roles implícitos — que
 * era como se colaban cuentas fantasma sin ningún acceso real.
 */
export class RemoveUserRole1786132000000 implements MigrationInterface {
  name = 'RemoveUserRole1786132000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "roles" DROP DEFAULT`);
    await queryRunner.query(
      `UPDATE "users" SET "roles" = array_remove("roles", 'user') WHERE 'user' = ANY("roles")`,
    );
    // Una cuenta que solo tuviera 'user' se quedaría sin ningún rol y no podría
    // entrar. No debería existir ninguna, pero si la hubiera es mejor saberlo.
    const huerfanos = await queryRunner.query(
      `SELECT email FROM "users" WHERE cardinality("roles") = 0`,
    );
    if (huerfanos.length > 0) {
      throw new Error(
        `Estas cuentas quedarían sin rol al quitar 'user': ${huerfanos
          .map((u: { email: string }) => u.email)
          .join(', ')}. Asígnales un rol real antes de migrar.`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "users" SET "roles" = array_append("roles", 'user') WHERE NOT ('user' = ANY("roles"))`,
    );
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "roles" SET DEFAULT '{user}'`);
  }
}
