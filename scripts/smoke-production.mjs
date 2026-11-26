import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const probe = createServer();
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const env = { ...process.env, PORT: String(port) };
for (const name of Object.keys(env)) if (name.startsWith('WA_')) delete env[name];
const child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts', '--production'], { cwd: new URL('../', import.meta.url), env, stdio: ['ignore','pipe','pipe'] });
let logs = '';
child.on('error', error => { logs += error.message; });
child.stdout.on('data', chunk => logs += chunk);
child.stderr.on('data', chunk => logs += chunk);
const base = `http://127.0.0.1:${port}`;
try {
  let ready = false;
  for (let index = 0; index < 50; index++) {
    try { if ((await fetch(base + '/health')).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert(ready, logs);
  const index = await fetch(base + '/');
  assert.equal(index.status, 200);
  const html = await index.text();
  const asset = /src="([^"]+\.js)"/.exec(html)?.[1];
  assert(asset); assert.equal((await fetch(base + asset)).status, 200);
  assert.equal((await fetch(base + '/api/missing')).status, 404);
  assert.equal((await (await fetch(base + '/api/ai/status')).json()).available, false);
  assert.equal((await (await fetch(base + '/api/whatsapp/status')).json()).enabled, false);
  const binary = Buffer.from(await (await fetch(base + '/sql-wasm.wasm')).arrayBuffer());
  const expected = readFileSync(new URL('../node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url));
  const hash = value => createHash('sha256').update(value).digest('hex');
  assert.equal(hash(binary), hash(expected));
  await WebAssembly.compile(binary);
  console.log(JSON.stringify({ productionEntry: 'pass', health: 'pass', spaAndBundle: 'pass', api404: 'pass', localAiDisabled: true, whatsappDisabledWithoutConfig: true, wasmPairedAndCompiles: true }));
} finally {
  if (child.pid && child.exitCode === null) {
    const exited = new Promise(resolve => child.once('exit', resolve));
    child.kill();
    await exited;
  }
}
