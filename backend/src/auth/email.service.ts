import { Injectable, Logger } from '@nestjs/common';
import { config } from '../config.js';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailResult {
  delivered: boolean;
  transport: 'console' | 'smtp';
}

/**
 * Delivery is pluggable. `console` is a development-only transport: the message
 * is written to the server log and nothing is sent. `smtp` uses a real provider
 * and is only considered configured when SMTP settings are present.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  get transport(): 'console' | 'smtp' {
    return config.emailTransport;
  }

  isConfigured(): boolean {
    if (this.transport === 'console') return true;
    return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT);
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    if (!this.isConfigured()) {
      throw new Error('SMTP is selected but SMTP_HOST/SMTP_PORT are not configured');
    }

    if (this.transport === 'console') {
      this.logger.log(
        `[console mail] to=${message.to} subject="${message.subject}"\n${message.text}`,
      );
      return { delivered: false, transport: 'console' };
    }

    const nodemailer = await import('nodemailer');
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASSWORD
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
          : undefined,
    });

    await transport.sendMail({
      from: config.emailFrom,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });

    return { delivered: true, transport: 'smtp' };
  }
}
