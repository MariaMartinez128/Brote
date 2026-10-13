const r = require('express').Router();
const { SCENARIOS } = require('../lib/scenarios');

// Catálogo completo de escenarios (el cliente lo usa para pintar el selector y los temas)
r.get('/', (req, res) => res.json(SCENARIOS));
module.exports = r;
