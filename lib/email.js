const nodemailer = require('nodemailer');

// El correo solo se usa si EMAIL_USER y EMAIL_PASS están definidos (contraseña de aplicación de Gmail)
const emailConfigurado = () => Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);

let transporter;
const getTransporter = () => transporter || (transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
}));

async function enviarEmailConfirmacion(email, key) {
  const urlBase = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const enlace = `${urlBase}/api/auth/confirmar/${encodeURIComponent(email)}/${key}`;
  await getTransporter().sendMail({
    from: `Brote <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Confirma tu cuenta en Brote',
    html: `
      <h2>¡Bienvenido a Brote! 🌱</h2>
      <p>Haz clic en el siguiente enlace para confirmar tu cuenta y poder iniciar sesión:</p>
      <p><a href="${enlace}" target="_blank">Confirmar mi cuenta</a></p>
      <p>Si no solicitaste esto, puedes ignorar este mensaje.</p>`
  });
}
module.exports = { enviarEmailConfirmacion, emailConfigurado };
