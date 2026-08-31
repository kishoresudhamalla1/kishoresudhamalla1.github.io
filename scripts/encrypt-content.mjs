#!/usr/bin/env node
// Encrypts a plaintext file into the { salt, iv, ciphertext } blob shape
// consumed by src/lib/crypto.ts + PasswordGate. Run:
//
//   npm run encrypt -- "your-password" ./scratch/super-agent-confidential.md
//
// Paste the printed JSON into the relevant content/*.ts file's
// `confidential.blob` field, then delete the plaintext draft file — it
// should never be committed to git (see .gitignore's scratch/ entry).
//
// Algorithm parameters MUST match src/lib/crypto.ts exactly: PBKDF2-SHA256
// with 250000 iterations, AES-GCM-256, a 16-byte salt, a 12-byte iv.

import { readFile } from "node:fs/promises";

const PBKDF2_ITERATIONS = 250_000;

function bufferToBase64(buffer) {
  return Buffer.from(buffer).toString("base64");
}

async function deriveKey(password, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
}

async function main() {
  const [password, filePath] = process.argv.slice(2);

  if (!password || !filePath) {
    console.error('Usage: npm run encrypt -- "your-password" ./path/to/draft.md');
    process.exit(1);
  }

  const plaintext = await readFile(filePath, "utf-8");

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );

  const blob = {
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(ciphertext),
  };

  console.log("\nPaste this into the case study's `confidential.blob` field:\n");
  console.log(JSON.stringify(blob, null, 2));
  console.log("\nRemember: delete the plaintext draft file before committing.\n");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
