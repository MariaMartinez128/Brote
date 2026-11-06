// Registro, login, aislamiento de datos, contraseñas y recuperación
const crypto = require('crypto');
const request = require('supertest');
const { conectar, cerrar, alta } = require('./support/testdb');

describe('Autenticación', () => {
  let app, User;
  beforeAll(async () => { await conectar(); app = require('../server'); User = require('../models').User; await require('../seed')(); }, 120000);
  afterAll(cerrar);
  const login = (ag, email, password = 'password123') => ag.post('/api/auth/login').send({ email, password });

  it('rechaza el acceso a la API sin sesión', async () => {
    expect((await request(app).get('/api/tasks')).status).toBe(401);
    expect((await request(app).get('/api/admin/usuarios')).status).toBe(401);
  });

  it('valida el registro y no guarda la contraseña en claro', async () => {
    const ag = request.agent(app);
    expect((await ag.post('/api/auth/register').send({ email: 'x', password: 'password123' })).status).toBe(400);
    expect((await ag.post('/api/auth/register').send({ email: 'a@a.es', password: 'corta' })).status).toBe(400);
    expect((await ag.post('/api/auth/register').send({ email: 'a@a.es', password: 'x'.repeat(73) })).status).toBe(400);
    expect((await ag.post('/api/auth/register').send({ name: 'Ana', email: 'ana@test.es', password: 'password123' })).status).toBe(201);
    expect((await ag.post('/api/auth/register').send({ email: 'ANA@test.es', password: 'password123' })).status).toBe(400);   // duplicado (sin distinguir mayúsculas)
    const u = await User.findOne({ email: 'ana@test.es' });
    expect(u.password).not.toBe('password123');
    expect(u.password.startsWith('$2')).toBeTrue();
    expect(u.role).toBe('admin');                                // primer usuario registrado
  });

  it('el segundo usuario es usuario normal y no ve la API de admin', async () => {
    const bea = await alta(app, 'bea@test.es', 'Bea');
    expect((await bea.get('/api/auth/me')).body.user.role).toBe('user');
    expect((await bea.get('/api/admin/usuarios')).status).toBe(403);
    expect((await bea.get('/api/admin/stats')).status).toBe(403);
    expect((await bea.delete('/api/admin/usuarios/000000000000000000000000')).status).toBe(403);
  });

  it('login: credenciales incorrectas, cookie httpOnly y logout', async () => {
    const ag = request.agent(app);
    expect((await login(ag, 'ana@test.es', 'mala-clave-1')).status).toBe(400);
    const ok = await login(ag, 'ana@test.es');
    expect(ok.status).toBe(200);
    expect(ok.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
    expect(ok.body.user.password).toBeUndefined();
    expect((await ag.get('/api/auth/me')).status).toBe(200);
    await ag.post('/api/auth/logout');
    expect((await ag.get('/api/auth/me')).status).toBe(401);
  });

  it('cada usuario solo ve sus propios datos', async () => {
    const ana = await alta(app, 'ana@test.es'), carlos = await alta(app, 'carlos@test.es', 'Carlos');
    const t = (await ana.post('/api/tasks').send({ title: 'Solo de Ana' })).body;
    expect((await carlos.get('/api/tasks')).body.length).toBe(0);
    expect((await carlos.put('/api/tasks/' + t._id).send({ status: 'done' })).status).toBe(404);
    expect((await carlos.delete('/api/tasks/' + t._id)).status).toBe(404);
    expect((await ana.get('/api/tasks')).body.length).toBe(1);
  });

  it('cambiar la contraseña exige la actual y cierra las demás sesiones', async () => {
    const a = await alta(app, 'dani@test.es', 'Dani'), otra = request.agent(app);
    await login(otra, 'dani@test.es');
    expect((await a.put('/api/user/password').send({ current: 'incorrecta', password: 'nueva-clave-1' })).status).toBe(400);
    expect((await a.put('/api/user/password').send({ current: 'password123', password: 'corta' })).status).toBe(400);
    await new Promise(r => setTimeout(r, 1100));      // los tokens JWT llevan fecha en segundos
    expect((await a.put('/api/user/password').send({ current: 'password123', password: 'nueva-clave-1' })).status).toBe(200);
    expect((await a.get('/api/auth/me')).status).toBe(200);        // la sesión que cambia la contraseña sigue abierta
    expect((await otra.get('/api/auth/me')).status).toBe(401);     // la otra sesión ya no vale
    expect((await login(request.agent(app), 'dani@test.es')).status).toBe(400);
    expect((await login(request.agent(app), 'dani@test.es', 'nueva-clave-1')).status).toBe(200);
  });

  it('recuperar contraseña: sin correo configurado avisa; con token válido la cambia; el token caduca y es de un solo uso', async () => {
    expect((await request(app).post('/api/auth/forgot').send({ email: 'ana@test.es' })).status).toBe(503);
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    await User.updateOne({ email: 'ana@test.es' }, { resetHash: hash, resetExpires: new Date(Date.now() + 60000) });
    expect((await request(app).post('/api/auth/reset').send({ token: 'falso', password: 'otra-clave-12' })).status).toBe(400);
    expect((await request(app).post('/api/auth/reset').send({ token, password: 'corta' })).status).toBe(400);
    expect((await request(app).post('/api/auth/reset').send({ token, password: 'otra-clave-12' })).status).toBe(200);
    expect((await request(app).post('/api/auth/reset').send({ token, password: 'otra-clave-34' })).status).toBe(400);   // un solo uso
    expect((await login(request.agent(app), 'ana@test.es', 'otra-clave-12')).status).toBe(200);
    await User.updateOne({ email: 'ana@test.es' }, { resetHash: hash, resetExpires: new Date(Date.now() - 1000) });
    expect((await request(app).post('/api/auth/reset').send({ token, password: 'otra-clave-56' })).status).toBe(400);   // caducado
  });

  it('eliminar mi cuenta exige la contraseña y borra mis datos', async () => {
    const ag = await alta(app, 'eva@test.es', 'Eva');
    await ag.post('/api/tasks').send({ title: 'Tarea de Eva' });
    expect((await ag.delete('/api/user').send({ password: 'mala' })).status).toBe(400);
    expect((await ag.delete('/api/user').send({ password: 'password123' })).status).toBe(200);
    const { Task } = require('../models');
    expect(await User.countDocuments({ email: 'eva@test.es' })).toBe(0);
    expect(await Task.countDocuments({ title: 'Tarea de Eva' })).toBe(0);
  });

  it('exporta todos mis datos en JSON', async () => {
    const ag = await alta(app, 'fer@test.es', 'Fer');
    await ag.post('/api/tasks').send({ title: 'Exportable' });
    const r = await ag.get('/api/user/export');
    expect(r.status).toBe(200);
    expect(r.headers['content-disposition']).toMatch(/attachment/);
    expect(r.body.cuenta.email).toBe('fer@test.es');
    expect(r.body.tareas.length).toBe(1);
    expect(r.body.cuenta.password).toBeUndefined();
  });
});
