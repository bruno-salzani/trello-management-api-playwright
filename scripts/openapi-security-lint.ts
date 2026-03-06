import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

async function downloadOpenApi(target: string) {
  const url =
    process.env.OPENAPI_URL ||
    'https://api.trello.com/1/openapi.json';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed ${res.status}`);
  const buf = await res.arrayBuffer();
  fs.writeFileSync(target, Buffer.from(buf));
}

function runSpectral(file: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['--yes', 'spectral', 'lint', file],
      { stdio: 'inherit' }
    );
    child.on('close', (code) => resolve(code ?? 1));
  });
}

async function main() {
  const dir = path.resolve('test-results');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const specPath = path.join(dir, 'trello-openapi.json');
  try {
    await downloadOpenApi(specPath);
  } catch (e) {
    console.warn(
      '[SECURITY][OPENAPI] Não foi possível baixar o OpenAPI:',
      (e as Error).message
    );
    console.warn('[SECURITY][OPENAPI] Pulando lint de segurança (spec indisponível).');
    return;
  }
  const code = await runSpectral(specPath);
  if (code !== 0) {
    process.exit(code);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
