// Prova: a página da proposta veste o orçamento real do CRM.
// Uso: node probe-proposta-url.mjs "<url completa com ?proposta=...>"
// Requisito: puppeteer + Chrome — ajuste o createRequire abaixo para uma pasta
// SUA que tenha `npm i puppeteer` (na máquina da Indaiá ele vem do crm-backend).
import { createRequire } from 'module';
const require = createRequire(process.env.PUPPETEER_EM || 'c:/Users/usuário/Desktop/Projetos/crm-backend/package.json');
const puppeteer = require('puppeteer');

const URL_PROPOSTA = process.argv[2];
if (!URL_PROPOSTA) { console.error('uso: node probe-proposta-url.mjs <url>'); process.exit(2); }

const browser = await puppeteer.launch({ headless: 'new', executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--window-size=1500,900'] });
let falhas = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHOU ✗ ') + m); if (!c) falhas++; };
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 900 });
  const erros = []; page.on('pageerror', e => erros.push(String(e).slice(0, 200)));
  await page.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto(URL_PROPOSTA, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2500)); // vestirPropostaCRM é async pós-arranque

  const st = await page.evaluate(() => ({
    titulo: document.title,
    brand: document.querySelector('.brand__mono')?.textContent,
    conv: document.querySelector('#invConvidados')?.textContent,
    cardData: document.querySelector('#cardData .rcard__val')?.textContent,
    validade: document.querySelector('.js-validade')?.textContent,
    tbResumo: document.querySelector('#tbResumo')?.textContent,
    total: document.querySelector('#totalGeral')?.textContent,
    eyebrow: document.querySelector('.eyebrow')?.textContent,
    crm: window.__PROPOSTA_CRM__ || null,
    ctaImg: document.querySelector('#ctaImg')?.getAttribute('src'),
  }));
  console.log(JSON.stringify(st, null, 1));
  ok(/TESTE PROPOSTA URL/.test(st.titulo), 'título com o nome do cliente');
  ok(/TESTE PROPOSTA URL/.test(st.brand || ''), 'brand do topo = cliente');
  ok(st.conv === '100', 'convidados = 100 (do orçamento)');
  ok(st.cardData === '19/11/2026', 'card da data = 19/11/2026');
  ok(/Menu Superior I\b/.test(st.tbResumo || ''), 'menu selecionado = Menu Superior I');
  ok(/Open bar 2\b/.test(st.tbResumo || ''), 'open bar selecionado = Open bar 2');
  ok(/^100 convidados/.test(st.tbResumo || ''), 'tierbar com 100 convidados');
  ok(/TESTE PROPOSTA URL/.test(st.crm?.telao || ''), 'telão 3D com o nome do cliente');
  ok(!/dimy/i.test(st.ctaImg || ''), 'CTA sem o render da DIMY → ' + st.ctaImg);
  ok(erros.length === 0, 'sem erro de página' + (erros.length ? ' → ' + erros[0] : ''));

  // 3D: abre a maquete e fotografa (conferência visual do telão)
  await page.click('.pill[data-visao="v3d"]');
  await new Promise(r => setTimeout(r, 12000));
  const S = 'C:/Users/USURIO~1/AppData/Local/Temp/claude/c--Users-usu-rio-Desktop-Projetos/b42bf2eb-7914-4252-bbe8-6e2b90755015/scratchpad';
  await page.screenshot({ path: `${S}/proposta-3d-telao.png` });
  console.log('screenshot 3D salvo');
} finally { await browser.close(); }
process.exit(falhas ? 1 : 0);
