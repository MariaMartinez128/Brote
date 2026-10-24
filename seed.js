const { Phrase } = require('./models');
// Frases del sistema. Son neutras respecto al escenario (valen para huerto, ciudad, océano…)
const DEFAULTS = {
  feliz: ['Tu energía de hoy es el mejor abono.', 'Aprovecha esta racha: cada tarea hace crecer tu mundo.', 'Celebra lo pequeño: también cuenta.', 'Una sonrisa a tiempo vale por una hora de trabajo.', 'Disfruta del momento: te lo has ganado.'],
  motivado: ['Un pomodoro más y tu mundo crece.', 'La constancia construye más que la prisa.', 'Empieza ahora; el ánimo llega trabajando.', 'Lo que haces hoy es lo que verás florecer mañana.', 'Estás más cerca de lo que crees.'],
  tranquilo: ['Paso a paso también se llega lejos.', 'Mantén el ritmo: sin prisa, pero sin pausa.', 'La calma es una buena herramienta de trabajo.', 'Respira hondo: todo a su tiempo.', 'Las raíces profundas crecen en silencio.'],
  cansado: ['Descansar también es avanzar. Elige una sola tarea.', 'Pequeños avances siguen siendo avances.', 'Haz una pausa corta y vuelve con calma.', 'Hasta la semilla necesita su noche para brotar.', 'No hace falta hacerlo todo hoy.'],
  triste: ['Los días grises también hacen crecer cosas.', 'Hoy basta con lo mínimo. Mañana será más fácil.', 'No tienes que poder con todo hoy.', 'Después de la lluvia, todo brota.', 'Ser amable contigo también es productivo.']
};
// Frases antiguas que hablaban solo de "ciudad"; se retiran para que no aparezcan con otros escenarios
const ANTIGUAS = ['Aprovecha esta racha: cada tarea suma un edificio.', 'Celebra lo pequeño: también construye ciudad.', 'Un pomodoro más y la ciudad crece.', 'Tu energía de hoy es el mejor cimiento.', 'Los días grises también construyen ciudades.'];

// Crea las frases del sistema la primera vez, o al migrar desde las antiguas.
// Después no las vuelve a crear: si el admin borra una, se queda borrada.
module.exports = async () => {
  const { deletedCount } = await Phrase.deleteMany({ isDefault: true, text: { $in: ANTIGUAS } });
  if (!deletedCount && await Phrase.exists({ isDefault: true })) return;
  const existentes = new Set((await Phrase.find({ isDefault: true }, 'text')).map(p => p.text));
  const nuevas = Object.entries(DEFAULTS).flatMap(([mood, list]) => list.filter(t => !existentes.has(t)).map(text => ({ text, mood, isDefault: true, user: null })));
  if (nuevas.length) await Phrase.insertMany(nuevas);
};
