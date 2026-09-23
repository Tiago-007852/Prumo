/**
 * Reproduz localmente o build das funções @vercel/node e executa os lambdas
 * compilados — para diagnosticar o FUNCTION_INVOCATION_FAILED de produção
 * sem precisar de credenciais da Vercel.
 */
import { build } from '@vercel/node';
import { FileFsRef } from '@vercel/build-utils';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';

const entrypoint = process.argv[2] || 'api/health.ts';
const files = {};
files[entrypoint] = new FileFsRef({ mode: 0o644, fsPath: path.resolve(entrypoint) });

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-test-'));
const version = JSON.parse(fs.readFileSync('node_modules/@vercel/node/package.json', 'utf8')).version;
console.log(`Compilando ${entrypoint} com @vercel/node ${version} → ${outDir}`);

const result = await build({
  files,
  entrypoint,
  workPath: process.cwd(),
  config: {},
  meta: { isDev: false, requestPath: '/', deploymentId: 'diag', paths: [] },
});

const out = result.output;
const lambdaFiles = out.files || out; // Lambda direto ou mapa de FileFsRef
console.log('Tipo/runtime:', out.type, out.runtime || '');
console.log('Handler:', out.handler);
console.log('Arquivos do lambda:', Object.keys(lambdaFiles).length);

// Escreve todos os arquivos do lambda em disco (FileFsRef tem fsPath; FileBlob tem data)
for (const [name, ref] of Object.entries(lambdaFiles)) {
  const dest = path.join(outDir, name);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (typeof ref.fsPath === 'string') {
    fs.copyFileSync(ref.fsPath, dest);
  } else if (ref.data !== undefined) {
    fs.writeFileSync(dest, ref.data);
  } else if (typeof ref.toBuffer === 'function') {
    fs.writeFileSync(dest, await ref.toBuffer());
  } else {
    console.warn('Ref desconhecido para', name, Object.keys(ref).join(','));
  }
}

// Localiza o JS compilado do handler (procura o conteúdo do nosso endpoint)
let handlerFile = null;
for (const name of Object.keys(lambdaFiles)) {
  if (!name.endsWith('.js')) continue;
  const content = fs.readFileSync(path.join(outDir, name), 'utf8');
  if (content.includes('databaseConfigured') || content.includes('ping')) {
    handlerFile = name;
    break;
  }
}
console.log('Handler compilado:', handlerFile);

// Mostra um trecho do topo do handler para inspeção de formato (ESM vs CJS)
if (handlerFile) {
  const head = fs.readFileSync(path.join(outDir, handlerFile), 'utf8').slice(0, 400);
  console.log('── Topo do handler ──\n' + head);
}

// Invoca o handler compilado
const invokeScript = `
process.env.NODE_ENV = 'production';
const mod = require(${JSON.stringify(path.join(outDir, handlerFile))});
const handler = mod.default || mod;
const req = { method: 'GET', headers: {}, url: '/', body: null };
const res = {
  statusCode: 0, headers: {}, body: '',
  status(c) { this.statusCode = c; return this; },
  setHeader(k, v) { this.headers[k] = v; return this; },
  json(b) { this.body = JSON.stringify(b); return this; },
  end(b) { if (b) this.body = String(b); return this; },
};
Promise.resolve(handler(req, res))
  .then(() => { console.log('LAMBDA OK →', res.statusCode, String(res.body).slice(0, 200)); })
  .catch((e) => { console.error('LAMBDA FALHOU →', e && e.stack ? e.stack.split('\\n').slice(0, 8).join('\\n') : e); process.exit(1); });
`;
fs.writeFileSync(path.join(outDir, 'invoke.cjs'), invokeScript);
try {
  const stdout = execFileSync('node', [path.join(outDir, 'invoke.cjs')], {
    cwd: outDir,
    timeout: 30000,
    encoding: 'utf8',
  });
  console.log(stdout);
} catch (err) {
  console.error('Execução do lambda falhou:');
  console.error((err.stdout || '') + (err.stderr || err.message));
  process.exit(1);
}
