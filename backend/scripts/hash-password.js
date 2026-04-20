#!/usr/bin/env node
/**
 * Utility — prints a bcrypt hash of a plaintext password.
 * Usage:  node backend/scripts/hash-password.js "MyPassword#2026"
 */

const bcrypt = require('bcrypt');

const pw = process.argv[2];
if (!pw) {
  console.error('Usage: node scripts/hash-password.js "<plaintext>"');
  process.exit(1);
}
const rounds = Number(process.env.BCRYPT_SALT_ROUNDS || 12);
console.log(bcrypt.hashSync(pw, rounds));
