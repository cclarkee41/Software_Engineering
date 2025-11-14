// authUtil.js
const bcrypt = require("bcryptjs");
async function hashPassword(plain) {
  const saltRounds = 10;
  return bcrypt.hash(plain, saltRounds);
}
async function verifyPassword(plain, hashed) {
  return bcrypt.compare(plain, hashed);
}
module.exports = { hashPassword, verifyPassword };
