// backend/src/services/mail.service.js
import 'dotenv/config';
import sgMail from '@sendgrid/mail';
import { EmailLogModel } from '../models/email.log.model.js';

export class MailService {

  constructor() {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    this.EmailLogModel = EmailLogModel;
  }

  async sendPasswordResetEmail(to, token) {
    try {
      const resetLink = `${process.env.FRONT_URL}/reset-password?token=${token}`;

      const info = await sgMail.send({
        from: `GEO-VOTATION <${process.env.EMAIL_USER}>`,
        to,
        subject: "Recuperación de contraseña - GEO-VOTATION",
        text: `Haz clic en el siguiente enlace para restablecer tu contraseña: ${resetLink}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px;">
            <h2>Recuperación de contraseña</h2>
            <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en <strong>GEO-VOTATION</strong>.</p>
            
            <p>Para crear una nueva contraseña, haz clic en el siguiente botón:</p>

            <a href="${resetLink}" 
               style="
                 display: inline-block;
                 padding: 12px 20px;
                 margin: 15px 0;
                 background-color: #2563eb;
                 color: white;
                 text-decoration: none;
                 border-radius: 5px;
                 font-weight: bold;
               ">
              Restablecer contraseña
            </a>

            <p>O copia y pega este enlace en tu navegador:</p>
            <p style="word-break: break-all;">${resetLink}</p>

            <p><strong>Este enlace expirará en 15 minutos.</strong></p>
            
            <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              Si no solicitaste este cambio, puedes ignorar este mensaje.<br>
              Tu contraseña actual seguirá siendo válida.
            </p>
          </div>
        `,
      });

      console.log("📨 Email de recuperación enviado:", info);
      return info;

    } catch (err) {
      console.error("❌ Error enviando email de recuperación:", err);
      throw err;
    }
  }

  async sendEmail(to, token) {
    try {
      const verificationLink = `${process.env.FRONT_URL}/verify-code/${token}`;

      const info = await sgMail.send({
        from: `GEO-VOTATION <${process.env.EMAIL_USER}>`,
        to,
        subject: "Verifica tu cuenta - GEO-VOTATION",
        text: `Haz clic en el siguiente enlace para verificar tu cuenta: ${verificationLink}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px;">
            <h2>Verificación de cuenta</h2>
            <p>Gracias por registrarte en <strong>GEO-VOTATION</strong>.</p>
            <p>Para activar tu cuenta, haz clic en el siguiente botón:</p>

            <a href="${verificationLink}" 
               style="
                 display: inline-block;
                 padding: 12px 20px;
                 margin: 15px 0;
                 background-color: #2563eb;
                 color: white;
                 text-decoration: none;
                 border-radius: 5px;
                 font-weight: bold;
               ">
              Verificar cuenta
            </a>

            <p>O copia y pega este enlace en tu navegador:</p>
            <p style="word-break: break-all;">${verificationLink}</p>

            <p>Este enlace expirará en 10 minutos.</p>
            <p>Si no solicitaste este registro, puedes ignorar este mensaje.</p>
          </div>
        `,
      });

      console.log("📨 Email enviado:", info);
      return info;

    } catch (err) {
      console.error("❌ Error enviando email:", err);
      throw err;
    }
  }

  // Función auxiliar para renderizar valores según el tipo de pregunta
  renderAnswerValue(value, type) {
    switch (type) {
      case "SHORTANSWER":
      case "LARGEANSWER":
        return value?.value || value || "Sin respuesta";

      case "HOUR": {
        const hour = value?.hour || value?.value?.hour;
        const min = value?.min || value?.value?.min;
        return `${hour || '--'}:${min || '--'}`;
      }

      case "DATE": {
        const d1 = value?.date ? new Date(value.date) : null;
        const d2 = value?.value?.date ? new Date(value.value.date) : null;
        const isValid = (d) => d instanceof Date && !isNaN(d);
        const pickDate = isValid(d1) ? d1 : (isValid(d2) ? d2 : null);
        return pickDate ? pickDate.toLocaleDateString("es-CL") : "No especificada";
      }

      case "MULTI_OPTION": {
        const arr1 = value?.options;
        const arr2 = value?.value?.options;
        const arr = (arr1?.length > 0 ? arr1 : (arr2?.length > 0 ? arr2 : []));
        if (arr.length === 0) return "Ninguna opción seleccionada";
        const selected = arr.filter(op => op.isChecked).map(dt => dt.label);
        return selected.length > 0 ? selected.join(", ") : "Ninguna opción seleccionada";
      }

      default:
        return value?.value || value || "Sin respuesta";
    }
  }

  // Generar HTML del resumen de respuestas
  generateAnswersEmailHTML(votationTitle, votationDescription, questions, userName) {
    const questionsHtml = questions.map((q, idx) => {
      const answerText = this.renderAnswerValue(q?.value, q.type || q.question?.type);
      
      return `
        <div style="margin-bottom: 25px; padding-bottom: 15px; border-bottom: 1px solid #eee;">
          <div style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px;">
            <div style="background: #4f46e5; color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">
              ${idx + 1}
            </div>
            <strong style="color: #1f2937; font-size: 16px;">${q.label || q.question?.label}</strong>
          </div>
          <div style="margin-left: 34px; padding: 12px; background: #f9fafb; border-radius: 8px; border-left: 3px solid #4f46e5;">
            <span style="color: #6b7280; font-size: 12px;">Tu respuesta:</span>
            <p style="margin: 5px 0 0 0; color: #1f2937; font-weight: 500;">${answerText}</p>
          </div>
        </div>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Resumen de tu respuesta - GEO-VOTATION</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f3f4f6; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; }
          .header h1 { color: white; font-size: 24px; margin-bottom: 8px; }
          .header p { color: rgba(255,255,255,0.8); font-size: 14px; }
          .content { padding: 30px; }
          .greeting { margin-bottom: 25px; }
          .greeting h2 { color: #1f2937; font-size: 20px; margin-bottom: 8px; }
          .votation-info { background: #f3f4f6; padding: 15px; border-radius: 12px; margin-bottom: 25px; }
          .votation-info h3 { color: #4f46e5; font-size: 18px; margin-bottom: 5px; }
          .votation-info p { color: #6b7280; font-size: 14px; }
          .questions-section { margin: 25px 0; }
          .footer { background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb; }
          .footer p { color: #9ca3af; font-size: 12px; margin: 5px 0; }
          .btn { display: inline-block; padding: 10px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; margin-top: 20px; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Resumen de tu respuesta</h1>
            <p>GEO-VOTATION - Votaciones seguras y confiables</p>
          </div>
          <div class="content">
            <div class="greeting">
              <h2>Hola, ${userName || 'Usuario'}!</h2>
              <p style="color: #6b7280;">Gracias por participar en esta votación. Aquí tienes un resumen de tus respuestas:</p>
            </div>
            <div class="votation-info">
              <h3>📋 ${votationTitle}</h3>
              <p>${votationDescription || 'Sin descripción'}</p>
            </div>
            <div class="questions-section">
              ${questionsHtml}
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONT_URL}/dashboard/votations" class="btn">
                Ver todas mis votaciones
              </a>
            </div>
          </div>
          <div class="footer">
            <p>Este es un mensaje automático de GEO-VOTATION</p>
            <p>© ${new Date().getFullYear()} GEO-VOTATION - Todos los derechos reservados</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Enviar email con resumen de respuestas (para submit)
  async sendAnswerSummaryEmail(to, userName, votationTitle, votationDescription, questions) {
    try {
      const emailHtml = this.generateAnswersEmailHTML(votationTitle, votationDescription, questions, userName);
      
      const info = await sgMail.send({
        from: `GEO-VOTATION <${process.env.EMAIL_USER}>`,
        to,
        subject: `✅ Respuesta enviada - ${votationTitle}`,
        html: emailHtml,
      });

      if (this.EmailLogModel) {
        await this.EmailLogModel.create({
          to,
          type: 'ANSWER_SUBMITTED',
          subject: `✅ Respuesta enviada - ${votationTitle}`,
          status: 'SENT',
          metadata: { votationTitle, questionsCount: questions.length }
        });
      }

      console.log("📨 Email de resumen de respuestas enviado:", info);
      return info;
    } catch (err) {
      console.error("❌ Error enviando email de resumen:", err);
      
      if (this.EmailLogModel) {
        await this.EmailLogModel.create({
          to,
          type: 'ANSWER_SUBMITTED',
          subject: `✅ Respuesta enviada - ${votationTitle}`,
          status: 'FAILED',
          error: err.message,
          metadata: { votationTitle }
        });
      }
      
      return null;
    }
  }

  // Enviar email con resumen de respuestas (para update)
  async sendAnswerUpdateSummaryEmail(to, userName, votationTitle, votationDescription, questions) {
    try {
      const emailHtml = this.generateAnswersEmailHTML(votationTitle, votationDescription, questions, userName);
      
      const info = await sgMail.send({
        from: `GEO-VOTATION <${process.env.EMAIL_USER}>`,
        to,
        subject: `🔄 Respuesta actualizada - ${votationTitle}`,
        html: emailHtml,
      });

      if (this.EmailLogModel) {
        await this.EmailLogModel.create({
          to,
          type: 'ANSWER_UPDATED',
          subject: `🔄 Respuesta actualizada - ${votationTitle}`,
          status: 'SENT',
          metadata: { votationTitle, questionsCount: questions.length }
        });
      }

      console.log("📨 Email de actualización de respuestas enviado:", info);
      return info;
    } catch (err) {
      console.error("❌ Error enviando email de actualización:", err);
      
      if (this.EmailLogModel) {
        await this.EmailLogModel.create({
          to,
          type: 'ANSWER_UPDATED',
          subject: `🔄 Respuesta actualizada - ${votationTitle}`,
          status: 'FAILED',
          error: err.message,
          metadata: { votationTitle }
        });
      }
      
      return null;
    }
  }
}