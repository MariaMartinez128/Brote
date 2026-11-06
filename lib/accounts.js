const { User, Task, WorldState, Phrase, MoodLog, Activity, Audit } = require('../models');

// Borra un usuario y TODOS sus datos (tareas, mundos, ánimos, actividad y frases propias)
async function borrarUsuario(id) {
  await User.findByIdAndDelete(id);
  await Promise.all([
    ...[Task, WorldState, MoodLog, Activity].map(M => M.deleteMany({ user: id })),
    Phrase.deleteMany({ user: id, isDefault: false })
  ]);
}

// ¿Quedaría la app sin administradores si `id` deja de serlo?
const ultimoAdmin = async id => (await User.countDocuments({ role: 'admin', _id: { $ne: id } })) === 0;

const auditar = (admin, action, target = '') =>
  Audit.create({ admin: admin._id, adminEmail: admin.email, action, target }).catch(e => console.error('Auditoría:', e.message));

module.exports = { borrarUsuario, ultimoAdmin, auditar };
