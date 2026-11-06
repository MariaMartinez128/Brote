// Estado de ánimo, frases propias y zonas horarias
const request = require('supertest');
const { conectar, cerrar, alta } = require('./support/testdb');
const { dayIn, addDays, streak, isDay, validTz } = require('../lib/dates');

describe('Fechas y zonas horarias', () => {
  it('el "día" depende de la zona horaria', () => {
    const d = new Date('2026-03-10T23:30:00Z');
    expect(dayIn('Europe/Madrid', d)).toBe('2026-03-11');          // ya es el día siguiente en España
    expect(dayIn('America/Los_Angeles', d)).toBe('2026-03-10');
    expect(dayIn('Pacific/Kiritimati')).not.toBe(dayIn('Pacific/Pago_Pago'));
  });
  it('suma días, calcula rachas y valida', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01'); expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(streak(new Set(['2026-05-03', '2026-05-02', '2026-05-01']), '2026-05-03')).toBe(3);
    expect(streak(new Set(['2026-05-02', '2026-05-01']), '2026-05-03')).toBe(2);   // hoy aún sin registro: la racha de ayer sigue viva
    expect(streak(new Set(['2026-05-01']), '2026-05-03')).toBe(0);
    expect(isDay('2026-02-30')).toBeFalse(); expect(isDay('2026-12-31')).toBeTrue(); expect(isDay('31/12/2026')).toBeFalse();
    expect(validTz('Europe/Madrid')).toBeTrue(); expect(validTz('Marte/Olympus')).toBeFalse();
  });
});

describe('Ánimo y frases', () => {
  let app, ag, otro, models;
  beforeAll(async () => { await conectar(); app = require('../server'); models = require('../models'); await require('../seed')();
    ag = await alta(app, 'animo@test.es'); otro = await alta(app, 'otro@test.es', 'Otro'); }, 120000);
  afterAll(cerrar);

  it('registra el ánimo y devuelve una frase; "otra frase" no crea un registro nuevo', async () => {
    expect((await ag.post('/api/moods').send({ mood: 'nada' })).status).toBe(400);
    const r = await ag.post('/api/moods').send({ mood: 'cansado' });
    expect(r.status).toBe(201); expect(r.body.phrase.length).toBeGreaterThan(3);
    const otra = await ag.post('/api/moods/otra').send({ mood: 'cansado' });
    expect(otra.status).toBe(200);
    expect(await models.MoodLog.countDocuments({ user: (await models.User.findOne({ email: 'animo@test.es' }))._id })).toBe(1);
    expect((await ag.get('/api/moods/today')).body.mood).toBe('cansado');
  });

  it('usa la zona horaria del usuario para decidir qué es "hoy"', async () => {
    const mad = await ag.get('/api/moods/stats').set('X-Timezone', 'Europe/Madrid');
    const nz = await ag.get('/api/moods/stats').set('X-Timezone', 'Pacific/Kiritimati');
    expect(mad.body.semana[6].date).toBe(dayIn('Europe/Madrid'));
    expect(nz.body.semana[6].date).toBe(dayIn('Pacific/Kiritimati'));
    expect((await ag.get('/api/moods/stats').set('X-Timezone', 'inventada')).body.semana[6].date).toBe(dayIn('Europe/Madrid'));   // zona inválida: se usa la de por defecto
  });

  it('calcula la racha de días seguidos', async () => {
    const u = await models.User.findOne({ email: 'otro@test.es' });
    const hoy = dayIn('Europe/Madrid');
    for (const n of [0, 1, 2]) await models.MoodLog.create({ user: u._id, mood: 'feliz', day: addDays(hoy, -n), date: new Date(Date.now() - n * 24 * 3600 * 1000) });
    await models.MoodLog.create({ user: u._id, mood: 'feliz', day: addDays(hoy, -4), date: new Date(Date.now() - 4 * 24 * 3600 * 1000) });
    const s = (await otro.get('/api/moods/stats')).body;
    expect(s.racha).toBe(3); expect(s.semana.filter(d => d.mood).length).toBe(4); expect(s.masComun).toBe('feliz');
  });

  it('las frases propias se mezclan con las del sistema y son privadas', async () => {
    expect((await ag.post('/api/phrases').send({ text: '', mood: 'feliz' })).status).toBe(400);
    expect((await ag.post('/api/phrases').send({ text: 'a', mood: 'x' })).status).toBe(400);
    expect((await ag.post('/api/phrases').send({ text: 'x'.repeat(201), mood: 'feliz' })).status).toBe(400);
    const p = (await ag.post('/api/phrases').send({ text: 'Mi frase secreta', mood: 'feliz' })).body;
    expect((await otro.get('/api/phrases')).body.length).toBe(0);
    expect((await otro.put('/api/phrases/' + p._id).send({ text: 'hackeada' })).status).toBe(404);
    expect((await otro.delete('/api/phrases/' + p._id)).status).toBe(404);
    expect((await ag.put('/api/phrases/' + p._id).send({ text: 'Editada' })).body.text).toBe('Editada');
    expect((await ag.delete('/api/phrases/' + p._id)).status).toBe(204);
  });
});

describe('Seguridad HTTP', () => {
  let app;
  beforeAll(() => { app = require('../server'); });
  it('envía cabeceras de seguridad y no revela Express', async () => {
    const r = await request(app).get('/');
    expect(r.headers['content-security-policy']).toContain("script-src 'self'");
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['x-powered-by']).toBeUndefined();
  });
  it('rechaza JSON roto o demasiado grande con un error claro', async () => {
    expect((await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{no-es-json')).status).toBe(400);
    expect((await request(app).post('/api/auth/login').send({ email: 'a@a.es', password: 'x'.repeat(30000) })).status).toBe(413);
  });
  it('/api/health informa del estado de la base de datos', async () => {
    const r = await request(app).get('/api/health');
    expect([200, 503]).toContain(r.status); expect(typeof r.body.ok).toBe('boolean');
  });
  it('las rutas de API desconocidas devuelven 404 en JSON', async () => {
    const { alta } = require('./support/testdb');
    expect((await request(app).get('/api/no-existe')).status).toBe(401);       // sin sesión ni siquiera se revela qué existe
  });
});
