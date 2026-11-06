const nodemailer = require('nodemailer');

// Dos formas de enviar correo (si no hay ninguna, las cuentas se confirman solas al registrarse):
//  1) SMTP genérico, p. ej. Brevo:  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS y EMAIL_FROM (remitente verificado)
//  2) Gmail:                        EMAIL_USER y EMAIL_PASS (contraseña de aplicación)
const env = k => (process.env[k] || '').trim();
const usaSmtp = () => Boolean(env('SMTP_HOST') && env('SMTP_USER') && env('SMTP_PASS') && env('EMAIL_FROM'));
const usaGmail = () => Boolean(env('EMAIL_USER') && env('EMAIL_PASS'));
const emailConfigurado = () => usaSmtp() || usaGmail();
const urlBase = () => (env('BASE_URL') || 'http://localhost:3000').replace(/\/$/, '');

let transporter;
const getTransporter = () => {
  if (transporter) return transporter;
  if (usaSmtp()) {
    const port = Number(env('SMTP_PORT')) || 587;
    transporter = nodemailer.createTransport({ host: env('SMTP_HOST'), port, secure: port === 465, auth: { user: env('SMTP_USER'), pass: env('SMTP_PASS') } });
  } else {
    transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: env('EMAIL_USER'), pass: env('EMAIL_PASS') } });
  }
  return transporter;
};
const remitente = () => `Brote <${usaSmtp() ? env('EMAIL_FROM') : env('EMAIL_USER')}>`;

const enviar = (to, subject, html) => getTransporter().sendMail({ from: remitente(), to, subject, html });

async function enviarEmailConfirmacion(email, key) {
  const enlace = `${urlBase()}/api/auth/confirmar/${encodeURIComponent(email)}/${key}`;
  await enviar(email, 'Confirma tu cuenta en Brote', `
      <h2>¡Bienvenido a Brote! 🌱</h2>
      <p>Haz clic en el siguiente enlace para confirmar tu cuenta y poder iniciar sesión:</p>
      <p><a href="${enlace}" target="_blank">Confirmar mi cuenta</a></p>
      <p>Si no solicitaste esto, puedes ignorar este mensaje.</p>`);
}

async function enviarEmailReset(email, token) {
  const enlace = `${urlBase()}/#reset=${token}`;
  await enviar(email, 'Recupera tu contraseña de Brote', `
      <h2>Recuperar contraseña 🔑</h2>
      <p>Pulsa el enlace para elegir una contraseña nueva. Caduca en 1 hora.</p>
      <p><a href="${enlace}" target="_blank">Elegir nueva contraseña</a></p>
      <p>Si no lo pediste tú, ignora este mensaje: tu contraseña no cambiará.</p>`);
}

module.exports = { enviarEmailConfirmacion, enviarEmailReset, emailConfigurado };
