const nodemailer = require('nodemailer');

// El correo solo se usa si EMAIL_USER y EMAIL_PASS están definidos (contraseña de aplicación de Gmail)
const emailConfigurado = () => Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
const urlBase = () => (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

let transporter;
const getTransporter = () => transporter || (transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
}));

const enviar = (to, subject, html) => getTransporter().sendMail({ from: `Brote <${process.env.EMAIL_USER}>`, to, subject, html });

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
