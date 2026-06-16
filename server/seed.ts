// Dealer seeding from importdealers.txt. Used both by the CLI
// (server/import-dealers.ts) and on server startup (server/bootstrap.ts) so a
// fresh cloud database gets populated in the running process against the real
// (disk-mounted) database. Idempotent: existing emails are skipped.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, type UserRow } from './db.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Default location of the export file (repo root). */
export const DEFAULT_IMPORT_PATH = path.join(here, '..', 'importdealers.txt');

/** Minimal RFC-4180-ish CSV parser (handles quoted fields with commas). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (field !== '' || row.length > 0) {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      }
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export interface ImportResult {
  added: number;
  skipped: number;
  admins: number;
}

/**
 * Import dealers from the given file into the users table. Returns counts.
 * Returns null (with a warning) if the file is missing.
 */
export function importDealers(srcPath: string = DEFAULT_IMPORT_PATH): ImportResult | null {
  if (!fs.existsSync(srcPath)) {
    console.warn(`[seed] import file not found at ${srcPath} — skipping dealer import.`);
    return null;
  }

  let raw = fs.readFileSync(srcPath, 'utf8');
  // The export has no row delimiters: records are separated by a space, each
  // beginning with `<id>,` right after the previous record's quoted timestamp.
  // Insert a newline at every `"<space><digits>,` boundary so the parser can
  // split rows. (No-op on a normally line-delimited file.)
  if (!raw.includes('\n')) {
    raw = raw.replace(/"\s+(\d+,)/g, '"\n$1');
  }
  const rows = parseCsv(raw);
  const header = rows.shift();
  if (!header) {
    console.warn('[seed] empty import file.');
    return { added: 0, skipped: 0, admins: 0 };
  }

  const getByEmail = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)');
  const insert = db.prepare(`
    INSERT INTO users (name, email, role, company_name, company_slogan, address, phone, password_hash, active, created_at, updated_at)
    VALUES (@name, @email, @role, @company_name, @company_slogan, @address, @phone, @password_hash, 1, @created_at, @updated_at)
  `);
  const promote = db.prepare("UPDATE users SET role = 'admin' WHERE id = ?");

  let added = 0;
  let skipped = 0;
  let admins = 0;

  const tx = db.transaction(() => {
    for (const cols of rows) {
      // ID,Name,Email,Group,Company Name,Company Slogan,Address,Phone,Password,EmailVerifiedAt,CreatedAt,UpdatedAt
      const [, name, email, group, companyName, slogan, address, phone, hash, , createdAt, updatedAt] = cols;
      if (!email || !hash) continue;
      const role = group?.trim().toLowerCase() === 'dealer' ? 'dealer' : 'admin';
      const existing = getByEmail.get(email.trim()) as UserRow | undefined;
      if (existing) {
        if (role === 'admin' && existing.role !== 'admin') {
          promote.run(existing.id);
          admins++;
        }
        skipped++;
        continue;
      }
      insert.run({
        name: (name || email).trim(),
        email: email.trim(),
        role,
        company_name: (companyName || '').trim(),
        company_slogan: (slogan || '').trim(),
        address: (address || '').trim(),
        // strip the trailing underscore some phone numbers carry in the export
        phone: (phone || '').replace(/_+$/, '').trim(),
        password_hash: hash.trim(),
        created_at: (createdAt || '').trim() || undefined,
        updated_at: (updatedAt || '').trim() || undefined,
      });
      if (role === 'admin') admins++;
      added++;
    }
  });

  tx();
  return { added, skipped, admins };
}
