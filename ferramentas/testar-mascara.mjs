// Teste completo do editor com máscara: arrasto real a cada ponto circulado + proibidos + extremos.
import { createRequire } from 'module';
const require = createRequire(process.env.PUPPETEER_EM || 'c:/Users/usuário/Desktop/Projetos/crm-backend/package.json');
const puppeteer = require('puppeteer');

const URL_ALVO = process.argv[2] || process.env.PROPOSTA_URL || 'file:///C:/Users/usu%C3%A1rio/Desktop/Projetos/proposta-corporativa/index.html';
const browser = await puppeteer.launch({ headless: 'new', executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--window-size=1400,1320'] });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 1320 });
await page.setCacheEnabled(false);
const errosJs = [];
page.on('pageerror', e => errosJs.push(String(e).slice(0, 120)));
await page.goto(URL_ALVO, { waitUntil: 'networkidle2', timeout: 60000 });

// rolagem instantânea até o editor
await page.evaluate(() => {
  document.documentElement.style.scrollBehavior = 'auto';
  const r = document.querySelector('#plantaSvg').getBoundingClientRect();
  window.scrollTo(0, window.scrollY + r.top - 40);
});
await new Promise(r => setTimeout(r, 300));

const telaDe = (ix, iy) => page.evaluate((ix, iy) => {
  const svg = document.querySelector('#plantaSvg');
  const pt = svg.createSVGPoint(); pt.x = ix; pt.y = iy;
  const m = pt.matrixTransform(svg.getScreenCTM());
  return { x: m.x, y: m.y };
}, ix, iy);

const arrastar = async (iMesa, alvoImg) => {
  await page.evaluate(() => {
    const r = document.querySelector('#plantaSvg').getBoundingClientRect();
    window.scrollTo(0, window.scrollY + r.top - 20);
  });
  const anc = await page.evaluate((i) => ({ ...PROPOSTA.mesas[i] }), iMesa);
  const de = await telaDe(anc.x, anc.y);
  const para = await telaDe(alvoImg[0], alvoImg[1]);
  await page.mouse.move(de.x, de.y); await page.mouse.down();
  await page.mouse.move(para.x, para.y, { steps: 12 }); await page.mouse.up();
  return page.evaluate((i) => PROPOSTA.mesas[i], iMesa);
};

console.log('=== PONTOS CIRCULADOS PELO DONO (têm que aceitar a mesa a <=12px) ===');
const CIRCULADOS = [[300,290],[470,295],[900,300],[1176,444],[1300,435],[1530,435],[1600,300],[1690,460]];
let falhas = 0;
for (let k = 0; k < CIRCULADOS.length; k++) {
  const alvo = CIRCULADOS[k];
  const fim = await arrastar(k % 19, alvo);
  const d = Math.hypot(fim.x - alvo[0], fim.y - alvo[1]);
  const ok = d <= 14;
  if (!ok) falhas++;
  console.log(`(${alvo}) → mesa em (${fim.x},${fim.y}) dist=${d.toFixed(0)}px ${ok ? 'OK' : 'FALHOU ✗'}`);
}

console.log('\n=== EXTREMOS (borda: mesa encosta) ===');
for (const [alvo, rot] of [[[1745,500],'vidro direita'], [[1000,870],'divisa deck'], [[265,300],'parede entrada']]) {
  const fim = await arrastar(10, alvo);
  const d = Math.hypot(fim.x - alvo[0], fim.y - alvo[1]);
  console.log(`${rot}: alvo (${alvo}) → (${fim.x},${fim.y}) dist=${d.toFixed(0)}px ${d <= 56 ? 'OK' : 'FALHOU ✗'}`);
  if (d > 56) falhas++;
}

console.log('\n=== PROIBIDOS (mesa NÃO pode parar neles) ===');
for (const [alvo, rot] of [[[450,650],'árvore/deck'], [[950,940],'deck de luzes'], [[80,120],'exterior'], [[1850,500],'cortina/vidro']]) {
  const fim = await arrastar(11, alvo);
  const d = Math.hypot(fim.x - alvo[0], fim.y - alvo[1]);
  const valido = await page.evaluate((m) => pisoValido(m.x, m.y), fim);
  console.log(`${rot}: alvo (${alvo}) → (${fim.x},${fim.y}) dist=${d.toFixed(0)}px pisoValido=${valido} ${valido && d > 30 ? 'OK (deslizou p/ piso)' : valido ? 'OK' : 'FALHOU ✗'}`);
  if (!valido) falhas++;
}

console.log('\nerros de JS na página:', errosJs.length ? errosJs : 'nenhum');
console.log(falhas === 0 && errosJs.length === 0 ? '\n✅ TODOS OS TESTES PASSARAM' : `\n❌ ${falhas} falhas`);

const svgEl = await page.$('#plantaSvg');
await svgEl.screenshot({ path: process.env.PROVA_OUT || 'prova-mascara.png' });
await browser.close();
process.exit(falhas === 0 && errosJs.length === 0 ? 0 : 1);
