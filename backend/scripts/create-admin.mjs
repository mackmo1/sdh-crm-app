#!/usr/bin/env node
/**
 * Creates the initial CRM administrator.
 *
 * There are deliberately no default credentials: the name, email and password
 * must be supplied, either through the environment or interactively.
 *
 *   CRM_ADMIN_NAME="Admin" CRM_ADMIN_EMAIL=admin@example.com \
 *   CRM_ADMIN_PASSWORD='...' npm run admin:create
 *
 * Optional: CRM_ADMIN_MODULE = all | lead | property   (default: all)
 */
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const ARGON2ID = 2;
const MODULES = new Set(['all', 'lead', 'property']);

function loadDotEnv() {
  if (process.env.DATABASE_URL) return;
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  try {
    const contents = readFileSync(join(root, '.env'), 'utf8');
    for (const line of contents.split('\n')) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) continue;
      if (process.env[match[1]] !== undefined) continue;
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    // No .env file: rely on the ambient environment.
  }
}

function prompt(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function promptHidden(question) {
  return new Promise((resolve) => {
    const muted = new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    });
    const rl = createInterface({ input: process.stdin, output: muted, terminal: true });
    process.stdout.write(question);
    rl.question('', (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

async function main() {
  loadDotEnv();

  if (!process.env.DATABASE_URL) {
    fail('DATABASE_URL is not set. Configure backend/.env before creating an admin.');
  }

  const name = process.env.CRM_ADMIN_NAME || (await prompt('Administrator name: '));
  const email = (process.env.CRM_ADMIN_EMAIL || (await prompt('Administrator email: ')))
    .trim()
    .toLowerCase();
  const password =
    process.env.CRM_ADMIN_PASSWORD ||
    (await promptHidden('Password (hidden): '));
  const moduleName = (process.env.CRM_ADMIN_MODULE || 'all').trim();

  if (!name) fail('A name is required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('A valid email address is required.');
  if (password.length < 8) fail('The password must be at least 8 characters long.');
  if (!MODULES.has(moduleName)) fail(`CRM_ADMIN_MODULE must be one of: ${[...MODULES].join(', ')}`);

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.crmUser.findUnique({ where: { email } });
    if (existing) {
      fail(`An account already exists for ${email}. Use the password reset flow instead.`);
    }

    const passwordHash = await hash(password, {
      algorithm: ARGON2ID,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.crmUser.create({
        data: {
          name,
          email,
          module: moduleName,
          role: 'admin',
          active: true,
        },
      });
      await tx.crmUserCredential.create({
        data: { crm_user_id: user.id, password_hash: passwordHash },
      });
      return user;
    });

    console.log(`\n✔ Administrator created: ${created.email} (${created.id})\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
