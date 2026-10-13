// Cada escenario es solo configuración visual: la lógica del juego es siempre la misma.
//   grow[tipo]  -> emojis posibles al completar una tarea de ese tipo
//   bg          -> color de fondo del tablero
//   built/lost  -> textos de los contadores
//   tip         -> mensaje bajo el tablero
const grow = (e, t, h) => ({ Estudio: e, Trabajo: t, Hábito: h });

const SCENARIOS = {
  huerto: {
    name: 'Huerto', icon: '🌱', bg: '#a9cf93', title: 'Mi huerto',
    grow: grow(['🌳', '🍎', '🌲'], ['🥕', '🍅', '🌽', '🥦'], ['🌻', '🌷', '🌼']),
    built: 'plantas creciendo', lost: 'plantas marchitas',
    tip: 'Completa tareas para que crezcan plantas. Si fallas una, se marchita.'
  },
  ciudad: {
    name: 'Ciudad', icon: '🏙️', bg: '#b9c4cc', title: 'Mi ciudad',
    grow: grow(['🏫', '🏥', '🏛️'], ['🏢', '🏬', '🏪'], ['🏠', '🏡', '⛲']),
    built: 'edificios en pie', lost: 'edificios perdidos',
    tip: 'Completa tareas para construir. Marca una como fallida y perderás un edificio.'
  },
  sistemaSolar: {
    name: 'Sistema solar', icon: '🪐', bg: '#14143a', title: 'Mi sistema solar',
    grow: grow(['🪐', '🌕', '🛰️'], ['🌍', '🌎', '🔴'], ['⭐', '✨', '🌟']),
    built: 'astros en órbita', lost: 'astros destruidos',
    tip: 'Cada tarea completada crea un astro. Las fallidas lo convierten en polvo.'
  },
  playa: {
    name: 'Playa', icon: '🏖️', bg: '#f1dfa4', title: 'Mi playa',
    grow: grow(['⛱️', '🏝️', '🏄'], ['🐚', '🦀', '⭐'], ['🌴', '🍹', '🪸']),
    built: 'detalles de playa', lost: 'basura acumulada',
    tip: 'Completa tareas para animar la playa. Las fallidas la dejan sucia.'
  },
  oceano: {
    name: 'Océano', icon: '🐠', bg: '#7fb8d9', title: 'Mi océano',
    grow: grow(['🐢', '🐋', '🐬'], ['🐠', '🐟', '🦈'], ['🪸', '🐙', '🦀']),
    built: 'criaturas marinas', lost: 'criaturas perdidas',
    tip: 'Cada tarea llena el mar de vida. Las fallidas lo vacían.'
  },
  bosque: {
    name: 'Bosque', icon: '🌲', bg: '#8fbf8a', title: 'Mi bosque',
    grow: grow(['🌲', '🌳', '🦉'], ['🍄', '🐿️', '🦌'], ['🦊', '🐇', '🦋']),
    built: 'seres del bosque', lost: 'zonas quemadas',
    tip: 'Completa tareas para que el bosque prospere. Las fallidas lo queman.'
  },
  granja: {
    name: 'Granja', icon: '🐄', bg: '#c9d98f', title: 'Mi granja',
    grow: grow(['🏡', '🚜', '🛖'], ['🐄', '🐖', '🐑'], ['🌾', '🐓', '🥚']),
    built: 'elementos de granja', lost: 'pérdidas',
    tip: 'Cada tarea hace crecer la granja. Las fallidas traen pérdidas.'
  },
  espacio: {
    name: 'Estación espacial', icon: '🚀', bg: '#1b1f3b', title: 'Mi estación espacial',
    grow: grow(['🛰️', '📡', '🔭'], ['🚀', '🛸', '🧑‍🚀'], ['⭐', '🌙', '🪐']),
    built: 'módulos operativos', lost: 'módulos dañados',
    tip: 'Completa tareas para ampliar la estación. Las fallidas dañan módulos.'
  },
  medieval: {
    name: 'Reino medieval', icon: '🏰', bg: '#a7c48a', title: 'Mi reino',
    grow: grow(['🏰', '📜', '⛪'], ['⚔️', '🛡️', '🏹'], ['🌾', '🐎', '🛖']),
    built: 'construcciones', lost: 'aldeas arrasadas',
    tip: 'Completa tareas para engrandecer el reino. Las fallidas lo debilitan.'
  },
  zen: {
    name: 'Jardín zen', icon: '🎋', bg: '#e6e2d3', title: 'Mi jardín zen',
    grow: grow(['🎋', '🏮', '⛩️'], ['🪨', '🌉', '🎍'], ['🌸', '🪷', '🍃']),
    built: 'elementos zen', lost: 'hojas caídas',
    tip: 'Cada tarea aporta calma al jardín. Las fallidas lo desordenan.'
  }
};

const SCENARIO_IDS = Object.keys(SCENARIOS);
const DEFAULT_SCENARIO = 'huerto';
module.exports = { SCENARIOS, SCENARIO_IDS, DEFAULT_SCENARIO };
