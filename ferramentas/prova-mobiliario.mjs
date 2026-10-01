// MOBILIÁRIO DO ORÇAMENTO NA PLANTA (01/10/2026).
//
// O editor 2D só desenhava a mesa redonda de 8 lugares. Numa proposta de
// coquetel não existe mesa de jantar nenhuma — existe bistrô, palco, telão —,
// e o cliente olhava uma planta que não era a dele. Esta bateria garante que:
//   · o que entra na planta é o que o ORÇAMENTO contratou (nunca a casa por conta);
//   · nenhuma peça nasce em cima de uma mesa;
//   · o cliente arrasta, tira e põe de volta, e isso fica guardado no link;
//   · a maquete 3D mostra o bistrô ONDE ele largou na planta.
//
// Precisa de: node ferramentas/servir.mjs 8140 · node ferramentas/crm-falso.mjs
//   node ferramentas/prova-mobiliario.mjs
import { createRequire } from 'module';
const require = createRequire(process.env.PUPPETEER_EM || 'C:/Users/User/Desktop/Comercial/crm-backend/package.json');
const puppeteer = require('puppeteer');
const SITE = process.env.PROPOSTA_URL || 'http://localhost:8140/index.html';
const CRM = process.env.CRM_FALSO || 'http://localhost:8141';
const TOKEN = 'b'.repeat(40);
const espera = ms => new Promise(r => setTimeout(r, ms));
let falhas = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHOU ✗ ') + m); if (!c) falhas++; };

const b = await puppeteer.launch({ headless: 'new', executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [];
const p = await b.newPage();
p.on('pageerror', e => erros.push(String(e).slice(0, 150)));
p.on('console', m => { if (/propostaCRM/.test(m.text())) erros.push(m.text().slice(0, 150)); });
await p.setViewport({ width: 1440, height: 1000 });
const alvo = `${SITE}?espaco=salao_eventos&proposta=${TOKEN}&api=${CRM}`;
/* link limpo: o mobiliário tem que nascer do orçamento, não de um estado velho */
await p.goto(alvo, { waitUntil: 'networkidle2' });
await espera(800);
await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
await p.goto(alvo, { waitUntil: 'networkidle2' });
await espera(4000);

const ler = () => p.evaluate(() => ({
  contratadas: pecasContratadas(),
  pecas: (PROPOSTA.pecas || []).map(x => ({ t: x.t, x: x.x, y: x.y })),
  desenhadas: document.querySelectorAll('#pecasCamada .peca').length,
  pills: [...document.querySelectorAll('.pecapill')].map(x => x.dataset.add),
}));

/* 1 · o que entra é o que o orçamento contratou */
const v = await ler();
ok(v.contratadas.bistro === 10 && v.contratadas.palco === 2 && v.contratadas.telao === 1,
  `o orçamento traz ${JSON.stringify(v.contratadas)}`);
const conta = t => v.pecas.filter(x => x.t === t).length;
ok(conta('bistro') === 10 && conta('palco') === 2 && conta('telao') === 1,
  `a planta nasce com a mesma quantidade (${v.pecas.length} peças)`);
ok(v.desenhadas === v.pecas.length, `e todas desenhadas (${v.desenhadas})`);
ok(v.pills.join() === 'palco,telao,bistro', `um botão por tipo contratado (${v.pills.join(', ')})`);

/* 2 · PEÇA SOBRE MESA — um palco de 4 × 4 m não cabe no corredor do layout
   padrão sem mexer nas mesas. A página não esconde isso: avisa e deixa o
   cliente arrastar. O que ela NÃO pode fazer é calar. */
const sobre = await p.evaluate(() => ({
  chocando: pecasSobreMesa(),
  aviso: document.getElementById('pecasAviso').hidden
    ? '' : document.getElementById('pecasAviso').textContent.replace(/\s+/g, ' ').trim(),
}));
ok(sobre.chocando.length === 0 ? sobre.aviso === '' : sobre.aviso.length > 10,
  sobre.chocando.length
    ? 'peça sobre mesa é avisada ao cliente ("' + sobre.aviso.slice(0, 74) + '")'
    : 'nenhuma peça nasce sobre mesa, e nenhum aviso aparece');

/* 3 · sem orçamento, a casa não põe mobiliário nenhum */
const semOrc = await b.newPage();
semOrc.on('pageerror', e => erros.push(String(e).slice(0, 150)));
await semOrc.setViewport({ width: 1360, height: 900 });
await semOrc.goto(`${SITE}?espaco=salao_eventos`, { waitUntil: 'networkidle2' });
await espera(2500);
const demo = await semOrc.evaluate(() => ({ contratadas: pecasContratadas(),
  pecas: (PROPOSTA.pecas || []).length, barra: !document.getElementById('pecasBarra').hidden }));
ok(Object.keys(demo.contratadas).length === 0 && demo.pecas === 0 && !demo.barra,
  'sem orçamento, nenhuma peça e nenhum botão (a casa não põe por conta)');
await semOrc.close();

/* 4 · tirar e pôr de volta, e o link lembra */
await p.evaluate(() => {
  const g = [...document.querySelectorAll('#pecasCamada .peca')].find(x => x.dataset.t === 'bistro');
  const r = g.getBoundingClientRect();
  g.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));
});
await espera(300);
await p.evaluate(() => {
  const g = [...document.querySelectorAll('#pecasCamada .peca')].find(x => x.dataset.t === 'bistro');
  const x = g.querySelector('.peca__x-hit'), r = x.getBoundingClientRect();
  x.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 2, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));
});
await espera(500);
const tirou = await ler();
ok(tirou.pecas.filter(x => x.t === 'bistro').length === 9, `tirar um bistrô deixa 9 na planta`);
const aviso = await p.evaluate(() => document.querySelector('[data-add="bistro"]').textContent.replace(/\s+/g, ' '));
ok(/9 de 10/.test(aviso), `e o botão diz quantas faltam (${aviso.trim()})`);
await p.evaluate(() => document.querySelector('[data-add="bistro"]').click());
await espera(500);
ok((await ler()).pecas.filter(x => x.t === 'bistro').length === 10, 'pôr de volta volta a 10');

/* 5 · arrastar move de verdade e fica guardado */
await p.evaluate(() => document.getElementById('planta').scrollIntoView({ block: 'center' }));
await espera(700);
const antes = await p.evaluate(() => {
  const g = [...document.querySelectorAll('#pecasCamada .peca')].find(x => x.dataset.t === 'palco');
  const r = g.getBoundingClientRect();
  return { i: +g.dataset.i, pos: { ...PROPOSTA.pecas[+g.dataset.i] }, x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await p.mouse.move(antes.x, antes.y);
await p.mouse.down();
await p.mouse.move(antes.x + 80, antes.y + 30, { steps: 8 });
await p.mouse.up();
await espera(600);
const depois = await p.evaluate(i => ({ ...PROPOSTA.pecas[i] }), antes.i);
ok(Math.hypot(depois.x - antes.pos.x, depois.y - antes.pos.y) > 20,
  `arrastar o palco move de verdade (${antes.pos.x},${antes.pos.y} → ${depois.x},${depois.y})`);
await p.reload({ waitUntil: 'networkidle2' });
await espera(4000);
const voltou = await p.evaluate(i => ({ ...(PROPOSTA.pecas || [])[i] }), antes.i);
ok(voltou && Math.abs(voltou.x - depois.x) < 3 && Math.abs(voltou.y - depois.y) < 3,
  `e o link lembra onde ele ficou (${voltou && voltou.x},${voltou && voltou.y})`);

/* 6 · a maquete 3D mostra o bistrô onde ele está na planta */
await p.evaluate(() => { document.getElementById('planta').scrollIntoView(); trocarVisao('v3d'); });
await espera(22000);
const cena = await p.evaluate(() => {
  const naPlanta = (PROPOSTA.pecas || []).filter(x => x.t === 'bistro');
  const naCena = T3.cena ? T3.cena.children.filter(o => o.name === 'bistro') : [];
  if (!naCena.length || !naPlanta.length) return { pronto: T3.pronto, n: naCena.length, bate: false };
  /* o 1º da planta tem que estar na mesma coordenada do 1º da cena */
  const m = pxParaM(naPlanta[0].x, naPlanta[0].y);
  const o = naCena[0].position;
  return { pronto: T3.pronto, n: naCena.length,
    bate: Math.abs(o.x - m.x) < 0.2 && Math.abs(o.z - m.z) < 0.2 };
});
ok(cena.pronto && cena.n === 10, `a maquete mostra os 10 bistrôs (${cena.n})`);
ok(cena.bate, 'e cada um no lugar onde está na planta');

ok(erros.length === 0, `sem erros de JS ${erros.slice(0, 2).join(' | ')}`);
await b.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO VERDE');
process.exit(falhas ? 1 : 0);
