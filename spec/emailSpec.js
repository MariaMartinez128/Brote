// Detección de la configuración de correo: SMTP (Brevo) o Gmail
describe('Configuración de correo', () => {
  const CLAVES = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM', 'EMAIL_USER', 'EMAIL_PASS'];
  let guardado;
  beforeEach(() => { guardado = {}; CLAVES.forEach(k => { guardado[k] = process.env[k]; delete process.env[k]; }); });
  afterEach(() => CLAVES.forEach(k => { if (guardado[k] === undefined) delete process.env[k]; else process.env[k] = guardado[k]; }));
  const { emailConfigurado } = require('../lib/email');

  it('sin variables no hay correo (las cuentas se confirman solas)', () => expect(emailConfigurado()).toBeFalse());

  it('con Gmail basta EMAIL_USER y EMAIL_PASS', () => {
    process.env.EMAIL_USER = 'a@gmail.com'; process.env.EMAIL_PASS = 'clave';
    expect(emailConfigurado()).toBeTrue();
  });

  it('con SMTP (Brevo) hacen falta host, usuario, clave y remitente verificado', () => {
    Object.assign(process.env, { SMTP_HOST: 'smtp-relay.brevo.com', SMTP_USER: 'x@smtp-brevo.com', SMTP_PASS: 'clave' });
    expect(emailConfigurado()).toBeFalse();          // falta EMAIL_FROM
    process.env.EMAIL_FROM = 'yo@gmail.com';
    expect(emailConfigurado()).toBeTrue();
  });
});
