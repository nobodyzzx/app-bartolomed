import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createTransport } from 'nodemailer';
import { MailService } from './mail.service';
import { SmtpConfig } from './entities/smtp-config.entity';
import { createMockRepository, createMockQueryBuilder, MockRepository } from 'src/test/helpers/mock-repository.factory';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

const mockCreateTransport = createTransport as jest.Mock;

const makeConfig = (overrides: Partial<SmtpConfig> = {}): SmtpConfig =>
  ({
    id: 1,
    host: 'smtp.example.com',
    port: 587,
    secure: false,
    user: 'user@example.com',
    pass: 'secret',
    fromName: 'Bartolomed',
    fromEmail: 'no-reply@bartolomed.com',
    enabled: true,
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }) as SmtpConfig;

describe('MailService', () => {
  let service: MailService;
  let smtpRepo: MockRepository<SmtpConfig>;

  beforeEach(async () => {
    smtpRepo = createMockRepository<SmtpConfig>();
    smtpRepo.upsert = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [MailService, { provide: getRepositoryToken(SmtpConfig), useValue: smtpRepo }],
    }).compile();

    service = module.get<MailService>(MailService);
    jest.clearAllMocks();
  });

  describe('getConfig', () => {
    it('consulta la fila id=1 incluyendo la columna pass (select: false por defecto)', async () => {
      const qb = createMockQueryBuilder({ getOne: jest.fn().mockResolvedValue(makeConfig()) });
      (smtpRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.getConfig();

      expect(qb.addSelect).toHaveBeenCalledWith('s.pass');
      expect(qb.where).toHaveBeenCalledWith('s.id = :id', { id: 1 });
      expect(result?.host).toBe('smtp.example.com');
    });

    it('devuelve null si no hay configuración guardada', async () => {
      const qb = createMockQueryBuilder({ getOne: jest.fn().mockResolvedValue(null) });
      (smtpRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.getConfig();

      expect(result).toBeNull();
    });
  });

  describe('saveConfig', () => {
    it('hace upsert por id y devuelve la config recién guardada', async () => {
      (smtpRepo.upsert as jest.Mock).mockResolvedValue(undefined);
      const qb = createMockQueryBuilder({ getOne: jest.fn().mockResolvedValue(makeConfig({ host: 'smtp.new.com' })) });
      (smtpRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.saveConfig({ host: 'smtp.new.com' });

      expect(smtpRepo.upsert).toHaveBeenCalledWith({ id: 1, host: 'smtp.new.com' }, ['id']);
      expect(result.host).toBe('smtp.new.com');
    });
  });

  describe('send', () => {
    it('no envía nada y no crea transporter si no hay config guardada', async () => {
      const qb = createMockQueryBuilder({ getOne: jest.fn().mockResolvedValue(null) });
      (smtpRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      await service.send({ to: 'x@example.com', subject: 'Hola', html: '<p>hi</p>' });

      expect(mockCreateTransport).not.toHaveBeenCalled();
    });

    it('no envía nada si la config existe pero está deshabilitada', async () => {
      const qb = createMockQueryBuilder({ getOne: jest.fn().mockResolvedValue(makeConfig({ enabled: false })) });
      (smtpRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      await service.send({ to: 'x@example.com', subject: 'Hola', html: '<p>hi</p>' });

      expect(mockCreateTransport).not.toHaveBeenCalled();
    });

    it('crea el transporter con la config activa y envía el correo', async () => {
      const cfg = makeConfig();
      const qb = createMockQueryBuilder({ getOne: jest.fn().mockResolvedValue(cfg) });
      (smtpRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);
      const sendMail = jest.fn().mockResolvedValue(undefined);
      mockCreateTransport.mockReturnValue({ sendMail });

      await service.send({ to: 'paciente@example.com', subject: 'Recordatorio', html: '<p>cita</p>' });

      expect(mockCreateTransport).toHaveBeenCalledWith({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: { user: cfg.user, pass: cfg.pass },
      });
      expect(sendMail).toHaveBeenCalledWith({
        from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
        to: 'paciente@example.com',
        subject: 'Recordatorio',
        html: '<p>cita</p>',
      });
    });

    it('propaga el error si el envío falla (el llamador decide cómo manejarlo)', async () => {
      const qb = createMockQueryBuilder({ getOne: jest.fn().mockResolvedValue(makeConfig()) });
      (smtpRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);
      const sendMail = jest.fn().mockRejectedValue(new Error('SMTP timeout'));
      mockCreateTransport.mockReturnValue({ sendMail });

      await expect(
        service.send({ to: 'paciente@example.com', subject: 'Recordatorio', html: '<p>cita</p>' }),
      ).rejects.toThrow('SMTP timeout');
    });
  });

  describe('testConnection', () => {
    it('devuelve error si no hay configuración guardada', async () => {
      const qb = createMockQueryBuilder({ getOne: jest.fn().mockResolvedValue(null) });
      (smtpRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.testConnection();

      expect(result).toEqual({ ok: false, error: 'Sin configuración SMTP guardada.' });
      expect(mockCreateTransport).not.toHaveBeenCalled();
    });

    it('devuelve error si la config existe pero no tiene host', async () => {
      const qb = createMockQueryBuilder({ getOne: jest.fn().mockResolvedValue(makeConfig({ host: '' })) });
      (smtpRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.testConnection();

      expect(result.ok).toBe(false);
      expect(mockCreateTransport).not.toHaveBeenCalled();
    });

    it('devuelve ok:true si transporter.verify() resuelve', async () => {
      const cfg = makeConfig();
      const qb = createMockQueryBuilder({ getOne: jest.fn().mockResolvedValue(cfg) });
      (smtpRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);
      const verify = jest.fn().mockResolvedValue(true);
      mockCreateTransport.mockReturnValue({ verify });

      const result = await service.testConnection();

      expect(result).toEqual({ ok: true });
    });

    it('devuelve ok:false con el mensaje del error si verify() rechaza', async () => {
      const cfg = makeConfig();
      const qb = createMockQueryBuilder({ getOne: jest.fn().mockResolvedValue(cfg) });
      (smtpRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);
      const verify = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      mockCreateTransport.mockReturnValue({ verify });

      const result = await service.testConnection();

      expect(result).toEqual({ ok: false, error: 'ECONNREFUSED' });
    });

    it('devuelve un mensaje por defecto si el error rechazado no trae message', async () => {
      const cfg = makeConfig();
      const qb = createMockQueryBuilder({ getOne: jest.fn().mockResolvedValue(cfg) });
      (smtpRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);
      const verify = jest.fn().mockRejectedValue({});
      mockCreateTransport.mockReturnValue({ verify });

      const result = await service.testConnection();

      expect(result).toEqual({ ok: false, error: 'Error desconocido' });
    });
  });
});
