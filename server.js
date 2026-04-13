import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import moment from "moment-timezone";

import {
  getBirthdays,
  getBirthdaysByGroup,
  getBirthdayById,
  addBirthday,
  updateBirthday,
  deleteBirthday,
  findBirthday,
} from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

export function startWebServer(getWaState, TZ) {
  const app = express();

  app.use(express.json());
  app.use(express.static(path.join(__dirname, "public")));

  app.get("/api/status", (req, res) => {
    const wa = getWaState();
    res.json({ connected: wa?.isReady ?? false });
  });

  app.get("/api/birthdays", (req, res) => {
    try {
      const { groupId } = req.query;
      const data = groupId ? getBirthdaysByGroup(groupId) : getBirthdays();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/birthdays", (req, res) => {
    try {
      const { name, date, groupId, groupName, message } = req.body;
      if (!name || !date) return res.status(400).json({ error: "name y date son requeridos" });
      if (!/^\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "Formato de fecha invalido, usar DD-MM" });

      const exists = findBirthday(name, date, groupId || "");
      if (exists) return res.status(409).json({ error: "Ese cumpleanos ya esta registrado" });

      const created = addBirthday({ name: name.trim(), date: date.trim(), groupId: groupId || "", groupName: groupName || "", message: message || undefined });
      res.status(201).json(created);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/birthdays/:id", (req, res) => {
    try {
      const { id } = req.params;
      const existing = getBirthdayById(id);
      if (!existing) return res.status(404).json({ error: "No encontrado" });

      const { name, date, groupId, groupName, message } = req.body;
      if (date && !/^\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "Formato de fecha invalido, usar DD-MM" });

      const fields = {};
      if (name !== undefined) fields.name = name.trim();
      if (date !== undefined) fields.date = date.trim();
      if (groupId !== undefined) fields.groupId = groupId;
      if (groupName !== undefined) fields.groupName = groupName;
      if (message !== undefined) fields.message = message || null;

      const updated = updateBirthday(id, fields);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/birthdays/:id", (req, res) => {
    try {
      const { id } = req.params;
      const existing = getBirthdayById(id);
      if (!existing) return res.status(404).json({ error: "No encontrado" });
      deleteBirthday(id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/birthdays/:id/reset", (req, res) => {
    try {
      const { id } = req.params;
      const existing = getBirthdayById(id);
      if (!existing) return res.status(404).json({ error: "No encontrado" });
      const updated = updateBirthday(id, { lastReminderYear: null });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/birthdays/:id/force", async (req, res) => {
    try {
      const { id } = req.params;
      const person = getBirthdayById(id);
      if (!person) return res.status(404).json({ error: "No encontrado" });

      const wa = getWaState();
      if (!wa?.isReady) return res.status(503).json({ error: "WhatsApp no esta conectado" });

      const chats = await wa.client.getChats();
      const chat = chats.find(c => c.id._serialized === person.groupId && c.isGroup);
      if (!chat) return res.status(404).json({ error: "Grupo no encontrado en WhatsApp" });

      const text = person.message || `Feliz cumpleanos ${person.name}!`;
      await chat.sendMessage(text);

      const year = moment().tz(TZ).year();
      const updated = updateBirthday(id, { lastReminderYear: year });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/groups", async (req, res) => {
    try {
      const wa = getWaState();
      if (!wa?.isReady) return res.json([]);
      const chats = await wa.client.getChats();
      const groups = chats.filter(c => c.isGroup).map(c => ({ id: c.id._serialized, name: c.name }));
      res.json(groups);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  });

  app.listen(PORT, () => {
    console.log(`Web UI disponible en http://localhost:${PORT}`);
  });

  return app;
}
