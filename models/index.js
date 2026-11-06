const { Schema, model } = require('mongoose');
const { SCENARIO_IDS, DEFAULT_SCENARIO } = require('../lib/scenarios');

const MOODS = ['feliz', 'motivado', 'tranquilo', 'cansado', 'triste'];
const TYPES = ['Estudio', 'Trabajo', 'Hábito'];
const STATUS = ['pending', 'done', 'failed'];
const REPEAT = ['none', 'daily'];
const userRef = { type: Schema.Types.ObjectId, ref: 'User', index: true };
const mins = d => ({ type: Number, default: d, min: 1, max: 180 });

// Usuarios con registro e inicio de sesión. La contraseña se guarda siempre con hash (bcrypt).
const User = model('User', new Schema({
  name: { type: String, default: 'Usuario', trim: true, maxlength: 60 },
  email: { type: String, required: [true, 'El email es obligatorio'], unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  confirmed: { type: Boolean, default: false },   // se pone a true al pulsar el enlace del correo
  emailVerified: { type: Boolean, default: false }, // true si el correo se comprobó (enlace del correo o Google)
  googleId: { type: String, default: undefined, index: { unique: true, sparse: true } },   // "sub" de la cuenta de Google vinculada
  hasPassword: { type: Boolean, default: true },    // false si la cuenta se creó con Google y aún no tiene contraseña propia
  active: { type: Boolean, default: true },       // el admin puede suspender una cuenta (no podrá iniciar sesión)
  lastLogin: { type: Date, default: null },
  key: { type: String, default: '' },             // clave aleatoria de confirmación
  resetHash: { type: String, default: '' },       // hash (sha256) del token de recuperación de contraseña
  resetExpires: { type: Date, default: null },
  passwordChangedAt: { type: Date, default: null }, // invalida las sesiones anteriores al cambiar la contraseña
  scenario: { type: String, enum: SCENARIO_IDS, default: DEFAULT_SCENARIO },
  pomodoro: { work: mins(25), short: mins(5), long: mins(15) }
}, { timestamps: true }));

// Efecto que una tarea produjo en el tablero. Se guarda en la tarea para poder deshacerlo con exactitud.
const effect = new Schema({ scenario: String, index: Number, emoji: String }, { _id: false });

const Task = model('Task', (() => {
  const s = new Schema({
    user: userRef,
    title: { type: String, required: [true, 'El título es obligatorio'], trim: true, maxlength: 200 },
    type: { type: String, enum: TYPES, default: 'Estudio' },
    status: { type: String, enum: STATUS, default: 'pending' },
    dueDate: { type: String, default: '', match: [/^(\d{4}-\d{2}-\d{2})?$/, 'Fecha no válida'] },  // YYYY-MM-DD o vacío
    repeat: { type: String, enum: REPEAT, default: 'none' },   // "daily": vuelve a pendiente cada día (hábitos)
    statusDay: { type: String, default: '' },                  // día en que cambió el estado por última vez
    doneAt: { type: Date, default: null },
    grown: { type: effect, default: undefined },               // qué hizo crecer al completarse
    lostFx: { type: effect, default: undefined }               // qué destruyó al fallar (index -1 si no había nada)
  }, { timestamps: true });
  s.index({ user: 1, status: 1 });
  return s;
})());

// Un mundo por usuario Y por escenario: cada escenario conserva su propio progreso.
const worldSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  scenario: { type: String, enum: SCENARIO_IDS, required: true },
  cells: { type: [String], default: () => Array(50).fill('') },
  lost: { type: Number, default: 0, min: 0 },
  completed: { type: Number, default: 0, min: 0 },   // veces que has llenado el tablero y empezado de nuevo
  rev: { type: Number, default: 0 }                  // control de concurrencia (ver lib/world.js)
}, { timestamps: true });
worldSchema.index({ user: 1, scenario: 1 }, { unique: true });
const WorldState = model('WorldState', worldSchema);

const Phrase = model('Phrase', new Schema({
  user: { ...userRef, default: null },          // null = frase del sistema
  text: { type: String, required: [true, 'La frase es obligatoria'], trim: true, maxlength: 200 },
  mood: { type: String, enum: MOODS, required: true },
  isDefault: { type: Boolean, default: false }
}, { timestamps: true }));

const MoodLog = model('MoodLog', (() => {
  const s = new Schema({
    user: userRef,
    mood: { type: String, enum: MOODS, required: true },
    phrase: { type: String, default: '' },
    day: { type: String, default: '' },           // día local (YYYY-MM-DD) del usuario
    date: { type: Date, default: Date.now }
  });
  s.index({ user: 1, date: -1 });
  return s;
})());

// Historial de actividad: base de las estadísticas, el XP y los logros.
//   done / failed -> una tarea completada o fallida;  focus -> una sesión Pomodoro de concentración
const Activity = model('Activity', (() => {
  const s = new Schema({
    user: userRef,
    kind: { type: String, enum: ['done', 'failed', 'focus'], required: true },
    day: { type: String, required: true },
    type: { type: String, default: '' },
    minutes: { type: Number, default: 0 },
    task: { type: Schema.Types.ObjectId, default: null }
  }, { timestamps: true });
  s.index({ user: 1, day: 1 });
  s.index({ user: 1, task: 1, kind: 1 });
  return s;
})());

// Registro de acciones de los administradores
const Audit = model('Audit', new Schema({
  admin: { type: Schema.Types.ObjectId, ref: 'User' },
  adminEmail: String,
  action: { type: String, required: true },
  target: { type: String, default: '' }
}, { timestamps: true }));

module.exports = { User, Task, WorldState, CityState: WorldState, Phrase, MoodLog, Activity, Audit, MOODS, TYPES, STATUS, REPEAT };
