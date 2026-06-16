// CLI: import dealers from importdealers.txt into the users table.
// Preserves existing bcrypt hashes; the "Regular" group account becomes admin,
// the rest dealers. Idempotent — existing emails are skipped.
//
// Usage:  npm run import-dealers
//         npm run import-dealers -- ../importdealers.txt   (custom path)
import path from 'node:path';
import { importDealers, DEFAULT_IMPORT_PATH } from './seed.ts';

const fileArg = process.argv[2];
const srcPath = fileArg ? path.resolve(process.cwd(), fileArg) : DEFAULT_IMPORT_PATH;

const result = importDealers(srcPath);
if (!result) process.exit(1);

console.log(`Imported ${result.added} new user(s), skipped ${result.skipped} existing. Admins: ${result.admins}.`);
console.log('Existing passwords are preserved; the "Regular" group account is the admin.');
