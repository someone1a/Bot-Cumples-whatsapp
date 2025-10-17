import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode-terminal";
import cron from "node-cron";
import moment from "moment-timezone";
import fs from "fs";

const TZ = "America/Argentina/Buenos_Aires";
const FILE = "./birthdays.json";

// Cargar cumpleaños desde archivo
let birthdays = [];
if (fs.existsSync(FILE)) {
  birthdays = JSON.parse(fs.readFileSync(FILE, "utf-8"));
} else {
  fs.writeFileSync(FILE, "[]");
}

// Guardar cumpleaños
function saveBirthdays() {
  fs.writeFileSync(FILE, JSON.stringify(birthdays, null, 2));
}

// Crear cliente WhatsApp con sesión persistente
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: "./session" }),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  }
});

// Mostrar QR para vincular WhatsApp
client.on("qr", (qr) => {
  console.log("Escaneá este QR con tu WhatsApp:");
  qrcode.generate(qr, { small: true });
});

// Aviso cuando el bot está listo
client.on("ready", () => {
  console.log("✅ Bot conectado y listo.");
  
  // Función reutilizable para revisar cumpleaños
  async function checkBirthdays(sendTestForDate) {
    const today = sendTestForDate || moment().tz(TZ).format("DD-MM");
    console.log("🔍 Revisando cumpleaños del", today);

    for (const person of birthdays) {
      if (person.date === today) {
        try {
          // Si no tenemos groupId, intentar buscar por groupName
          let groupId = person.groupId;
          if (!groupId || groupId === "") {
            // Buscar chats cargados en el cliente por nombre
            const chats = await client.getChats();
            const found = chats.find(c => (c.name || "").trim() === (person.groupName || "").trim());
            if (found) {
              groupId = found.id._serialized;
              person.groupId = groupId; // guardar para futuras ejecuciones
              saveBirthdays();
              console.log(`🔁 Resuelto groupId para ${person.groupName} -> ${groupId}`);
            }
          }

          if (!groupId || groupId === "") {
            console.warn(`⚠️ No se pudo resolver groupId para ${person.groupName}, saltando.`);
            continue;
          }

          const chat = await client.getChatById(groupId);
          const text = person.message ? person.message : `🎉 ¡Feliz cumpleaños ${person.name}! 🎂🥳`;
          await chat.sendMessage(text);
          console.log(`🎂 Mensaje enviado a ${person.name} en ${person.groupName}`);
        } catch (err) {
          console.error("❌ Error enviando mensaje:", err);
        }
      }
    }
  }

  // Ejecutar al iniciar para enviar mensajes del día actual
  (async () => {
    try {
      // En la petición del usuario, queremos enviar el mensaje para 17-10
      // pero solo si hoy es igual o si queremos forzar, aquí llamamos con la fecha 17-10
      // Llamada inicial: verificar cumpleaños de hoy
      await checkBirthdays();

      // Además, enviar específicamente la PRUEBA para 17-10 (según solicitud)
      await checkBirthdays("17-10");
    } catch (err) {
      console.error("❌ Error en la comprobación inicial:", err);
    }
  })();

  // Tarea automática: todos los días a las 00:00
  cron.schedule("0 0 * * *", async () => {
    await checkBirthdays();
  });
});

// Función para obtener el texto de ayuda
function getHelpText() {
  return `📚 *Comandos disponibles - Bot Cumpleaños*

🔍 *Comandos básicos*
!ping - Verificar si el bot está activo
!help, !ayuda - Mostrar este mensaje de ayuda

📅 *Gestión de cumpleaños*
!agregar DD-MM Nombre - Agregar un cumpleaños
  Ejemplo: !agregar 17-10 Juan Pérez

!listar - Ver todos los cumpleaños del grupo actual

!borrar Nombre - Eliminar un cumpleaños
  Ejemplo: !borrar Juan Pérez`;
}

// Escuchar mensajes entrantes
client.on("message", async (msg) => {

  const chat = await msg.getChat();
  const text = msg.body.trim();

  // ✅ Verificar si el bot responde
  if (text === "!ping") {
    msg.reply("🏓 ¡Estoy activo!");
  }

  // ✅ Mostrar ayuda
  if (text === "!help" || text === "!ayuda") {
    msg.reply(getHelpText());
  }

  // ✅ Agregar cumpleaños
  // Ejemplo: !agregar 17-10 Juan Pérez
  if (text.startsWith("!agregar")) {
    const parts = text.split(" ");
    if (parts.length < 3) {
      return msg.reply("❌ Formato incorrecto. Usá: !agregar DD-MM Nombre Apellido");
    }

    const date = parts[1];
    const name = parts.slice(2).join(" ");
    const groupId = chat.id._serialized;
    const groupName = chat.name || "Chat individual";

    // Verificar duplicado
    const exists = birthdays.find(
      (b) =>
        b.date === date &&
        b.name.toLowerCase() === name.toLowerCase() &&
        b.groupId === groupId
    );
    if (exists) return msg.reply("⚠️ Ese cumpleaños ya está registrado.");

    birthdays.push({ name, date, groupId, groupName });
    saveBirthdays();
    msg.reply(`✅ Cumpleaños agregado:\n🧍 ${name}\n📅 ${date}\n👥 ${groupName}`);
  }

  // ✅ Listar cumpleaños del grupo actual
  if (text === "!listar") {
    const groupId = chat.id._serialized;
    const groupCumples = birthdays.filter((b) => b.groupId === groupId);

    if (groupCumples.length === 0) {
      msg.reply("📭 No hay cumpleaños registrados en este grupo.");
    } else {
      const list = groupCumples.map((b) => `🎂 ${b.name} - ${b.date}`).join("\n");
      msg.reply(`📅 Cumpleaños del grupo:\n\n${list}`);
    }
  }

  // ✅ Borrar cumpleaños (opcional)
  // Ejemplo: !borrar Juan Pérez
  if (text.startsWith("!borrar")) {
    // Extraer nombre buscado (sin comando) y normalizar solo para comparación
    const rawName = text.slice(8).trim();
    const searchName = rawName.toLowerCase();
    const groupId = chat.id._serialized;

    // Buscar si existe y obtener el objeto original para conservar capitalización
    const found = birthdays.find(
      (b) => b.groupId === groupId && b.name.toLowerCase() === searchName
    );

    if (!found) {
      return msg.reply("❌ No se encontró ese nombre en este grupo.");
    }

    // Filtrar para eliminar todos los registros que coincidan con ese nombre en el grupo
    birthdays = birthdays.filter(
      (b) => !(b.groupId === groupId && b.name.toLowerCase() === searchName)
    );

    saveBirthdays();
    const displayGroupName = chat.name || found.groupName || "este grupo";
    msg.reply(`🗑️ Se eliminó el cumpleaños de ${found.name} en "${displayGroupName}".`);
  }
});

client.initialize();
