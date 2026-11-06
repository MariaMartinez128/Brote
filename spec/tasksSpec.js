// Tareas y mundo: cada tarea crea/destruye una casilla concreta y deshacer la revierte con exactitud
const { conectar, cerrar, alta } = require('./support/testdb');

describe('Tareas y mundo', () => {
  let app, ag, models;
  beforeAll(async () => { await conectar(); app = require('../server'); models = require('../models'); ag = await alta(app, 'juego@test.es', 'Juego'); }, 120000);
  afterAll(cerrar);
  const crear = async (title = 'T', extra = {}) => (await ag.post('/api/tasks').send({ title, ...extra })).body;
  const estado = (t, status) => ag.put('/api/tasks/' + t._id).send({ status });
  const mundo = async () => (await ag.get('/api/city')).body;
  const llenas = w => w.cells.filter(Boolean).length;

  it('valida los datos de la tarea', async () => {
    expect((await ag.post('/api/tasks').send({ title: '  ' })).status).toBe(400);
    expect((await ag.post('/api/tasks').send({ title: 'x'.repeat(201) })).status).toBe(400);
    expect((await ag.post('/api/tasks').send({ title: 'a', type: 'Inventado' })).status).toBe(400);
    expect((await ag.post('/api/tasks').send({ title: 'a', dueDate: '31/12/2026' })).status).toBe(400);
    expect((await ag.post('/api/tasks').send({ title: 'a', repeat: 'cada-hora' })).status).toBe(400);
    const t = await crear('Con fecha', { type: 'Trabajo', dueDate: '2026-12-31', repeat: 'daily' });
    expect(t.dueDate).toBe('2026-12-31'); expect(t.repeat).toBe('daily');
    expect((await ag.put('/api/tasks/' + t._id).send({ type: 'Otro' })).status).toBe(400);
    expect((await ag.put('/api/tasks/' + t._id).send({ status: 'raro' })).status).toBe(400);
    expect((await ag.get('/api/tasks/no-existe')).status).toBe(404);
  });

  it('completar crea una casilla y deshacer quita EXACTAMENTE esa casilla', async () => {
    const a = await crear('A'), b = await crear('B');
    const ra = await estado(a, 'done'), rb = await estado(b, 'done');
    expect(ra.body.effect.type).toBe('pop');
    expect(llenas(await mundo())).toBeGreaterThanOrEqual(2);
    const antes = await mundo(), idxA = ra.body.task.grown.index, idxB = rb.body.task.grown.index;
    await estado(a, 'pending');                                    // deshace A aunque B se completó después
    const despues = await mundo();
    expect(despues.cells[idxA]).toBe('');
    expect(despues.cells[idxB]).toBe(antes.cells[idxB]);           // la casilla de B sigue ahí
    await estado(b, 'pending');
  });

  it('fallar destruye una casilla (y suma pérdida); deshacer repone la casilla y la pérdida', async () => {
    const a = await crear('Hecha'), f = await crear('Fallo');
    await estado(a, 'done');
    const w0 = await mundo();
    const r = await estado(f, 'failed');
    expect(r.body.effect.type).toBe('boom');
    const w1 = await mundo();
    expect(w1.lost).toBe(w0.lost + 1); expect(llenas(w1)).toBe(llenas(w0) - 1);
    await estado(f, 'pending');
    const w2 = await mundo();
    expect(w2.lost).toBe(w0.lost); expect(w2.cells).toEqual(w0.cells);
    await estado(a, 'pending');
  });

  it('fallar con el tablero vacío cuenta como pérdida y se puede deshacer sin romper nada', async () => {
    await ag.post('/api/city/reset');
    const f = await crear('Sin nada que perder');
    const r = await estado(f, 'failed');
    expect(r.body.effect.type).toBe('lost'); expect(r.body.city.lost).toBe(1);
    expect((await estado(f, 'pending')).body.city.lost).toBe(0);
    expect((await estado(f, 'pending')).status).toBe(200);        // mismo estado: sin efecto
    expect((await mundo()).lost).toBe(0);
  });

  it('si una fallida destruye la casilla de una tarea hecha, deshacer ambas no deja casillas huérfanas', async () => {
    await ag.post('/api/city/reset');
    const a = await crear('Hecha'), b = await crear('Fallida');
    await estado(a, 'done');                       // 1 casilla (la de "a")
    await estado(b, 'failed');                     // destruye esa única casilla
    expect(llenas(await mundo())).toBe(0);
    await estado(a, 'pending'); await estado(b, 'pending');
    const w = await mundo();
    expect(llenas(w)).toBe(0); expect(w.lost).toBe(0);
  });

  it('cada escenario conserva su progreso y deshacer actúa sobre el escenario donde se completó', async () => {
    await ag.post('/api/city/reset');
    const t = await crear('En el huerto');
    await estado(t, 'done');
    expect(llenas(await mundo())).toBe(1);
    expect((await ag.put('/api/user/scenario').send({ scenario: 'ciudad' })).body.city.cells.filter(Boolean).length).toBe(0);
    expect((await ag.put('/api/user/scenario').send({ scenario: 'no-existe' })).status).toBe(400);
    await estado(t, 'pending');                                    // estando en la ciudad
    await ag.put('/api/user/scenario').send({ scenario: 'huerto' });
    expect(llenas(await mundo())).toBe(0);                         // se quitó del huerto, no de la ciudad
  });

  it('dos peticiones a la vez no corrompen el mundo', async () => {
    await ag.put('/api/user/scenario').send({ scenario: 'oceano' });
    const ts = await Promise.all(Array.from({ length: 8 }, (_, i) => crear('Par ' + i)));
    const rs = await Promise.all(ts.map(t => estado(t, 'done')));
    expect(rs.every(r => r.status === 200)).toBeTrue();
    expect(llenas(await mundo())).toBe(8);
    // el mismo cambio enviado dos veces a la vez (doble clic) solo se aplica UNA vez
    const t = await crear('Doble clic');
    const dobles = await Promise.all([estado(t, 'done'), estado(t, 'done')]);
    expect(dobles.every(r => [200, 409].includes(r.status))).toBeTrue();
    expect(llenas(await mundo())).toBe(9);
    expect((await ag.get('/api/user/stats')).body.totales.hechas).toBeGreaterThanOrEqual(9);
  });

  it('tablero lleno: aviso, mundo completado y reinicio que cuenta como logro', async () => {
    await ag.put('/api/user/scenario').send({ scenario: 'playa' });
    let ultimo;
    for (let i = 0; i < 50; i++) ultimo = await estado(await crear('Casilla ' + i), 'done');
    expect(ultimo.body.effect.completed).toBeTrue();
    expect(llenas(await mundo())).toBe(50);
    const extra = await estado(await crear('Sobrante'), 'done');
    expect(extra.status).toBe(200); expect(extra.body.effect.type).toBe('full');
    const w = (await ag.post('/api/city/reset')).body;
    expect(llenas(w)).toBe(0); expect(w.completed).toBe(1);
    const st = (await ag.get('/api/user/stats')).body;
    expect(st.totales.mundosCompletos).toBe(1);
    expect(st.logros.find(l => l.id === 'mundo').unlocked).toBeTrue();
  }, 60000);

  it('ya no se puede subir un tablero inventado', async () => {
    expect((await ag.put('/api/city').send({ cells: Array(50).fill('💎'), lost: 0 })).status).toBe(404);
  });

  it('los hábitos diarios vuelven a pendiente al empezar un día nuevo', async () => {
    const h = await crear('Beber agua', { type: 'Hábito', repeat: 'daily' });
    await estado(h, 'done');
    await models.Task.updateOne({ _id: h._id }, { statusDay: '2000-01-01' });   // como si se hubiera hecho ayer
    const lista = (await ag.get('/api/tasks')).body;
    expect(lista.find(t => t._id === h._id).status).toBe('pending');
  });

  it('el XP y las estadísticas salen del historial: completar suma, deshacer resta', async () => {
    await ag.put('/api/user/scenario').send({ scenario: 'bosque' });
    const base = (await ag.get('/api/user/stats')).body;
    const t = await crear('XP');
    await estado(t, 'done');
    const s1 = (await ag.get('/api/user/stats')).body;
    expect(s1.xp).toBe(base.xp + 10); expect(s1.totales.hechas).toBe(base.totales.hechas + 1);
    expect(s1.dias[13].done).toBeGreaterThan(0);
    await estado(t, 'pending');
    expect((await ag.get('/api/user/stats')).body.xp).toBe(base.xp);
  });

  it('las sesiones Pomodoro suman minutos y XP y validan los datos', async () => {
    expect((await ag.post('/api/user/session').send({ minutes: 0 })).status).toBe(400);
    expect((await ag.post('/api/user/session').send({ minutes: 25, taskId: '000000000000000000000000' })).status).toBe(404);
    const antes = (await ag.get('/api/user')).body;
    const r = await ag.post('/api/user/session').send({ minutes: 25 });
    expect(r.status).toBe(201); expect(r.body.count).toBe(antes.sessions + 1); expect(r.body.focusMinutes).toBe(antes.focusMinutes + 25);
    expect((await ag.put('/api/user').send({ pomodoro: { work: 500 } })).status).toBe(400);
    expect((await ag.put('/api/user').send({ pomodoro: { work: 30 } })).body.pomodoro.work).toBe(30);
  });
});
