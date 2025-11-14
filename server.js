// server.js — JSON storage version
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const { hashPassword, verifyPassword } = require('./authUtil');
const db = require('./jsonDb');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ----- User Routes -----
app.post('/api/signup', async (req, res) => {
  const { username, email, password, confirmPassword, role } = req.body;
  if (!username || !email || !password || !confirmPassword || !role) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match' });
  }
  if (!['Customer', 'Worker', 'Admin'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role selected' });
  }
  try {
    const exists = await db.emailExists(email);
    if (exists) return res.status(409).json({ message: 'Email already registered' });
    const hashedPassword = await hashPassword(password);
    await db.createUser({ username, email, password: hashedPassword, role, approved: false });
    return res.status(201).json({ message: 'Signup successful' });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ message: 'Missing login credentials.' });
  }
  try {
    const user = await db.findUserByUsernameAndRole(username, role);
    if (!user) return res.status(401).json({ message: 'Invalid username or password.' });
    const isMatch = await verifyPassword(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid username or password.' });
    if (!user.approved) {
      return res.status(403).json({ message: 'Your account is pending admin approval.' });
    }
    return res.status(200).json({ message: 'Login successful' });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Server error during login' });
  }
});

app.post('/api/approve', async (req, res) => {
  const { username, role, approved } = req.body;
  if (!username || !role || typeof approved !== 'boolean') {
    return res.status(400).json({ message: 'Missing or invalid fields.' });
  }
  try {
    const user = await db.findUserByUsernameAndRole(username, role);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    await db.updateUserByUsernameRole(username, role, { approved });
    return res.status(200).json({ message: `User ${approved ? 'approved' : 'rejected'}` });
  } catch (err) {
    console.error('Approval update error:', err);
    return res.status(500).json({ message: 'Server error while updating approval.' });
  }
});

app.post('/api/user-orders', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ message: 'Username is required' });
  try {
    const orders = await db.listTasksByUsername(username);
    return res.status(200).json(orders);
  } catch (err) {
    console.error('Error fetching user orders:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/profile', async (req, res) => {
  const { username, role } = req.body;
  if (!username || !role) {
    return res.status(400).json({ message: 'Missing username or role' });
  }
  try {
    const user = await db.findUserByUsernameAndRole(username, role);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const { password, ...userData } = user;
    return res.status(200).json(userData);
  } catch (err) {
    console.error('Profile fetch error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Task routes
app.post('/api/task', async (req, res) => {
  const { taskTitle, description, budget, location, date, time, username } = req.body;
  if (!taskTitle || !description || !location) {
    return res.status(400).json({ message: 'Missing required fields.' });
  }
  try {
    await db.createTask({ taskTitle, description, budget, location, date, time, username });
    return res.status(201).json({ message: 'Task saved.' });
  } catch (err) {
    console.error('Error saving task:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await db.listTasks();
    return res.status(200).json(tasks);
  } catch (err) {
    console.error('Error fetching tasks:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// Admin routes
app.get('/api/users', async (req, res) => {
  try {
    const users = await db.listUsers();
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/users', async (req, res) => {
  const { username, role } = req.body;
  if (!username || !role) return res.status(400).json({ message: 'Missing username or role' });
  try {
    const deleted = await db.deleteUserByUsernameRole(username, role);
    if (!deleted) return res.status(404).json({ message: 'User not found' });
    const tasksDeleted = await db.deleteTasksByUsername(username);
    res.status(200).json({ message: `User deleted. ${tasksDeleted} task(s) also removed.` });
  } catch (err) {
    console.error('Error deleting user and tasks:', err);
    res.status(500).json({ message: 'Server error during user deletion' });
  }
});

app.get('/api/messages', async (req, res) => {
  try {
    const messages = await db.listMessages();
    res.json(messages);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/summary', async (req, res) => {
  try {
    const users = await db.listUsers();
    const taskCount = await db.countTasks();
    const messageCount = await db.countMessages();
    res.json({ userCount: users.length, requestCount: taskCount, messageCount, reportCount: 2 });
  } catch (err) {
    console.error('Error fetching summary:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/new-users-month', async (req, res) => {
  try {
    const count = await db.countNewUsersInCurrentMonth();
    res.json({ count });
  } catch (err) {
    console.error('Error counting new users:', err);
    res.status(500).json({ message: 'Error generating report' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/index.html`);
});
