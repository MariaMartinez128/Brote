// Fechas "de calendario" (YYYY-MM-DD) calculadas en la zona horaria del usuario.
// El servidor corre en UTC (Cloud Run), pero "hoy" depende de dónde esté la persona.
const DEFAULT_TZ = 'Europe/Madrid';
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const validTz = tz => {
  if (typeof tz !== 'string' || tz.length > 64) return false;
  try { new Intl.DateTimeFormat('en-CA', { timeZone: tz }); return true; } catch { return false; }
};

// Día (YYYY-MM-DD) en que cae `date` en la zona `tz`
const dayIn = (tz, date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

// Suma (o resta) días a un YYYY-MM-DD
const addDays = (day, n) => {
  const d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// Días seguidos contados hacia atrás desde hoy. Si hoy aún no hay actividad, la racha de ayer sigue viva.
const streak = (daysSet, today) => {
  let d = daysSet.has(today) ? today : addDays(today, -1), n = 0;
  while (daysSet.has(d)) { n++; d = addDays(d, -1); }
  return n;
};

// Fecha real del calendario: se comprueba con ida y vuelta porque JS acepta 2026-02-30 y la convierte en marzo
const isDay = s => typeof s === 'string' && DAY_RE.test(s) && new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) === s;

module.exports = { DEFAULT_TZ, validTz, dayIn, addDays, streak, isDay };
