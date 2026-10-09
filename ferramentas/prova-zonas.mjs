// ZONAS DE UMA MESMA CASA (05/10/2026).
//
// Pedido do dono: "Quando eu troco para palestra, não aparece nada, nem
// lounge, nem luau." O Mediterrâneo tem cinco zonas que dividem a MESMA
// imagem de planta e o mesmo recorte: trocar de aba não mexia no desenho e
// todo o mobiliário caía na primeira zona. Esta bateria garante que:
//   · cada zona tem a sua própria janela da planta (recorte diferente);
//   · o quadro não muda de tamanho entre as abas (mesma proporção);
//   · o palco e o telão ficam na zona de palestra;
//   · os bistrôs se espalham pelas zonas de estar;
//   · a zona aberta fica acesa e o resto do desenho escurece.
//
// Precisa de: node ferramentas/servir.mjs 8140 · node ferramentas/crm-falso.mjs
//   node ferramentas/prova-zonas.mjs
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
p.on('pageerror', e => erros.push(String(e).slice(0, 160)));
await p.setViewport({ width: 1440, height: 1000 });
const alvo = `${SITE}?espaco=mediterraneo&proposta=${TOKEN}&api=${CRM}`;
await p.goto(alvo, { waitUntil: 'networkidle2' });
await espera(600);
await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
await p.goto(alvo, { waitUntil: 'networkidle2' });
await espera(4000);

const zonas = await p.evaluate(() => PISOS.map(P => P.nome));
ok(zonas.length > 1, `a casa abre com ${zonas.length} zonas (${zonas.join(' · ')})`);
ok(!zonas.some(n => /[—–]/.test(n)), 'nenhum nome de zona com travessão');

/* 1 · cada aba mostra um pedaço diferente da planta, no mesmo tamanho */
const quadros = [];
for (let i = 0; i < zonas.length; i++) {
  await p.evaluate(k => trocarPiso(k), i);
  await espera(250);
  quadros.push(await p.evaluate(() => {
    const v = document.getElementById('plantaSvg').getAttribute('viewBox').split(' ').map(Number);
    return { vb: v, foco: !!document.querySelector('#areasCamada .zona__foco') };
  }));
}
const chaves = new Set(quadros.map(q => q.vb.join(',')));
ok(chaves.size === zonas.length, `cada zona com a sua janela (${chaves.size} de ${zonas.length} diferentes)`);
const props = quadros.map(q => q.vb[2] / q.vb[3]);
ok(Math.max(...props) - Math.min(...props) < 0.02,
  `mesmo quadro em todas as abas (proporção ${props.map(x => x.toFixed(2)).join(' · ')})`);
/* SEM AMPLIAR (09/10/2026) — a zona da Palestra tem 582 px na imagem e o quadro
   na tela tem 832: o recorte esticava a planta 43% e ela saía borrada. Agora o
   recorte tem um mínimo, e o que o cliente vê nunca é imagem ampliada. */
const tela = await p.evaluate(() => Math.round(document.getElementById('plantaSvg').getBoundingClientRect().width));
const maiorEscala = Math.max(...quadros.map(q => tela / q.vb[2]));
ok(maiorEscala <= 1.02, `nenhuma zona amplia a planta (maior escala ${maiorEscala.toFixed(2)}x em ${tela}px de tela)`);
ok(quadros.every(q => q.foco), 'o resto do desenho escurece em todas as abas');

/* 2 · cada peça na sua zona */
const porZona = await p.evaluate(() => {
  const m = {};
  for (const pc of (PROPOSTA.pecas || [])) {
    const n = (PISOS[pc.p | 0] || {}).nome || '?';
    (m[n] = m[n] || []).push(pc.t);
  }
  return m;
});
const nomes = Object.keys(porZona);
ok(nomes.length > 1, `o mobiliário se espalha por ${nomes.length} zonas`);
const palestra = nomes.find(n => /palestra|apresenta|auditório|auditorio/i.test(n));
ok(!!palestra && porZona[palestra].includes('palco') && porZona[palestra].includes('telao'),
  `palco e telão na zona de palestra (${palestra || 'nenhuma'}: ${(porZona[palestra] || []).join(', ')})`);
const estar = nomes.filter(n => /lounge|coffee|recep|bar|estar/i.test(n));
ok(estar.length >= 2 && estar.every(n => porZona[n].includes('bistro')),
  `bistrôs em ${estar.length} zonas de estar (${estar.join(' · ')})`);

/* 3 · nenhuma peça fora da área da sua zona */
const fora = await p.evaluate(() => (PROPOSTA.pecas || []).filter(pc => {
  const A = areaDoPiso(pc.p | 0);
  return pc.x < A.x0 || pc.x > A.x1 || pc.y < A.y0 || pc.y > A.y1;
}).length);
ok(fora === 0, `nenhuma peça fora da sua zona (${fora} fora)`);

/* 4 · VISTA GERAL — a casa inteira num quadro só, sem o escurecido da zona e
   sem a barra do editor: para mexer, o cliente escolhe um ambiente. */
await p.evaluate(() => trocarPiso(-1));
await espera(400);
const geral = await p.evaluate(() => ({
  pill: (document.querySelector('#pisosSel .pill') || {}).textContent || '',
  pecas: (PROPOSTA.pecas || []).length,
  desenhadas: document.querySelectorAll('#pecasCamada .peca').length,
  foco: !!document.querySelector('#areasCamada .zona__foco'),
  barra: !!(document.querySelector('.visao__foot .planta__bar') || {}).hidden,
  dica: !(document.getElementById('plantaDica') || {hidden:true}).hidden,
}));
ok(/Espaço inteiro/.test(geral.pill), `a primeira aba é a do espaço inteiro (${geral.pill.trim()})`);
ok(geral.desenhadas === geral.pecas, `mostra o mobiliário de todas as zonas (${geral.desenhadas} de ${geral.pecas})`);
ok(!geral.foco, 'sem escurecer nada: a planta inteira acesa');
ok(geral.barra && geral.dica, 'a barra do editor some e entra a dica de escolher o ambiente');

ok(erros.length === 0, 'sem erro de página' + (erros.length ? ': ' + erros[0] : ''));
await b.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO VERDE');
process.exit(falhas ? 1 : 0);
