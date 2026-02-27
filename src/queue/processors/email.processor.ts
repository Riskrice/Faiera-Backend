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
        const port = parseInt(this.configService.get<string>('SMTP_PORT', '587'), 10);
        const user = this.configService.get<string>('SMTP_USER');
        const pass = this.configService.get<string>('SMTP_PASS');

        if (!host || !user || !pass) {
            this.logger.warn('SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASS). Emails will be logged but not sent.');
            return;
        }

        this.logger.log(`SMTP Config: host=${host}, port=${port}, secure=${port === 465}, user=${user}`);

        this.transporter = nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: { user, pass },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
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
        const brandColor = '#10B981';
        const brandColorLight = '#d1fae5';
        const darkBg = '#0F1115';
        const year = new Date().getFullYear();

        const header = `
            <tr>
              <td style="background-color: ${darkBg}; padding: 20px 16px; text-align: center;">
                <table cellpadding="0" cellspacing="0" border="0" align="center" role="presentation">
                  <tr>
                    <td style="width: 36px; height: 36px; background-color: ${brandColor}; border-radius: 10px; text-align: center; vertical-align: middle;">
                      <span style="color: #000; font-size: 18px; font-weight: bold; font-family: 'Cairo', 'Segoe UI', Arial, sans-serif;">F</span>
                    </td>
                    <td style="padding-right: 10px;">
                      <span style="color: #fff; font-size: 22px; font-weight: bold; font-family: 'Cairo', 'Segoe UI', Arial, sans-serif;">فايرا</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
        `;

        const footer = `
            <tr>
              <td style="background-color: #f8fafc; padding: 20px 16px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0 0 6px 0; font-family: 'Cairo', 'Segoe UI', Arial, sans-serif;">
                    © ${year} فايرا (Faiera). جميع الحقوق محفوظة.
                </p>
                <p style="color: #cbd5e1; font-size: 11px; margin: 0; font-family: 'Cairo', 'Segoe UI', Arial, sans-serif;">
                    هذا البريد مُرسل تلقائيًا، يرجى عدم الرد عليه.
                </p>
              </td>
            </tr>
        `;

        const wrapContent = (content: string) => `
            <!DOCTYPE html>
            <html dir="rtl" lang="ar" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
            <head>
                <meta charset="UTF-8" />
                <meta http-equiv="X-UA-Compatible" content="IE=edge" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <meta name="x-apple-disable-message-reformatting" />
                <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no" />
                <title>فايرا</title>
                <!--[if mso]>
                <noscript>
                <xml>
                  <o:OfficeDocumentSettings>
                    <o:PixelsPerInch>96</o:PixelsPerInch>
                  </o:OfficeDocumentSettings>
                </xml>
                </noscript>
                <![endif]-->
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
                    * { box-sizing: border-box; }
                    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
                    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
                    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
                    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
                    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }

                    @media only screen and (max-width: 620px) {
                        .email-container { width: 100% !important; max-width: 100% !important; }
                        .email-body { padding: 20px 16px !important; }
                        .email-header { padding: 16px 12px !important; }
                        .email-footer { padding: 16px 12px !important; }
                        .otp-code { font-size: 28px !important; letter-spacing: 6px !important; }
                        .otp-box { padding: 20px 12px !important; }
                        .cta-btn { padding: 12px 24px !important; font-size: 15px !important; width: 100% !important; display: block !important; }
                        .icon-circle-lg { width: 64px !important; height: 64px !important; }
                        .icon-circle-lg span { font-size: 28px !important; }
                        .steps-box { padding: 16px !important; }
                        .step-text { font-size: 13px !important; }
                        .heading-lg { font-size: 20px !important; }
                        .heading-md { font-size: 18px !important; }
                        .body-text { font-size: 14px !important; }
                        .small-text { font-size: 12px !important; }
                    }
                </style>
            </head>
            <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
                <!-- Outer wrapper table for full-width background -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f1f5f9;">
                  <tr>
                    <td align="center" style="padding: 24px 12px;">
                      <!-- Email container -->
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="email-container" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">
                        ${header}
                        <tr>
                          <td dir="rtl" class="email-body" style="padding: 32px 28px; font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;">
                            ${content}
                          </td>
                        </tr>
                        ${footer}
                      </table>
                    </td>
                  </tr>
                </table>
            </body>
            </html>
        `;

        const templates: Record<string, string> = {
            'password-reset': wrapContent(`
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td align="center" style="padding-bottom: 20px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr><td align="center" style="width: 64px; height: 64px; background-color: ${brandColorLight}; border-radius: 50%; text-align: center; vertical-align: middle; font-size: 28px;">🔐</td></tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-bottom: 24px;">
                      <h2 class="heading-md" style="color: #020817; font-size: 22px; margin: 0; font-family: 'Cairo', 'Segoe UI', Arial, sans-serif;">إعادة تعيين كلمة المرور</h2>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <p class="body-text" style="color: #334155; font-size: 16px; line-height: 1.8; margin: 0 0 8px 0;">مرحبًا <strong>${context?.name || ''}</strong>،</p>
                      <p class="body-text" style="color: #475569; font-size: 15px; line-height: 1.8; margin: 0 0 24px 0;">لقد تلقينا طلبًا لإعادة تعيين كلمة المرور الخاصة بحسابك. اضغط على الزر أدناه للمتابعة:</p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding: 8px 0 28px 0;">
                      <a href="${context?.resetUrl || '#'}" class="cta-btn"
                         style="display: inline-block; padding: 14px 40px; background-color: ${brandColor}; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; font-family: 'Cairo', 'Segoe UI', Arial, sans-serif; mso-padding-alt: 0; text-align: center;">
                        <!--[if mso]><i style="mso-font-width:-100%;mso-text-raise:21pt">&nbsp;</i><![endif]-->
                        <span style="mso-text-raise:10pt;">إعادة تعيين كلمة المرور</span>
                        <!--[if mso]><i style="mso-font-width:-100%">&nbsp;</i><![endif]-->
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px;">
                        <tr>
                          <td style="padding: 12px 16px;">
                            <p class="small-text" style="color: #92400e; font-size: 13px; margin: 0;">⏳ هذا الرابط صالح لمدة <strong>ساعة واحدة</strong> فقط.</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-top: 20px;">
                      <p class="small-text" style="color: #94a3b8; font-size: 13px; margin: 0;">إذا لم تطلب ذلك، يمكنك تجاهل هذا البريد بأمان.</p>
                    </td>
                  </tr>
                </table>
            `),

            'welcome': wrapContent(`
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td align="center" style="padding-bottom: 12px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr><td class="icon-circle-lg" align="center" style="width: 80px; height: 80px; background-color: ${brandColorLight}; border-radius: 50%; text-align: center; vertical-align: middle; font-size: 36px;">🎉</td></tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-bottom: 4px;">
                      <h2 class="heading-lg" style="color: #020817; font-size: 24px; margin: 0; font-family: 'Cairo', 'Segoe UI', Arial, sans-serif;">مرحبًا بك في فايرا!</h2>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-bottom: 24px;">
                      <p style="color: ${brandColor}; font-size: 14px; font-weight: 600; margin: 0;">حسابك جاهز للاستخدام</p>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <p class="body-text" style="color: #334155; font-size: 16px; line-height: 1.8; margin: 0 0 8px 0;">مرحبًا <strong>${context?.name || ''}</strong>،</p>
                      <p class="body-text" style="color: #475569; font-size: 15px; line-height: 1.8; margin: 0 0 24px 0;">يسعدنا انضمامك إلى مجتمع فايرا التعليمي! تم إنشاء حسابك بنجاح ويمكنك الآن البدء في رحلتك التعليمية.</p>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="steps-box" style="background-color: #f0fdf4; border-radius: 12px;">
                        <tr>
                          <td style="padding: 24px;">
                            <h3 style="color: #020817; font-size: 16px; margin: 0 0 16px 0; font-family: 'Cairo', 'Segoe UI', Arial, sans-serif;">🚀 ابدأ الآن</h3>
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                              <tr>
                                <td style="padding: 8px 0; vertical-align: top; width: 32px;">
                                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                                    <tr><td style="width: 28px; height: 28px; background-color: ${brandColor}; border-radius: 50%; text-align: center; vertical-align: middle; color: #fff; font-size: 13px;">✓</td></tr>
                                  </table>
                                </td>
                                <td class="step-text" style="padding: 8px 12px 8px 0; color: #334155; font-size: 14px; vertical-align: middle;">تصفّح الدورات المتاحة واختر ما يناسبك</td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; vertical-align: top; width: 32px;">
                                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                                    <tr><td style="width: 28px; height: 28px; background-color: ${brandColor}; border-radius: 50%; text-align: center; vertical-align: middle; color: #fff; font-size: 13px;">✓</td></tr>
                                  </table>
                                </td>
                                <td class="step-text" style="padding: 8px 12px 8px 0; color: #334155; font-size: 14px; vertical-align: middle;">أكمل ملفك الشخصي لتجربة أفضل</td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; vertical-align: top; width: 32px;">
                                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                                    <tr><td style="width: 28px; height: 28px; background-color: ${brandColor}; border-radius: 50%; text-align: center; vertical-align: middle; color: #fff; font-size: 13px;">✓</td></tr>
                                  </table>
                                </td>
                                <td class="step-text" style="padding: 8px 12px 8px 0; color: #334155; font-size: 14px; vertical-align: middle;">تابع تقدمك وحقق أهدافك التعليمية</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding: 28px 0;">
                      <a href="${context?.loginUrl || '#'}" class="cta-btn"
                         style="display: inline-block; padding: 14px 48px; background-color: ${brandColor}; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; font-family: 'Cairo', 'Segoe UI', Arial, sans-serif; mso-padding-alt: 0; text-align: center;">
                        <!--[if mso]><i style="mso-font-width:-100%;mso-text-raise:21pt">&nbsp;</i><![endif]-->
                        <span style="mso-text-raise:10pt;">ابدأ رحلتك التعليمية</span>
                        <!--[if mso]><i style="mso-font-width:-100%">&nbsp;</i><![endif]-->
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td style="border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center;">
                      <p class="small-text" style="color: #64748b; font-size: 14px; margin: 0 0 4px 0;">هل تحتاج مساعدة؟ تواصل معنا على</p>
                      <a href="mailto:support@faiera.com" style="color: ${brandColor}; font-size: 14px; text-decoration: none; font-weight: 600;">support@faiera.com</a>
                    </td>
                  </tr>
                </table>
            `),

            'otp-login': wrapContent(`
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td align="center" style="padding-bottom: 20px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr><td align="center" style="width: 64px; height: 64px; background-color: ${brandColorLight}; border-radius: 50%; text-align: center; vertical-align: middle; font-size: 28px;">🔑</td></tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-bottom: 24px;">
                      <h2 class="heading-md" style="color: #020817; font-size: 22px; margin: 0; font-family: 'Cairo', 'Segoe UI', Arial, sans-serif;">رمز الدخول لمرة واحدة</h2>
                    </td>
                  </tr>
                  <tr>
                    <td align="center">
                      <p class="body-text" style="color: #334155; font-size: 16px; line-height: 1.8; margin: 0 0 4px 0;">مرحبًا <strong>${context?.name || ''}</strong>،</p>
                      <p class="body-text" style="color: #475569; font-size: 15px; line-height: 1.8; margin: 0 0 24px 0;">لقد طلبت تسجيل الدخول إلى حسابك. استخدم الرمز التالي للمتابعة:</p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding: 8px 0 28px 0;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="otp-box" style="background-color: ${darkBg}; border-radius: 12px; width: 100%; max-width: 320px;">
                        <tr>
                          <td align="center" style="padding: 28px 16px;">
                            <span class="otp-code" style="font-size: 36px; font-weight: bold; letter-spacing: 10px; color: ${brandColor}; font-family: 'Courier New', monospace;">${context?.otpCode || '------'}</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px;">
                        <tr>
                          <td align="center" style="padding: 12px 16px;">
                            <p class="small-text" style="color: #92400e; font-size: 13px; margin: 0;">⏳ هذا الرمز صالح لمدة <strong>10 دقائق</strong> فقط.</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-top: 20px;">
                      <p class="small-text" style="color: #94a3b8; font-size: 13px; margin: 0;">إذا لم تقم بطلب هذا الرمز، يمكنك تجاهل هذه الرسالة بأمان.</p>
                    </td>
                  </tr>
                </table>
            `),
        };

        return templates[template] || wrapContent(`
            <h2 style="color: #020817;">${context?.subject || template}</h2>
            <p style="color: #475569;">${context?.body || JSON.stringify(context)}</p>
        `);
    }
}
