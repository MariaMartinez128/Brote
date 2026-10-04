# 🌱 Brote

> **Productividad gamificada:** Tu lista de tareas diaria que hace crecer (o deteriorar) tu propia ciudad virtual.

---

## 🎯 ¿Qué hace exactamente la aplicación? (En pocas palabras)

**Brote** convierte tu rutina diaria y tu gestión del tiempo en un juego visual de evolución urbana:

1. 📋 **Gestionas tus tareas:** Creas tus tareas pendientes (estudiar, hacer ejercicio, trabajar, etc.).
2. 🏙️ **Tu ciudad reacciona a tus acciones:**
   * **Si completas tareas:** La ciudad progresa, evoluciona y mejora visualmente.
   * **Si fallas o no cumples tareas:** La ciudad se deteriora o se estanca.
3. ⏱️ **Te ayuda a concentrarte:** Incluye un **Temporizador Pomodoro** con contador automático de sesiones de trabajo completadas.
4. 🧠 **Registra cómo te sientes:** Un módulo diario para guardar tu **estado de ánimo** y recibir frases motivacionales adaptadas.

Toda la evolución de la ciudad se calcula en el servidor y se guarda de forma permanente en una base de datos (**MongoDB**).

---

## 🛠️ Tecnologías Utilizadas

* **Backend:** Node.js + Express.js
* **Base de Datos:** MongoDB / Mongoose (5 colecciones: `users`, `tasks`, `citystates`, `phrases`, `moodlogs`)
* **Frontend:** HTML5, CSS3 y JavaScript (Vanilla JS - Fetch API)
* **Testing:** Colección de pruebas en Postman

---

## 📁 Estructura del Proyecto

```text
Brote/
├── models/         # Esquemas de datos (User, Task, CityState, Phrase, MoodLog)
├── routes/         # Endpoints de la API REST (tareas, ciudad, ánimo, frases)
├── lib/            # Lógica de negocio (cálculo del estado de la ciudad)
├── public/         # Interfaz web del usuario (HTML, CSS y JS)
├── postman/        # Pruebas automatizadas de la API
├── .env.example    # Plantilla de variables de entorno
├── server.js       # Servidor principal y conexión a MongoDB
└── README.md       # Documentación del proyecto
