import { SmtpConfigController } from './smtp-config.controller';
import { MailService } from './mail.service';
import { UpdateSmtpConfigDto } from './dto/smtp-config.dto';

describe('SmtpConfigController', () => {
  let controller: SmtpConfigController;
  let mailService: jest.Mocked<MailService>;

  beforeEach(() => {
    mailService = {
      getConfig: jest.fn().mockResolvedValue({ host: 'smtp.example.com' }),
      saveConfig: jest.fn().mockResolvedValue({ host: 'smtp.new.com' }),
      testConnection: jest.fn().mockResolvedValue({ ok: true }),
    } as unknown as jest.Mocked<MailService>;
    controller = new SmtpConfigController(mailService);
  });

  it('getConfig delega en mailService.getConfig()', async () => {
    const result = await controller.getConfig();
    expect(mailService.getConfig).toHaveBeenCalled();
    expect(result).toEqual({ host: 'smtp.example.com' });
  });

  it('saveConfig delega el dto completo en mailService.saveConfig()', async () => {
    const dto: UpdateSmtpConfigDto = { host: 'smtp.new.com' } as UpdateSmtpConfigDto;
    const result = await controller.saveConfig(dto);
    expect(mailService.saveConfig).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ host: 'smtp.new.com' });
  });

  it('testConnection delega en mailService.testConnection()', async () => {
    const result = await controller.testConnection();
    expect(mailService.testConnection).toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });
});
