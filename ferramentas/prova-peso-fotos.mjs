// O PESO DA PRIMEIRA TELA E A CURADORIA DAS FOTOS (30/09/2026).
//
// Duas coisas que só aparecem medindo:
//   · a capa chegou a baixar 10,8 MB antes de o cliente ler uma linha (o filme
//     inteiro de 25 s + o sprite da mesa em PNG). O corte da capa e o webp
//     derrubaram para ~1,6 MB — esta bateria segura esse teto;
//   · as casas também fazem casamento, e o acervo tem bolo, arco de flores e
//     retrato do casal. Numa proposta corporativa essas fotos não entram.
//
// Precisa de: node ferramentas/servir.mjs 8140 · node ferramentas/crm-falso.mjs
//   node ferramentas/prova-peso-fotos.mjs
import { createRequire } from 'module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(process.env.PUPPETEER_EM || 'C:/Users/User/Desktop/Comercial/crm-backend/package.json');
const puppeteer = require('puppeteer');
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = process.env.PROPOSTA_URL || 'http://localhost:8140/index.html';
const CRM = process.env.CRM_FALSO || 'http://localhost:8141';
const TOKEN = 'b'.repeat(40);
const espera = ms => new Promise(r => setTimeout(r, ms));
let falhas = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHOU ✗ ') + m); if (!c) falhas++; };
const MB = n => (n / 1048576).toFixed(2) + ' MB';

/* teto da capa: o que o cliente baixa antes de rolar a página */
const TETO_CAPA = 2.6 * 1048576;

const b = await puppeteer.launch({ headless: 'new', executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--autoplay-policy=no-user-gesture-required'] });
const erros = [];

/* 1 · todo filme tem o corte leve da capa ao lado */
const pastas = [];
for (const d of fs.readdirSync(path.join(RAIZ, 'assets', 'ambientes'))) {
  const v = path.join(RAIZ, 'assets', 'ambientes', d, 'video');
  if (fs.existsSync(path.join(v, 'passeio.mp4'))) pastas.push(v);
}
const props = path.join(RAIZ, 'assets', 'propostas');
if (fs.existsSync(props)) for (const d of fs.readdirSync(props)) {
  if (fs.existsSync(path.join(props, d, 'passeio.mp4'))) pastas.push(path.join(props, d));
}
for (const pasta of pastas) {
  const rot = path.relative(RAIZ, pasta);
  const capa = path.join(pasta, 'capa.mp4');
  if (!fs.existsSync(capa)) { ok(false, `${rot}: falta o capa.mp4 (rode ferramentas/enxugar-midia.mjs)`); continue; }
  const n = fs.statSync(capa).size, cheio = fs.statSync(path.join(pasta, 'passeio.mp4')).size;
  ok(n < 2.2 * 1048576, `${rot}: corte da capa em ${MB(n)} (passeio ${MB(cheio)})`);
  const poster = path.join(pasta, 'poster.jpg');
  if (fs.existsSync(poster)) ok(fs.statSync(poster).size < 160 * 1024,
    `${rot}: poster em ${(fs.statSync(poster).size / 1024).toFixed(0)} KB`);
}
const sprite = path.join(RAIZ, 'assets', 'mesa-foto.webp');
ok(fs.existsSync(sprite) && fs.statSync(sprite).size < 200 * 1024,
  `o sprite da mesa é webp de ${fs.existsSync(sprite) ? (fs.statSync(sprite).size / 1024).toFixed(0) : '?'} KB`);

/* 2 · o que a capa baixa de verdade, num celular */
const p = await b.newPage();
p.on('pageerror', e => erros.push(String(e).slice(0, 140)));
await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await p.goto(`${SITE}?espaco=salao_eventos&proposta=${TOKEN}&api=${CRM}`, { waitUntil: 'networkidle2' });
await espera(9000);
const peso = await p.evaluate(base => {
  const r = performance.getEntriesByType('resource').filter(x => !x.name.includes(base));
  const n = x => x.decodedBodySize || x.encodedBodySize || 0;
  return { tot: r.reduce((a, x) => a + n(x), 0),
    maior: r.map(x => ({ n: n(x), u: x.name.split('/').pop().slice(0, 40) })).sort((a, c) => c.n - a.n)[0] };
}, new URL(CRM).host);
ok(peso.tot < TETO_CAPA, `a capa baixa ${MB(peso.tot)} (teto ${MB(TETO_CAPA)}) · maior: ${peso.maior.u} ${(peso.maior.n / 1024).toFixed(0)} KB`);
const capaTocando = await p.evaluate(() => { const v = document.querySelector('.hero__fundo video');
  return v ? { src: v.dataset.src, tocando: !v.paused } : null; });
ok(capaTocando && /capa\.mp4$/.test(capaTocando.src) && capaTocando.tocando,
  `e mesmo assim o filme roda no topo (${capaTocando && capaTocando.src.split('/').pop()})`);

/* 3 · nenhuma foto de casamento numa proposta corporativa */
const SOCIAL = /bolo|noiv|casal|arco de flores|colunas de flores|cerejeira/i;
for (const amb of ['salao_eventos', 'mezanino', 'solar', 'mirante', 'canto_lagoa']) {
  const t = await b.newPage();
  t.on('pageerror', e => erros.push(String(e).slice(0, 140)));
  await t.setViewport({ width: 1360, height: 900 });
  await t.goto(`${SITE}?espaco=${amb}`, { waitUntil: 'networkidle2' });
  await espera(1500);
  const g = await t.evaluate(() => ({
    acervo: AMB.galeria.length,
    sociais: AMB.galeria.filter(f => f.perfil === 'social').length,
    naTela: [...document.querySelectorAll('.gfoto img')].map(i => i.alt),
    topo: (fotoDestaque() || {}).perfil || '',
  }));
  ok(g.naTela.length === g.acervo - g.sociais,
    `${amb}: ${g.naTela.length} de ${g.acervo} fotos na proposta corporativa (${g.sociais} de casamento fora)`);
  const escapou = g.naTela.filter(c => SOCIAL.test(c));
  ok(escapou.length === 0, `${amb}: nada de bolo, noiva ou arco de flores na tela${escapou.length ? ' — ' + escapou[0].slice(0, 48) : ''}`);
  ok(g.topo !== 'social', `${amb}: a foto do topo não é de casamento`);
  /* a mesma casa, numa proposta de casamento, mostra tudo de novo */
  if (g.sociais) {
    const volta = await t.evaluate(() => galeriaDoEvento('Casamento').length);
    ok(volta === g.acervo, `${amb}: numa proposta de casamento as ${g.sociais} voltam (${volta} de ${g.acervo})`);
  }
  await t.close();
}

ok(erros.length === 0, `sem erros de JS ${erros.slice(0, 2).join(' | ')}`);
await b.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO VERDE');
process.exit(falhas ? 1 : 0);
