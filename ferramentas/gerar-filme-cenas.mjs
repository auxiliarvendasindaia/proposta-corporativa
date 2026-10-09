// O FILME POR CENAS (09/10/2026) — protótipo.
//
// Pedido do dono, depois de ver o vídeo da Algar: "gostaria que o vídeo das
// propostas fosse mais ou menos assim, mostrando a ideia de como ficaria o
// evento do cliente no dia... o espaço com a decoração e itens que estão no
// orçamento, nesse formato mais realista".
//
// O da Algar é criação à mão: imagens geradas e montadas para aquela
// proposta. O que dá para fazer SOZINHO, a cada orçamento, é montar o filme
// a partir das fotos de evento corporativo que já estão na ficha da casa,
// escolhendo as cenas pelo que o orçamento contratou, com cartela de abertura
// no nome do cliente e cartela de fecho do Indaiá.
//
// O que ele NÃO faz: inventar decoração. Só entra cena de coisa que a casa
// entregou de verdade e que está no orçamento — a regra de sempre.
//
//   node ferramentas/gerar-filme-cenas.mjs --espaco mediterraneo
//   node ferramentas/gerar-filme-cenas.mjs --espaco mediterraneo --proposta <token> --api <base>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'module';

const require = createRequire(process.env.SHARP_EM || 'C:/Users/User/Desktop/Comercial/crm-backend/package.json');
const sharp = require('sharp');
const FFMPEG = require('ffmpeg-static');
const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname.slice(1)), '..');
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const ESPACO = arg('--espaco') || 'mediterraneo';
const TOKEN = arg('--proposta');
const API = arg('--api') || 'http://localhost:8141';
const W = 1920, H = 1080, FPS = 30, DUR = 4.2, FADE = 0.9;

/* ---- o que a página já sabe da casa: as fotos curadas e o nome ---- */
const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const inicio = html.indexOf('\n  ' + ESPACO + ': {');
if (inicio < 0) throw new Error('a página não tem ficha de ' + ESPACO);
const ficha = html.slice(inicio, html.indexOf('\n  },', inicio));
const cenas = [...ficha.matchAll(/url:'([^']+)'[\s\S]*?badge:'([^']*)'/g)]
  .map(m => ({ url: m[1], rotulo: m[2] }));
if (!cenas.length) throw new Error(ESPACO + ' não tem foto na galeria');

const pacote = (() => {
  const t = fs.readFileSync(path.join(RAIZ, 'dados', 'ambientes', ESPACO + '.js'), 'utf8');
  global.window = {};
  eval(t);
  return global.window.__AMB_CRM__;
})();
const CASA = pacote.dados.nome;
const ONDE = pacote.dados.cidadeLonga || pacote.dados.cidade || '';

/* ---- o orçamento manda na escolha das cenas ---- */
let CLIENTE = '', EVENTO = 'O seu evento', QUANDO = '';
const contratado = new Set();
if (TOKEN) {
  const resp = await fetch(API + '/api/public/proposta/' + TOKEN);
  const orc = ((await resp.json()).data || {}).orcamento || {};
  CLIENTE = (orc.empresa && orc.empresa.nome) || orc.cliente_nome || '';
  EVENTO = orc.nome_evento || orc.evento || EVENTO;
  if (orc.data_evento) {
    QUANDO = new Date(orc.data_evento + 'T12:00').toLocaleDateString('pt-BR',
      { day: '2-digit', month: 'long', year: 'numeric' });
  }
  for (const it of (orc.itens || [])) {
    const n = (((it.produto && it.produto.nome) || it.nome || '') + '').toLowerCase();
    if (/\bled\b|tel[aã]o|painel|projec|datashow/.test(n)) contratado.add('telao');
    if (/palco|tablado/.test(n)) contratado.add('palco');
    if (/bistr/.test(n)) contratado.add('bistro');
    if (/coquetel|finger/.test(n)) contratado.add('coquetel');
    if (/jantar|menu|empratado/.test(n)) contratado.add('jantar');
  }
}
/* sem palco nem telão no orçamento, a cena de auditório sai: o filme não
   mostra estrutura que ninguém comprou */
function cabe(c) {
  if (!TOKEN) return true;
  const r = c.rotulo.toLowerCase();
  if (/auditório|auditorio|palco|painel/.test(r)) return contratado.has('palco') || contratado.has('telao');
  if (/jantar/.test(r)) return contratado.has('jantar') || !contratado.has('coquetel');
  return true;
}
const escolhidas = cenas.filter(cabe).slice(0, 6);
console.log(escolhidas.length + ' cenas de ' + cenas.length + ' · ' + CASA
  + (TOKEN ? ' · ' + (CLIENTE || '(sem cliente)') : ' · demonstração'));
for (const c of escolhidas) console.log('   · ' + c.rotulo);

/* ---- cartelas ---- */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
function cartela(linhas, arq) {
  const txt = linhas.map(l =>
    '<text x="' + (W / 2) + '" y="' + l.y + '" text-anchor="middle" '
    + 'font-family="' + (l.serif ? 'Georgia, serif' : 'Helvetica, Arial, sans-serif') + '" '
    + 'font-size="' + l.t + '" fill="' + l.cor + '" letter-spacing="' + (l.ls || 0) + '" '
    + 'font-style="' + (l.it ? 'italic' : 'normal') + '">' + esc(l.txt) + '</text>').join('');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '">'
    + '<rect width="' + W + '" height="' + H + '" fill="#12171C"/>' + txt + '</svg>';
  return sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toFile(arq);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cenas-'));
await cartela([
  { txt: (CLIENTE || 'INDAIÁ EVENTOS').toUpperCase(), y: 470, t: 30, cor: '#C9A96A', ls: 10 },
  { txt: EVENTO, y: 580, t: 62, cor: '#F2F0EC', serif: true },
  { txt: [CASA, ONDE, QUANDO].filter(Boolean).join(' · '), y: 648, t: 26, cor: '#9AA3AC' },
], path.join(tmp, '00.jpg'));
await cartela([
  { txt: 'INDAIÁ EVENTOS', y: 520, t: 34, cor: '#C9A96A', ls: 12 },
  { txt: 'O seu evento no ' + CASA + '.', y: 604, t: 44, cor: '#F2F0EC', serif: true, it: true },
], path.join(tmp, '99.jpg'));

/* ---- as fotos já no enquadramento do filme ---- */
for (let i = 0; i < escolhidas.length; i++) {
  const u = escolhidas[i].url;
  const buf = /^https?:/.test(u)
    ? Buffer.from(await (await fetch(u)).arrayBuffer())
    : fs.readFileSync(path.join(RAIZ, u));
  await sharp(buf).resize(W, H, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 92 }).toFile(path.join(tmp, String(i + 1).padStart(2, '0') + '.jpg'));
}

/* ---- montagem: zoom lento em cada cena, emenda por fusão ---- */
const arquivos = fs.readdirSync(tmp).filter(f => f.endsWith('.jpg')).sort();
const quadros = Math.round(DUR * FPS);
const entradas = [];
for (const f of arquivos) entradas.push('-loop', '1', '-t', String(DUR), '-i', path.join(tmp, f));

const Q = String.fromCharCode(39);
const zoom = arquivos.map((f, i) => {
  const passo = (0.06 / quadros).toFixed(6);
  const z = i % 2
    ? 'zoom=' + Q + 'max(1.06-on*' + passo + ',1.0)' + Q
    : 'zoom=' + Q + 'min(1.0+on*' + passo + ',1.06)' + Q;
  return '[' + i + ':v]scale=' + (W * 2) + ':-2,'
    + 'zoompan=' + z + ':d=' + quadros
    + ':x=' + Q + 'iw/2-(iw/zoom/2)' + Q + ':y=' + Q + 'ih/2-(ih/zoom/2)' + Q
    + ':s=' + W + 'x' + H + ':fps=' + FPS + ',setsar=1[v' + i + ']';
});
let cadeia = '', atual = 'v0', t = DUR - FADE;
for (let i = 1; i < arquivos.length; i++) {
  const saida = 'x' + i;
  cadeia += '[' + atual + '][v' + i + ']xfade=transition=fade:duration=' + FADE
    + ':offset=' + t.toFixed(2) + '[' + saida + '];';
  atual = saida;
  t += DUR - FADE;
}

const destino = path.join(RAIZ, 'video-prova', 'cenas-' + ESPACO + (TOKEN ? '-proposta' : '') + '.mp4');
fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.rmSync(destino, { force: true });
execFileSync(FFMPEG, ['-y', ...entradas,
  '-filter_complex', zoom.join(';') + ';' + cadeia + '[' + atual + ']format=yuv420p[v]',
  '-map', '[v]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '23',
  '-movflags', '+faststart', destino], { stdio: ['ignore', 'pipe', 'pipe'] });
fs.rmSync(tmp, { recursive: true, force: true });

const mb = fs.statSync(destino).size / 1e6;
const seg = arquivos.length * (DUR - FADE) + FADE;
console.log('✔ ' + path.relative(RAIZ, destino) + ' · ' + mb.toFixed(1) + ' MB · ' + seg.toFixed(1) + 's');
