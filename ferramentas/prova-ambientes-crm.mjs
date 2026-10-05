// OS SALÕES DO CRM, UM A UM (02/10/2026)
//
// A página deixou de ter cinco salões escritos à mão: a ficha vem do pacote do
// CRM, gravado em `dados/ambientes/<slug>.js` por ferramentas/gerar-ambientes.mjs.
// Esta bateria abre TODOS eles e confere o que o cliente precisa ver:
// a planta carregada, a escala, o mapa do piso decodificado, a montagem oficial
// dentro do piso e nenhum erro de JS. Slug que não tem pacote tem que cair no
// aviso honesto, nunca no salão de outra cidade.
//
// Precisa de: node ferramentas/servir.mjs 8140
//   node ferramentas/prova-ambientes-crm.mjs
//   node ferramentas/prova-ambientes-crm.mjs joinville,castelo   → só esses
import { createRequire } from 'module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(process.env.PUPPETEER_EM || 'C:/Users/User/Desktop/Comercial/crm-backend/package.json');
const puppeteer = require('puppeteer');
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = process.env.PROPOSTA_URL || 'http://localhost:8140/index.html';
const espera = ms => new Promise(r => setTimeout(r, ms));
let falhas = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHOU ✗ ') + m); if (!c) falhas++; };

const indice = JSON.parse(fs.readFileSync(path.join(RAIZ, 'dados', 'ambientes.json'), 'utf8'));
const pedidos = (process.argv[2] && !process.argv[2].startsWith('--')) ? process.argv[2].split(',') : null;
const lista = indice.ambientes.filter(a => !pedidos || pedidos.includes(a.slug));

console.log(`pacote de ${indice.gerado_em} · ${indice.ambientes.length} salões · conferindo ${lista.length}\n`);

const b = await puppeteer.launch({ headless: 'new', executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const p = await b.newPage();
await p.setViewport({ width: 1360, height: 900 });
const erros = [];
p.on('pageerror', e => erros.push(String(e).slice(0, 130)));

for (const amb of lista) {
  erros.length = 0;
  await p.goto(`${SITE}?espaco=${amb.slug}`, { waitUntil: 'networkidle2' });
  await espera(1800);
  const v = await p.evaluate(() => {
    const img = document.getElementById('plantaImg');
    const mascara = (() => { try { return !!mascaraDoPiso(0); } catch (e) { return false; } })();
    const foraDoPiso = PROPOSTA.mesas.filter(m => !pisoValido(m.x, m.y, m.p | 0)).length;
    return {
      pacote: typeof CRM_AMB !== 'undefined' && CRM_AMB ? CRM_AMB.slug : null,
      espaco: ESPACO, nome: AMB.nome, pxm: AMB.pxm,
      plantaOk: !!img && img.naturalWidth > 200,
      plantaLarg: img ? img.naturalWidth : 0,
      mascara, mesas: PROPOSTA.mesas.length, foraDoPiso,
      pisos: PISOS.length,
      aviso: !document.getElementById('semMaquete').hidden,
      planta: !document.getElementById('planta').hidden,
    };
  });
  const bem = v.pacote === amb.slug && v.espaco === amb.slug && v.plantaOk && v.mascara
    && v.foraDoPiso === 0 && !v.aviso && v.planta && erros.length === 0;
  ok(bem, `${amb.slug.padEnd(30)} ${String(v.nome).slice(0, 22).padEnd(23)}`
    + `planta ${v.plantaLarg}px · ${v.mesas} mesas · ${v.pisos} piso(s) · pxm ${Math.round(v.pxm * 10) / 10}`
    + (v.foraDoPiso ? ` · ${v.foraDoPiso} FORA DO PISO` : '')
    + (!v.mascara ? ' · SEM MÁSCARA' : '') + (v.aviso ? ' · CAIU NO AVISO' : '')
    + (erros.length ? ` · ERRO ${erros[0]}` : ''));
}

/* slug sem pacote: o aviso honesto, nunca o salão de outra cidade */
if (!pedidos) {
  for (const slug of ['cerimonia_garden_joinville', 'salao_que_nao_existe']) {
    erros.length = 0;
    await p.goto(`${SITE}?espaco=${slug}`, { waitUntil: 'networkidle2' });
    await espera(1500);
    const v = await p.evaluate(() => ({
      aviso: !document.getElementById('semMaquete').hidden,
      planta: !document.getElementById('planta').hidden,
      galeria: !document.getElementById('galeria').hidden,
    }));
    ok(v.aviso && !v.planta && !v.galeria && erros.length === 0,
      `${slug.padEnd(30)} sem pacote → aviso honesto, sem planta e sem fotos de outra casa`);
  }
}


/* O SALÃO DO ORÇAMENTO MANDA (02/10/2026) — o CRM só põe `espaco=` no link
   quando aquele espaço tem maquete (25 de 34). Sem isso a página abria o
   orçamento de uma casa mostrando a planta de outra, calada. */
const CRM_FALSO = process.env.CRM_FALSO || 'http://localhost:8141';
const TOKEN_FALSO = 'b'.repeat(40);
const abrir = async (url) => { await p.goto(url, { waitUntil: 'networkidle2' }); await espera(3800); };
const estado = () => p.evaluate(() => ({
  espaco: ESPACO, nome: document.getElementById('espacoNome').textContent.trim(),
  aviso: !document.getElementById('semMaquete').hidden,
  planta: !document.getElementById('planta').hidden,
}));

/* 1 · link sem salão, orçamento de uma casa que a página NÃO reconhece pelo
   nome: o nome certo na tela e o aviso honesto, nunca a planta de Itapema */
erros.length = 0;
await abrir(`${SITE}?proposta=${TOKEN_FALSO}&api=${CRM_FALSO}`);
const semSlug = await estado();
ok(semSlug.aviso && !semSlug.planta && /Mediterr/i.test(semSlug.nome),
  `link sem salão: mostra "${semSlug.nome}" e esconde a planta de outra casa`);
ok(erros.length === 0, `e sem erro de JS ${erros.slice(0, 1).join('')}`);

await b.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : `\nTODOS OS SALÕES OK`);
process.exit(falhas ? 1 : 0);
