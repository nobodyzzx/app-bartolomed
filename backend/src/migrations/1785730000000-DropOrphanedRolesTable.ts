import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Gestión de Roles" era un CRUD completo (tabla roles) sin ninguna conexión
 * real al RBAC del sistema: PermissionsGuard/ClinicScopeGuard autorizan
 * exclusivamente contra el enum fijo ValidRoles + el mapa estático
 * role-permissions.map.ts. Un rol creado/editado acá no otorgaba ningún
 * permiso real — sin FKs entrantes ni salientes, sin ningún guard que la
 * leyera. Se elimina la tabla junto con su controller/service/entity y la
 * pantalla de administración correspondiente.
 */
export class DropOrphanedRolesTable1785730000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "roles"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "roles" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" text NOT NULL,
                "description" text,
                "permissions" text array NOT NULL DEFAULT '{}',
                "isActive" boolean NOT NULL DEFAULT true,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_648e3f5447f725579d7d4ffdfb7" UNIQUE ("name"),
                CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id")
            )
        `);
  }
}
