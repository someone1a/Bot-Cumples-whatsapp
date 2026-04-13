# Bot de Cumpleaños para WhatsApp

Bot para WhatsApp que envía mensajes automáticos de cumpleaños a grupos. Incluye base de datos SQLite local, panel web y soporte para VPS con PM2.

---

## Características

- Mensajes automáticos enviados cada día a las 00:00 (zona horaria configurable)
- Base de datos SQLite local (`data/birthdays.db`)
- Panel web en `http://localhost:3000` para ver y gestionar cumpleaños
- Sesión persistente con `LocalAuth`
- Migración automática desde `birthdays.json` si existe
- Compatible con cualquier grupo donde el bot esté agregado

---

## Requisitos

- Node.js 18 o superior
- npm
- WhatsApp instalado y una cuenta activa en tu teléfono
- (Para VPS) PM2: `npm install -g pm2`

---

## Instalación

```bash
git clone https://github.com/someone1a/Bot-Cumples-whatsapp
cd Bot-Cumples-whatsapp
npm install
```

---

## Uso

```bash
npm start
```

La primera vez aparecerá un **código QR** en la consola. Escanealo desde tu teléfono:
**Menú → Dispositivos vinculados → Vincular un dispositivo.**

Una vez conectado el panel web queda disponible en `http://localhost:3000`.

---

## Panel Web

Accedé desde el navegador a `http://localhost:3000` (o `http://IP_DEL_VPS:3000` si usás un servidor remoto).

Desde ahí podés:
- Ver todos los cumpleaños con su estado (enviado / pendiente)
- Agregar, editar y eliminar cumpleaños
- Filtrar por grupo o buscar por nombre
- Forzar el envío de un mensaje manualmente
- Resetear el estado de enviado

---

## Estructura del Proyecto

```
Bot-Cumples-whatsapp/
├── index.js               # Bot principal + arranca el servidor web
├── server.js              # API REST y servidor Express
├── db.js                  # Capa de base de datos SQLite
├── public/
│   ├── index.html         # Panel web
│   ├── styles.css
│   └── app.js
├── data/
│   └── birthdays.db       # Base de datos SQLite (se crea automáticamente)
├── session/               # Sesión de WhatsApp (no subir al repo)
├── ecosystem.config.cjs   # Configuración de PM2
└── package.json
```

---

## Comandos de WhatsApp

| Comando | Descripción | Ejemplo |
|---|---|---|
| `!ping` | Verifica si el bot está activo | `!ping` |
| `!help` / `!ayuda` | Muestra la ayuda | `!help` |
| `!grupos` | Lista los grupos disponibles | `!grupos` |
| `!agregar DD-MM Nombre` | Agrega un cumpleaños al grupo actual | `!agregar 17-10 Juan Pérez` |
| `!listar` | Muestra los cumpleaños del grupo actual | `!listar` |
| `!borrar Nombre` | Elimina un cumpleaños | `!borrar Juan Pérez` |
| `!forzar Nombre` | Fuerza el reenvío del mensaje | `!forzar Juan Pérez` |
| `!actualizar` | Actualiza los IDs de grupos | `!actualizar` |

---

## Configuración

**Zona horaria** — editá la constante `TZ` en `index.js` (línea 25):

```js
const TZ = "America/Argentina/Buenos_Aires";
```

**Puerto del panel web** — por defecto es `3000`. Podés cambiarlo con la variable de entorno `PORT`:

```bash
PORT=8080 npm start
```

---

## Correr en VPS con PM2

### Instalar PM2

```bash
npm install -g pm2
```

### Iniciar el bot

```bash
pm2 start ecosystem.config.cjs
```

### Comandos útiles

```bash
pm2 logs birthday-bot        # Ver logs en tiempo real
pm2 restart birthday-bot     # Reiniciar
pm2 stop birthday-bot        # Detener
pm2 status                   # Estado de todos los procesos
```

### Arranque automático al reiniciar el VPS

```bash
pm2 startup
pm2 save
```

### Abrir el puerto en el firewall (Ubuntu)

```bash
ufw allow 3000
```

---

## Migración desde versión anterior

Si tenés datos en un archivo `birthdays.json`, se migran automáticamente a SQLite la primera vez que iniciás el bot. El archivo original no se modifica.

---

## Seguridad

No subas al repositorio las carpetas `session/` ni `data/`. Ya están incluidas en el `.gitignore`.

---

## Solución de Problemas

| Problema | Solución |
|---|---|
| No aparece el QR | Verificá que puppeteer y chromium estén instalados correctamente |
| El bot no envía mensajes | Verificá que el bot esté en el grupo y tenga permisos |
| Error de sesión | Borrá la carpeta `session/` y volvé a vincular el dispositivo |
| Panel web no carga | Verificá que el puerto 3000 esté abierto en el firewall del VPS |

---

## Licencia

> Este proyecto no tiene licencia explícita. Usalo bajo tu propia responsabilidad.
