const { User, Task, CityState, WorldState } = require('../models');
const { SCENARIOS, SCENARIO_IDS } = require('../lib/scenarios');

describe('Modelos y escenarios', () => {
  it('los modelos están definidos y exportados', () => {
    for (const M of [User, Task, CityState]) { expect(M).toBeDefined(); expect(typeof M.find).toBe('function'); }
    expect(CityState).toBe(WorldState);
  });
  it('User y Task se pueden instanciar y tienen valores por defecto', () => {
    const u = new User({ email: 'TEST@Brote.com ' });
    expect(u.email).toBe('test@brote.com'); expect(u.role).toBe('user'); expect(u.pomodoro.work).toBe(25);
    const t = new Task({ title: 'Estudiar' });
    expect(t.status).toBe('pending'); expect(t.type).toBe('Estudio'); expect(t.repeat).toBe('none');
  });
  it('el título es obligatorio y los valores se validan', () => {
    expect(new Task({}).validateSync().errors.title).toBeDefined();
    expect(new Task({ title: 'x', type: 'Otro' }).validateSync().errors.type).toBeDefined();
    expect(new Task({ title: 'x', dueDate: 'mañana' }).validateSync().errors.dueDate).toBeDefined();
    expect(new Task({ title: 'x', dueDate: '2026-12-31' }).validateSync()).toBeUndefined();
  });
  it('los 10 escenarios tienen emojis para los 3 tipos de tarea', () => {
    expect(SCENARIO_IDS.length).toBe(10);
    for (const id of SCENARIO_IDS) for (const tipo of ['Estudio', 'Trabajo', 'Hábito'])
      expect(SCENARIOS[id].grow[tipo].length).withContext(id + '/' + tipo).toBeGreaterThan(0);
  });
});
