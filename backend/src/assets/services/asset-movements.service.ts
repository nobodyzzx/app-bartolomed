import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { FilterMovementsDto, MoveAssetDto } from '../dto/asset-movement.dto';
import { AssetMovement } from '../entities/asset-movement.entity';
import { Asset, AssetStatus } from '../entities/asset.entity';
import { User } from '../../users/entities/user.entity';
import { UserClinic } from '../../users/entities/user-clinic.entity';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

/** Clínica a la que se puede mandar un ítem, con los ambientes que ya tiene. */
export interface TargetClinic {
  id: string;
  name: string;
  locations: string[];
}

/** Estados en los que el ítem ya no está en el piso y no tiene sentido moverlo. */
const FUERA_DE_PISO: AssetStatus[] = [AssetStatus.RETIRED, AssetStatus.SOLD, AssetStatus.LOST];

@Injectable()
export class AssetMovementsService {
  constructor(
    @InjectRepository(Asset)
    private readonly assetRepo: Repository<Asset>,
    @InjectRepository(AssetMovement)
    private readonly movementRepo: Repository<AssetMovement>,
    @InjectRepository(UserClinic)
    private readonly membershipRepo: Repository<UserClinic>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Traspasa unidades de un ítem a otro ambiente, sea de la misma clínica o de
   * la de al lado.
   *
   * Total (o si no se indica cantidad): el ítem cambia de ambiente y conserva su
   * código, que es lo que espera quien lo tiene rotulado.
   *
   * Parcial: se restan del origen y se suman al ítem equivalente del destino —
   * mismo nombre y mismo ambiente—, o se crea uno nuevo si no existía. Sin esa
   * fusión, mover 2 sillas dos veces dejaría dos filas de 2 en vez de una de 4,
   * que es justo lo que un inventario por existencias no debe permitir.
   */
  async move(assetId: string, dto: MoveAssetDto, userId: string, clinicId: string): Promise<AssetMovement> {
    const destino = dto.toLocation.trim();
    if (!destino) {
      throw new BadRequestException('El ambiente de destino es obligatorio');
    }

    const destinoClinicId = dto.toClinicId ?? clinicId;
    const cruzaDeClinica = destinoClinicId !== clinicId;
    // Fuera de la transacción a propósito: si la clínica no es alcanzable no hay
    // nada que revertir, y así el bloqueo pesimista del ítem dura lo mínimo.
    if (cruzaDeClinica) await this.assertClinicaAlcanzable(destinoClinicId, userId);

    return await this.dataSource.transaction(async (em: EntityManager) => {
      const asset = await em.findOne(Asset, {
        where: { id: assetId, isActive: true, clinic: { id: clinicId } },
        relations: ['clinic'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!asset) throw new NotFoundException('Activo no encontrado');

      if (FUERA_DE_PISO.includes(asset.status)) {
        throw new BadRequestException(`"${asset.name}" está dado de baja (${asset.status}) y no se puede mover`);
      }

      const origen = asset.location?.trim() ?? null;
      // Cruzando de clínica el mismo nombre de ambiente es legítimo: las dos
      // pueden tener su "SALA DE ESPERA" y son sitios distintos.
      if (!cruzaDeClinica && origen === destino) {
        throw new BadRequestException(`"${asset.name}" ya está en ${destino}`);
      }

      const disponibles = asset.quantity ?? 1;
      const mueve = dto.quantity ?? disponibles;
      if (mueve > disponibles) {
        throw new BadRequestException(`No se pueden mover ${mueve} unidades de "${asset.name}": hay ${disponibles}`);
      }

      let targetAssetId: string | null = null;

      if (mueve === disponibles) {
        // Si allá ya hay una fila de lo mismo, las unidades se le suman y esta
        // se retira. Un código rotula un grupo de cosas iguales, no cada objeto:
        // dejar dos filas de "Porta pico" en la misma Farmacia haría que la hoja
        // de conteo pidiera contar dos veces el mismo montón.
        const equivalente = await this.buscarEquivalente(em, asset, destino, destinoClinicId);

        if (equivalente) {
          equivalente.quantity = (equivalente.quantity ?? 0) + mueve;
          await em.save(Asset, equivalente);

          asset.isActive = false;
          asset.notes = this.anotar(asset.notes, `Absorbido por ${equivalente.assetTag} al pasar a ${destino}.`);
          await em.save(Asset, asset);
          targetAssetId = equivalente.id;
        } else {
          asset.location = destino;
          // El ítem entero cambia de dueño y se lleva su código: al ser único en
          // todo el sistema, no choca con nada en la clínica que lo recibe.
          if (cruzaDeClinica) asset.clinic = { id: destinoClinicId } as Clinic;
          await em.save(Asset, asset);
          targetAssetId = asset.id;
        }
      } else {
        asset.quantity = disponibles - mueve;
        await em.save(Asset, asset);
        targetAssetId = (await this.sumarEnDestino(em, asset, mueve, destino, destinoClinicId, userId)).id;
      }

      const movimiento = em.create(AssetMovement, {
        assetId: asset.id,
        assetName: asset.name,
        fromLocation: origen ?? undefined,
        toLocation: destino,
        quantity: mueve,
        targetAssetId: targetAssetId ?? undefined,
        notes: dto.notes,
        movedBy: { id: userId } as User,
        clinic: { id: clinicId } as Clinic,
        toClinic: cruzaDeClinica ? ({ id: destinoClinicId } as Clinic) : undefined,
      });
      return await em.save(AssetMovement, movimiento);
    });
  }

  /**
   * Solo se manda a una clínica activa y de la que el usuario sea miembro.
   *
   * Sin la comprobación de membresía, cualquiera podría empujar un ítem a una
   * clínica que no mira nadie: desaparecería de su inventario y no aparecería en
   * ninguno que la persona pueda abrir para devolverlo.
   */
  private async assertClinicaAlcanzable(clinicId: string, userId: string): Promise<void> {
    const membresia = await this.membershipRepo.findOne({
      where: { user: { id: userId }, clinic: { id: clinicId, isActive: true } },
      relations: ['clinic'],
    });
    if (!membresia) {
      throw new ForbiddenException('No tienes acceso a la clínica de destino');
    }
  }

  /**
   * Clínicas a las que este usuario puede mandar un ítem, con los ambientes que
   * cada una ya tiene, para poder elegir de una lista en vez de teclear a ciegas
   * un nombre que quizá no coincida con el que allá se usa.
   */
  async targetClinics(userId: string, clinicId: string): Promise<TargetClinic[]> {
    const membresias = await this.membershipRepo.find({
      where: { user: { id: userId } },
      relations: ['clinic'],
    });

    const destinos = membresias.map(m => m.clinic).filter(c => c && c.isActive && c.id !== clinicId);

    if (destinos.length === 0) return [];

    const filas: { clinic_id: string; location: string }[] = await this.assetRepo
      .createQueryBuilder('a')
      .select('a.clinic_id', 'clinic_id')
      .addSelect('a.location', 'location')
      .where('a.clinic_id IN (:...ids)', { ids: destinos.map(c => c.id) })
      .andWhere('a.isActive = true')
      .andWhere("a.location IS NOT NULL AND a.location <> ''")
      .groupBy('a.clinic_id')
      .addGroupBy('a.location')
      .getRawMany();

    return destinos
      .map(c => ({
        id: c.id,
        name: c.name,
        locations: filas
          .filter(f => f.clinic_id === c.id)
          .map(f => f.location)
          .sort((a, b) => a.localeCompare(b, 'es')),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  /**
   * La fila de lo mismo que ya vive en el ambiente de destino, si la hay: mismo
   * nombre, mismo ambiente, misma clínica.
   */
  private async buscarEquivalente(
    em: EntityManager,
    origen: Asset,
    destino: string,
    clinicId: string,
  ): Promise<Asset | null> {
    return await em.findOne(Asset, {
      where: {
        name: origen.name,
        location: destino,
        isActive: true,
        status: AssetStatus.ACTIVE,
        clinic: { id: clinicId },
      },
      lock: { mode: 'pessimistic_write' },
    });
  }

  /** Añade una línea a las observaciones sin pisar lo que ya había. */
  private anotar(notas: string | null | undefined, linea: string): string {
    return [notas, linea].filter(Boolean).join(' ');
  }

  private async sumarEnDestino(
    em: EntityManager,
    origen: Asset,
    unidades: number,
    destino: string,
    clinicId: string,
    userId: string,
  ): Promise<Asset> {
    const existente = await this.buscarEquivalente(em, origen, destino, clinicId);

    if (existente) {
      existente.quantity = (existente.quantity ?? 0) + unidades;
      return await em.save(Asset, existente);
    }

    const nuevo = em.create(Asset, {
      assetTag: await this.generarCodigo(em),
      name: origen.name,
      quantity: unidades,
      type: origen.type,
      status: AssetStatus.ACTIVE,
      condition: origen.condition,
      manufacturer: origen.manufacturer,
      model: origen.model,
      location: destino,
      notes: origen.notes,
      isActive: true,
      clinic: { id: clinicId } as Clinic,
      createdBy: { id: userId } as User,
    });
    return await em.save(Asset, nuevo);
  }

  /**
   * Código para el ítem que nace de un traspaso parcial. Sigue la numeración
   * `AF-0001` del inventario, contando desde el mayor existente para no chocar
   * con los códigos de los que ya se dieron de baja.
   */
  private async generarCodigo(em: EntityManager): Promise<string> {
    await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['asset_tag']);
    const row = await em.query(
      `SELECT COALESCE(MAX(NULLIF(regexp_replace("assetTag", '^AF-', ''), '')::int), 0) AS max
         FROM "assets" WHERE "assetTag" ~ '^AF-[0-9]+$'`,
    );
    return `AF-${String(Number(row?.[0]?.max ?? 0) + 1).padStart(4, '0')}`;
  }

  async findAll(clinicId: string, filters?: FilterMovementsDto): Promise<PaginatedResult<AssetMovement>> {
    const page = filters?.page ?? 1;
    const limit = Math.min(filters?.limit ?? 50, 200);

    const qb = this.movementRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.movedBy', 'movedBy')
      .leftJoinAndSelect('m.clinic', 'clinic')
      .leftJoinAndSelect('m.toClinic', 'toClinic')
      // Origen o destino: lo que llega de la otra clínica también es historial
      // de esta, y es justo lo que quien recibe necesita ver.
      .where('(clinic.id = :clinicId OR toClinic.id = :clinicId)', { clinicId })
      .orderBy('m.createdAt', 'DESC')
      .take(limit)
      .skip((page - 1) * limit);

    if (filters?.location) {
      qb.andWhere('(m.fromLocation = :loc OR m.toLocation = :loc)', { loc: filters.location });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  /** Historial de un ítem: por dónde pasó desde que se dio de alta. */
  async findByAsset(assetId: string, clinicId: string): Promise<AssetMovement[]> {
    return (
      this.movementRepo
        .createQueryBuilder('m')
        .leftJoinAndSelect('m.movedBy', 'movedBy')
        .leftJoinAndSelect('m.clinic', 'clinic')
        .leftJoinAndSelect('m.toClinic', 'toClinic')
        .where('m.asset_id = :assetId', { assetId })
        // El ítem que cruzó de clínica conserva su historial completo: la nueva
        // dueña ve de dónde vino, y la anterior sigue viendo que lo mandó.
        .andWhere('(clinic.id = :clinicId OR toClinic.id = :clinicId)', { clinicId })
        .orderBy('m.createdAt', 'DESC')
        .getMany()
    );
  }
}
