import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../roles/entities/role.entity';

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
  ) {}

  async onModuleInit() {
    await this.seedRoles();
  }

  private async seedRoles() {
    const roles = [
      {
        name: 'super-admin',
        description: 'Acceso completo y gestión de administradores',
        permissions: ['crear', 'editar', 'eliminar', 'ver', 'gestionar_roles', 'gestionar_usuarios'],
        isActive: true,
      },
      {
        name: 'admin',
        description: 'Control total del sistema',
        permissions: ['crear', 'editar', 'eliminar', 'ver', 'gestionar_usuarios'],
        isActive: true,
      },
      {
        name: 'doctor',
        description: 'Médico profesional',
        permissions: ['crear', 'editar', 'ver', 'crear_expediente', 'crear_receta'],
        isActive: true,
      },
      {
        name: 'nurse',
        description: 'Personal de enfermería',
        permissions: ['ver', 'editar', 'crear_expediente'],
        isActive: true,
      },
      {
        name: 'pharmacist',
        description: 'Especialista en farmacia',
        permissions: ['ver', 'editar', 'gestionar_inventario', 'dispensar'],
        isActive: true,
      },
      {
        name: 'receptionist',
        description: 'Personal de recepción',
        permissions: ['ver', 'crear_cita', 'editar_cita', 'ver_pacientes'],
        isActive: true,
      },
      {
        name: 'user',
        description: 'Acceso estándar al sistema',
        permissions: ['ver'],
        isActive: true,
      },
    ];

    for (const roleData of roles) {
      const existingRole = await this.rolesRepository.findOne({
        where: { name: roleData.name },
      });

      if (!existingRole) {
        const role = this.rolesRepository.create(roleData);
        await this.rolesRepository.save(role);
        console.log(`✓ Role creado: ${roleData.name}`);
      } else {
        console.log(`✓ Role ya existe: ${roleData.name}`);
      }
    }
  }
}
