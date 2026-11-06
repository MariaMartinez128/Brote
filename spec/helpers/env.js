// Se carga antes que los specs: entorno de pruebas aislado (sin correo real, sin límites de peticiones)
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'secreto-de-prueba';
// Vacías (no borradas): así dotenv no las rellena con las del .env real y los tests no envían correos
process.env.EMAIL_USER = ''; process.env.EMAIL_PASS = ''; process.env.ADMIN_EMAIL = '';
