# 🌱 Brote

**Productividad gamificada.** Completa tus tareas y haz crecer tu propio mundo; si fallas, se resiente.
Tú eliges el escenario (un huerto, una ciudad, un sistema solar, una playa…) y cada uno guarda su propio progreso.

<p align="center">
  <img src="docs/img/tareas.png" alt="Lista de tareas" width="48%">
  <img src="docs/img/mundo.png" alt="Mi mundo" width="48%">
</p>

## Características

**Para cualquier usuario**
- **Tareas** de tres tipos (Estudio, Trabajo, Hábito) con **fecha límite**, **repetición diaria** para hábitos, filtros (Hoy · Pendientes · Hechas · Todas) y aviso de tareas vencidas. Se pueden completar, marcar como fallidas, editar, eliminar y **deshacer**.
- **Mundo que crece o se destruye:** completar una tarea hace aparecer un elemento en el tablero (50 casillas); fallarla destruye uno. **Deshacer es exacto**: se quita justo la casilla que creó esa tarea. Si llenas el tablero, ¡mundo completado! y puedes empezar otro.
- **10 escenarios** (🌱 Huerto, 🏙️ Ciudad, 🪐 Sistema solar, 🏖️ Playa, 🐠 Océano, 🌲 Bosque, 🐄 Granja, 🚀 Estación espacial, 🏰 Reino medieval, 🎋 Jardín zen), cada uno con su tablero, colores y textos, y su propio progreso.
- **Pomodoro** fiable (calcula con la hora de fin, así no se desajusta con la pestaña en segundo plano y sobrevive a recargar la página), con sonido y aviso del navegador, tareas asociadas, descanso largo cada 4 sesiones y tiempos configurables.
- **Estado de ánimo:** eliges cómo te sientes y recibes una frase (del sistema o tuya). Puedes escribir y editar tus frases, pedir otra, ver tu semana y tu racha.
- **Estadísticas y logros:** nivel y XP (10 por tarea, 5 por sesión), gráfica de los últimos 14 días, rachas y 10 logros desbloqueables.
- **Cuenta:** recuperar contraseña por correo, cambiarla, **descargar todos mis datos (JSON)** y eliminar mi cuenta. Tema claro/oscuro.

**Para el administrador (rol `admin`)**
- Estadísticas generales de la aplicación.
- Listar y **buscar usuarios** con su actividad.
- **Eliminar usuarios de la base de datos junto con todos sus datos** (tareas, mundos, ánimos, estadísticas y frases).
- Hacer o quitar el rol de administrador, **suspender / reactivar** cuentas (la sesión deja de valer al instante) y confirmar cuentas a mano.
- **Restablecer la contraseña** de un usuario (se genera una temporal que se muestra una sola vez).
- Gestionar las **frases del sistema** que ven todos los usuarios.
- **Registro de acciones** de administración (quién hizo qué y cuándo).
- Protecciones: nadie puede quitarse el rol a sí mismo, borrar o suspender su propia cuenta desde el panel, ni dejar la aplicación sin administradores.

<p align="center">
  <img src="docs/img/admin.png" alt="Panel de administración" width="70%">
</p>

## Tecnologías

Node.js 18+ · Express 4 · MongoDB con Mongoose · HTML, CSS y JavaScript nativos (sin framework) · Helmet · Jasmine + Supertest · Docker · GitHub Actions.

## Ejecutar en local

### Opción A: con Docker (un solo comando)
```bash
docker compose up --build
```
Abre <http://localhost:3000>. Levanta la app y una base MongoDB. El primer usuario que se registre será administrador.

### Opción B: con Node.js
1. `npm install`
2. Copia `.env.example` a `.env` y rellena `MONGO_URI` (local o [MongoDB Atlas](https://www.mongodb.com/atlas)) y `JWT_SECRET`.
3. `npm start` (o `npm run dev` para recarga automática) y abre <http://localhost:3000>.

Al arrancar se crean las frases motivacionales de ejemplo.

### Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `MONGO_URI` | Sí | Cadena de conexión a MongoDB |
| `JWT_SECRET` | Sí | Texto aleatorio (32+ caracteres) para firmar las sesiones. Genera uno: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `PORT` | No | Puerto del servidor (por defecto `3000`; Cloud Run lo define solo) |
| `ADMIN_EMAIL` | No | Quien se registre con este correo será administrador (si no se define, el primer usuario registrado) |
| `EMAIL_USER`, `EMAIL_PASS` | No | Cuenta de Gmail (contraseña de aplicación) para el correo de confirmación y la recuperación de contraseña. Sin ellas, las cuentas se confirman solas y el administrador puede restablecer contraseñas |
| `BASE_URL` | No | URL pública de la app, usada en los enlaces de los correos |
| `COOKIE_SECURE` | No | `false` solo para probar la imagen Docker en `http://localhost` |

> Si activas el correo, no hace falta `ADMIN_EMAIL` para recuperar contraseñas, pero sí conviene definirlo para saber quién es el administrador. **Sin correo configurado, define `ADMIN_EMAIL` y registra esa cuenta antes que nadie.**

## Cómo se juega

1. Elige tu mundo en **Escenarios**.
2. Añade tareas en **Tareas** (tipo, fecha límite y si se repite cada día).
3. **Completar** hace aparecer algo en tu tablero; el tipo decide qué. **Fallida** destruye una casilla. **Desmarcar** lo revierte con exactitud.
4. Concéntrate con el **Pomodoro**, registra tu **Ánimo** y mira tu progreso en **Estadísticas**.

## API REST (prefijo `/api`)

| Recurso | Rutas |
|---|---|
| Salud | `GET /health` (200 si la base de datos está conectada, 503 si no) |
| Autenticación | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `GET /auth/confirmar/:email/:key`, `POST /auth/forgot`, `POST /auth/reset` |
| Usuario | `GET /user`, `PUT /user`, `PUT /user/scenario`, `POST /user/session`, `GET /user/stats`, `PUT /user/password`, `GET /user/export`, `DELETE /user` |
| Escenarios | `GET /scenarios` |
| Tareas | `GET /tasks`, `POST /tasks`, `PUT /tasks/:id` (editar o cambiar `status`), `DELETE /tasks/:id` |
| Mundo | `GET /city`, `POST /city/reset` |
| Ánimo | `POST /moods`, `POST /moods/otra`, `GET /moods/today`, `GET /moods/stats`, `GET /moods` |
| Frases | `GET /phrases`, `POST /phrases`, `PUT /phrases/:id`, `DELETE /phrases/:id` |
| Admin (solo `admin`) | `GET /admin/usuarios?q=`, `GET /admin/stats`, `PUT /admin/usuarios/:id/rol`, `PUT /admin/usuarios/:id/activo`, `PUT /admin/usuarios/:id/confirmar`, `PUT /admin/usuarios/:id/password`, `DELETE /admin/usuarios/:id`, `GET /admin/auditoria`, `GET/POST /admin/frases`, `DELETE /admin/frases/:id` |

El cliente envía su zona horaria en la cabecera `X-Timezone`; el servidor la usa para decidir qué es "hoy" (tareas, ánimo, rachas, sesiones).

Colección de **Postman** en `postman/Brote.postman_collection.json` (la variable `baseUrl` apunta a `http://localhost:3000/api`; cámbiala por `https://TU-URL.run.app/api` para probar el despliegue).

## Decisiones técnicas

- **El servidor es la única fuente de verdad del mundo.** El cliente no puede subir un tablero inventado: solo cambia al completar o fallar tareas. Cada tarea guarda qué casilla creó o destruyó, y por eso deshacer es exacto.
- **Concurrencia:** las operaciones sobre el mundo usan control optimista (`rev`) y una cola por usuario; el doble clic o dos pestañas no corrompen el tablero.
- **Estadísticas derivadas del historial** (`Activity`): XP, rachas y logros se calculan siempre desde ahí, así nunca se desajustan al deshacer.
- **Zona horaria por usuario** en lugar de la del servidor (UTC).
- **Seguridad:** contraseñas con bcrypt (máximo 72 caracteres, el límite real del algoritmo), JWT en cookie `httpOnly` + `sameSite`, sesiones invalidadas al cambiar la contraseña o suspender la cuenta, límite de intentos en acceso y límite general en la API, cabeceras y CSP con Helmet, validación de entradas, tokens de recuperación guardados con hash y con caducidad de 1 hora, respuestas que no revelan qué correos existen y datos aislados por usuario.
- **Privacidad (RGPD):** una única cookie técnica de sesión, descarga de todos los datos y eliminación de la cuenta.

## Estructura del proyecto

```
Brote/
├── server.js            # Arranque, seguridad, rutas, errores y cierre ordenado
├── seed.js              # Frases motivacionales por defecto
├── lib/
│   ├── scenarios.js     # Catálogo de escenarios (solo configuración)
│   ├── world.js         # Lógica del mundo: crecer, destruir, deshacer, reiniciar
│   ├── lock.js          # Cola por usuario
│   ├── dates.js         # Fechas y rachas según zona horaria
│   ├── stats.js         # Estadísticas, XP, nivel y logros
│   ├── accounts.js      # Borrado de usuarios con sus datos y auditoría
│   └── email.js         # Correos de confirmación y recuperación
├── models/index.js      # User, Task, WorldState, Phrase, MoodLog, Activity, Audit
├── routes/              # auth, user, tasks, city, scenarios, moods, phrases, admin
├── middleware/          # auth (sesión y rol admin) y tz (zona horaria)
├── public/              # Cliente: index.html, css/, js/, img/
├── spec/                # Tests (Jasmine + Supertest)
├── postman/             # Colección de Postman
├── Dockerfile · docker-compose.yml · .github/workflows/ci.yml
```

**Añadir un escenario:** edita `lib/scenarios.js` y añade un bloque (aparece solo en la pantalla de selección):
```js
desierto: {
  name: 'Desierto', icon: '🏜️', bg: '#e8c88a', title: 'Mi desierto',
  grow: grow(['🌵', '🐪'], ['🏺', '🦂'], ['🌴', '⛺']),   // Estudio, Trabajo, Hábito
  built: 'elementos del desierto', lost: 'zonas arrasadas',
  tip: 'Completa tareas para dar vida al desierto.'
}
```

## Desplegar en Google Cloud Run + MongoDB Atlas

1. **Atlas:** crea un clúster gratuito (M0), un usuario de base de datos y, en *Network Access*, permite `0.0.0.0/0` (Cloud Run no tiene IP fija).
2. **Despliega** desde esta carpeta (usa el `Dockerfile`):
   ```bash
   gcloud run deploy brote --source . --region europe-west1 --allow-unauthenticated \
     --set-env-vars "MONGO_URI=mongodb+srv://USUARIO:PASSWORD@cluster0.xxxxx.mongodb.net/Brote,JWT_SECRET=TEXTO_LARGO_ALEATORIO,ADMIN_EMAIL=tu@correo.com"
   ```
3. Copia la URL que te da (`https://brote-xxxx.run.app`) y actualiza `BASE_URL`:
   ```bash
   gcloud run services update brote --region europe-west1 --update-env-vars BASE_URL=https://brote-xxxx.run.app
   ```
4. **Regístrate con `ADMIN_EMAIL`** y ya tendrás el panel de administración.
5. Para actualizar la app, repite el comando del paso 2.

Más seguro: guarda `MONGO_URI` y `JWT_SECRET` en *Secret Manager* y usa `--set-secrets "MONGO_URI=mongo-uri:latest,JWT_SECRET=jwt-secret:latest"` en vez de `--set-env-vars`.

(Alternativa: Render con *Build* `npm install`, *Start* `node server.js` y las mismas variables.)

## Tests

```bash
npm test
```
43 tests de autenticación, recuperación de contraseña, panel de administración, tareas y mundo (deshacer exacto, concurrencia, tablero lleno, hábitos diarios, XP), ánimo y zonas horarias. Usan MongoDB en memoria (se descarga la primera vez) o la base **vacía** indicada en `MONGO_TEST_URI`. Se ejecutan automáticamente en GitHub Actions en cada *push*.
