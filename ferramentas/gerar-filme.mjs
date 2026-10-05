// O FILME DO ESPAÇO — gera o passeio da maquete em 1080p e salva o arquivo que
// a proposta mostra na seção 05 (assets/ambientes/<slug>/video/).
//
// QUADRO A QUADRO, não gravação de tela: pedir o quadro no tempo exato e montar
// o vídeo depois dá 30 quadros por segundo de verdade. Gravando ao vivo a 1080p
// o computador entregava 8,6 e o passeio saía travado.
//
// O vídeo é do ESPAÇO, não do cliente: o telão e as cartelas ficam com a marca
// da casa (a página entra em MODO_FILME com ?filme=1).
//
//   node ferramentas/gerar-filme.mjs                      → todos os ambientes
//   node ferramentas/gerar-filme.mjs solar,mirante        → só esses
//   node ferramentas/gerar-filme.mjs salao_eventos --completo   → tour inteiro (~57 s)
//
// Precisa do servidor local: node ferramentas/servir.mjs 8140
import { createRequire } from 'module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const require = createRequire(process.env.PUPPETEER_EM || 'C:/Users/User/Desktop/Comercial/crm-backend/package.json');
const puppeteer = require('puppeteer');

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = process.env.PROPOSTA_URL || 'http://localhost:8140/index.html';
const COMPLETO = process.argv.includes('--completo');
const FPS = 30;
const LARG = 1920, ALT = 1080;
const espera = ms => new Promise(r => setTimeout(r, ms));
/* ffmpeg vem do crm-backend (ffmpeg-static) */
const FFMPEG = (() => { try { return require('ffmpeg-static'); } catch (e) { return null; } })();
if (!FFMPEG) { console.error('Sem ffmpeg (ffmpeg-static no crm-backend) — não dá para montar o vídeo.'); process.exit(1); }

const b = await puppeteer.launch({ headless: 'new',
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: [`--window-size=${LARG},${ALT + 120}`] });

const p0 = await b.newPage();
await p0.goto(SITE, { waitUntil: 'networkidle2' });
const TODOS = await p0.evaluate(() => Object.keys(AMBIENTES));
await p0.close();

/* --proposta <token> --api <base>: o filme deixa de ser da casa e passa a ser
   DESTE evento — a marca do cliente no telão, o layout e o cenário do
   orçamento (palco e LED só se estiverem na lista). O arquivo vai para
   assets/propostas/<número>/ e a proposta o encontra sozinha. */
const arg = nome => { const i = process.argv.indexOf(nome); return i > 0 ? process.argv[i + 1] : null; };
const TOKEN = arg('--proposta');
const API = arg('--api') || 'http://localhost:8141';

if (TOKEN) {
  const espaco = arg('--espaco') || TODOS[0];
  const url = `${SITE}?espaco=${espaco}&proposta=${TOKEN}&api=${encodeURIComponent(API)}&filme=1`;
  const numero = await (async () => {
    const p = await b.newPage();
    await p.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
    await espera(3000);
    const n = await p.evaluate(() => (window.__PROPOSTA_CRM__ || {}).numero || null);
    await p.close();
    return n;
  })();
  if (!numero) { console.error('✗ o link não trouxe orçamento nenhum — confira o token e a api'); await b.close(); process.exit(1); }
  console.log(`\n=== proposta ${numero} · ${espaco} ===`);
  await gravar(url, path.join(RAIZ, 'assets', 'propostas', numero), `proposta ${numero}`);
  /* a lista guarda o SALÃO de cada filme: a página só mostra o passeio quando
     a proposta está aberta no mesmo salão em que ele foi gravado (05/10/2026) */
  const indexHtml = path.join(RAIZ, 'index.html');
  let html = fs.readFileSync(indexHtml, 'utf8');
  const re = /const PROPOSTAS_COM_FILME = \{([^}]*)\};/;
  const atual = {};
  for (const par of (re.exec(html)?.[1] || '').split(',')) {
    const m = /'([^']+)'\s*:\s*'([^']+)'/.exec(par);
    if (m) atual[m[1]] = m[2];
  }
  if (atual[numero] !== espaco) {
    atual[numero] = espaco;
    const corpo = Object.entries(atual).map(([n, e]) => `'${n}':'${e}'`).join(', ');
    html = html.replace(re, `const PROPOSTAS_COM_FILME = {${corpo}};`);
    fs.writeFileSync(indexHtml, html);
    console.log(`  · ${numero} anotado com o salão ${espaco}`);
  }
  await b.close();
  console.log('\nA proposta mostra este vídeo sozinha quando o orçamento for o mesmo.');
  process.exit(0);
}

const pedidos = (process.argv[2] && !process.argv[2].startsWith('--')) ? process.argv[2].split(',') : TODOS;

async function gravar(url, destino, rotulo){
  fs.mkdirSync(destino, { recursive: true });
  const quadros = fs.mkdtempSync(path.join(os.tmpdir(), 'filme-'));

  const p = await b.newPage();
  await p.setViewport({ width: LARG, height: ALT, deviceScaleFactor: 1 });
  const erros = [];
  p.on('pageerror', e => erros.push(String(e).slice(0, 140)));
  await p.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  await espera(1500);

  /* a maquete ocupa a tela toda, para o quadro sair 16:9 limpo */
  await p.evaluate(() => {
    document.querySelector('#visoes').scrollIntoView();
    trocarVisao('v3d');
    const box = document.getElementById('tresBox');
    box.style.cssText = 'position:fixed;inset:0;z-index:9999;width:100vw;height:100vh;';
    document.querySelectorAll('.topbar,.expirada,.tierbar,.visao__foot').forEach(el => el.style.display = 'none');
  });
  try {
    await p.waitForFunction(() => typeof T3 !== 'undefined' && T3.pronto && T3.raf > 0, { timeout: 300000 });
  } catch (e) { console.log('  ✗ a maquete não ficou pronta'); await p.close(); return; }
  await p.evaluate(() => {
    T3.renderer.setSize(innerWidth, innerHeight, false);
    T3.cam.aspect = innerWidth / innerHeight; T3.cam.updateProjectionMatrix();
  });
  await espera(4000);   /* texturas, sombras e reflexos assentam */

  const dur = await p.evaluate(curto => filmePreparar(curto), !COMPLETO);
  const emendas = await p.evaluate(() => Math.max(0, TOUR.segs.filter(x=>x.fusao).length - 1));
  if (!dur) { console.log('  ✗ o roteiro não ficou pronto'); await p.close(); return; }
  const total = Math.floor(dur * FPS);
  console.log(`  ${dur}s · ${total} quadros em ${LARG}×${ALT}…`);

  let n = 0;
  for (let i = 0; i < total; i++) {
    /* desenhar e ler o quadro na MESMA chamada: separado dava quadro preto */
    const url = await p.evaluate(s => filmeQuadro(s), i / FPS);
    if (!url) break;
    fs.writeFileSync(path.join(quadros, String(i).padStart(5, '0') + '.jpg'),
      Buffer.from(url.split(',')[1], 'base64'));
    n++;
    if (n % 90 === 0) process.stdout.write(`  ${Math.round(n / total * 100)}%\r`);
  }
  /* nenhum quadro pode sair preto: 4 KB de JPEG é tela vazia */
  const leves = fs.readdirSync(quadros).filter(f => fs.statSync(path.join(quadros, f)).size < 4096);
  if (leves.length) console.log(`  ~ ${leves.length} quadro(s) sem imagem — o vídeo vai piscar; confira antes de publicar`);
  await p.close();
  console.log(`  ${n} quadros gravados; montando…`);

  const final = path.join(destino, 'passeio.mp4');
  fs.rmSync(final, { force: true });
  /* crf 26 a 1080p: medido em 10,7 MB para 25 s (crf 21 dava 20,7 MB e não
     se via diferença no player da proposta, que tem ~1.100 px de largura) */
  execFileSync(FFMPEG, ['-y', '-framerate', String(FPS), '-i', path.join(quadros, '%05d.jpg'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', '-an', final], { stdio: 'pipe' });
  /* o poster sai do quadro com MAIS informação entre 30% e 70% do passeio:
     pegar "o do meio" às cegas caía numa fusão em preto (13 KB de imagem) */
  const candidatos = [];
  for (let f = Math.floor(n * 0.3); f < Math.floor(n * 0.7); f += Math.max(1, Math.floor(n / 40))) {
    const arq = path.join(quadros, String(f).padStart(5, '0') + '.jpg');
    if (fs.existsSync(arq)) candidatos.push({ arq, peso: fs.statSync(arq).size });
  }
  candidatos.sort((a, c) => c.peso - a.peso);
  if (candidatos.length) fs.copyFileSync(candidatos[0].arq, path.join(destino, 'poster.jpg'));
  fs.rmSync(quadros, { recursive: true, force: true });

  const mb = fs.statSync(final).size / 1e6;
  /* conferência no arquivo pronto: piscada de preto é defeito que só aparece
     assistindo, então a ferramenta procura sozinha */
  let pretos = 0;
  try {
    execFileSync(FFMPEG, ['-i', final, '-vf', 'blackdetect=d=0.03:pix_th=0.12', '-an', '-f', 'null', '-'],
      { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    const txt = String(e.stderr || '');
    pretos = (txt.match(/black_start/g) || []).length;
    /* a abertura e o fecho têm cartela escura de propósito */
    /* as emendas entre planos passam por uma fusão em preto de propósito;
       o que não pode é preto FORA delas (era o sintoma do quadro perdido) */
    const noMeio = [...txt.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)]
      .map(m => ({ ini: +m[1], dur: +m[2] - +m[1] }))
      .filter(s => s.ini > 3.2 && s.ini < (n / FPS) - 3.2);
    pretos = Math.max(0, noMeio.length - emendas);
  }
  console.log(`  ✔ ${path.relative(RAIZ, final)} · ${mb.toFixed(1)} MB · ${(n / FPS).toFixed(1)}s a ${FPS} q/s · poster.jpg`);
  if (pretos) console.log(`  ✗ ${pretos} trecho(s) preto(s) no meio do filme — NÃO publique assim`);
  if (erros.length) console.log(`  ~ erros de JS: ${erros.slice(0, 2).join(' | ')}`);
  if (mb > 25) console.log('  ~ acima de 25 MB: reduza a duração ou aumente o crf antes de publicar');
}

for (const amb of pedidos) {
  if (!TODOS.includes(amb)) { console.log(`✗ ${amb}: não é um ambiente da página`); continue; }
  console.log(`
=== ${amb} ===`);
  await gravar(`${SITE}?espaco=${amb}&filme=1`, path.join(RAIZ, 'assets', 'ambientes', amb, 'video'), amb);
}
await b.close();
console.log('\nCada ambiente mostra o filme pelo campo `filme` do registro AMBIENTES.');
