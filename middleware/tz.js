const { DEFAULT_TZ, validTz, dayIn } = require('../lib/dates');

// El cliente envía su zona horaria (Intl) en la cabecera X-Timezone; de ahí salen req.tz y req.today
module.exports = (req, res, next) => {
  const h = req.get('x-timezone');
  req.tz = validTz(h) ? h : DEFAULT_TZ;
  req.today = dayIn(req.tz);
  next();
};
