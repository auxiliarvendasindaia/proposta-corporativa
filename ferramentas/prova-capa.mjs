// A CAPA — o título muda com o tipo de evento, a frase muda com a casa, e
// tudo isso sem empurrar os botões para fora da primeira tela.
//
// Precisa de: node ferramentas/servir.mjs 8140 · node ferramentas/crm-falso.mjs
//   node ferramentas/prova-capa.mjs
import { createRequire } from 'module';
const require = createRequire(process.env.PUPPETEER_EM || 'C:/Users/User/Desktop/Comercial/crm-backend/package.json');
const puppeteer = require('puppeteer');
const SITE = process.env.PROPOSTA_URL || 'http://localhost:8140/index.html';
const CRM = process.env.CRM_FALSO || 'http://localhost:8141';
const espera = ms => new Promise(r => setTimeout(r, ms));
let falhas = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHOU ✗ ') + m); if (!c) falhas++; };

const b = await puppeteer.launch({ headless: 'new', executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const erros = [];

/* 1 · cada casa tem a sua frase, e ela fala do que existe lá */
const ESPERADO = {
  salao_eventos: /vidro de ponta a ponta|figueira/,
  mezanino: /mezanino|dois níveis/,
  solar: /casarão|pátio da árvore/,
  mirante: /Lagoa da Conceição|Hall dos Espelhos/,
  canto_lagoa: /deck de frente para a Lagoa/,
};
const p = await b.newPage();
await p.setViewport({ width: 1360, height: 860 });
p.on('pageerror', e => erros.push(String(e).slice(0, 130)));
for (const [amb, regra] of Object.entries(ESPERADO)) {
  await p.goto(`${SITE}?espaco=${amb}`, { waitUntil: 'networkidle2' });
  await espera(1500);
  const v = await p.evaluate(() => ({
    frase: document.getElementById('heroFrase').textContent.trim(),
    assina: document.querySelector('.hero__ajuste').textContent.trim(),
    titulo: document.querySelector('.hero__title').textContent.replace(/\s+/g, ' ').trim(),
    botoes: (() => { const r = document.querySelector('.hero__actions').getBoundingClientRect(); return r.bottom <= innerHeight; })(),
  }));
  ok(regra.test(v.frase), `${amb}: a frase é da casa ("${v.frase.slice(0, 62)}…")`);
  ok(v.frase.length <= 130, `${amb}: frase curta (${v.frase.length} letras)`);
  ok(/Cozinha, equipe e estrutura são nossas/.test(v.assina), `${amb}: a assinatura do Indaiá está logo abaixo`);
  ok(v.botoes, `${amb}: os botões continuam na primeira tela`);
  /* nada de promessa que a casa não cumpre */
  ok(!/sem coluna|sem pilar|maior de Santa Catarina|melhor de/i.test(v.frase),
    `${amb}: nenhuma promessa sem base na frase`);
}

/* 2 · o título acompanha o tipo de evento do orçamento */
const TIPOS = [['Corporativo', /convidados/], ['Dinner', /jantar/i], ['Formatura', /história/],
  ['Casamento', /imaginaram/], ['15 Anos', /contar/], ['Outros Eventos', /representa/]];
for (const [tipo, regra] of TIPOS) {
  const t = await p.evaluate(nome => { vestirFrases(nome); return document.querySelector('.hero__title').textContent.replace(/\s+/g, ' ').trim(); }, tipo);
  ok(regra.test(t), `${tipo}: "${t}"`);
}

/* 1b · a foto do alto é a escolhida para o espaço, e a capa tem UM caminho */
for (const amb of ['salao_eventos', 'mezanino', 'mirante']) {
  await p.goto(`${SITE}?espaco=${amb}`, { waitUntil: 'networkidle2' });
  await p.waitForFunction(() => { const i = document.getElementById('heroImg'); return i && i.naturalWidth > 0; }, { timeout: 60000 }).catch(() => {});
  const foto = await p.evaluate(() => {
    const f = fotoDestaque(), i = document.getElementById('heroImg');
    return { cap: (f && f.cap) || '', largura: i ? i.naturalWidth : 0, escolhida: AMB.heroFoto };
  });
  ok(foto.largura > 0, `${amb}: a foto do alto carregou (${foto.largura}px)`);
  ok(!/casamento|noiv|15 anos|debutante/i.test(foto.cap), `${amb}: nada de casamento na capa ("${foto.cap.slice(0, 46)}")`);
  ok(Number.isInteger(foto.escolhida), `${amb}: foto escolhida a dedo (índice ${foto.escolhida})`);
}
const botoesCapa = await p.evaluate(() => [...document.querySelectorAll('.hero__actions a')].map(a => a.textContent.trim()));
ok(botoesCapa.length === 1 && /Ver a proposta/.test(botoesCapa[0]), `a capa tem um caminho só (${botoesCapa.join(' · ')})`);

/* 2b · o miolo também fala a língua do evento, e cada seção mostra o que só
   o Indaiá entrega */
await p.goto(`${SITE}?espaco=salao_eventos`, { waitUntil: 'networkidle2' });
await espera(1500);
const miolo = await p.evaluate(tipo => {
  vestirFrases(tipo);
  return ['resumo', 'cardapios', 'extras', 'planta', 'galeria'].map(id => {
    const s = document.getElementById(id);
    return { id, tit: s.querySelector('.sec__title').textContent.trim(),
      dif: (s.querySelector('.sec__dif') || {}).textContent || '' };
  });
}, 'Corporativo');
const porId = id => miolo.find(x => x.id === id);
ok(/sustenta o encontro/.test(porId('cardapios').tit), `corporativo: "${porId('cardapios').tit}"`);
ok(/estrutura que o seu evento pede/.test(porId('extras').tit), `corporativo: "${porId('extras').tit}"`);
ok(/Onde o seu evento acontece/.test(porId('galeria').tit), `corporativo: "${porId('galeria').tit}"`);
ok(!miolo.some(s => /festa/i.test(s.tit)), 'nenhum título de festa numa proposta corporativa');
for (const id of ['cardapios', 'extras', 'planta', 'galeria'])
  ok(porId(id).dif.length > 20, `${id}: linha do diferencial ("${porId(id).dif.slice(0, 52)}…")`);
/* casamento e 15 anos ficam com o texto original da página */
const festa = await p.evaluate(() => { vestirFrases('Casamento'); return document.querySelector('#cardapios .sec__title').textContent.trim(); });
ok(/conduz a noite/.test(festa), `casamento mantém o texto da casa ("${festa}")`);

/* 3 · com o orçamento do CRM, o tipo vem de lá */
await p.goto(`${SITE}?espaco=salao_eventos&proposta=${'b'.repeat(40)}&api=${CRM}`, { waitUntil: 'networkidle2' });
await espera(2200);
const real = await p.evaluate(() => ({
  titulo: document.querySelector('.hero__title').textContent.replace(/\s+/g, ' ').trim(),
  frase: document.getElementById('heroFrase').textContent.trim(),
  chapeu: document.querySelector('.eyebrow').textContent.trim(),
}));
ok(/convidados/.test(real.titulo), `orçamento corporativo traz o título dos convidados (${real.titulo})`);
ok(/Mediterrâneo|vidro|figueira/.test(real.frase) || real.frase.length > 0, 'a frase da casa continua na capa');

/* 3b · compartilhar leva a validade junto, e não existe baixar */
await b.defaultBrowserContext().overridePermissions(new URL(SITE).origin, ['clipboard-read', 'clipboard-write']);
await p.bringToFront();
const comp = await p.evaluate(async () => {
  await compartilharProposta();
  await new Promise(r => setTimeout(r, 500));
  let copiado = '';
  try { copiado = await navigator.clipboard.readText(); } catch (e) { copiado = ''; }
  return { toast: document.querySelector('.toast')?.textContent || '', copiado };
});
ok(/Vale até \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}/.test(comp.copiado),
  `o texto compartilhado diz até quando vale ("${comp.copiado.split('.')[1] || comp.copiado.slice(0, 60)}")`);
ok(comp.copiado.includes('proposta='), 'e leva o link da proposta junto');
ok(/copiado/i.test(comp.toast), `o cliente recebe a confirmação (${comp.toast.slice(0, 48)}…)`);
const semBaixar = await p.evaluate(() => {
  const txt = document.body.innerText;
  return { baixar: /baixar|download|salvar em pdf/i.test(txt),
    botoes: [...document.querySelectorAll('button,a')].some(b => /baixar|download/i.test(b.textContent)) };
});
ok(!semBaixar.baixar && !semBaixar.botoes, 'a proposta não oferece baixar em lugar nenhum');
/* com a proposta vencida, o texto compartilhado avisa */
const vencido = await p.evaluate(() => { VALIDADE_FIM = new Date(Date.now() - 6e4); aplicarValidade(); return textoParaCompartilhar(); });
ok(/validade desta proposta terminou/.test(vencido), `vencida: "${vencido.slice(0, 70)}…"`);

/* 4 · no celular a capa também cabe */
const c = await b.newPage();
await c.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 });
c.on('pageerror', e => erros.push(String(e).slice(0, 130)));
await c.goto(`${SITE}?espaco=mirante`, { waitUntil: 'networkidle2' });
await espera(1600);
const cel = await c.evaluate(() => {
  const f = document.getElementById('heroFrase').getBoundingClientRect();
  const a = document.querySelector('.hero__actions').getBoundingClientRect();
  return { fraseVisivel: f.top < innerHeight, botoes: Math.round(a.bottom), alt: innerHeight,
    rolagemH: document.documentElement.scrollWidth <= innerWidth + 1 };
});
ok(cel.fraseVisivel, 'no celular a frase aparece sem rolar');
ok(cel.rolagemH, 'e a capa não escorre para o lado');
ok(erros.length === 0, `sem erros de JS ${erros.slice(0, 2).join(' | ')}`);

await b.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO VERDE');
process.exit(falhas ? 1 : 0);
