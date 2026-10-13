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
   PORT=3000
   ```
3. Arranca la aplicación y abre <http://localhost:3000>:
   ```bash
   npm start          # producción
   npm run dev        # recarga automática al editar
   ```

Al arrancar por primera vez se crea el usuario, su mundo y las frases motivacionales de ejemplo. Si venías de una versión anterior con una única ciudad, esta se migra sola al escenario *Ciudad*.

### Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `MONGO_URI` | Sí | Cadena de conexión a MongoDB |
| `PORT` | No | Puerto del servidor (por defecto `3000`) |
| `EMAIL_USER`, `EMAIL_PASS` | Solo con registro por correo | Cuenta de Gmail que envía el correo de confirmación |
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
├── models/index.js      # Esquemas: User, Task, WorldState, Phrase, MoodLog
├── routes/              # user, tasks, city, scenarios, moods, phrases, auth, admin
├── middleware/auth.js   # Sesión y control de rol administrador
├── public/index.html    # Cliente (HTML + CSS + JS)
├── postman/             # Colección de Postman para probar la API
└── spec/                # Tests con Jasmine
```

## Tests

```bash
npm test
```

## Postman

Importa `postman/CityFocus.postman_collection.json`. La variable `baseUrl` apunta a `http://localhost:3000/api`; cámbiala por `https://TU-APP.onrender.com/api` para probar el despliegue.

## Desplegar (Render + MongoDB Atlas)

- **Build Command:** `npm install`
- **Start Command:** `node server.js`
- **Variable de entorno:** `MONGO_URI`
- En Atlas, permite el acceso desde `0.0.0.0/0` (*Network Access*).

## Estado y próximos pasos

- Por ahora la aplicación funciona con un único usuario y sin inicio de sesión. Las rutas de registro, confirmación por correo y panel de administración (`/api/auth`, `/api/admin`) están escritas pero todavía sin activar.
- Ideas pendientes: desbloquear escenarios al completar cierto número de tareas, crecimiento por etapas (🌱 → 🌿 → 🌳) y estadísticas semanales.