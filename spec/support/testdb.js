// Base de datos para los tests: MONGO_TEST_URI (una BD de pruebas VACÍA, se borra) o MongoDB en memoria
const mongoose = require('mongoose');
let mongod;
exports.conectar = async () => {
  let uri = process.env.MONGO_TEST_URI;
  if (!uri) { const { MongoMemoryServer } = require('mongodb-memory-server'); mongod = await MongoMemoryServer.create(); uri = mongod.getUri(); }
  await mongoose.connect(uri);
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map(m => m.createIndexes()));   // tras borrar la BD se recrean los índices únicos
};
exports.cerrar = async () => {
  if (process.env.MONGO_TEST_URI) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
};
const request = require('supertest');
// Registra y deja iniciada la sesión de un usuario; devuelve un "agente" con su cookie
exports.alta = async (app, email, name = 'Ana') => {
  const ag = request.agent(app);
  await ag.post('/api/auth/register').send({ name, email, password: 'password123' });
  await ag.post('/api/auth/login').send({ email, password: 'password123' });
  return ag;
};
