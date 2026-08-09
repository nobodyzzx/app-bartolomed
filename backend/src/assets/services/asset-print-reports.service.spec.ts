import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { TypstCompilerService } from '../../pdf/typst-compiler.service';
import { Asset, AssetCondition, AssetStatus, AssetType } from '../entities/asset.entity';
import { AssetPrintReportsService } from './asset-print-reports.service';

const CLINIC_ID = 'clinic-1';

const makeAsset = (overrides: Partial<Asset> = {}): Asset =>
  ({
    id: 'asset-1',
    assetTag: 'AF-0001',
    name: 'Ecógrafo CHAIZON',
    type: AssetType.MEDICAL_EQUIPMENT,
    status: AssetStatus.ACTIVE,
    condition: AssetCondition.GOOD,
    quantity: 1,
    location: 'SALA ECOGRAFIA',
    isActive: true,
    ...overrides,
  }) as Asset;

describe('AssetPrintReportsService', () => {
  let service: AssetPrintReportsService;
  let assetRepo: { find: jest.Mock };
  let clinicRepo: { findOne: jest.Mock };
  let compiler: { compile: jest.Mock };

  /** El `.typ` que el servicio le pasó al compilador en la llamada `n`. */
  const typ = (n = 0): string => compiler.compile.mock.calls[n][0] as string;

  beforeEach(async () => {
    assetRepo = { find: jest.fn().mockResolvedValue([makeAsset()]) };
    clinicRepo = { findOne: jest.fn().mockResolvedValue({ name: 'San Bartolomé' } as Clinic) };
    compiler = { compile: jest.fn().mockResolvedValue(Buffer.from('%PDF')) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetPrintReportsService,
        { provide: getRepositoryToken(Asset), useValue: assetRepo },
        { provide: getRepositoryToken(Clinic), useValue: clinicRepo },
        { provide: TypstCompilerService, useValue: compiler },
      ],
    }).compile();

    service = module.get(AssetPrintReportsService);
  });

  it('exige clínica: sin ella el informe listaría los activos de todas', async () => {
    await expect(service.inventoryByLocation(undefined)).rejects.toThrow(BadRequestException);
    expect(assetRepo.find).not.toHaveBeenCalled();
  });

  it('excluye del piso los retirados, vendidos y extraviados, pero no los dañados', async () => {
    await service.inventoryByLocation(CLINIC_ID);
    const where = assetRepo.find.mock.calls[0][0].where;
    expect(where.clinic).toEqual({ id: CLINIC_ID });
    expect(where.isActive).toBe(true);
    // `Not(In([...]))` — TypeORM anida un FindOperator dentro de otro, así que
    // se baja por `value` hasta dar con el array.
    let excluidos = where.status;
    while (excluidos && !Array.isArray(excluidos)) excluidos = excluidos.value;
    expect(excluidos).toEqual([AssetStatus.RETIRED, AssetStatus.SOLD, AssetStatus.LOST]);
    expect(excluidos).not.toContain(AssetStatus.DAMAGED);
  });

  it('filtra por ambiente solo cuando se pide uno', async () => {
    await service.inventoryByLocation(CLINIC_ID);
    expect(assetRepo.find.mock.calls[0][0].where.location).toBeUndefined();

    await service.inventoryByLocation(CLINIC_ID, { location: 'SALA ECOGRAFIA' });
    expect(assetRepo.find.mock.calls[1][0].where.location).toBe('SALA ECOGRAFIA');
  });

  it('agrupa por ambiente de mayor a menor y manda los activos sin ubicación a su propio grupo', async () => {
    assetRepo.find.mockResolvedValue([
      makeAsset({ assetTag: 'AF-1', location: 'FARMACIA' }),
      makeAsset({ assetTag: 'AF-2', location: 'SALA ECOGRAFIA' }),
      makeAsset({ assetTag: 'AF-3', location: 'SALA ECOGRAFIA' }),
      makeAsset({ assetTag: 'AF-4', location: '   ' }),
    ]);

    await service.inventoryByLocation(CLINIC_ID);
    const fuente = typ();
    expect(fuente.indexOf('SALA ECOGRAFIA — 2 ítem(s)')).toBeLessThan(fuente.indexOf('FARMACIA — 1 ítem(s)'));
    expect(fuente).toContain('Sin ubicación asignada — 1 ítem(s)');
  });

  it('traduce los enums al español — sin esto el papel dice "medical_equipment"', async () => {
    assetRepo.find.mockResolvedValue([
      makeAsset({ type: AssetType.COMPUTER, condition: AssetCondition.FAIR, status: AssetStatus.MAINTENANCE }),
    ]);
    await service.inventoryByLocation(CLINIC_ID);
    expect(typ()).toContain('"Cómputo"');
    expect(typ()).toContain('badge("Regular", color: "amber")');
    expect(typ()).toContain('badge("Mantenimiento", color: "amber")');
    expect(typ()).not.toContain('medical_equipment');
  });

  it('usa oficio por defecto y A4 cuando se pide', async () => {
    await service.inventoryByLocation(CLINIC_ID);
    expect(typ()).toContain('width: 21.6cm, height: 33cm');

    await service.inventoryByLocation(CLINIC_ID, { paper: 'a4' });
    expect(typ(1)).toContain('paper: "a4"');
  });

  it('el acta arranca por la fecha cuando la clínica no tiene localidad cargada', async () => {
    await service.handoverAct(CLINIC_ID);
    expect(typ()).toMatch(/"A los \d+ días del mes de \w+ de \d{4},"/);
    expect(typ()).not.toContain('la localidad de la clínica');
  });

  it('el acta antepone el lugar cuando sí lo hay', async () => {
    clinicRepo.findOne.mockResolvedValue({ name: 'San Jorge', localidad: 'El Alto', departamento: 'La Paz' } as Clinic);
    await service.handoverAct(CLINIC_ID);
    expect(typ()).toContain('"En El Alto, La Paz, a los');
  });

  it('el acta deja las líneas de firma en blanco si no se pasan nombres', async () => {
    await service.handoverAct(CLINIC_ID);
    expect(typ()).toContain('(name: "", role: "Entrega — Nombre, firma y C.I.")');

    await service.handoverAct(CLINIC_ID, { deliveredBy: 'Ana Quispe', receivedBy: 'Luis Mamani' });
    expect(typ(1)).toContain('(name: "Ana Quispe", role: "Entrega — Nombre, firma y C.I.")');
    expect(typ(1)).toContain('(name: "Luis Mamani", role: "Recibe — Nombre, firma y C.I.")');
  });

  it('la hoja de conteo pide contar unidades y no muestra la condición del sistema', async () => {
    assetRepo.find.mockResolvedValue([makeAsset({ quantity: 1 }), makeAsset({ assetTag: 'AF-2', quantity: 4 })]);
    await service.countSheet(CLINIC_ID);
    expect(typ()).toContain('"Cant."');
    expect(typ()).toContain('"Contado"');
    // Casilla solo para los de una unidad: marcar un cuadrito no dice nada de
    // las 4 unidades que deberían estar, ahí se escribe el número contado.
    expect(typ().match(/box\(width: 9pt/g) ?? []).toHaveLength(1);
    expect(typ()).not.toContain('badge("Bueno"');
  });

  it('cuenta ítems y unidades por separado en cada informe', async () => {
    assetRepo.find.mockResolvedValue([makeAsset({ quantity: 4 }), makeAsset({ assetTag: 'AF-2', quantity: 137 })]);
    await service.inventoryByLocation(CLINIC_ID);
    // 2 ítems, 141 unidades: sin esto el inventario decía "2 activos" de una
    // caja de 137 agujas y 4 sensores.
    expect(typ()).toContain('("Ítems", "2")');
    expect(typ()).toContain('("Unidades", "141")');
    expect(typ()).toContain('SALA ECOGRAFIA — 2 ítem(s) / 141 unidades');
  });

  it('el acta declara unidades verificadas, no fichas', async () => {
    assetRepo.find.mockResolvedValue([makeAsset({ quantity: 4 })]);
    await service.handoverAct(CLINIC_ID);
    expect(typ()).toContain('#strong[4] unidades');
    expect(typ()).toContain('#strong[1] ítems');
  });

  it('el resumen omite los tipos sin ningún activo', async () => {
    assetRepo.find.mockResolvedValue([makeAsset({ type: AssetType.MEDICAL_EQUIPMENT })]);
    await service.executiveSummary(CLINIC_ID);
    expect(typ()).toContain('"Equipo médico"');
    expect(typ()).not.toContain('"Vehículo"');
    expect(typ()).not.toContain('"Inmueble"');
  });

  it('el resumen ignora el filtro de ambiente: compara ambientes entre sí', async () => {
    await service.executiveSummary(CLINIC_ID, { location: 'FARMACIA' });
    expect(assetRepo.find.mock.calls[0][0].where.location).toBeUndefined();
  });

  it('mal estado y bajas consulta las dos listas por separado', async () => {
    assetRepo.find.mockResolvedValue([]);
    await service.conditionAndDisposals(CLINIC_ID);

    const [malEstado, bajas] = assetRepo.find.mock.calls.map(c => c[0].where);
    expect(malEstado.condition.value).toEqual([AssetCondition.FAIR, AssetCondition.POOR, AssetCondition.CRITICAL]);
    expect(malEstado.isActive).toBe(true);
    expect(bajas.status.value).toEqual([AssetStatus.RETIRED, AssetStatus.SOLD, AssetStatus.LOST]);
    // Un mensaje propio, no el "sin datos del período" genérico: acá no hay período.
    expect(typ()).toContain('Ningún activo dado de baja hasta la fecha.');
  });

  it('kpiCard nunca pide el color "gray", que no existe en la paleta y rompe la compilación', async () => {
    assetRepo.find.mockResolvedValue([]);
    await service.conditionAndDisposals(CLINIC_ID);
    expect(typ()).not.toMatch(/kpiCard\([^)]*color: "gray"/);
  });

  it('los cinco informes se compilan al vuelo, sin persistir nada', async () => {
    const buf = await service.inventoryByLocation(CLINIC_ID);
    expect(buf).toEqual(Buffer.from('%PDF'));
    expect(compiler.compile).toHaveBeenCalledTimes(1);
  });
});
