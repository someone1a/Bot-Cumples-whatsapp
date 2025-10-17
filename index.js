import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import fs from "fs";
import cron from "node-cron";
import moment from "moment-timezone";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const TZ = "America/Argentina/Buenos_Aires";
const FILE = "./birthdays.json";

// Cargar birthdays.json
let birthdays = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf-8")) : [];

// Guardar cumpleaños
function saveBirthdays() {
  fs.writeFileSync(FILE, JSON.stringify(birthdays, null, 2));
}

// Middleware para procesar JSON
app.use(express.json());

// Servir página simple para mostrar QR
app.get("/login", (req, res) => {
  res.send(`
    <h2>Escanea el QR para conectar WhatsApp</h2>
    <img id="qrcode" src="" />
    <script src="/socket.io/socket.io.js"></script>
    <script>
      const socket = io();
      socket.on("qr", data => {
        document.getElementById("qrcode").src = data;
      });
    </script>
  `);
});

// Endpoint para obtener todos los cumpleaños
app.get("/api/birthdays", (req, res) => {
  res.json(birthdays);
});

// Endpoint para subir cumpleaños
app.post("/api/birthdays", (req, res) => {
  try {
    const newBirthdays = req.body;
    
    // Validar que sea un array
    if (!Array.isArray(newBirthdays)) {
      return res.status(400).json({ error: "Los datos deben ser un array de cumpleaños" });
    }

    // Validar estructura de cada cumpleaños
    const isValid = newBirthdays.every(birthday => 
      birthday.name && 
      birthday.date && 
      birthday.groupId && 
      birthday.groupName &&
      typeof birthday.name === 'string' &&
      typeof birthday.date === 'string' &&
      typeof birthday.groupId === 'string' &&
      typeof birthday.groupName === 'string' &&
      /^\d{2}-\d{2}$/.test(birthday.date)
    );

    if (!isValid) {
      return res.status(400).json({ 
        error: "Formato inválido. Cada cumpleaños debe tener: name, date (DD-MM), groupId y groupName" 
      });
    }

    // Agregar solo cumpleaños que no existan
    const added = [];
    const duplicates = [];

    newBirthdays.forEach(birthday => {
      const exists = birthdays.some(b => 
        b.date === birthday.date && 
        b.name.toLowerCase() === birthday.name.toLowerCase() && 
        b.groupId === birthday.groupId
      );

      if (!exists) {
        birthdays.push(birthday);
        added.push(birthday);
      } else {
        duplicates.push(birthday);
      }
    });

    // Guardar los cambios
    saveBirthdays();

    res.json({
      message: "Proceso completado",
      added: added.length,
      duplicates: duplicates.length,
      total: birthdays.length
    });

  } catch (error) {
    console.error("Error procesando cumpleaños:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Crear cliente WhatsApp
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: "./session" }),
  puppeteer: { headless: true, args: ["--no-sandbox","--disable-setuid-sandbox"] }
});

client.on("qr", async (qr) => {
  // Convertir QR a imagen data URL
  const qrImage = await qrcode.toDataURL(qr);
  io.emit("qr", qrImage);
});

client.on("ready", () => {
  console.log("✅ Bot conectado y listo.");

  // Cron diario para enviar cumpleaños
  cron.schedule("0 0 * * *", async () => {
    const today = moment().tz(TZ).format("DD-MM");
    for (const person of birthdays) {
      if (person.date === today) {
        try {
          const chat = await client.getChatById(person.groupId);
          await chat.sendMessage(`🎉 ¡Feliz cumpleaños ${person.name}! 🎂🥳`);
          console.log(`🎂 Mensaje enviado a ${person.name} en ${person.groupName}`);
        } catch (err) {
          console.error("Error enviando mensaje:", err);
        }
      }
    }
  });
});

// Escuchar mensajes para comandos (!agregar, !listar, etc.) — igual que antes
client.on("message", async (msg) => {
  const chat = await msg.getChat();
  const text = msg.body.trim();

  if (text === "!ping") msg.reply("🏓 ¡Estoy activo!");

  if (text.startsWith("!agregar")) {
    const parts = text.split(" ");
    if (parts.length < 3) return msg.reply("❌ Formato: !agregar DD-MM Nombre");
    const date = parts[1];
    const name = parts.slice(2).join(" ");
    const groupId = chat.id._serialized;
    const groupName = chat.name || "Chat individual";

    if (birthdays.find(b => b.date === date && b.name.toLowerCase() === name.toLowerCase() && b.groupId === groupId))
      return msg.reply("⚠️ Ese cumpleaños ya está registrado.");

    birthdays.push({ name, date, groupId, groupName });
    saveBirthdays();
    msg.reply(`✅ Cumpleaños agregado: ${name} - ${date} (${groupName})`);
  }

  if (text === "!listar") {
    const groupId = chat.id._serialized;
    const list = birthdays.filter(b => b.groupId === groupId)
      .map(b => `🎂 ${b.name} - ${b.date}`).join("\n");
    msg.reply(list || "📭 No hay cumpleaños registrados en este grupo.");
  }

  if (text.startsWith("!eliminar")) {
    const parts = text.split(" ");
    if (parts.length < 3) return msg.reply("❌ Formato: !eliminar DD-MM Nombre");
    const date = parts[1];
    const name = parts.slice(2).join(" ");
    const groupId = chat.id._serialized;

    const index = birthdays.findIndex(b => 
      b.date === date && 
      b.name.toLowerCase() === name.toLowerCase() && 
      b.groupId === groupId
    );

    if (index === -1) return msg.reply("❌ No se encontró ese cumpleaños en este grupo.");

    birthdays.splice(index, 1);
    saveBirthdays();
    msg.reply(`✅ Cumpleaños eliminado: ${name} - ${date}`);
  }

  if (text === "!help" || text === "!ayuda") {
    const menu = `📋 *Comandos disponibles:*
🔹 !agregar DD-MM Nombre
   _Agrega un nuevo cumpleaños_
🔹 !eliminar DD-MM Nombre
   _Elimina un cumpleaños existente_
🔹 !listar
   _Muestra todos los cumpleaños del grupo_
🔹 !ping
   _Verifica si el bot está activo_
🔹 !help o !ayuda
   _Muestra este menú de ayuda_

*Ejemplo:* !agregar 25-12 Juan Pérez`;
    
    msg.reply(menu);
  }
});

client.initialize();

// Iniciar servidor web
server.listen(PORT, () => {
  console.log(`🌐 Abierto en http://localhost:${PORT}`);
  console.log(`🔧 Zona horaria configurada: ${TZ}`);
  console.log(`URL PARA INICIAR SESIÓN: http://localhost:${PORT}/login`);
});
