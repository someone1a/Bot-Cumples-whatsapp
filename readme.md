# 🎂 Bot de Cumpleaños para WhatsApp

Un bot sencillo y funcional para **WhatsApp** que envía mensajes automáticos de cumpleaños a grupos, utilizando la librería [`whatsapp-web.js`](https://github.com/pedroslopez/whatsapp-web.js).

---

## 📋 Tabla de Contenidos

* [Características](#-características)
* [Requisitos](#-requisitos)
* [Instalación](#-instalación)
* [Uso](#-uso)
* [Estructura del Proyecto](#-estructura-del-proyecto)
* [Comandos Disponibles](#-comandos-disponibles)
* [Configuración](#-configuración)
* [Notas de Seguridad](#-notas-de-seguridad)
* [Solución de Problemas](#-solución-de-problemas)
* [Futuras Mejoras](#-futuras-mejoras)
* [Contribuir](#-contribuir)
* [Licencia](#-licencia)

---

## ✨ Características

* 🗓️ **Gestión de cumpleaños** por grupo (agregar, listar, borrar).
* ⏰ **Mensajes automáticos** enviados cada día a las 00:00 (zona horaria configurable).
* 💾 **Sesión persistente** con `LocalAuth` (carpeta `session/`).
* 🧩 Compatible con cualquier grupo donde el bot esté agregado.
* 📦 **Archivo JSON** simple para almacenar los datos (`birthdays.json`).

---

## ⚙️ Requisitos

* **Node.js** 16 o superior
* **npm** (gestor de paquetes de Node)
* **WhatsApp instalado** y una cuenta activa en tu teléfono

---

## 🚀 Instalación

1. **Clona o descarga** este repositorio:

   ```bash
   git clone https://github.com/someone1a/Bot-Cumples-whatsapp
   cd Bot-Cumples-whatsapp
   ```

2. **Instala las dependencias:**

   ```bash
   npm install
   ```

3. **(Opcional)** Crea manualmente la carpeta `session/`.
   El bot la generará automáticamente la primera vez que inicies sesión con `LocalAuth`.

---

## ▶️ Uso

1. **Inicia el bot:**

   ```bash
   npm start
   # o
   node index.js
   ```

2. En la primera ejecución aparecerá un **código QR** en la consola.
   Escanealo desde tu teléfono:
   **Menú → Dispositivos vinculados → Vincular un dispositivo.**

3. Una vez conectado, verás:

   ```
   ✅ Bot conectado y listo.
   ```

   A partir de ese momento, el bot estará activo en tus grupos.

---

## 🗂️ Estructura del Proyecto

```
📁 bot-cumpleanios/
├── index.js          # Lógica principal del bot
├── birthdays.json    # Base de datos de cumpleaños
├── session/          # Sesión de WhatsApp (no subir al repositorio)
├── package.json      # Dependencias y scripts
└── README.md         # Este archivo
```

---

## 💬 Comandos Disponibles

| Comando                          | Descripción                                          | Ejemplo                     |
| -------------------------------- | ---------------------------------------------------- | --------------------------- |
| `!ping`                          | Verifica si el bot está activo.                      | `!ping`                     |
| `!help` o `!ayuda`               | Muestra el mensaje de ayuda.                         | `!help`                     |
| `!agregar DD-MM Nombre Apellido` | Agrega un cumpleaños al grupo actual.                | `!agregar 17-10 Juan Pérez` |
| `!listar`                        | Muestra los cumpleaños registrados del grupo actual. | `!listar`                   |
| `!borrar Nombre`                 | Borra un cumpleaños del grupo actual.                | `!borrar Juan Pérez`        |

---

## ⚙️ Configuración

* **Zona horaria:**
  Editá la constante `TZ` en `index.js`.
  Por defecto:

  ```js
  const TZ = 'America/Argentina/Buenos_Aires';
  ```

* **Mensajes personalizados:**
  Podés extender la estructura de `birthdays.json` para agregar un campo:

  ```json
  {
    "name": "Juan Pérez",
    "date": "17-10",
    "message": "¡Feliz cumpleaños, Juan! 🎉"
  }
  ```

---

## 🔒 Notas de Seguridad

* **No compartas** las carpetas `session/` ni el archivo `birthdays.json`.
* No subas estas carpetas a repositorios públicos ni servicios en la nube.
* Se recomienda agregar al `.gitignore`:

  ```
  session/
  birthdays.json
  ```

---

## 🧩 Solución de Problemas

| Problema                 | Posible causa / solución                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| No aparece el QR         | Verificá que `whatsapp-web.js` y Puppeteer estén correctamente instalados.               |
| El bot no envía mensajes | Asegurate de que el bot esté en el grupo correcto y tenga permisos para enviar mensajes. |
| Error al iniciar sesión  | Borra la carpeta `session/` y vuelve a vincular el dispositivo.                          |

---

## 🚧 Futuras Mejoras

* 🔐 Confirmación interactiva antes de borrar cumpleaños.
* 🌐 Panel web para administrar cumpleaños.
* 🌍 Soporte de zonas horarias por grupo o usuario.
* 🧠 Recordatorios anticipados (por ejemplo, “mañana cumple X”).

---

## 🤝 Contribuir

¡Las contribuciones son bienvenidas!
Si querés mejorar el bot:

1. Haz un **fork** del proyecto.
2. Crea una nueva rama con tus cambios:

   ```bash
   git checkout -b feature/nueva-funcionalidad
   ```
3. Envía un **pull request** con una descripción clara de la mejora o corrección.

---

## 📜 Licencia

> ⚠️ Este proyecto **no tiene licencia explícita**.
> Usalo bajo tu propia responsabilidad. 
