// Panel de administración: lo que SOLO puede hacer un administrador (incluido borrar usuarios de la base de datos)
const { conectar, cerrar, alta } = require('./support/testdb');

describe('Administrador', () => {
  let app, admin, models, bea, beaId;
  beforeAll(async () => {
    await conectar(); app = require('../server'); models = require('../models'); await require('../seed')();
    admin = await alta(app, 'admin@test.es', 'Admin');           // primer usuario = administrador
    bea = await alta(app, 'bea@test.es', 'Bea');
    beaId = (await models.User.findOne({ email: 'bea@test.es' }))._id.toString();
  }, 120000);
  afterAll(cerrar);

  it('lista y busca usuarios con su actividad', async () => {
    const t = (await bea.post('/api/tasks').send({ title: 'De Bea' })).body;
    await bea.put('/api/tasks/' + t._id).send({ status: 'done' });
    const todos = (await admin.get('/api/admin/usuarios')).body;
    expect(todos.length).toBe(2);
    expect(todos.find(u => u.email === 'bea@test.es')).toEqual(jasmine.objectContaining({ tasks: 1, done: 1 }));
    expect(todos[0].password).toBeUndefined();
    expect((await admin.get('/api/admin/usuarios?q=BEA')).body.length).toBe(1);
    expect((await admin.get('/api/admin/usuarios?q=.*')).body.length).toBe(0);    // la búsqueda no interpreta expresiones regulares
    const s = (await admin.get('/api/admin/stats')).body;
    expect(s.usuarios.total).toBe(2); expect(s.tareas.completadas).toBe(1);
  });

  it('un usuario normal no puede usar NINGUNA ruta de admin', async () => {
    const rutas = [['get', '/usuarios'], ['get', '/stats'], ['get', '/frases'], ['get', '/auditoria'], ['delete', '/usuarios/' + beaId],
      ['put', '/usuarios/' + beaId + '/rol'], ['put', '/usuarios/' + beaId + '/activo'], ['put', '/usuarios/' + beaId + '/password']];
    for (const [m, r] of rutas) expect((await bea[m]('/api/admin' + r).send({})).status).withContext(m + ' ' + r).toBe(403);
  });

  it('cambia roles, pero nunca deja la app sin administradores', async () => {
    const adminId = (await models.User.findOne({ email: 'admin@test.es' }))._id.toString();
    expect((await admin.put('/api/admin/usuarios/' + beaId + '/rol').send({ role: 'jefe' })).status).toBe(400);
    expect((await admin.put('/api/admin/usuarios/' + adminId + '/rol').send({ role: 'user' })).status).toBe(400);   // ni a sí mismo ni al último
    expect((await admin.delete('/api/admin/usuarios/' + adminId)).status).toBe(400);
    expect((await admin.put('/api/admin/usuarios/' + beaId + '/rol').send({ role: 'admin' })).status).toBe(200);
    expect((await bea.get('/api/admin/usuarios')).status).toBe(200);                                                 // Bea ya es admin
    expect((await admin.put('/api/admin/usuarios/' + beaId + '/rol').send({ role: 'user' })).status).toBe(200);
  });

  it('suspender corta el acceso al instante y reactivar lo devuelve', async () => {
    expect((await admin.put('/api/admin/usuarios/' + beaId + '/activo').send({ active: 'si' })).status).toBe(400);
    expect((await admin.put('/api/admin/usuarios/' + beaId + '/activo').send({ active: false })).status).toBe(200);
    expect((await bea.get('/api/tasks')).status).toBe(403);
    expect((await require('supertest')(app).post('/api/auth/login').send({ email: 'bea@test.es', password: 'password123' })).status).toBe(403);
    await admin.put('/api/admin/usuarios/' + beaId + '/activo').send({ active: true });
    expect((await bea.get('/api/tasks')).status).toBe(200);
  });

  it('restablece la contraseña: devuelve una temporal una vez y cierra las sesiones del usuario', async () => {
    await new Promise(r => setTimeout(r, 1100));
    const r = await admin.put('/api/admin/usuarios/' + beaId + '/password');
    expect(r.status).toBe(200); expect(r.body.passwordTemporal.length).toBeGreaterThanOrEqual(10);
    expect((await bea.get('/api/tasks')).status).toBe(401);
    const nuevo = require('supertest').agent(app);
    expect((await nuevo.post('/api/auth/login').send({ email: 'bea@test.es', password: r.body.passwordTemporal })).status).toBe(200);
    expect((await admin.put('/api/admin/usuarios/000000000000000000000000/password')).status).toBe(404);
  });

  it('confirma cuentas a mano', async () => {
    const { User } = models;
    const u = await User.create({ email: 'pendiente@test.es', password: 'x', confirmed: false });
    expect((await admin.put('/api/admin/usuarios/' + u._id + '/confirmar')).status).toBe(200);
    expect((await User.findById(u._id)).confirmed).toBeTrue();
  });

  it('ELIMINA a un usuario de la base de datos con TODOS sus datos', async () => {
    const { User, Task, WorldState, MoodLog, Phrase, Activity } = models;
    const victima = await alta(app, 'victima@test.es', 'Víctima');
    const id = (await User.findOne({ email: 'victima@test.es' }))._id;
    const t = (await victima.post('/api/tasks').send({ title: 'Se borrará' })).body;
    await victima.put('/api/tasks/' + t._id).send({ status: 'done' });
    await victima.post('/api/moods').send({ mood: 'feliz' });
    await victima.post('/api/phrases').send({ text: 'Mi frase', mood: 'feliz' });
    await victima.post('/api/user/session').send({ minutes: 25 });
    const sistema = await Phrase.countDocuments({ isDefault: true });
    expect(await Task.countDocuments({ user: id })).toBe(1);

    expect((await admin.delete('/api/admin/usuarios/no-es-un-id')).status).toBe(400);
    expect((await admin.delete('/api/admin/usuarios/' + id)).status).toBe(200);

    expect(await User.countDocuments({ _id: id })).toBe(0);
    for (const M of [Task, WorldState, MoodLog, Activity]) expect(await M.countDocuments({ user: id })).withContext(M.modelName).toBe(0);
    expect(await Phrase.countDocuments({ user: id })).toBe(0);
    expect(await Phrase.countDocuments({ isDefault: true })).toBe(sistema);          // las frases del sistema no se tocan
    expect((await victima.get('/api/tasks')).status).toBe(401);                      // su sesión ya no vale
    expect((await admin.delete('/api/admin/usuarios/' + id)).status).toBe(404);
  });

  it('gestiona las frases del sistema', async () => {
    expect((await admin.post('/api/admin/frases').send({ text: 'Hola', mood: 'raro' })).status).toBe(400);
    expect((await admin.post('/api/admin/frases').send({ text: '  ', mood: 'feliz' })).status).toBe(400);
    const p = (await admin.post('/api/admin/frases').send({ text: 'Frase para todos', mood: 'triste' })).body;
    expect((await admin.post('/api/moods').send({ mood: 'triste' })).status).toBe(201);
    expect((await admin.delete('/api/admin/frases/' + p._id)).status).toBe(204);
    expect((await admin.delete('/api/admin/frases/' + p._id)).status).toBe(404);
  });

  it('registra las acciones de administración', async () => {
    const log = (await admin.get('/api/admin/auditoria')).body;
    expect(log.length).toBeGreaterThan(4);
    expect(log.some(x => x.action.includes('Eliminó al usuario') && x.target === 'victima@test.es')).toBeTrue();
    expect(log.every(x => x.adminEmail === 'admin@test.es')).toBeTrue();
  });
});
