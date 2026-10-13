const { Schema, model } = require('mongoose');
const { SCENARIO_IDS, DEFAULT_SCENARIO } = require('../lib/scenarios');

const MOODS = ['feliz', 'motivado', 'tranquilo', 'cansado', 'triste'];
const TYPES = ['Estudio', 'Trabajo', 'Hábito'];
const STATUS = ['pending', 'done', 'failed'];
const userRef = { type: Schema.Types.ObjectId, ref: 'User', index: true };
const mins = d => ({ type: Number, default: d, min: 1, max: 180 });

// Usuarios con registro e inicio de sesión. La contraseña se guarda siempre con hash (bcrypt).
const User = model('User', new Schema({
  name: { type: String, default: 'Usuario', trim: true },
  email: { type: String, required: [true, 'El email es obligatorio'], unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  confirmed: { type: Boolean, default: false },   // se pone a true al pulsar el enlace del correo
  key: { type: String, default: '' },             // clave aleatoria de confirmación
  scenario: { type: String, enum: SCENARIO_IDS, default: DEFAULT_SCENARIO },
  pomodoro: { work: mins(25), short: mins(5), long: mins(15) },
  sessions: { date: { type: String, default: '' }, count: { type: Number, default: 0 } }
}, { timestamps: true }));

const Task = model('Task', new Schema({
  user: userRef,
  title: { type: String, required: [true, 'El título es obligatorio'], trim: true, maxlength: 200 },
  type: { type: String, enum: TYPES, default: 'Estudio' },
  status: { type: String, enum: STATUS, default: 'pending' }
}, { timestamps: true }));

// Un mundo por usuario Y por escenario: cada escenario conserva su propio progreso.
const worldSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  scenario: { type: String, enum: SCENARIO_IDS, required: true },
  cells: { type: [String], default: () => Array(50).fill('') },
  lost: { type: Number, default: 0, min: 0 }
}, { timestamps: true });
worldSchema.index({ user: 1, scenario: 1 }, { unique: true });
const WorldState = model('WorldState', worldSchema);

const Phrase = model('Phrase', new Schema({
  user: { ...userRef, default: null },          // null = frase del sistema
  text: { type: String, required: [true, 'La frase es obligatoria'], trim: true, maxlength: 200 },
  mood: { type: String, enum: MOODS, required: true },
  isDefault: { type: Boolean, default: false }
}, { timestamps: true }));

const MoodLog = model('MoodLog', new Schema({
  user: userRef,
  mood: { type: String, enum: MOODS, required: true },
  phrase: { type: String, default: '' },
  date: { type: Date, default: Date.now }
}));

module.exports = { User, Task, WorldState, CityState: WorldState, Phrase, MoodLog, MOODS, TYPES, STATUS };
