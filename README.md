# 🌱 Brote

**Productividad gamificada.** Completa tus tareas y haz crecer tu propio mundo; si fallas, se resiente.
Tú eliges el escenario: un huerto, una ciudad, un sistema solar, una playa… y cada uno guarda su propio progreso.

Incluye lista de tareas, temporizador Pomodoro, registro del estado de ánimo con frases motivacionales y un tablero que evoluciona según cumplas.

## Características

- **Tareas** de tres tipos (Estudio, Trabajo, Hábito) que se pueden completar, marcar como fallidas, editar o eliminar. Los cambios se pueden deshacer.
- **Mundo que crece o se destruye:** completar una tarea hace aparecer un elemento en el tablero (50 celdas); fallarla destruye uno.
- **10 escenarios** a elegir, cada uno con su propio tablero, colores y textos:

  | | | | | |
  |---|---|---|---|---|
  | 🌱 Huerto | 🏙️ Ciudad | 🪐 Sistema solar | 🏖️ Playa | 🐠 Océano |
  | 🌲 Bosque | 🐄 Granja | 🚀 Estación espacial | 🏰 Reino medieval | 🎋 Jardín zen |

- **Pomodoro** con duraciones configurables y contador de sesiones del día.
- **Estado de ánimo:** eliges cómo te sientes y recibes una frase motivacional (del sistema o escritas por ti).
- **Panel** con el progreso del día, tu mundo, la próxima sesión y la frase del día.

## Tecnologías

Node.js · Express 4 · MongoDB con Mongoose · HTML, CSS y JavaScript nativos (sin framework) · Jasmine para los tests.

## Requisitos

- Node.js 18 o superior
- Una base de datos MongoDB (local o [MongoDB Atlas](https://www.mongodb.com/atlas))

## Ejecutar en local

1. Instala las dependencias:
   ```bash
   npm install
   ```
2. Copia `.env.example` a `.env` y completa tus valores:
   ```env
   MONGO_URI=mongodb+srv://USUARIO:PASSWORD@cluster0.xxxxx.mongodb.net/Brote
   JWT_SECRET=un-texto-largo-y-aleatorio
   PORT=3000
   ```
3. Arranca la aplicación y abre <http://localhost:3000>:
   ```bash
   npm start          # producción
   npm run dev        # recarga automática al editar
   ```

Al arrancar se crean las frases motivacionales de ejemplo. Regístrate desde la pantalla de acceso para empezar.

### Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `MONGO_URI` | Sí | Cadena de conexión a MongoDB |
| `PORT` | No | Puerto del servidor (por defecto `3000`) |
| `JWT_SECRET` | Sí | Texto aleatorio para firmar las sesiones |
| `ADMIN_EMAIL` | No | Email que recibe el rol admin (si no, el primer registrado) |
| `EMAIL_USER`, `EMAIL_PASS` | No; solo para confirmar por correo | Cuenta de Gmail que envía el correo de confirmación |
| `BASE_URL` | No | URL pública usada en el enlace de confirmación (por defecto `http://localhost:3000`) |

## Cómo se juega

1. Entra en **Escenarios** y elige dónde quieres jugar.
2. Añade tareas en **Tareas** indicando su tipo.
3. Pulsa **Completar** cuando termines una: aparecerá algo nuevo en tu tablero. El tipo de la tarea decide qué aparece.
4. Pulsa **Fallida** si no la cumples: perderás un elemento. Puedes **Desmarcar** para revertirlo.
5. Usa el **Pomodoro** para concentrarte y el **Ánimo** para recibir una frase motivacional.

Cambiar de escenario no borra nada: cada uno conserva su progreso y lo recuperas al volver.

## API REST (prefijo `/api`)

| Recurso | Rutas |
|---|---|
| Salud | `GET /health` |
| Usuario | `GET /user`, `PUT /user`, `PUT /user/scenario`, `POST /user/session` |
| Escenarios | `GET /scenarios` (catálogo completo con sus temas) |
| Tareas | `GET /tasks`, `POST /tasks`, `PUT /tasks/:id` (editar o cambiar `status`), `DELETE /tasks/:id` |
| Mundo (escenario activo) | `GET /city`, `PUT /city` |
| Ánimo | `POST /moods`, `GET /moods/today`, `GET /moods` |
| Frases | `GET /phrases`, `POST /phrases`, `PUT /phrases/:id`, `DELETE /phrases/:id` |

Al cambiar el `status` de una tarea (`done`, `failed` o `pending`), el servidor actualiza el mundo del escenario activo y devuelve el tablero y el efecto aplicado.

## Añadir un escenario nuevo

Los escenarios son solo configuración. Edita `lib/scenarios.js` y añade un bloque:

```js
desierto: {
  name: 'Desierto', icon: '🏜️', bg: '#e8c88a', title: 'Mi desierto',
  grow: grow(['🌵', '🐪'], ['🏺', '🦂'], ['🌴', '⛺']),   // Estudio, Trabajo, Hábito
  built: 'elementos del desierto', lost: 'zonas arrasadas',
  tip: 'Completa tareas para dar vida al desierto.'
}
```

Aparecerá automáticamente en la pantalla de selección; no hay que tocar nada más.

## Estructura del proyecto

```
Brote/
├── server.js            # Arranque, conexión a MongoDB y montaje de rutas
├── wrap.js              # Manejo de errores async en Express
├── seed.js              # Frases motivacionales por defecto
├── lib/
│   ├── scenarios.js     # Catálogo de escenarios (configuración visual)
│   ├── city.js          # Lógica del mundo: crecer, destruir y deshacer
│   └── email.js         # Correo de confirmación de cuenta
├── models/index.js      # Esquemas: User (con password/rol), Task, WorldState, Phrase, MoodLog
├── routes/              # user, tasks, city, scenarios, moods, phrases, auth, admin
├── middleware/auth.js   # Sesión y control de rol administrador
├── public/index.html    # Cliente (HTML + CSS + JS)
├── postman/             # Colección de Postman para probar la API
└── spec/                # Tests con Jasmine
```

## Postman

Importa `postman/CityFocus.postman_collection.json`. La variable `baseUrl` apunta a `http://localhost:3000/api`; cámbiala por `https://TU-APP.onrender.com/api` para probar el despliegue.

## Registro e inicio de sesión

- **Registro** (`POST /api/auth/register`): nombre, email y contraseña (mínimo 8 caracteres). La contraseña se guarda con **bcrypt**.
- **Confirmación por correo** (`GET /api/auth/confirmar/:email/:key`): solo si `EMAIL_USER` y `EMAIL_PASS` están definidos; si no, la cuenta queda confirmada al instante.
- **Login** (`POST /api/auth/login`): crea una cookie `httpOnly` con un **JWT** firmado (`JWT_SECRET`) válido 7 días. `POST /api/auth/logout` la borra y `GET /api/auth/me` devuelve el usuario actual.
- **Aislamiento:** todas las rutas `/api/*` (tareas, mundo, frases, ánimo…) exigen sesión y solo devuelven los datos del usuario autenticado.
- **Roles:** `admin` (el email de `ADMIN_EMAIL`, o el primer registrado) puede listar (`GET /api/admin/usuarios`) y borrar usuarios; un usuario normal solo puede borrar su propia cuenta. Al borrar un usuario se borran también sus datos.

## Desplegar en Google Cloud Run + MongoDB Atlas

1. En Atlas: crea un clúster gratuito (M0), un usuario de base de datos, y en *Network Access* permite `0.0.0.0/0`.
2. Despliega desde esta carpeta:
   ```bash
   gcloud run deploy brote --source . --region europe-west1 --allow-unauthenticated \
     --set-env-vars "MONGO_URI=...,JWT_SECRET=...,ADMIN_EMAIL=...,BASE_URL=https://TU-URL.run.app"
   ```
3. Si activas el correo, añade también `EMAIL_USER` y `EMAIL_PASS`.

(Alternativa: Render con *Build* `npm install`, *Start* `node server.js` y las mismas variables.)

## Tests

`npm test` lanza los tests de modelos y los de autenticación. Estos últimos usan MongoDB en memoria (se descarga la primera vez) o la base indicada en `MONGO_TEST_URI`.
