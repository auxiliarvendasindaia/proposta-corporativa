// Smoke do editor 2D após o patch dos PISOS (v18.08-24): sem regressão no
// Solar e no Salão (1 piso: seletor oculto, botões, arrasto, serialização) e,
// se o ambiente tiver pisos, troca de piso + arrasto no piso superior.
import { createRequire } from 'module';
const require = createRequire(process.env.PUPPETEER_EM || 'c:/Users/usuário/Desktop/Projetos/crm-backend/package.json');
const puppeteer = require('puppeteer');

const BASE = process.argv[2] || process.env.PROPOSTA_URL || 'file:///C:/Users/usu%C3%A1rio/Desktop/Projetos/proposta-corporativa/index.html';
const AMBS = (process.argv[3] || 'salao_eventos,solar').split(',');
const browser = await puppeteer.launch({ headless: 'new', executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--window-size=1400,1320'] });
let falhas = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'OK ' : '✗  '} ${msg}`); if (!cond) falhas++; };

for (const amb of AMBS) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1320 });
  await page.setCacheEnabled(false);
  const erros = [];
  page.on('pageerror', e => erros.push(String(e).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error') erros.push('console: ' + m.text().slice(0, 160)); });
  await page.goto(`${BASE}?espaco=${amb}&smoke=${Date.now()}`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload({ waitUntil: 'networkidle2' });   // estado limpo SEM apagar em recargas futuras (testa a persistência)
  console.log(`\n=== ${amb} ===`);

  const info = await page.evaluate(() => ({
    pisos: PISOS.length, pisoI: PISO_I, selOculto: document.querySelector('#pisosSel').hidden,
    mesas: PROPOSTA.mesas.length, comP: PROPOSTA.mesas.filter(m => m.p).length,
    rotulos: document.querySelectorAll('#areasCamada g').length,
    render: document.querySelectorAll('#mesasCamada .mesa').length,
    L: serializarLayout(PROPOSTA.mesas), limpar: document.querySelector('#btnLimparMesas').textContent.trim(),
    planta: document.querySelector('#plantaImg').getAttribute('src'),
  }));
  console.log(info);
  ok(info.selOculto === (info.pisos < 2), 'seletor de piso visível só com 2+ pisos');
  ok(info.render === info.mesas - info.comP || info.pisos > 1, 'todas as mesas do térreo renderizadas');
  ok(!/\.\w+\.\w+\./.test(info.L) || info.pisos > 1, 'serialização x.y sem terceiro campo no térreo');

  // botões: adicionar, distribuir, limpar, restaurar
  const antes = info.mesas;
  await page.click('#btnAddMesa');
  const n1 = await page.evaluate(() => PROPOSTA.mesas.length);
  ok(n1 === antes + 1, `adicionar mesa (${antes} → ${n1})`);
  await page.click('#btnDistribuir');
  const d = await page.evaluate(() => ({ n: PROPOSTA.mesas.length, need: Math.ceil(PROPOSTA.convidados / MESA.lugares), todasValidas: PROPOSTA.mesas.every(m => pisoValido(m.x, m.y, m.p | 0)) }));
  ok(d.n > 0 && d.todasValidas, `distribuir: ${d.n} mesas (precisa ${d.need}), todas em piso válido`);
  await page.click('#btnLimparMesas');
  const lz = await page.evaluate(() => ({ ativo: PROPOSTA.mesas.filter(m => (m.p|0) === PISO_I).length, outros: PROPOSTA.mesas.filter(m => (m.p|0) !== PISO_I).length }));
  ok(lz.ativo === 0 && (info.pisos > 1 || lz.outros === 0), `limpar zera o piso ativo (ficam ${lz.outros} de outros pisos)`);
  await page.click('#btnPadrao');
  const r = await page.evaluate(() => PROPOSTA.mesas.length);
  ok(r === MESAS_PADRAO_LEN(await page.evaluate(() => MESAS_PADRAO.length)), `restaurar padrão (${r} mesas)`);

  // arrasto real de uma mesa para fora do piso → tem que deslizar para célula válida
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; const rr = document.querySelector('#plantaSvg').getBoundingClientRect(); window.scrollTo(0, window.scrollY + rr.top - 20); });
  const tela = (ix, iy) => page.evaluate((ix, iy) => { const svg = document.querySelector('#plantaSvg'); const pt = svg.createSVGPoint(); pt.x = ix; pt.y = iy; const m = pt.matrixTransform(svg.getScreenCTM()); return { x: m.x, y: m.y }; }, ix, iy);
  const anc = await page.evaluate(() => ({ ...PROPOSTA.mesas[0] }));
  const de = await tela(anc.x, anc.y), para = await tela(5, 5);
  await page.mouse.move(de.x, de.y); await page.mouse.down(); await page.mouse.move(para.x, para.y, { steps: 10 }); await page.mouse.up();
  const fim = await page.evaluate(() => ({ ...PROPOSTA.mesas[0], valido: pisoValido(PROPOSTA.mesas[0].x, PROPOSTA.mesas[0].y, PROPOSTA.mesas[0].p | 0) }));
  ok(fim.valido && (fim.x !== anc.x || fim.y !== anc.y), `arrasto real: (${anc.x},${anc.y}) → (${fim.x},${fim.y}) válido=${fim.valido}`);

  // pisos superiores (se houver)
  if (info.pisos > 1) {
    for (let p = 1; p < info.pisos; p++) {
      await page.evaluate((p) => { const b = document.querySelector(`#pisosSel [data-piso="${p}"]`); b.scrollIntoView({block:'center'}); b.click(); }, p);
      const s = await page.evaluate(() => ({ pisoI: PISO_I, planta: document.querySelector('#plantaImg').getAttribute('src'), render: document.querySelectorAll('#mesasCamada .mesa').length, rotulos: [...document.querySelectorAll('#areasCamada .area__txt')].map(t => t.textContent) }));
      console.log(`piso ${p}:`, s);
      ok(s.pisoI === p, `trocou para o piso ${p}`);
      await page.evaluate(() => document.querySelector('#btnAddMesa').click());
      const m = await page.evaluate(() => { const m = PROPOSTA.mesas[PROPOSTA.mesas.length - 1]; return { ...m, valido: pisoValido(m.x, m.y, m.p | 0), y3d: pisoYEm(m.x, m.y, m.p | 0) }; });
      ok(m.p === p && m.valido, `mesa nova no piso ${p}: (${m.x},${m.y}) p=${m.p} válida=${m.valido} pisoY=${m.y3d}`);
      const anc2 = await page.evaluate(() => ({ ...PROPOSTA.mesas[PROPOSTA.mesas.length - 1] }));
      const de2 = await tela(anc2.x, anc2.y), para2 = await tela(anc2.x + 400, anc2.y + 300);
      await page.mouse.move(de2.x, de2.y); await page.mouse.down(); await page.mouse.move(para2.x, para2.y, { steps: 10 }); await page.mouse.up();
      const f2 = await page.evaluate(() => { const m = PROPOSTA.mesas[PROPOSTA.mesas.length - 1]; return { ...m, valido: pisoValido(m.x, m.y, m.p | 0) }; });
      ok(f2.p === p && f2.valido, `arrasto no piso ${p}: (${anc2.x},${anc2.y}) → (${f2.x},${f2.y}) p=${f2.p} válida=${f2.valido}`);
      const L = await page.evaluate(() => serializarLayout(PROPOSTA.mesas));
      ok(new RegExp(`\\.${p.toString(36)}(-|$)`).test(L), `link leva o piso: …${L.slice(-24)}`);
      // recarrega: localStorage preserva o piso da mesa
      await page.reload({ waitUntil: 'networkidle2' });
      const re = await page.evaluate(() => PROPOSTA.mesas.filter(m => m.p).length);
      ok(re >= 1, `após recarregar, ${re} mesa(s) em piso/aba superior preservada(s)`);
      await page.evaluate(() => document.querySelector('#btnDistribuir').click());
      const dd = await page.evaluate(() => ({ terreo: PROPOSTA.mesas.filter(m => !m.p).length, sup: PROPOSTA.mesas.filter(m => m.p).length }));
      ok(dd.terreo > 0, `distribuir no térreo não apaga o mezanino: térreo ${dd.terreo} · superior ${dd.sup}`);
    }
    await page.screenshot({ path: `${process.env.PROVA_OUT || '.'}/smoke-${amb}-pisos.jpg`, type: 'jpeg', quality: 70 });
  }
  ok(erros.length === 0, `erros de JS: ${erros.length ? erros.join(' | ') : 'nenhum'}`);
  await page.close();
}
function MESAS_PADRAO_LEN(n) { return n; }
await browser.close();
console.log(falhas ? `\n✗ ${falhas} FALHA(S)` : '\n✅ SMOKE DOS PISOS PASSOU');
process.exit(falhas ? 1 : 0);
