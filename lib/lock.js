// Cola por clave: ejecuta de una en una las operaciones de la misma clave (aquí, el id del usuario).
// Así dos peticiones del mismo usuario en la misma instancia (doble clic, dos pestañas) nunca se pisan.
// Entre instancias distintas (Cloud Run puede escalar) se encarga el control de versión de lib/world.js.
const colas = new Map();
module.exports = function conCola(clave, fn) {
  const previa = colas.get(clave) || Promise.resolve();
  const actual = previa.catch(() => {}).then(fn);
  const cola = actual.catch(() => {});
  colas.set(clave, cola);
  cola.then(() => { if (colas.get(clave) === cola) colas.delete(clave); });
  return actual;
};
