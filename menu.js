import readline from "readline";
import fs from "fs";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode-terminal";

const FILE = "./birthdays.json";

// Cargar cumpleaños desde archivo
let birthdays = [];
if (fs.existsSync(FILE)) {
  birthdays = JSON.parse(fs.readFileSync(FILE, "utf-8"));
}

// Guardar cumpleaños
function saveBirthdays() {
  fs.writeFileSync(FILE, JSON.stringify(birthdays, null, 2));
  console.log("✅ Datos guardados correctamente.");
}

// Configurar readline para entrada de consola
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Función para hacer preguntas
function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

// Cliente de WhatsApp
let client;
let clientReady = false;

// Inicializar cliente
function initClient() {
  return new Promise((resolve) => {
    client = new Client({
      authStrategy: new LocalAuth({ dataPath: "./session" }),
      puppeteer: {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      },
    });

    client.on("qr", (qr) => {
      console.log("\n📱 Escaneá este QR con tu WhatsApp:");
      qrcode.generate(qr, { small: true });
    });

    client.on("ready", () => {
      console.log("✅ WhatsApp conectado correctamente.\n");
      clientReady = true;
      resolve();
    });

    client.on("auth_failure", (msg) => {
      console.error("❌ Fallo en la autenticación:", msg);
      process.exit(1);
    });

    client.initialize();
  });
}

// Obtener lista de grupos
async function getGroups() {
  if (!clientReady) {
    console.log("⚠️ WhatsApp no está conectado aún.");
    return [];
  }

  const chats = await client.getChats();
  const groups = chats.filter((chat) => chat.isGroup);
  return groups;
}

// Mostrar menú principal
function showMenu() {
  console.log("\n╔════════════════════════════════════════╗");
  console.log("║   🎂 GESTIÓN DE CUMPLEAÑOS - MENÚ    ║");
  console.log("╚════════════════════════════════════════╝");
  console.log("1. 📋 Listar todos los cumpleaños");
  console.log("2. ➕ Agregar nuevo cumpleaños");
  console.log("3. ✏️  Actualizar cumpleaños existente");
  console.log("4. 🗑️  Eliminar cumpleaños");
  console.log("5. 👥 Ver grupos disponibles");
  console.log("6. 🚪 Salir");
  console.log("═══════════════════════════════════════════\n");
}

// Listar cumpleaños
function listBirthdays() {
  console.log("\n📅 LISTA DE CUMPLEAÑOS:\n");
  
  if (birthdays.length === 0) {
    console.log("📭 No hay cumpleaños registrados.\n");
    return;
  }

  // Agrupar por grupo
  const byGroup = {};
  birthdays.forEach((b) => {
    const groupName = b.groupName || "Sin grupo";
    if (!byGroup[groupName]) {
      byGroup[groupName] = [];
    }
    byGroup[groupName].push(b);
  });

  Object.keys(byGroup).forEach((groupName) => {
    console.log(`\n👥 ${groupName}:`);
    console.log("─────────────────────────────────────");
    
    byGroup[groupName]
      .sort((a, b) => {
        const [dayA, monthA] = a.date.split("-").map(Number);
        const [dayB, monthB] = b.date.split("-").map(Number);
        return monthA === monthB ? dayA - dayB : monthA - monthB;
      })
      .forEach((b, index) => {
        const status = b._meta?.lastReminderYear 
          ? `✅ (enviado ${b._meta.lastReminderYear})`
          : "⏳ (pendiente)";
        console.log(`  ${index + 1}. ${b.name} - ${b.date} ${status}`);
        if (b.message) {
          console.log(`     💬 "${b.message}"`);
        }
      });
  });
  
  console.log("\n");
}

// Agregar cumpleaños
async function addBirthday() {
  console.log("\n➕ AGREGAR NUEVO CUMPLEAÑOS\n");

  const groups = await getGroups();
  if (groups.length === 0) {
    console.log("⚠️ No hay grupos disponibles. Asegurate de estar conectado a WhatsApp.\n");
    return;
  }

  console.log("Grupos disponibles:");
  groups.forEach((group, index) => {
    console.log(`${index + 1}. ${group.name}`);
  });

  const groupIndex = await question("\nNúmero del grupo: ");
  const selectedGroup = groups[parseInt(groupIndex) - 1];

  if (!selectedGroup) {
    console.log("❌ Grupo inválido.\n");
    return;
  }

  const name = await question("Nombre completo: ");
  const date = await question("Fecha (DD-MM): ");

  // Validar formato de fecha
  if (!/^\d{2}-\d{2}$/.test(date)) {
    console.log("❌ Formato de fecha incorrecto. Debe ser DD-MM (ejemplo: 17-10)\n");
    return;
  }

  const customMessage = await question("Mensaje personalizado (opcional, Enter para omitir): ");

  // Verificar duplicado
  const exists = birthdays.find(
    (b) =>
      b.date === date &&
      b.name.toLowerCase() === name.toLowerCase() &&
      b.groupId === selectedGroup.id._serialized
  );

  if (exists) {
    console.log("⚠️ Ese cumpleaños ya está registrado.\n");
    return;
  }

  const newBirthday = {
    name: name.trim(),
    date: date.trim(),
    groupId: selectedGroup.id._serialized,
    groupName: selectedGroup.name,
    _meta: {
      lastReminderYear: null,
    },
  };

  if (customMessage.trim()) {
    newBirthday.message = customMessage.trim();
  }

  birthdays.push(newBirthday);
  saveBirthdays();

  console.log(`\n✅ Cumpleaños agregado exitosamente:`);
  console.log(`   🧍 ${name}`);
  console.log(`   📅 ${date}`);
  console.log(`   👥 ${selectedGroup.name}\n`);
}

// Actualizar cumpleaños
async function updateBirthday() {
  console.log("\n✏️  ACTUALIZAR CUMPLEAÑOS\n");

  if (birthdays.length === 0) {
    console.log("📭 No hay cumpleaños registrados.\n");
    return;
  }

  console.log("Cumpleaños registrados:");
  birthdays.forEach((b, index) => {
    console.log(`${index + 1}. ${b.name} - ${b.date} (${b.groupName})`);
  });

  const index = await question("\nNúmero del cumpleaños a actualizar: ");
  const selectedIndex = parseInt(index) - 1;

  if (selectedIndex < 0 || selectedIndex >= birthdays.length) {
    console.log("❌ Número inválido.\n");
    return;
  }

  const birthday = birthdays[selectedIndex];

  console.log(`\nActualizando: ${birthday.name} - ${birthday.date}`);
  console.log("(Dejá en blanco para mantener el valor actual)\n");

  const newName = await question(`Nuevo nombre [${birthday.name}]: `);
  const newDate = await question(`Nueva fecha [${birthday.date}]: `);
  const newMessage = await question(`Nuevo mensaje [${birthday.message || "sin mensaje"}]: `);

  if (newName.trim()) {
    birthday.name = newName.trim();
  }

  if (newDate.trim()) {
    if (!/^\d{2}-\d{2}$/.test(newDate)) {
      console.log("❌ Formato de fecha incorrecto.\n");
      return;
    }
    birthday.date = newDate.trim();
  }

  if (newMessage.trim()) {
    birthday.message = newMessage.trim();
  } else if (newMessage === "") {
    delete birthday.message;
  }

  saveBirthdays();
  console.log("\n✅ Cumpleaños actualizado exitosamente.\n");
}

// Eliminar cumpleaños
async function deleteBirthday() {
  console.log("\n🗑️  ELIMINAR CUMPLEAÑOS\n");

  if (birthdays.length === 0) {
    console.log("📭 No hay cumpleaños registrados.\n");
    return;
  }

  console.log("Cumpleaños registrados:");
  birthdays.forEach((b, index) => {
    console.log(`${index + 1}. ${b.name} - ${b.date} (${b.groupName})`);
  });

  const index = await question("\nNúmero del cumpleaños a eliminar: ");
  const selectedIndex = parseInt(index) - 1;

  if (selectedIndex < 0 || selectedIndex >= birthdays.length) {
    console.log("❌ Número inválido.\n");
    return;
  }

  const birthday = birthdays[selectedIndex];
  const confirm = await question(
    `\n⚠️  ¿Estás seguro de eliminar "${birthday.name}"? (s/n): `
  );

  if (confirm.toLowerCase() === "s" || confirm.toLowerCase() === "si") {
    birthdays.splice(selectedIndex, 1);
    saveBirthdays();
    console.log("\n✅ Cumpleaños eliminado exitosamente.\n");
  } else {
    console.log("\n❌ Operación cancelada.\n");
  }
}

// Ver grupos
async function viewGroups() {
  console.log("\n👥 GRUPOS DISPONIBLES:\n");

  const groups = await getGroups();
  if (groups.length === 0) {
    console.log("⚠️ No hay grupos disponibles.\n");
    return;
  }

  groups.forEach((group, index) => {
    console.log(`${index + 1}. ${group.name}`);
    console.log(`   ID: ${group.id._serialized}`);
  });

  console.log("\n");
}

// Loop del menú
async function menuLoop() {
  let running = true;

  while (running) {
    showMenu();
    const option = await question("Seleccioná una opción: ");

    switch (option.trim()) {
      case "1":
        listBirthdays();
        break;
      case "2":
        await addBirthday();
        break;
      case "3":
        await updateBirthday();
        break;
      case "4":
        await deleteBirthday();
        break;
      case "5":
        await viewGroups();
        break;
      case "6":
        console.log("\n👋 ¡Hasta luego!\n");
        running = false;
        break;
      default:
        console.log("\n❌ Opción inválida. Intentá de nuevo.\n");
    }
  }

  rl.close();
  if (client) {
    try {
      await client.destroy();
    } catch (err) {
      // Ignorar errores de archivos bloqueados - son normales en Windows
      if (!err.code || err.code !== 'EBUSY') {
        console.error("⚠️ Error al cerrar cliente:", err.message);
      }
    }
  }
  process.exit(0);
}

// Iniciar aplicación
console.log("🚀 Iniciando sistema de gestión de cumpleaños...\n");
console.log("⏳ Conectando a WhatsApp...");

initClient().then(() => {
  menuLoop();
});