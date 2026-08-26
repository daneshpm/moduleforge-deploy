import nodemailer from 'nodemailer';

export interface SendInviteParams {
  to: string;
  projectName: string;
  inviterName?: string;
  role: string;
  inviteToken: string;
  appUrl?: string;
}

export interface SendInviteResult {
  success: boolean;
  previewUrl?: string;
  gmailComposeUrl: string;
  mailtoUrl: string;
  inviteLink: string;
  error?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;

    if (gmailUser && gmailPass && !smtpHost) {
      // Direct Gmail Service Transport
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: gmailUser,
          pass: gmailPass,
        },
      });
      console.log(`✉️ Configured Direct Gmail Transport for (${gmailUser})`);
    } else if (smtpHost && gmailUser && gmailPass) {
      // Custom SMTP Transport
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: gmailUser,
          pass: gmailPass,
        },
      });
      console.log(`✉️ Configured Custom SMTP Email Transport (${smtpHost}:${smtpPort})`);
    } else {
      console.log(`ℹ️ SMTP/Gmail credentials not set in .env. Enabled 1-click Web Gmail & Ethereal email fallback.`);
    }
  }

  public async sendProjectInvitation(params: SendInviteParams): Promise<SendInviteResult> {
    const { to, projectName, inviterName = 'Project Owner', role, inviteToken } = params;
    const baseUrl = params.appUrl || process.env.APP_URL || 'http://localhost:5173';
    const inviteLink = `${baseUrl}/join-project?token=${inviteToken}`;

    const subject = `You've been invited to join "${projectName}" on ModuleForge`;
    const plainBody = `Hello,\n\n${inviterName} has invited you to join the team project "${projectName}" on ModuleForge as a ${role}.\n\nClick the link below to accept the invitation and join the project:\n${inviteLink}\n\nHappy building,\nModuleForge Team`;

    const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainBody)}`;
    const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainBody)}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 40px 20px; }
          .container { max-width: 560px; margin: 0 auto; background-color: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 36px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4); }
          .header { text-align: center; margin-bottom: 28px; }
          .logo-badge { display: inline-block; padding: 6px 14px; background: rgba(99, 102, 241, 0.15); color: #818cf8; border-radius: 9999px; font-size: 13px; font-weight: 700; font-family: monospace; letter-spacing: 0.5px; margin-bottom: 12px; }
          h1 { font-size: 22px; font-weight: 800; color: #ffffff; margin: 0 0 8px 0; }
          p { color: #cbd5e1; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; }
          .highlight-box { background-color: #0f172a; border-radius: 12px; border: 1px solid #334155; padding: 18px; margin: 24px 0; text-align: left; }
          .highlight-label { color: #94a3b8; font-size: 13px; }
          .btn-container { text-align: center; margin: 32px 0 24px 0; }
          .btn { display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-size: 14px; font-weight: 700; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4); }
          .footer { font-size: 12px; color: #64748b; text-align: center; margin-top: 28px; border-top: 1px solid #334155; padding-top: 20px; }
          .link-fallback { font-size: 11px; word-break: break-all; color: #818cf8; font-family: monospace; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo-badge">MODULEFORGE TEAM</div>
            <h1>Project Collaboration Invitation</h1>
          </div>
          
          <p>Hello,</p>
          <p><strong>${inviterName}</strong> has invited you to join the team project <strong>"${projectName}"</strong> on ModuleForge.</p>
          
          <div class="highlight-box">
            <div style="margin-bottom: 6px;">
              <span class="highlight-label">Project:</span>
              <strong style="color: #ffffff; margin-left: 8px;">${projectName}</strong>
            </div>
            <div style="margin-bottom: 6px;">
              <span class="highlight-label">Invited Role:</span>
              <span style="color: #818cf8; font-weight: 700; margin-left: 8px; text-transform: capitalize;">${role}</span>
            </div>
            <div>
              <span class="highlight-label">Invited Email:</span>
              <span style="color: #cbd5e1; font-family: monospace; margin-left: 8px;">${to}</span>
            </div>
          </div>
          
          <p>As a team member, you can connect your module's Git/GitHub repository, synchronize live commits, and test the unified application on localhost.</p>
          
          <div class="btn-container">
            <a href="${inviteLink}" class="btn" target="_blank">Accept Invitation & Join Project →</a>
          </div>
          
          <div class="footer">
            <p style="margin-bottom: 8px;">If the button above does not work, copy and paste this link in your browser:</p>
            <a href="${inviteLink}" class="link-fallback" target="_blank">${inviteLink}</a>
            <p style="margin-top: 16px; font-size: 11px;">This invitation was sent from ModuleForge Platform.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      if (this.transporter) {
        await this.transporter.sendMail({
          from: process.env.SMTP_FROM || `"ModuleForge Team" <${process.env.GMAIL_USER || 'no-reply@moduleforge.io'}>`,
          to,
          subject,
          html: htmlContent,
          text: plainBody,
        });
        console.log(`✉️ Successfully delivered email invitation to ${to} for project "${projectName}"`);
        return {
          success: true,
          gmailComposeUrl,
          mailtoUrl,
          inviteLink,
        };
      } else {
        // Fallback: Generate Ethereal test account on the fly for development preview
        try {
          const testAccount = await nodemailer.createTestAccount();
          const testTransporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
              user: testAccount.user,
              pass: testAccount.pass,
            },
          });

          const info = await testTransporter.sendMail({
            from: '"ModuleForge Team" <no-reply@moduleforge.io>',
            to,
            subject,
            html: htmlContent,
            text: plainBody,
          });

          const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
          console.log(`✉️ Email Invitation sent via Ethereal! Preview URL: ${previewUrl}`);
          return {
            success: true,
            previewUrl,
            gmailComposeUrl,
            mailtoUrl,
            inviteLink,
          };
        } catch (testErr) {
          console.log(`✉️ [Simulation] Invitation to: ${to} | Link: ${inviteLink}`);
          return {
            success: true,
            gmailComposeUrl,
            mailtoUrl,
            inviteLink,
          };
        }
      }
    } catch (error: any) {
      console.error('Failed to send email via SMTP:', error.message);
      return {
        success: false,
        gmailComposeUrl,
        mailtoUrl,
        inviteLink,
        error: error.message,
      };
    }
  }
}

export const emailService = new EmailService();
