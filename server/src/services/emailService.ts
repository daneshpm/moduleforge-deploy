import nodemailer from 'nodemailer';
import path from 'path';
import dotenv from 'dotenv';

// Ensure .env is loaded regardless of current working directory
dotenv.config();
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../../../.env') });
dotenv.config({ path: path.join(process.cwd(), 'server/.env') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

export interface SendInviteParams {
  to: string;
  projectName: string;
  inviterName?: string;
  role: string;
  inviteToken: string;
  appUrl?: string;
}

export interface SendTeamInviteParams {
  to: string;
  teamName: string;
  inviterName?: string;
  inviterUsername?: string;
  role?: string;
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

function cleanBaseUrl(inputUrl?: string): string {
  let url = (inputUrl || process.env.APP_URL || 'https://moduleforge-deploy-pearl.vercel.app').trim();
  url = url.replace(/\/+$/, '');
  if (url.includes('localhost') || url.includes('127.0.0.1') || url.startsWith('http://localhost')) {
    url = 'https://moduleforge-deploy-pearl.vercel.app';
  }
  return url;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.getTransporter();
  }

  private getTransporter(): nodemailer.Transporter | null {
    const gmailUser = (process.env.GMAIL_USER || process.env.SMTP_USER || process.env.EMAIL_USER || '').trim();
    const gmailPass = (process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || process.env.EMAIL_PASS || '').replace(/\s+/g, '').trim();
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;

    if (gmailUser && gmailPass && !smtpHost) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: gmailUser,
          pass: gmailPass,
        },
      });
      return this.transporter;
    } else if (smtpHost && gmailUser && gmailPass) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: gmailUser,
          pass: gmailPass,
        },
      });
      return this.transporter;
    }

    return this.transporter;
  }

  public async sendProjectInvitation(params: SendInviteParams): Promise<SendInviteResult> {
    const { to, projectName, inviterName = 'Project Owner', role, inviteToken } = params;
    const baseUrl = cleanBaseUrl(params.appUrl);
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
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F7F8F7; color: #202524; margin: 0; padding: 40px 20px; }
          .container { max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #E2E6E4; padding: 36px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); }
          .header { text-align: center; margin-bottom: 28px; }
          .logo-badge { display: inline-block; padding: 6px 14px; background: rgba(31, 94, 75, 0.1); color: #1F5E4B; border-radius: 9999px; font-size: 13px; font-weight: 700; font-family: monospace; letter-spacing: 0.5px; margin-bottom: 12px; }
          h1 { font-size: 22px; font-weight: 800; color: #202524; margin: 0 0 8px 0; }
          p { color: #6B7471; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; }
          .highlight-box { background-color: #F7F8F7; border-radius: 12px; border: 1px solid #E2E6E4; padding: 18px; margin: 24px 0; text-align: left; }
          .highlight-label { color: #6B7471; font-size: 13px; }
          .btn-container { text-align: center; margin: 32px 0 24px 0; }
          .btn { display: inline-block; background: #1F5E4B; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-size: 14px; font-weight: 700; box-shadow: 0 4px 14px rgba(31, 94, 75, 0.25); }
          .footer { font-size: 12px; color: #6B7471; text-align: center; margin-top: 28px; border-top: 1px solid #E2E6E4; padding-top: 20px; }
          .link-fallback { font-size: 11px; word-break: break-all; color: #1F5E4B; font-family: monospace; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo-badge">MODULEFORGE</div>
            <h1>Project Collaboration Invitation</h1>
          </div>
          
          <p>Hello,</p>
          <p><strong>${inviterName}</strong> has invited you to join the team project <strong>"${projectName}"</strong> on ModuleForge as a ${role}.</p>
          
          <div class="highlight-box">
            <div style="margin-bottom: 6px;">
              <span class="highlight-label">Project:</span>
              <strong style="color: #202524; margin-left: 8px;">${projectName}</strong>
            </div>
            <div style="margin-bottom: 6px;">
              <span class="highlight-label">Role:</span>
              <span style="color: #1F5E4B; font-weight: 700; margin-left: 8px; text-transform: capitalize;">${role}</span>
            </div>
            <div>
              <span class="highlight-label">Invited Email:</span>
              <span style="color: #202524; font-family: monospace; margin-left: 8px;">${to}</span>
            </div>
          </div>
          
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

    return this.deliverEmail(to, subject, plainBody, htmlContent, gmailComposeUrl, mailtoUrl, inviteLink);
  }

  public async sendTeamInvitation(params: SendTeamInviteParams): Promise<SendInviteResult> {
    const { to, teamName, inviterName = 'Team Owner', inviterUsername, role = 'member', inviteToken } = params;
    const baseUrl = cleanBaseUrl(params.appUrl);
    const inviteLink = `${baseUrl}/invite/${inviteToken}`;

    const inviterDisplay = inviterUsername ? `${inviterName} (@${inviterUsername.replace(/^@/, '')})` : inviterName;
    const subject = `You're invited to join "${teamName}" on ModuleForge`;
    const plainBody = `Hello,\n\n${inviterDisplay} has invited you to join the team "${teamName}" on ModuleForge as a ${role}.\n\nClick the link below to accept the invitation and join the team:\n${inviteLink}\n\n(This invitation link will expire in 7 days.)\n\nHappy building,\nModuleForge Team`;

    const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainBody)}`;
    const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainBody)}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F7F8F7; color: #202524; margin: 0; padding: 40px 20px; }
          .container { max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #E2E6E4; padding: 36px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); }
          .header { text-align: center; margin-bottom: 28px; }
          .logo-badge { display: inline-block; padding: 6px 14px; background: rgba(31, 94, 75, 0.1); color: #1F5E4B; border-radius: 9999px; font-size: 13px; font-weight: 700; font-family: monospace; letter-spacing: 0.5px; margin-bottom: 12px; }
          h1 { font-size: 22px; font-weight: 800; color: #202524; margin: 0 0 8px 0; }
          p { color: #6B7471; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; }
          .highlight-box { background-color: #F7F8F7; border-radius: 12px; border: 1px solid #E2E6E4; padding: 18px; margin: 24px 0; text-align: left; }
          .highlight-label { color: #6B7471; font-size: 13px; }
          .btn-container { text-align: center; margin: 32px 0 24px 0; }
          .btn { display: inline-block; background: #1F5E4B; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-size: 14px; font-weight: 700; box-shadow: 0 4px 14px rgba(31, 94, 75, 0.25); }
          .footer { font-size: 12px; color: #6B7471; text-align: center; margin-top: 28px; border-top: 1px solid #E2E6E4; padding-top: 20px; }
          .link-fallback { font-size: 11px; word-break: break-all; color: #1F5E4B; font-family: monospace; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo-badge">MODULEFORGE TEAM</div>
            <h1>Team Invitation</h1>
          </div>
          
          <p>Hello,</p>
          <p><strong>${inviterDisplay}</strong> has invited you to join <strong>"${teamName}"</strong> on ModuleForge as a <strong>${role}</strong>.</p>
          
          <div class="highlight-box">
            <div style="margin-bottom: 6px;">
              <span class="highlight-label">Team:</span>
              <strong style="color: #202524; margin-left: 8px;">${teamName}</strong>
            </div>
            <div style="margin-bottom: 6px;">
              <span class="highlight-label">Invited by:</span>
              <span style="color: #202524; font-weight: 600; margin-left: 8px;">${inviterDisplay}</span>
            </div>
            <div style="margin-bottom: 6px;">
              <span class="highlight-label">Role:</span>
              <span style="color: #1F5E4B; font-weight: 700; margin-left: 8px; text-transform: capitalize;">${role}</span>
            </div>
            <div>
              <span class="highlight-label">Recipient:</span>
              <span style="color: #202524; font-family: monospace; margin-left: 8px;">${to}</span>
            </div>
          </div>
          
          <p>Collaborate on modular full-stack projects, share Git repositories, and compose applications seamlessly.</p>
          
          <div class="btn-container">
            <a href="${inviteLink}" class="btn" target="_blank">Join Team →</a>
          </div>
          
          <div class="footer">
            <p style="margin-bottom: 8px;">This invitation expires in 7 days. If the button above does not work, visit:</p>
            <a href="${inviteLink}" class="link-fallback" target="_blank">${inviteLink}</a>
            <p style="margin-top: 16px; font-size: 11px;">ModuleForge Software Platform</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.deliverEmail(to, subject, plainBody, htmlContent, gmailComposeUrl, mailtoUrl, inviteLink);
  }

  private async deliverEmail(
    to: string,
    subject: string,
    plainBody: string,
    htmlContent: string,
    gmailComposeUrl: string,
    mailtoUrl: string,
    inviteLink: string
  ): Promise<SendInviteResult> {
    const transporter = this.getTransporter();
    const gmailUser = (process.env.GMAIL_USER || process.env.SMTP_USER || '').trim();

    try {
      if (transporter && gmailUser) {
        const fromAddress = process.env.SMTP_FROM || `"ModuleForge Team" <${gmailUser}>`;
        console.log(`✉️ Sending email to: ${to} from: ${fromAddress}`);
        
        const info = await transporter.sendMail({
          from: fromAddress,
          to,
          subject,
          html: htmlContent,
          text: plainBody,
        });

        console.log(`✉️ Delivered email successfully to ${to} (Message ID: ${info.messageId})`);
        return { success: true, gmailComposeUrl, mailtoUrl, inviteLink };
      } else {
        console.log(`✉️ [Invite Generated] To: ${to} | Link: ${inviteLink}`);
        return { success: true, gmailComposeUrl, mailtoUrl, inviteLink };
      }
    } catch (error: any) {
      console.error('Failed to deliver email:', error.message);
      return { success: false, gmailComposeUrl, mailtoUrl, inviteLink, error: error.message };
    }
  }
}

export const emailService = new EmailService();
