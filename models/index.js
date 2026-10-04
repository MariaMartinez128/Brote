const { Schema, model } = require('mongoose');

const MOODS = ['feliz', 'motivado', 'tranquilo', 'cansado', 'triste'];
const TYPES = ['Estudio', 'Trabajo', 'Hábito'];
const STATUS = ['pending', 'done', 'failed'];
const userRef = { type: Schema.Types.ObjectId, ref: 'User', index: true };
const mins = d => ({ type: Number, default: d, min: 1, max: 180 });

// Users: de momento hay un único usuario (sin login). Para añadir login más adelante
// bastará con añadir el campo password (hash) y filtrar por el usuario autenticado.
const User = model('User', new Schema({
  name: { type: String, default: 'Usuario', trim: true },
  email: { type: String, default: '', trim: true, lowercase: true },
  pomodoro: { work: mins(25), short: mins(5), long: mins(15) },
  sessions: { date: { type: String, default: '' }, count: { type: Number, default: 0 } }
}, { timestamps: true }));

const Task = model('Task', new Schema({
  user: userRef,
  title: { type: String, required: [true, 'El título es obligatorio'], trim: true, maxlength: 200 },
  type: { type: String, enum: TYPES, default: 'Estudio' },
  status: { type: String, enum: STATUS, default: 'pending' }
}, { timestamps: true }));

const CityState = model('CityState', new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', unique: true },
  cells: { type: [String], default: () => Array(50).fill('') },
  lost: { type: Number, default: 0, min: 0 }
}, { timestamps: true }));

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

module.exports = { User, Task, CityState, Phrase, MoodLog, MOODS, TYPES, STATUS };
