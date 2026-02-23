import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { QUEUE_NAMES } from '../constants';

@Processor(QUEUE_NAMES.EMAILS)
export class EmailProcessor extends WorkerHost {
    private readonly logger = new Logger(EmailProcessor.name);
    private transporter: nodemailer.Transporter | null = null;

    constructor(private readonly configService: ConfigService) {
        super();
        this.initTransporter();
    }

    private initTransporter(): void {
        const host = this.configService.get<string>('SMTP_HOST');
        const port = this.configService.get<number>('SMTP_PORT', 587);
        const user = this.configService.get<string>('SMTP_USER');
        const pass = this.configService.get<string>('SMTP_PASS');

        if (!host || !user || !pass) {
            this.logger.warn('SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASS). Emails will be logged but not sent.');
            return;
        }

        this.transporter = nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: { user, pass },
        });

        this.logger.log(`Email transporter configured via ${host}:${port}`);
    }

    async process(job: Job<any, any, string>): Promise<any> {
        this.logger.log(`Processing email job ${job.id} of type ${job.name}`);

        const { to, subject, template, context } = job.data;

        // Build HTML body from template + context
        const html = this.renderTemplate(template, context);

        if (!this.transporter) {
            this.logger.warn(`[DRY-RUN] Email to ${to} | Subject: ${subject} | Template: ${template}`);
            this.logger.debug(`Context: ${JSON.stringify(context)}`);
            return { sent: false, reason: 'SMTP not configured' };
        }

        try {
            const fromName = this.configService.get<string>('SMTP_FROM_NAME', 'Faiera');
            const fromEmail = this.configService.get<string>('SMTP_FROM_EMAIL', this.configService.get<string>('SMTP_USER', 'noreply@faiera.com'));

            const info = await this.transporter.sendMail({
                from: `"${fromName}" <${fromEmail}>`,
                to,
                subject,
                html,
            });

            this.logger.log(`Email sent to ${to}, messageId: ${info.messageId}`);
            return { sent: true, messageId: info.messageId };
        } catch (error: any) {
            this.logger.error(`Failed to send email to ${to}`, error?.stack || error);
            throw error;
        }
    }

    private renderTemplate(template: string, context: Record<string, any>): string {
        // Simple template rendering — replace {{key}} with context values
        // For production, consider using Handlebars or a proper template engine
        const templates: Record<string, string> = {
            'password-reset': `
                <div dir="rtl" style="font-family: 'Cairo', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #333;">إعادة تعيين كلمة المرور</h2>
                    <p>مرحبًا ${context?.name || ''},</p>
                    <p>لقد طلبت إعادة تعيين كلمة المرور. اضغط على الزر أدناه:</p>
                    <a href="${context?.resetUrl || '#'}" 
                       style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 8px; margin: 16px 0;">
                        إعادة تعيين كلمة المرور
                    </a>
                    <p style="color: #666; font-size: 14px;">هذا الرابط صالح لمدة ساعة واحدة فقط.</p>
                    <p style="color: #999; font-size: 12px;">إذا لم تطلب ذلك، تجاهل هذا البريد.</p>
                </div>
            `,
            'welcome': `
                <div dir="rtl" style="font-family: 'Cairo', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #333;">مرحبًا بك في فائرة!</h2>
                    <p>مرحبًا ${context?.name || ''},</p>
                    <p>تم إنشاء حسابك بنجاح. يمكنك الآن تسجيل الدخول والبدء في رحلتك التعليمية.</p>
                </div>
            `,
        };

        return templates[template] || `
            <div dir="rtl" style="font-family: 'Cairo', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2>${context?.subject || template}</h2>
                <p>${context?.body || JSON.stringify(context)}</p>
            </div>
        `;
    }
}
