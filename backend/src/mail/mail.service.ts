import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createTransport, Transporter } from 'nodemailer';
import { Repository } from 'typeorm';
import { SmtpConfig } from './entities/smtp-config.entity';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @InjectRepository(SmtpConfig)
    private readonly smtpRepo: Repository<SmtpConfig>,
  ) {}

  /** Carga la configuración SMTP vigente desde la base de datos. */
  async getConfig(): Promise<SmtpConfig | null> {
    return this.smtpRepo
      .createQueryBuilder('s')
      .addSelect('s.pass')
      .where('s.id = :id', { id: 1 })
      .getOne();
  }

  /** Guarda (upsert) la configuración SMTP. */
  async saveConfig(dto: Partial<SmtpConfig>): Promise<SmtpConfig> {
    await this.smtpRepo.upsert({ id: 1, ...dto }, ['id']);
    return this.getConfig() as Promise<SmtpConfig>;
  }

  /** Envía un correo usando la config SMTP activa en la base de datos. */
  async send(opts: { to: string; subject: string; html: string }): Promise<void> {
    const cfg = await this.getConfig();
    if (!cfg || !cfg.enabled) {
      this.logger.warn(`[MAIL] SMTP deshabilitado — no se envió email a ${opts.to}`);
      return;
    }

    const transporter: Transporter = createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
    });

    await transporter.sendMail({
      from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });

    this.logger.log(`[MAIL] Email enviado a ${opts.to} — "${opts.subject}"`);
  }

  /** Verifica la conexión SMTP sin enviar nada. */
  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    const cfg = await this.getConfig();
    if (!cfg || !cfg.host) return { ok: false, error: 'Sin configuración SMTP guardada.' };
    try {
      const transporter = createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: { user: cfg.user, pass: cfg.pass },
      });
      await transporter.verify();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message ?? 'Error desconocido' };
    }
  }
}
