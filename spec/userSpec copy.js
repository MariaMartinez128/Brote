const { User, Task, CityState } = require('../models');

describe('Pruebas unitarias de los modelos - Proyecto Brote', function() {

  it('1. El modelo User debe estar definido y exportado correctamente', function() {
    expect(User).toBeDefined();
    expect(typeof User.find).toEqual('function');
  });

  it('2. El modelo Task debe estar definido y exportado correctamente', function() {
    expect(Task).toBeDefined();
    expect(typeof Task.find).toEqual('function');
  });

  it('3. El modelo CityState debe estar definido y exportado correctamente', function() {
    expect(CityState).toBeDefined();
    expect(typeof CityState.find).toEqual('function');
  });

  it('4. Se puede instanciar un objeto User con un email', function() {
    const user = new User({
      email: 'test@brote.com'
    });
    expect(user.email).toEqual('test@brote.com');
  });

  it('5. Se puede instanciar un objeto Task con un título', function() {
    const task = new Task({
      title: 'Estudiar para el examen'
    });
    expect(task.title).toEqual('Estudiar para el examen');
  });

});