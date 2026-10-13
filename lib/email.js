const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

module.exports.enviarEmailConfirmacion = async function (email, key) {
  // URL de tu servidor (en local será http://localhost:3000)
  const urlBase = process.env.BASE_URL || 'http://localhost:3000';
  const enlace = `${urlBase}/api/auth/confirmar/${email}/${key}`;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Confirma tu cuenta en Brote',
    html: `
      <h2>¡Bienvenido a Brote! 🌱</h2>
      <p>Has solicitado registrarte en nuestra aplicación de productividad.</p>
      <p>Haz clic en el siguiente enlace para confirmar tu cuenta y poder iniciar sesión:</p>
      <a href="${enlace}" target="_blank">Confirmar mi cuenta</a>
      <p>Si no solicitaste esto, puedes ignorar este mensaje.</p>
    `
  });
};