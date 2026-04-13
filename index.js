import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode-terminal";
import cron from "node-cron";
import moment from "moment-timezone";
import path from "path";
import { fileURLToPath } from "url";

import {
  getBirthdays,
  getBirthdaysByDate,
  getBirthdaysByGroup,
  addBirthday,
  updateBirthday,
  deleteBirthday,
  findBirthday,
  findBirthdayByNameAndGroup,
  updateGroupIdByName,
  migrateFromJson,
} from "./db.js";

import { startWebServer } from "./server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TZ = "America/Argentina/Buenos_Aires";

const migrated = migrateFromJson(path.join(__dirname, "birthdays.json"));
if (migrated > 0) {
  console.log(`Migrados ${migrated} registros desde birthdays.json a SQLite`);
}

let waClient = null;
let waReady = false;

startWebServer(() => ({ client: waClient, isReady: waReady }), TZ);

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: "./session" }),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

waClient = client;

client.on("qr", (qr) => {
  console.log("Escaneá este QR con tu WhatsApp:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", async () => {
  console.log("Bot conectado y listo.");
  waReady = true;

  updateAllGroupIds();

  setTimeout(async () => {
    try {
      await checkBirthdays();
    } catch (err) {
      console.error("Error en comprobacion inicial:", err.message);
    }
  }, 5000);

  cron.schedule("0 0 * * *", () => checkBirthdays(), { timezone: TZ });
});

client.on("disconnected", (reason) => {
  console.log("Cliente desconectado:", reason);
  waReady = false;
  if (reason === "LOGOUT") {
    console.log("Borra la carpeta 'session/' y vuelve a iniciar para re-vincular.");
  }
});

client.on("auth_failure", (msg) => {
  console.error("Fallo en la autenticacion:", msg);
  waReady = false;
});

async function checkBirthdays(testDate, testYear) {
  const today = testDate || moment().tz(TZ).format("DD-MM");
  const currentYear = testYear || moment().tz(TZ).year();
  console.log(`Revisando cumpleanos del ${today} (año ${currentYear})`);

  const list = getBirthdaysByDate(today);

  for (const person of list) {
    try {
      if (person._meta?.lastReminderYear === currentYear) {
        console.log(`Ya enviado para ${person.name} en ${currentYear}, saltando.`);
        continue;
      }

      const chat = await getGroupChat(person);
      if (!chat) {
        console.warn(`Grupo no encontrado para ${person.name} (${person.groupName})`);
        continue;
      }

      const text = person.message || `Feliz cumpleanos ${person.name}!`;
      await chat.sendMessage(text);

      updateBirthday(person.id, { lastReminderYear: currentYear });
      console.log(`Mensaje enviado a ${person.name} en ${person.groupName}`);
    } catch (err) {
      console.error(`Error enviando a ${person.name}:`, err.message);
    }
  }
}

async function updateAllGroupIds() {
  console.log("Actualizando IDs de grupos...");
  try {
    const chats = await client.getChats();
    const groups = chats.filter(c => c.isGroup);
    for (const g of groups) {
      updateGroupIdByName(g.name, g.id._serialized);
    }
    console.log(`${groups.length} grupos actualizados`);
  } catch (err) {
    console.error("Error actualizando grupos:", err.message);
  }
}

async function getGroupChat(person) {
  try {
    const chats = await client.getChats();
    if (person.groupId) {
      const found = chats.find(c => c.id._serialized === person.groupId && c.isGroup);
      if (found) return found;
    }
    if (person.groupName) {
      const found = chats.find(c => c.isGroup && c.name?.trim().toLowerCase() === person.groupName.trim().toLowerCase());
      if (found) {
        updateGroupIdByName(person.groupName, found.id._serialized);
        return found;
      }
    }
    return null;
  } catch (err) {
    console.error("Error obteniendo chat:", err.message);
    return null;
  }
}

client.on("message", async (msg) => {
  try {
    const chat = await msg.getChat();
    const text = msg.body.trim();
    const currentYear = moment().tz(TZ).year();

    if (text === "!ping") {
      msg.reply("Estoy activo!");
      return;
    }

    if (text === "!help" || text === "!ayuda") {
      msg.reply(getHelpText());
      return;
    }

    if (text === "!grupos") {
      const chats = await client.getChats();
      const groups = chats.filter(c => c.isGroup);
      if (groups.length === 0) {
        msg.reply("No estoy en ningun grupo.");
      } else {
        const list = groups.map((g, i) => `${i + 1}. ${g.name}\n   ID: ${g.id._serialized}`).join("\n\n");
        msg.reply(`Grupos disponibles:\n\n${list}`);
      }
      return;
    }

    if (text === "!actualizar") {
      msg.reply("Actualizando IDs de grupos...");
      await updateAllGroupIds();
      msg.reply("Grupos actualizados.");
      return;
    }

    if (text.startsWith("!agregar")) {
      const parts = text.split(" ");
      if (parts.length < 3) return msg.reply("Formato: !agregar DD-MM Nombre");
      const date = parts[1];
      const name = parts.slice(2).join(" ");
      if (!/^\d{2}-\d{2}$/.test(date)) return msg.reply("Fecha invalida. Usar DD-MM (ej: 17-10)");
      const groupId = chat.id._serialized;
      const groupName = chat.name || "Chat individual";
      if (findBirthday(name, date, groupId)) return msg.reply("Ese cumpleanos ya esta registrado.");
      addBirthday({ name, date, groupId, groupName });
      msg.reply(`Cumpleanos agregado:\n${name} - ${date}\n${groupName}`);
      return;
    }

    if (text === "!listar") {
      const groupId = chat.id._serialized;
      const list = getBirthdaysByGroup(groupId);
      if (list.length === 0) {
        msg.reply("No hay cumpleanos en este grupo.");
        return;
      }
      const sentCount = list.filter(b => b._meta?.lastReminderYear === currentYear).length;
      const lines = list.map(b => {
        const sent = b._meta?.lastReminderYear === currentYear;
        return `${sent ? "OK" : "..."} ${b.name} - ${b.date}${sent ? ` (enviado ${currentYear})` : ""}`;
      }).join("\n");
      msg.reply(`Cumpleanos del grupo (${currentYear})\n\n${lines}\n\nEnviados: ${sentCount} / Pendientes: ${list.length - sentCount}`);
      return;
    }

    if (text.startsWith("!borrar")) {
      const rawName = text.slice(8).trim();
      if (!rawName) return msg.reply("Ejemplo: !borrar Juan Perez");
      const found = findBirthdayByNameAndGroup(rawName, chat.id._serialized);
      if (!found) return msg.reply("No se encontro ese nombre en este grupo.");
      deleteBirthday(found.id);
      msg.reply(`Eliminado el cumpleanos de ${found.name}.`);
      return;
    }

    if (text.startsWith("!forzar")) {
      const rawName = text.slice(8).trim();
      if (!rawName) return msg.reply("Ejemplo: !forzar Juan Perez");
      const person = findBirthdayByNameAndGroup(rawName, chat.id._serialized);
      if (!person) return msg.reply("No se encontro ese nombre en este grupo.");
      try {
        const messageText = person.message || `Feliz cumpleanos ${person.name}!`;
        await chat.sendMessage(messageText);
        updateBirthday(person.id, { lastReminderYear: currentYear });
        msg.reply(`Mensaje enviado para ${person.name}.`);
      } catch (err) {
        console.error("Error forzando mensaje:", err.message);
        msg.reply("Error al enviar el mensaje.");
      }
      return;
    }
  } catch (err) {
    console.error("Error procesando mensaje:", err.message);
  }
});

process.on("SIGINT", async () => {
  console.log("\nCerrando bot...");
  try {
    await client.destroy();
    process.exit(0);
  } catch (err) {
    if (err.code === "EBUSY" || err.message?.includes("EBUSY")) {
      process.exit(0);
    }
    console.error("Error al cerrar:", err.message);
    process.exit(1);
  }
});

function getHelpText() {
  return `*Comandos - Bot Cumpleanos*

!ping - Estado del bot
!help / !ayuda - Este mensaje
!grupos - Ver grupos disponibles
!agregar DD-MM Nombre - Agregar cumpleanos
!listar - Ver cumpleanos del grupo
!borrar Nombre - Eliminar cumpleanos
!forzar Nombre - Forzar envio
!actualizar - Actualizar IDs de grupos`;
}

client.initialize();
