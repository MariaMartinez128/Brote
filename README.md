# CityFocus

Productividad gamificada: tareas, Pomodoro, mood tracker y una ciudad que crece (o se destruye) según cumplas.
Node + Express + MongoDB (Mongoose). El frontend (HTML/CSS/JS nativo) está en `public/` y lo sirve Express.

## Ejecutar en local
1. `npm install`
2. Copia `.env.example` a `.env` y pon tu `MONGO_URI` (MongoDB Atlas o local).
3. `npm start` y abre http://localhost:3000

## API (prefijo `/api`)
| Recurso | Rutas |
|---|---|
| Salud | `GET /health` |
| Usuario | `GET /user`, `PUT /user`, `POST /user/session` |
| Tareas | `GET /tasks`, `POST /tasks`, `PUT /tasks/:id` (editar o cambiar `status`), `DELETE /tasks/:id` |
| Ciudad | `GET /city`, `PUT /city` |
| Ánimo | `POST /moods`, `GET /moods/today`, `GET /moods` |
| Frases | `GET /phrases`, `POST /phrases`, `PUT /phrases/:id`, `DELETE /phrases/:id` |

Al cambiar el `status` de una tarea (`done` / `failed` / `pending`) el servidor construye o destruye un edificio y devuelve la ciudad actualizada.

## Postman
Importa `postman/CityFocus.postman_collection.json`. La variable `baseUrl` apunta a `http://localhost:3000/api`;
cámbiala por `https://TU-APP.onrender.com/api` para probar el despliegue.

## Desplegar (Render + MongoDB Atlas)
- Build Command: `npm install` · Start Command: `node server.js`
- Variable de entorno: `MONGO_URI`
- En Atlas, permite el acceso desde `0.0.0.0/0` (Network Access).
