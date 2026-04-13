import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(path.join(DATA_DIR, "birthdays.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS birthdays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    group_id TEXT NOT NULL DEFAULT '',
    group_name TEXT NOT NULL DEFAULT '',
    message TEXT,
    last_reminder_year INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

function toLocal(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    date: row.date,
    groupId: row.group_id,
    groupName: row.group_name,
    message: row.message || undefined,
    _meta: { lastReminderYear: row.last_reminder_year || null },
  };
}

export function getBirthdays() {
  return db.prepare("SELECT * FROM birthdays ORDER BY substr(date,4,2), substr(date,1,2)").all().map(toLocal);
}

export function getBirthdaysByDate(date) {
  return db.prepare("SELECT * FROM birthdays WHERE date = ?").all(date).map(toLocal);
}

export function getBirthdaysByGroup(groupId) {
  return db.prepare("SELECT * FROM birthdays WHERE group_id = ? ORDER BY substr(date,4,2), substr(date,1,2)").all(groupId).map(toLocal);
}

export function getBirthdayById(id) {
  return toLocal(db.prepare("SELECT * FROM birthdays WHERE id = ?").get(id));
}

export function addBirthday({ name, date, groupId, groupName, message }) {
  const result = db.prepare(
    "INSERT INTO birthdays (name, date, group_id, group_name, message, last_reminder_year) VALUES (?, ?, ?, ?, ?, NULL)"
  ).run(name, date, groupId || "", groupName || "", message || null);
  return getBirthdayById(result.lastInsertRowid);
}

export function updateBirthday(id, fields) {
  const row = db.prepare("SELECT * FROM birthdays WHERE id = ?").get(id);
  if (!row) return null;

  const updated = {
    name: fields.name !== undefined ? fields.name : row.name,
    date: fields.date !== undefined ? fields.date : row.date,
    group_id: fields.groupId !== undefined ? fields.groupId : row.group_id,
    group_name: fields.groupName !== undefined ? fields.groupName : row.group_name,
    message: fields.message !== undefined ? (fields.message || null) : row.message,
    last_reminder_year: fields.lastReminderYear !== undefined ? fields.lastReminderYear : row.last_reminder_year,
  };

  db.prepare(
    "UPDATE birthdays SET name=?, date=?, group_id=?, group_name=?, message=?, last_reminder_year=? WHERE id=?"
  ).run(updated.name, updated.date, updated.group_id, updated.group_name, updated.message, updated.last_reminder_year, id);

  return getBirthdayById(id);
}

export function deleteBirthday(id) {
  db.prepare("DELETE FROM birthdays WHERE id = ?").run(id);
}

export function findBirthday(name, date, groupId) {
  return toLocal(
    db.prepare("SELECT * FROM birthdays WHERE lower(name)=lower(?) AND date=? AND group_id=?").get(name, date, groupId || "")
  );
}

export function findBirthdayByNameAndGroup(name, groupId) {
  return toLocal(
    db.prepare("SELECT * FROM birthdays WHERE lower(name)=lower(?) AND group_id=?").get(name, groupId)
  );
}

export function updateGroupIdByName(groupName, newGroupId) {
  db.prepare("UPDATE birthdays SET group_id=? WHERE lower(group_name)=lower(?)").run(newGroupId, groupName);
}

export function migrateFromJson(jsonPath) {
  if (!fs.existsSync(jsonPath)) return 0;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  } catch {
    return 0;
  }
  if (!Array.isArray(data) || data.length === 0) return 0;

  const existing = db.prepare("SELECT COUNT(*) as c FROM birthdays").get();
  if (existing.c > 0) return 0;

  const insert = db.prepare(
    "INSERT INTO birthdays (name, date, group_id, group_name, message, last_reminder_year) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const insertMany = db.transaction((items) => {
    for (const b of items) {
      insert.run(b.name, b.date, b.groupId || "", b.groupName || "", b.message || null, b._meta?.lastReminderYear || null);
    }
  });
  insertMany(data);
  return data.length;
}

export default db;
