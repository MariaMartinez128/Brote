const { OAuth2Client } = require('google-auth-library');

// El inicio de sesión con Google solo se activa si existe GOOGLE_CLIENT_ID (ID de cliente OAuth, no es secreto)
const clientId = () => (process.env.GOOGLE_CLIENT_ID || '').trim();
const configurado = () => Boolean(clientId());

let client;
// Comprueba la firma del token de Google y que fue emitido para ESTA aplicación (audience).
// Se exporta como método del objeto para poder sustituirlo en los tests.
async function verificar(credential) {
  client = client || new OAuth2Client();
  const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId() });
  const p = ticket.getPayload();
  return { sub: p.sub, email: String(p.email || '').toLowerCase(), emailVerified: p.email_verified === true, name: p.name || '' };
}

module.exports = { clientId, configurado, verificar };
