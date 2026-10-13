const { Phrase } = require('./models');
const DEFAULTS = {
  feliz: ['Tu energía de hoy es el mejor cimiento.', 'Aprovecha esta racha: cada tarea suma un edificio.', 'Celebra lo pequeño: también construye ciudad.'],
  motivado: ['Un pomodoro más y la ciudad crece.', 'La constancia construye más que la prisa.', 'Empieza ahora; el ánimo llega trabajando.'],
  tranquilo: ['Paso a paso también se llega lejos.', 'Mantén el ritmo: sin prisa, pero sin pausa.', 'La calma es una buena herramienta de trabajo.'],
  cansado: ['Descansar también es avanzar. Elige una sola tarea.', 'Pequeños avances siguen siendo avances.', 'Haz una pausa corta y vuelve con calma.'],
  triste: ['Los días grises también construyen ciudades.', 'Hoy basta con lo mínimo. Mañana será más fácil.', 'No tienes que poder con todo hoy.']
};
// Inserta las frases del sistema solo si todavía no existen
module.exports = async () => {
  if (await Phrase.exists({ isDefault: true })) return;
  const docs = Object.entries(DEFAULTS).flatMap(([mood, list]) => list.map(text => ({ text, mood, isDefault: true, user: null })));
  await Phrase.insertMany(docs);
};
