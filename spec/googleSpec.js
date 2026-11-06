// Inicio de sesión con Google: el verificador de Google se sustituye por un doble (no se llama a Google en los tests)
const request = require('supertest');
const { conectar, cerrar, alta } = require('./support/testdb');

describe('Inicio de sesión con Google', () => {
  let app, User, google;
  const g = (sub, email, extra = {}) => ({ sub, email, emailVerified: true, name: 'Persona Google', ...extra });
  const entrar = (ag, cred = 'token-valido') => ag.post('/api/auth/google').send({ credential: cred });
  const simular = datos => spyOn(google, 'verificar').and.callFake(async c => { if (c === 'token-malo') throw new Error('firma incorrecta'); return datos; });

  beforeAll(async () => { await conectar(); app = require('../server'); User = require('../models').User; google = require('../lib/google'); }, 120000);
  afterAll(async () => { delete process.env.GOOGLE_CLIENT_ID; await cerrar(); });
  beforeEach(() => { process.env.GOOGLE_CLIENT_ID = 'cliente-de-prueba.apps.googleusercontent.com'; });

  it('/auth/config informa del ID de cliente solo si está configurado', async () => {
    expect((await request(app).get('/api/auth/config')).body.googleClientId).toBe('cliente-de-prueba.apps.googleusercontent.com');
    delete process.env.GOOGLE_CLIENT_ID;
    expect((await request(app).get('/api/auth/config')).body.googleClientId).toBeNull();
    expect((await entrar(request(app))).status).toBe(503);
  });

  it('rechaza credenciales ausentes, falsas o con el correo sin verificar', async () => {
    const ag = request.agent(app);
    expect((await ag.post('/api/auth/google').send({})).status).toBe(400);
    simular(g('s1', 'x@test.es'));
    expect((await entrar(ag, 'token-malo')).status).toBe(401);
    google.verificar.and.callFake(async () => g('s1', 'x@test.es', { emailVerified: false }));
    expect((await entrar(ag)).status).toBe(401);
    expect((await ag.get('/api/auth/me')).status).toBe(401);
  });

  it('crea la cuenta la primera vez, abre sesión y no necesita contraseña', async () => {
    simular(g('sub-nuevo', 'Nueva@Test.es'));
    const ag = request.agent(app);
    const r = await entrar(ag);
    expect(r.status).toBe(200);
    expect(r.body.user.email).toBe('nueva@test.es');
    expect((await ag.get('/api/auth/me')).body.user.email).toBe('nueva@test.es');
    const u = await User.findOne({ email: 'nueva@test.es' });
    expect(u.googleId).toBe('sub-nuevo'); expect(u.confirmed).toBeTrue(); expect(u.emailVerified).toBeTrue(); expect(u.hasPassword).toBeFalse();
    expect((await request(app).post('/api/auth/login').send({ email: 'nueva@test.es', password: 'password123' })).status).toBe(400);   // nadie conoce su contraseña
    expect((await entrar(request.agent(app))).status).toBe(200);          // la segunda vez entra en la misma cuenta
    expect(await User.countDocuments({ email: 'nueva@test.es' })).toBe(1);
  });

  it('una cuenta de Google puede crear su propia contraseña sin conocer la anterior y borrarse escribiendo su correo', async () => {
    simular(g('sub-clave', 'clave@test.es'));
    const ag = request.agent(app); await entrar(ag);
    expect((await ag.get('/api/user')).body.hasPassword).toBeFalse();
    expect((await ag.put('/api/user/password').send({ password: 'corta' })).status).toBe(400);
    expect((await ag.put('/api/user/password').send({ password: 'mi-clave-nueva' })).status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ email: 'clave@test.es', password: 'mi-clave-nueva' })).status).toBe(200);
    expect((await ag.get('/api/user')).body.hasPassword).toBeTrue();
  });

  it('vincula una cuenta existente con el correo verificado y conserva su contraseña', async () => {
    const ag0 = await alta(app, 'vinculo@test.es');
    await User.updateOne({ email: 'vinculo@test.es' }, { emailVerified: true });
    simular(g('sub-vinculo', 'vinculo@test.es'));
    expect((await entrar(request.agent(app))).status).toBe(200);
    expect((await User.findOne({ email: 'vinculo@test.es' })).googleId).toBe('sub-vinculo');
    expect((await request(app).post('/api/auth/login').send({ email: 'vinculo@test.es', password: 'password123' })).status).toBe(200);
    expect((await ag0.get('/api/user')).status).toBe(200);
  });

  it('si el correo de la cuenta nunca se verificó, al vincular con Google se anula la contraseña anterior', async () => {
    const intruso = await alta(app, 'victima-g@test.es');        // alguien registró el correo de otra persona
    await new Promise(ok => setTimeout(ok, 1100));                // los tokens JWT llevan fecha en segundos
    simular(g('sub-victima', 'victima-g@test.es'));
    const r = await entrar(request.agent(app));
    expect(r.status).toBe(200); expect(r.body.aviso).toMatch(/contraseña anterior/);
    expect((await request(app).post('/api/auth/login').send({ email: 'victima-g@test.es', password: 'password123' })).status).toBe(400);
    expect((await intruso.get('/api/tasks')).status).toBe(401);   // su sesión abierta también deja de valer
  });

  it('un correo vinculado a otra cuenta de Google no se puede reutilizar y las cuentas suspendidas no entran', async () => {
    simular(g('sub-a', 'dos@test.es')); await entrar(request.agent(app));
    google.verificar.and.callFake(async () => g('sub-b', 'dos@test.es'));
    expect((await entrar(request.agent(app))).status).toBe(403);
    google.verificar.and.callFake(async () => g('sub-a', 'dos@test.es'));
    await User.updateOne({ email: 'dos@test.es' }, { active: false });
    expect((await entrar(request.agent(app))).status).toBe(403);
  });

  it('la cuenta de Google se elimina confirmando con el correo', async () => {
    simular(g('sub-borrar', 'borrar@test.es'));
    const ag = request.agent(app); await entrar(ag);
    expect((await ag.delete('/api/user').send({ email: 'otro@test.es' })).status).toBe(400);
    expect((await ag.delete('/api/user').send({ email: 'borrar@test.es' })).status).toBe(200);
    expect(await User.countDocuments({ email: 'borrar@test.es' })).toBe(0);
  });
});
