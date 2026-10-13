// Prueba de integración del registro, login, aislamiento de datos y rol admin (usa MongoDB en memoria)
process.env.JWT_SECRET = 'secreto-de-prueba';
delete process.env.EMAIL_USER; delete process.env.EMAIL_PASS; delete process.env.ADMIN_EMAIL;
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

describe('Autenticación y datos por usuario', () => {
  let mongod, app;
  beforeAll(async () => {
    // MONGO_TEST_URI (una BD de pruebas vacía) evita descargar MongoDB en memoria
    const uri = process.env.MONGO_TEST_URI || (mongod = await MongoMemoryServer.create()).getUri();
    await mongoose.connect(uri);
    if (process.env.MONGO_TEST_URI) await mongoose.connection.dropDatabase();
    app = require('../server');
    await require('../seed')();
  }, 120000);
  afterAll(async () => { if (process.env.MONGO_TEST_URI) await mongoose.connection.dropDatabase();
    await mongoose.disconnect(); if (mongod) await mongod.stop(); });

  const alta = (ag, email, name = 'Ana') => ag.post('/api/auth/register').send({ name, email, password: 'password123' });
  const login = (ag, email) => ag.post('/api/auth/login').send({ email, password: 'password123' });

  it('rechaza el acceso a la API sin sesión', async () => {
    expect((await request(app).get('/api/tasks')).status).toBe(401);
  });

  it('valida el registro y no guarda la contraseña en claro', async () => {
    const ag = request.agent(app);
    expect((await ag.post('/api/auth/register').send({ email: 'x', password: 'password123' })).status).toBe(400);
    expect((await ag.post('/api/auth/register').send({ email: 'a@a.es', password: 'corta' })).status).toBe(400);
    expect((await alta(ag, 'ana@test.es')).status).toBe(201);
    expect((await alta(ag, 'ana@test.es')).status).toBe(400);   // duplicado
    const { User } = require('../models');
    const u = await User.findOne({ email: 'ana@test.es' });
    expect(u.password).not.toBe('password123');
    expect(u.role).toBe('admin');                                // primer usuario
  });

  it('login correcto/incorrecto, sesión y logout', async () => {
    const ag = request.agent(app);
    expect((await ag.post('/api/auth/login').send({ email: 'ana@test.es', password: 'mala-clave' })).status).toBe(400);
    expect((await login(ag, 'ana@test.es')).status).toBe(200);
    expect((await ag.get('/api/auth/me')).body.user.email).toBe('ana@test.es');
    await ag.post('/api/auth/logout');
    expect((await ag.get('/api/auth/me')).status).toBe(401);
  });

  it('cada usuario solo ve sus tareas y solo el admin lista usuarios', async () => {
    const ana = request.agent(app), luis = request.agent(app);
    await login(ana, 'ana@test.es');
    await alta(request(app), 'luis@test.es', 'Luis'); await login(luis, 'luis@test.es');
    await ana.post('/api/tasks').send({ title: 'Tarea de Ana' });
    expect((await ana.get('/api/tasks')).body.length).toBe(1);
    expect((await luis.get('/api/tasks')).body.length).toBe(0);
    expect((await luis.get('/api/admin/usuarios')).status).toBe(403);
    expect((await ana.get('/api/admin/usuarios')).body.length).toBe(2);
    const t = (await ana.get('/api/tasks')).body[0];
    const r = await ana.put('/api/tasks/' + t._id).send({ status: 'done' });
    expect(r.body.city.cells.filter(Boolean).length).toBe(1);    // el mundo crece
    expect((await luis.put('/api/tasks/' + t._id).send({ status: 'failed' })).status).toBe(404);
  });

  it('borrar una cuenta elimina sus datos', async () => {
    const luis = request.agent(app);
    await login(luis, 'luis@test.es');
    const me = (await luis.get('/api/auth/me')).body.user;
    expect((await luis.delete('/api/admin/usuarios/' + me.id)).status).toBe(200);
    expect((await luis.get('/api/tasks')).status).toBe(401);
  });
});
