const { Schema, model } = require('mongoose');

// Esquema de Usuario ampliado para cumplir con los requisitos de la asignatura
const UserSchema = new Schema({
  name: { type: String, default: 'Usuario', trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true }, // Se guardará con hash (bcrypt)
  role: { type: String, enum: ['user', 'admin'], default: 'user' }, // Roles obligatorios
  confirmed: { type: Boolean, default: false }, // Confirmación por correo
  key: { type: String, default: '' }, // Clave de confirmación o recuperación
  pomodoro: { 
    work: { type: Number, default: 25, min: 1, max: 180 }, 
    short: { type: Number, default: 5, min: 1, max: 180 }, 
    long: { type: Number, default: 15, min: 1, max: 180 } 
  },
  sessions: { 
    date: { type: String, default: '' }, 
    count: { type: Number, default: 0 } 
  }
}, { timestamps: true });

const User = model('User', UserSchema);