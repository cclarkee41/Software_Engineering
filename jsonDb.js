// jsonDb.js
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

async function ensureDb() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  try { await fsp.access(DB_FILE, fs.constants.F_OK); }
  catch { await fsp.writeFile(DB_FILE, JSON.stringify({ users: [], tasks: [], messages: [] }, null, 2), "utf8"); }
}

async function readDb() {
  await ensureDb();
  const raw = await fsp.readFile(DB_FILE, "utf8");
  return JSON.parse(raw);
}

async function writeDb(db) {
  const tmp = DB_FILE + "." + process.pid + ".tmp";
  await fsp.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
  await fsp.rename(tmp, DB_FILE);
}

function uid() {
  return crypto.randomUUID?.() || crypto.randomBytes(16).toString("hex");
}

// Users
async function emailExists(email) {
  const db = await readDb();
  return db.users.some(u => (u.email || "").toLowerCase() === String(email).toLowerCase());
}
async function findUserByUsernameAndRole(username, role) {
  const db = await readDb();
  return db.users.find(u => u.username === username && u.role === role) || null;
}
async function createUser(user) {
  const db = await readDb();
  const now = new Date().toISOString();
  const rec = { id: uid(), createdAt: now, updatedAt: now, approved: false, ...user };
  db.users.push(rec);
  await writeDb(db);
  return rec;
}
async function updateUserByUsernameRole(username, role, patch) {
  const db = await readDb();
  const i = db.users.findIndex(u => u.username === username && u.role === role);
  if (i === -1) return null;
  db.users[i] = { ...db.users[i], ...patch, updatedAt: new Date().toISOString() };
  await writeDb(db);
  return db.users[i];
}
async function deleteUserByUsernameRole(username, role) {
  const db = await readDb();
  const before = db.users.length;
  db.users = db.users.filter(u => !(u.username === username && u.role === role));
  await writeDb(db);
  return before - db.users.length;
}
async function listUsers() {
  const db = await readDb();
  return db.users;
}
async function countNewUsersInCurrentMonth() {
  const db = await readDb();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return db.users.filter(u => {
    const t = new Date(u.createdAt);
    return t >= start && t < end;
  }).length;
}

// Tasks
async function createTask(task) {
  const db = await readDb();
  const rec = { id: uid(), createdAt: new Date().toISOString(), ...task };
  db.tasks.push(rec);
  await writeDb(db);
  return rec;
}
async function listTasks() {
  const db = await readDb();
  return db.tasks.slice().sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
}
async function listTasksByUsername(username) {
  const db = await readDb();
  return db.tasks.filter(t=>t.username===username).sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt));
}
async function deleteTasksByUsername(username) {
  const db = await readDb();
  const before = db.tasks.length;
  db.tasks = db.tasks.filter(t => t.username !== username);
  await writeDb(db);
  return before - db.tasks.length;
}
async function countTasks() {
  const db = await readDb();
  return db.tasks.length;
}

// Messages
async function listMessages() {
  const db = await readDb();
  return db.messages;
}
async function countMessages() {
  const db = await readDb();
  return db.messages.length;
}

module.exports = {
  emailExists, findUserByUsernameAndRole, createUser, updateUserByUsernameRole, deleteUserByUsernameRole, listUsers, countNewUsersInCurrentMonth,
  createTask, listTasks, listTasksByUsername, deleteTasksByUsername, countTasks,
  listMessages, countMessages
};
