// O ROTEIRO E O FILME DA CAPA — as duas novidades da v18.09-21.
//
// O roteiro é escrito pela página a partir do que a proposta traz: ele não
// pode inventar um jantar que não foi contratado, nem prometer horário (o
// orçamento do CRM não guarda hora do evento). O filme da capa é o vídeo do
// cliente, sem som, e some quando o navegador pede menos movimento.
//
// Precisa de: node ferramentas/servir.mjs 8140 · node ferramentas/crm-falso.mjs
//   node ferramentas/prova-roteiro-capa.mjs
import { createRequire } from 'module';
const require = createRequire(process.env.PUPPETEER_EM || 'C:/Users/User/Desktop/Comercial/crm-backend/package.json');
const puppeteer = require('puppeteer');
const SITE = process.env.PROPOSTA_URL || 'http://localhost:8140/index.html';
const CRM = process.env.CRM_FALSO || 'http://localhost:8141';
const TOKEN = 'b'.repeat(40);
const espera = ms => new Promise(r => setTimeout(r, ms));
let falhas = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHOU ✗ ') + m); if (!c) falhas++; };

/* headless nasce com prefers-reduced-motion: reduce — sem isto o filme da
   capa nunca entra e a bateria mediria o contrário do que quer medir */
const semFreio = p => p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

const b = await puppeteer.launch({ headless: 'new', executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--autoplay-policy=no-user-gesture-required'] });
const erros = [];
const lerRoteiro = p => p.evaluate(() => ({
  oculto: document.getElementById('roteiro').hidden,
  secao: (document.getElementById('roteiro').closest('section') || {}).id,
  ordem: [...document.querySelectorAll('main > section[id]')].map(x => x.id),
  passos: [...document.querySelectorAll('.roteiro__passo')].map(l => ({
    num: l.querySelector('.roteiro__num').textContent.trim(),
    nome: l.querySelector('.roteiro__nome').textContent.trim(),
    aceso: l.classList.contains('roteiro__passo--mudou'),
    txt: l.querySelector('.roteiro__txt').textContent.trim() })),
}));

/* 1 · com o orçamento do SEBRAE (coquetel + open bar, sem jantar) */
const p = await b.newPage();
p.on('pageerror', e => erros.push(String(e).slice(0, 140)));
await semFreio(p);
await p.setViewport({ width: 1440, height: 950 });
await p.goto(`${SITE}?espaco=salao_eventos&proposta=${TOKEN}&api=${CRM}`, { waitUntil: 'networkidle2' });
await espera(3000);
const r = await lerRoteiro(p);
ok(!r.oculto && r.passos.length >= 4, `o roteiro aparece com ${r.passos.length} momentos`);
/* O ROTEIRO FICA DEPOIS DOS CARDÁPIOS (01/10) — ele nasceu na seção 01, ACIMA
   das escolhas: o cliente trocava um menu e nunca via a sequência mudar, e
   concluiu que ela não mudava. Agora fecha a seção 03, abaixo de tudo o que
   descreve. */
ok(r.ordem.indexOf(r.secao) > r.ordem.indexOf('cardapios'),
  `e fica depois dos cardápios, em "${r.secao}" (${r.ordem.join(' > ')})`);
ok(r.passos.every(x => !x.aceso), 'ao chegar, nenhum momento está aceso');
ok(r.passos[0].nome === 'A casa pronta' && /encerramento/i.test(r.passos.at(-1).nome),
  'começa na montagem e termina no encerramento');
ok(r.passos.every((x, i) => x.num === String(i + 1).padStart(2, '0')), 'os momentos vêm numerados em ordem');
/* o orçamento não tem jantar: o roteiro NÃO pode falar de jantar */
ok(!r.passos.some(x => /jantar|buffet/i.test(x.nome + x.txt)),
  'sem jantar no orçamento, nenhum momento promete jantar');
ok(r.passos.some(x => /coquetel/i.test(x.txt)), 'o coquetel contratado está no roteiro');
ok(r.passos.some(x => /open bar/i.test(x.txt)), 'o open bar contratado está no roteiro');
/* nada de horário: o CRM não manda hora do evento */
const texto = r.passos.map(x => x.nome + ' ' + x.txt).join(' ');
ok(!/\d{1,2}\s?h(\b|\d)|\d{1,2}:\d{2}/.test(texto), 'nenhum horário inventado no roteiro');
const sub = await p.evaluate(() => document.getElementById('cardDataSub').textContent.trim());
ok(!/\dh|\d{1,2}:\d{2}/.test(sub), `nem no card da data ("${sub}")`);

/* 2 · trocar o cardápio reescreve o roteiro na hora */
const antes = r.passos.length;
await p.evaluate(() => selecionar('menu', 'm3'));
await espera(600);
const depois = await lerRoteiro(p);
ok(depois.passos.length === antes + 1 && depois.passos.some(x => /Menu Premium/.test(x.txt)),
  `escolher um jantar acrescenta o momento (${antes} → ${depois.passos.length})`);
/* o toque do cliente ACENDE o momento que mudou — e só ele */
const cliqueReal = await (async () => {
  const caixa = await p.evaluate(() => {
    const c = [...document.querySelectorAll('#cardsOpenbar .nivel')].find(x => x.getAttribute('aria-pressed') !== 'true');
    c.scrollIntoView({ block: 'center' });
    const r = c.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + 30 };
  });
  await espera(500);
  await p.mouse.click(caixa.x, caixa.y);
  await espera(600);
  return lerRoteiro(p);
})();
const acesos = cliqueReal.passos.filter(x => x.aceso);
ok(acesos.length === 1 && /bar/i.test(acesos[0].nome),
  `trocar o bar acende só aquele momento (${acesos.map(x => x.nome).join(', ') || 'nenhum'})`);
await p.evaluate(() => tirarDaProposta('menu'));
await espera(600);
const semJantar = await lerRoteiro(p);
ok(semJantar.passos.length === antes, 'e tirar o jantar tira o momento de volta');
/* tirar um momento empurra os de baixo: comparar por posição acenderia a
   linha inteira, e a página compara por NOME */
ok(semJantar.passos.filter(x => x.aceso).length === 0,
  'e tirar não acende a linha inteira');

/* 3 · o filme da capa é o do cliente, sem som e em laço */
/* de volta ao topo: fora da tela o filme PAUSA de propósito (para não
   decodificar dois vídeos junto com o player da seção 05), e os testes acima
   rolaram a página até os cardápios */
await p.evaluate(() => scrollTo(0, 0));
await espera(1200);
const capa = await p.evaluate(() => {
  const v = document.querySelector('.hero__fundo video');
  return v ? { src: v.dataset.src, mudo: v.muted, laco: v.loop, tocando: !v.paused,
    visivel: document.querySelector('.hero__fundo').classList.contains('filme-ok'),
    foto: !!document.getElementById('heroImg') } : null;
});
ok(!!capa, 'a capa tem filme');
/* O FILME DA CAPA SEGUE O SALÃO (07/10/2026) — o passeio da ORC-2026-02412 foi
   regravado no Mediterrâneo, que é a casa do orçamento. Aberta no Salão de
   Eventos, a proposta mostra o filme DA CASA, não o do evento: filme de outro
   salão na capa é a casa errada, que foi o defeito apontado em 05/10. */
ok(capa && /ambientes\/salao_eventos\/video\/capa/.test(capa.src),
  `aberta em outro salão, a capa roda o filme DA CASA (${capa && capa.src})`);
ok(capa && capa.mudo && capa.laco, 'sem som e em laço');
ok(capa && capa.tocando && capa.visivel, 'tocando e visível');
ok(capa && capa.foto, 'a foto continua embaixo, para quando o vídeo não rolar');

/* 4 · quem pede menos movimento fica com a foto */
const q = await b.newPage();
q.on('pageerror', e => erros.push(String(e).slice(0, 140)));
await q.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await q.setViewport({ width: 1440, height: 950 });
await q.goto(`${SITE}?espaco=salao_eventos&proposta=${TOKEN}&api=${CRM}`, { waitUntil: 'networkidle2' });
await espera(2600);
const parado = await q.evaluate(() => ({ video: !!document.querySelector('.hero__fundo video'),
  foto: !!document.querySelector('.hero__fundo img') }));
ok(!parado.video && parado.foto, 'com "menos movimento" a capa fica na foto, sem vídeo');

/* 5 · na demonstração (sem orçamento) o roteiro e o filme são os da casa */
const d = await b.newPage();
d.on('pageerror', e => erros.push(String(e).slice(0, 140)));
await semFreio(d);
await d.setViewport({ width: 1440, height: 950 });
await d.goto(`${SITE}?espaco=solar`, { waitUntil: 'networkidle2' });
await espera(3200);
const demo = await lerRoteiro(d);
ok(!demo.oculto && demo.passos.length >= 4, `demonstração: roteiro com ${demo.passos.length} momentos`);
const filmeDemo = await d.evaluate(() => { const v = document.querySelector('.hero__fundo video'); return v && v.dataset.src; });
ok(/ambientes\/solar/.test(filmeDemo || ''), `e o filme da capa é o da casa (${filmeDemo})`);

/* 6 · no modo só-layout (dentro do CRM) nada disso aparece */
const l = await b.newPage();
await semFreio(l);
await l.setViewport({ width: 1200, height: 800 });
await l.goto(`${SITE}?espaco=salao_eventos&modo=layout`, { waitUntil: 'networkidle2' });
await espera(1800);
const layout = await l.evaluate(() => ({ roteiro: document.getElementById('roteiro').hidden,
  video: !!document.querySelector('.hero__fundo video') }));
ok(layout.roteiro && !layout.video, 'modo só-layout: sem roteiro e sem filme na capa');

/* 7 · o índice lateral sai das próprias seções e marca onde o cliente está */
const ix = await b.newPage();
ix.on('pageerror', e => erros.push(String(e).slice(0, 140)));
await semFreio(ix);
await ix.setViewport({ width: 1440, height: 900 });
await ix.goto(`${SITE}?espaco=salao_eventos&proposta=${TOKEN}&api=${CRM}`, { waitUntil: 'networkidle2' });
await espera(3000);
const indice = await ix.evaluate(() => {
  const n = document.getElementById('indice');
  if (!n) return null;
  const secs = [...document.querySelectorAll('main > section.sec[id]')].filter(s => !s.hidden).map(s => s.id);
  return { itens: [...n.querySelectorAll('a')].map(a => a.dataset.sec), secs, noTopo: n.classList.contains('on') };
});
ok(!!indice && indice.itens.join() === indice.secs.join(),
  `o índice tem uma entrada por seção visível (${indice ? indice.itens.length : 0})`);
ok(indice && !indice.noTopo, 'e fica escondido enquanto o cliente está na capa');
for (const [alvo, escuro] of [['cardapios', true], ['investimento', false]]) {
  await ix.evaluate(s => document.getElementById(s).scrollIntoView({ block: 'center' }), alvo);
  await espera(800);
  const m = await ix.evaluate(() => { const n = document.getElementById('indice');
    const a = n.querySelector('a[aria-current="true"]');
    return { marcado: a && a.dataset.sec, on: n.classList.contains('on'), claro: n.classList.contains('indice--claro') }; });
  ok(m.marcado === alvo && m.on, `em "${alvo}" o índice marca a seção certa (${m.marcado})`);
  ok(m.claro === escuro, `e clareia sobre a seção escura (${alvo}: ${m.claro})`);
}
const layoutIx = await b.newPage();
await layoutIx.goto(`${SITE}?espaco=salao_eventos&modo=layout`, { waitUntil: 'networkidle2' });
await espera(1500);
ok(!(await layoutIx.evaluate(() => !!document.getElementById('indice'))), 'modo só-layout: sem índice');

ok(erros.length === 0, `sem erros de JS ${erros.slice(0, 2).join(' | ')}`);
await b.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO VERDE');
process.exit(falhas ? 1 : 0);
