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
  
  // Normalizar cumpleaños existentes que no tienen _meta
  let needsSave = false;
  birthdays.forEach(birthday => {
    if (!birthday._meta) {
      birthday._meta = {
        lastReminderYear: null
      };
      needsSave = true;
    }
  });
  
  if (needsSave) {
    console.log("📝 Normalizando estructura de cumpleaños existentes...");
    saveBirthdays();
  }
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
client.on("ready", async () => {
  console.log("✅ Bot conectado y listo.");
  
  // Actualizar todos los groupIds al iniciar
  await updateAllGroupIds();
  
  // Función reutilizable para revisar cumpleaños
  async function checkBirthdays(sendTestForDate, forceYear = null) {
    const today = sendTestForDate || moment().tz(TZ).format("DD-MM");
    const currentYear = forceYear || moment().tz(TZ).year();
    console.log("🔍 Revisando cumpleaños del", today, `(año ${currentYear})`);

    for (const person of birthdays) {
      if (person.date === today) {
        try {
          // Verificar si ya se envió este año
          if (person._meta && person._meta.lastReminderYear === currentYear) {
            console.log(`⏭️ Ya se envió el mensaje para ${person.name} este año (${currentYear}), saltando.`);
            continue;
          }

          // Intentar obtener el chat actualizado
          const chat = await getGroupChat(person);
          
          if (!chat) {
            console.warn(`⚠️ No se pudo encontrar el grupo para ${person.name} (${person.groupName})`);
            continue;
          }

          const text = person.message ? person.message : `🎉 ¡Feliz cumpleaños ${person.name}! 🎂🥳`;
          await chat.sendMessage(text);
          
          // Registrar que se envió el mensaje este año
          if (!person._meta) {
            person._meta = {};
          }
          person._meta.lastReminderYear = currentYear;
          saveBirthdays();
          
          console.log(`🎂 Mensaje enviado a ${person.name} en ${person.groupName} (marcado año ${currentYear})`);
        } catch (err) {
          console.error(`❌ Error enviando mensaje a ${person.name}:`, err.message);
        }
      }
    }
  }

  // Función para actualizar todos los groupIds
  async function updateAllGroupIds() {
    console.log("🔄 Actualizando IDs de grupos...");
    try {
      const chats = await client.getChats();
      const groupChats = chats.filter(c => c.isGroup);
      
      let updated = 0;
      for (const birthday of birthdays) {
        const foundGroup = groupChats.find(c => 
          c.name && birthday.groupName && 
          c.name.trim().toLowerCase() === birthday.groupName.trim().toLowerCase()
        );
        
        if (foundGroup && birthday.groupId !== foundGroup.id._serialized) {
          console.log(`  ✓ Actualizado: ${birthday.groupName} -> ${foundGroup.id._serialized}`);
          birthday.groupId = foundGroup.id._serialized;
          updated++;
        }
      }
      
      if (updated > 0) {
        saveBirthdays();
        console.log(`✅ Se actualizaron ${updated} grupo(s)`);
      } else {
        console.log("✅ Todos los grupos están actualizados");
      }
    } catch (err) {
      console.error("❌ Error actualizando groupIds:", err.message);
    }
  }

  // Función para obtener el chat de un grupo
  async function getGroupChat(person) {
    try {
      const chats = await client.getChats();
      
      // Primero intentar por groupId
      if (person.groupId) {
        const chatById = chats.find(c => c.id._serialized === person.groupId);
        if (chatById && chatById.isGroup) {
          return chatById;
        }
      }
      
      // Si no funciona, buscar por nombre
      if (person.groupName) {
        const chatByName = chats.find(c => 
          c.isGroup && c.name && 
          c.name.trim().toLowerCase() === person.groupName.trim().toLowerCase()
        );
        
        if (chatByName) {
          // Actualizar el groupId
          person.groupId = chatByName.id._serialized;
          saveBirthdays();
          console.log(`🔁 Actualizado groupId para ${person.groupName}`);
          return chatByName;
        }
      }
      
      return null;
    } catch (err) {
      console.error(`❌ Error obteniendo chat:`, err.message);
      return null;
    }
  }

  // Ejecutar al iniciar para enviar mensajes del día actual
  (async () => {
    try {
      // Esperar un poco para asegurar que WhatsApp esté completamente cargado
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Verificar cumpleaños de hoy
      await checkBirthdays();
    } catch (err) {
      console.error("❌ Error en la comprobación inicial:", err);
    }
  })();

  // Tarea automática: todos los días a las 00:00
  cron.schedule("0 0 * * *", async () => {
    await checkBirthdays();
  }, {
    timezone: TZ
  });
});

// Función para obtener el texto de ayuda
function getHelpText() {
  return `📚 *Comandos disponibles - Bot Cumpleaños*

🔍 *Comandos básicos*
!ping - Verificar si el bot está activo
!help, !ayuda - Mostrar este mensaje de ayuda
!grupos - Listar todos los grupos donde está el bot

📅 *Gestión de cumpleaños*
!agregar DD-MM Nombre - Agregar un cumpleaños
  Ejemplo: !agregar 17-10 Juan Pérez

!listar - Ver todos los cumpleaños del grupo actual
  ✅ = Ya enviado este año
  ⏳ = Pendiente

!borrar Nombre - Eliminar un cumpleaños
  Ejemplo: !borrar Juan Pérez

!forzar Nombre - Forzar reenvío del mensaje de cumpleaños
  Ejemplo: !forzar Juan Pérez

!actualizar - Actualizar IDs de grupos`;
}

// Escuchar mensajes entrantes
client.on("message", async (msg) => {
  try {
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

    // 📋 Listar grupos
    if (text === "!grupos") {
      try {
        const chats = await client.getChats();
        const groups = chats.filter(c => c.isGroup);
        
        if (groups.length === 0) {
          msg.reply("📭 No estoy en ningún grupo.");
        } else {
          const groupList = groups
            .map((g, i) => `${i + 1}. ${g.name}\n   ID: ${g.id._serialized}`)
            .join("\n\n");
          msg.reply(`📋 *Grupos disponibles:*\n\n${groupList}`);
        }
      } catch (err) {
        msg.reply("❌ Error al listar grupos: " + err.message);
      }
    }

    // 🔄 Actualizar IDs de grupos
    if (text === "!actualizar") {
      msg.reply("🔄 Actualizando IDs de grupos...");
      try {
        const chats = await client.getChats();
        const groupChats = chats.filter(c => c.isGroup);
        
        let updated = 0;
        for (const birthday of birthdays) {
          const foundGroup = groupChats.find(c => 
            c.name && birthday.groupName && 
            c.name.trim().toLowerCase() === birthday.groupName.trim().toLowerCase()
          );
          
          if (foundGroup && birthday.groupId !== foundGroup.id._serialized) {
            birthday.groupId = foundGroup.id._serialized;
            updated++;
          }
        }
        
        if (updated > 0) {
          saveBirthdays();
          msg.reply(`✅ Se actualizaron ${updated} grupo(s)`);
        } else {
          msg.reply("✅ Todos los grupos están actualizados");
        }
      } catch (err) {
        msg.reply("❌ Error actualizando: " + err.message);
      }
    }

    // ✅ Agregar cumpleaños
    if (text.startsWith("!agregar")) {
      const parts = text.split(" ");
      if (parts.length < 3) {
        return msg.reply("❌ Formato incorrecto. Usá: !agregar DD-MM Nombre Apellido");
      }

      const date = parts[1];
      const name = parts.slice(2).join(" ");
      
      // Validar formato de fecha
      if (!/^\d{2}-\d{2}$/.test(date)) {
        return msg.reply("❌ Formato de fecha incorrecto. Usá: DD-MM (ejemplo: 17-10)");
      }

      const groupId = chat.id._serialized;
      const groupName = chat.name || "Chat individual";

      // Verificar duplicado
      const exists = birthdays.find(
        (b) =>
          b.date === date &&
          b.name.toLowerCase() === name.toLowerCase() &&
          b.groupId === groupId
      );
      
      if (exists) {
        return msg.reply("⚠️ Ese cumpleaños ya está registrado.");
      }

      // Agregar cumpleaños con estructura _meta inicializada
      const newBirthday = {
        name,
        date,
        groupId,
        groupName,
        _meta: {
          lastReminderYear: null
        }
      };

      birthdays.push(newBirthday);
      saveBirthdays();
      msg.reply(`✅ Cumpleaños agregado:\n🧍 ${name}\n📅 ${date}\n👥 ${groupName}\n⏳ Estado: Pendiente`);
    }

    // ✅ Listar cumpleaños del grupo actual
    if (text === "!listar") {
      const groupId = chat.id._serialized;
      const groupCumples = birthdays.filter((b) => b.groupId === groupId);
      const currentYear = moment().tz(TZ).year();

      if (groupCumples.length === 0) {
        msg.reply("📭 No hay cumpleaños registrados en este grupo.");
      } else {
        const list = groupCumples
          .sort((a, b) => {
            const [dayA, monthA] = a.date.split('-').map(Number);
            const [dayB, monthB] = b.date.split('-').map(Number);
            return monthA === monthB ? dayA - dayB : monthA - monthB;
          })
          .map((b) => {
            const lastYear = b._meta?.lastReminderYear;
            let statusEmoji = "⏳";
            let statusText = "";
            
            if (lastYear === currentYear) {
              statusEmoji = "✅";
              statusText = ` (enviado ${currentYear})`;
            } else if (lastYear && lastYear < currentYear) {
              statusEmoji = "⏳";
              statusText = ` (último: ${lastYear})`;
            }
            
            return `${statusEmoji} ${b.name} - ${b.date}${statusText}`;
          })
          .join("\n");
        
        const sentCount = groupCumples.filter(b => b._meta?.lastReminderYear === currentYear).length;
        const pendingCount = groupCumples.length - sentCount;
        
        msg.reply(`📅 *Cumpleaños del grupo* (${currentYear})\n\n${list}\n\n✅ Enviados: ${sentCount}\n⏳ Pendientes: ${pendingCount}`);
      }
    }

    // ✅ Borrar cumpleaños
    if (text.startsWith("!borrar")) {
      const rawName = text.slice(8).trim();
      
      if (!rawName) {
        return msg.reply("❌ Debes especificar un nombre. Ejemplo: !borrar Juan Pérez");
      }
      
      const searchName = rawName.toLowerCase();
      const groupId = chat.id._serialized;

      const found = birthdays.find(
        (b) => b.groupId === groupId && b.name.toLowerCase() === searchName
      );

      if (!found) {
        return msg.reply("❌ No se encontró ese nombre en este grupo.");
      }

      birthdays = birthdays.filter(
        (b) => !(b.groupId === groupId && b.name.toLowerCase() === searchName)
      );

      saveBirthdays();
      const displayGroupName = chat.name || found.groupName || "este grupo";
      msg.reply(`🗑️ Se eliminó el cumpleaños de ${found.name} en "${displayGroupName}".`);
    }

    // ✅ Forzar reenvío de cumpleaños
    if (text.startsWith("!forzar")) {
      const rawName = text.slice(8).trim();
      
      if (!rawName) {
        return msg.reply("❌ Debes especificar un nombre. Ejemplo: !forzar Juan Pérez");
      }
      
      const searchName = rawName.toLowerCase();
      const groupId = chat.id._serialized;

      const person = birthdays.find(
        (b) => b.groupId === groupId && b.name.toLowerCase() === searchName
      );

      if (!person) {
        return msg.reply("❌ No se encontró ese nombre en este grupo.");
      }

      try {
        // Resetear el año de recordatorio
        if (person._meta) {
          person._meta.lastReminderYear = null;
        }
        saveBirthdays();

        // Enviar el mensaje
        const text = person.message ? person.message : `🎉 ¡Feliz cumpleaños ${person.name}! 🎂🥳`;
        await chat.sendMessage(text);
        
        // Volver a marcar como enviado
        if (!person._meta) {
          person._meta = {};
        }
        person._meta.lastReminderYear = moment().tz(TZ).year();
        saveBirthdays();
        
        msg.reply(`✅ Mensaje de cumpleaños forzado para ${person.name}`);
      } catch (err) {
        console.error("❌ Error forzando mensaje:", err.message);
        msg.reply("❌ Error al enviar el mensaje. Ver logs para detalles.");
      }
    }
  } catch (err) {
    console.error("❌ Error procesando mensaje:", err.message);
  }
});

// Manejo de errores del cliente
client.on("disconnected", (reason) => {
  console.log("⚠️ Cliente desconectado:", reason);
  if (reason === "LOGOUT") {
    console.log("🔄 La sesión fue cerrada. Borra la carpeta 'session/' y vuelve a iniciar.");
  }
});

client.on("auth_failure", (msg) => {
  console.error("❌ Fallo en la autenticación:", msg);
  console.log("💡 Borra la carpeta 'session/' y vuelve a vincular el dispositivo.");
});

// Manejo correcto del cierre
process.on("SIGINT", async () => {
  console.log("\n🛑 Cerrando bot...");
  try {
    await client.destroy();
    console.log("✅ Bot cerrado correctamente");
    process.exit(0);
  } catch (err) {
    // Ignorar errores de archivos bloqueados (EBUSY) - son normales en Windows
    if (err.code === 'EBUSY' || err.message.includes('EBUSY')) {
      console.warn("⚠️ Algunos archivos de sesión están bloqueados, pero el bot se cerró.");
      process.exit(0);
    } else {
      console.error("❌ Error al cerrar:", err.message);
      process.exit(1);
    }
  }
});

client.initialize();