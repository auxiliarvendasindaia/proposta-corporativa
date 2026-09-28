// Servidor estático da proposta, para quem não tem Python na máquina.
//   node ferramentas/servir.mjs            → http://localhost:8140
//   node ferramentas/servir.mjs 8150       → outra porta
// (equivale ao `python -m http.server 8140` da receita da casa)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORTA = Number(process.argv[2]) || 8140;
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.ttf': 'font/ttf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.ico': 'image/x-icon', '.b64': 'text/plain',
};

http.createServer((req, res) => {
  const caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let arquivo = path.join(RAIZ, caminho);
  if (!arquivo.startsWith(RAIZ)) { res.writeHead(403); return res.end('fora da pasta'); }
  if (fs.existsSync(arquivo) && fs.statSync(arquivo).isDirectory()) arquivo = path.join(arquivo, 'index.html');
  fs.readFile(arquivo, (erro, dados) => {
    if (erro) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(dados);
  });
}).listen(PORTA, () => console.log(`proposta em http://localhost:${PORTA}  (pasta: ${RAIZ})`));
