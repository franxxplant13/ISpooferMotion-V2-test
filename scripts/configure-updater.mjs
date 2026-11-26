import fs from 'node:fs';

// Only the public verification key belongs in the application bundle.
const raw = (process.env.TAURI_PUBLIC_KEY || '').trim();
if (!raw) throw new Error('Set the TAURI_PUBLIC_KEY Actions variable before building a release.');
const decoded = raw.startsWith('untrusted comment:')
  ? raw
  : Buffer.from(raw, 'base64').toString('utf8').trim();
const lines = decoded.split(/\r?\n/).filter(Boolean);
if (
  !lines[0]?.startsWith('untrusted comment:') ||
  !/public key/i.test(lines[0]) ||
  lines.length !== 2 ||
  !/^[A-Za-z0-9+/=]+$/.test(lines[1]) ||
  Buffer.from(lines[1], 'base64').length !== 42
) {
  throw new Error('TAURI_PUBLIC_KEY must contain the full generated .pub file, not a private key.');
}
const path = new URL('../src-tauri/tauri.conf.json', import.meta.url);
const config = JSON.parse(fs.readFileSync(path, 'utf8'));
config.plugins.updater.pubkey = Buffer.from(`${lines.join('\n')}\n`).toString('base64');
fs.writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
console.log('Configured the fork updater public verification key.');
