// Pruebas del panel de administración y de las frases por estado de ánimo (MongoDB en memoria)
process.env.JWT_SECRET = 'secreto-de-prueba';
// Vacías (no borradas): así dotenv no las rellena con las del .env real y los tests no envían correos
process.env.EMAIL_USER = ''; process.env.EMAIL_PASS = ''; process.env.ADMIN_EMAIL = '';
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

describe('Admin y estado de ánimo', () => {
  let mongod, app, admin, luis, luisId;
  beforeAll(async () => {
    const uri = process.env.MONGO_TEST_URI || (mongod = await MongoMemoryServer.create()).getUri();
    await mongoose.connect(uri);
    if (process.env.MONGO_TEST_URI) await mongoose.connection.dropDatabase();
    app = require('../server');
    await require('../seed')();
    const alta = (ag, email, name) => ag.post('/api/auth/register').send({ name, email, password: 'password123' });
    admin = request.agent(app); luis = request.agent(app);
    await alta(admin, 'admin@test.es', 'Admin'); await alta(luis, 'luis@test.es', 'Luis');   // el primero es admin
    await admin.post('/api/auth/login').send({ email: 'admin@test.es', password: 'password123' });
    await luis.post('/api/auth/login').send({ email: 'luis@test.es', password: 'password123' });
    luisId = (await luis.get('/api/auth/me')).body.user.id;
  }, 120000);
  afterAll(async () => { if (process.env.MONGO_TEST_URI) await mongoose.connection.dropDatabase();
    await mongoose.disconnect(); if (mongod) await mongod.stop(); });

  it('solo el admin accede a estadísticas, usuarios y frases del sistema', async () => {
    for (const ruta of ['/api/admin/stats', '/api/admin/usuarios', '/api/admin/frases'])
      expect((await luis.get(ruta)).status).toBe(403);
    const st = (await admin.get('/api/admin/stats')).body;
    expect(st.usuarios.total).toBe(2);
    expect(st.frases.sistema).toBeGreaterThan(0);
    expect((await admin.get('/api/admin/usuarios?q=luis')).body.length).toBe(1);
  });

  it('el admin puede crear y borrar frases del sistema', async () => {
    const r = await admin.post('/api/admin/frases').send({ text: 'Frase global de prueba', mood: 'feliz' });
    expect(r.status).toBe(201);
    expect((await luis.post('/api/admin/frases').send({ text: 'x', mood: 'feliz' })).status).toBe(403);
    expect((await admin.delete('/api/admin/frases/' + r.body._id)).status).toBe(204);
  });

  it('suspender impide iniciar sesión y reactivar lo permite', async () => {
    expect((await admin.put(`/api/admin/usuarios/${luisId}/activo`).send({ active: false })).status).toBe(200);
    expect((await luis.get('/api/tasks')).status).toBe(403);
    expect((await request(app).post('/api/auth/login').send({ email: 'luis@test.es', password: 'password123' })).status).toBe(403);
    await admin.put(`/api/admin/usuarios/${luisId}/activo`).send({ active: true });
    expect((await luis.post('/api/auth/login').send({ email: 'luis@test.es', password: 'password123' })).status).toBe(200);
  });

  it('protege al último administrador', async () => {
    const adminId = (await admin.get('/api/auth/me')).body.user.id;
    expect((await admin.put(`/api/admin/usuarios/${adminId}/rol`).send({ role: 'user' })).status).toBe(400);
    expect((await admin.delete('/api/admin/usuarios/' + adminId)).status).toBe(400);
    expect((await admin.put(`/api/admin/usuarios/${luisId}/rol`).send({ role: 'dios' })).status).toBe(400);
  });

  it('una frase propia aparece al elegir ese ánimo', async () => {
    const f = 'Mi frase secreta de tristeza';
    expect((await luis.post('/api/phrases').send({ text: '   ', mood: 'triste' })).status).toBe(400);
    expect((await luis.post('/api/phrases').send({ text: f, mood: 'triste' })).status).toBe(201);
    const vistas = new Set();
    for (let i = 0; i < 40; i++) vistas.add((await luis.post('/api/moods').send({ mood: 'triste' })).body.phrase);
    expect(vistas.has(f)).toBeTrue();
    expect((await admin.post('/api/moods').send({ mood: 'triste' })).body.phrase).not.toBe(f);   // no se filtran entre usuarios
  });

  it('"otra frase" cambia la frase sin duplicar el registro y hay estadísticas', async () => {
    const antes = (await luis.get('/api/moods')).body.length;
    const r = await luis.post('/api/moods/otra').send({ mood: 'triste' });
    expect(r.status).toBe(200);
    expect((await luis.get('/api/moods')).body.length).toBe(antes);
    const s = (await luis.get('/api/moods/stats')).body;
    expect(s.semana.length).toBe(7);
    expect(s.racha).toBeGreaterThanOrEqual(1);
    expect(s.masComun).toBe('triste');
  });

  it('el admin puede eliminar a un usuario registrado y se borran sus datos', async () => {
    expect((await admin.delete('/api/admin/usuarios/' + luisId)).status).toBe(200);
    const { User, Phrase } = require('../models');
    expect(await User.findById(luisId)).toBeNull();
    expect(await Phrase.countDocuments({ user: luisId })).toBe(0);
  });
});
