// Set/reset a user's password from the command line. Handy for first admin
// login after importing dealers (their hashes are preserved, but if you don't
// know a password you can set one here).
//
// Usage:  npm run set-password -- <email> <newpassword>
import { db, type UserRow } from './db.ts';
import { hashPassword } from './auth.ts';

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: npm run set-password -- <email> <newpassword>');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

const user = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(email) as UserRow | undefined;
if (!user) {
  console.error(`No user found with email ${email}.`);
  process.exit(1);
}

db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(
  hashPassword(password),
  user.id
);
console.log(`Password updated for ${user.name} <${user.email}> (role: ${user.role}).`);
