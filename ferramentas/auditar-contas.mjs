// AUDITORIA DAS CONTAS — confere se o que a página MOSTRA fecha, em vez de
// repetir a conta que ela faz. Todos os números saem do DOM (as mesmas casas
// que o cliente lê) e do orçamento que o CRM entregou.
//
// Precisa de: node ferramentas/servir.mjs 8140
//             node ferramentas/crm-falso.mjs               (1 dia, 8141)
//             node ferramentas/crm-falso.mjs --multi-dia --porta 8143
//
//   node ferramentas/auditar-contas.mjs
import { createRequire } from 'module';
const require = createRequire(process.env.PUPPETEER_EM || 'C:/Users/User/Desktop/Comercial/crm-backend/package.json');
const puppeteer = require('puppeteer');
const SITE = process.env.PROPOSTA_URL || 'http://localhost:8140/';
const CRM1 = process.env.CRM_FALSO || 'http://localhost:8141';
const CRM2 = process.env.CRM_MULTI || 'http://localhost:8143';
const TOKEN = 'b'.repeat(40);
const espera = ms => new Promise(r => setTimeout(r, ms));
const cent = t => { const n = String(t).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'); return Math.round(parseFloat(n) * 100); };
const brl = c => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

let falhas = 0, avisos = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHOU ✗ ') + m); if (!c) falhas++; };
const aviso = m => { console.log('  ~  ' + m); avisos++; };

/* tudo o que a tela mostra de dinheiro, lido de uma vez */
const LER = () => ({
  gastro: document.getElementById('subGastro').textContent,
  estrutura: document.getElementById('subEstrutura').textContent,
  servicos: document.getElementById('subServicos').textContent,
  total: document.getElementById('totalGeral').textContent,
  pp: document.getElementById('invPP').textContent,
  conv: document.getElementById('invConvidados').textContent,
  tier: document.getElementById('tbTotal').textContent,
  itens: [...document.querySelectorAll('#listaItens .item')].map(li => ({
    nome: li.querySelector('.item__nome').textContent.trim(),
    preco: li.querySelector('.item__preco')?.textContent.trim() || '',
    qtd: li.querySelector('.trava__qtd')?.textContent.trim() || li.querySelector('.qtd__val')?.textContent.trim() || '',
    total: li.querySelector('.item__total').textContent.trim(),
    sub: li.classList.contains('item--subdia'),
  })),
  servLista: [...document.querySelectorAll('#listaServicos li')].map(li => ({
    nome: li.querySelector('span').textContent.trim(), valor: li.querySelector('b').textContent.trim(),
  })),
});

/* soma das linhas de item (fora o subtotal do dia) e dos serviços */
/* `linhasFecham` só vale onde a LISTA mostra o evento inteiro: no modo real de
   um dia. Na demo os cardápios não são linhas da lista (ficam nos cards) e no
   multi-dia a lista é de um dia só — nesses casos a soma é conferida à parte. */
function conferirFechamento(v, rotulo, linhasFecham = true) {
  const itens = v.itens.filter(i => !i.sub);
  const somaItens = itens.reduce((a, i) => a + (/incluso/i.test(i.total) ? 0 : cent(i.total)), 0);
  const somaServ = v.servLista.reduce((a, s) => a + cent(s.valor), 0);
  const blocos = cent(v.gastro) + cent(v.estrutura) + cent(v.servicos);
  const total = cent(v.total);
  ok(blocos === total, `${rotulo}: gastronomia + estrutura + serviços = total (${brl(blocos)} vs ${brl(total)})`);
  if (linhasFecham) ok(Math.abs(somaItens + somaServ - total) <= 1,
    `${rotulo}: soma das linhas da tela + serviços = total (${brl(somaItens + somaServ)} vs ${brl(total)})`);
  ok(cent(v.servicos) === somaServ,
    `${rotulo}: "serviços e taxas" = soma do bloco "já incluso" (${brl(cent(v.servicos))} vs ${brl(somaServ)})`);
  return { somaItens, somaServ, total };
}
/* cada linha: o valor total bate com quantidade × preço unitário MOSTRADO? */
function conferirLinhas(v, rotulo) {
  let piorCent = 0, pior = '';
  for (const i of v.itens.filter(x => !x.sub)) {
    const m = /R\$\s*([\d.,]+)/.exec(i.preco); if (!m) continue;
    const unit = cent(m[1]), qtd = parseInt(i.qtd, 10);
    if (!Number.isFinite(qtd) || !unit) continue;
    const dif = Math.abs(unit * qtd - cent(i.total));
    if (dif > piorCent) { piorCent = dif; pior = `${i.nome}: ${i.qtd} × ${m[1]} = ${brl(unit * qtd)}, mas a linha diz ${i.total}`; }
  }
  if (piorCent > 0) aviso(`${rotulo}: quem multiplicar na mão acha diferença de ${brl(piorCent)} — ${pior}`);
  else ok(true, `${rotulo}: quantidade × preço bate com o valor da linha (maior diferença ${brl(piorCent)})`);
  return piorCent;
}

const b = await puppeteer.launch({ headless: 'new', executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const erros = [];
const novaPagina = async url => {
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 950 });
  p.on('pageerror', e => erros.push(String(e).slice(0, 140)));
  p.on('console', m => { if (m.type() === 'error') erros.push('console: ' + m.text().slice(0, 140)); });
  await p.goto(url, { waitUntil: 'networkidle2' });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle2' });
  await espera(1800);
  return p;
};

/* ====================== 1 · MODO REAL, UM DIA ====================== */
console.log('\n=== 1 · orçamento do CRM, um dia ===');
const resp = await fetch(`${CRM1}/api/public/proposta/${TOKEN}`);
const orc = ((await resp.json()).data).orcamento;
const p1 = await novaPagina(`${SITE}?proposta=${TOKEN}&api=${CRM1}`);
let v = await p1.evaluate(LER);
ok(cent(v.total) === Math.round(orc.valor_total * 100), `abre com o total do CRM (${v.total})`);
conferirFechamento(v, 'abertura');
conferirLinhas(v, 'abertura');
ok(cent(v.tier) <= cent(v.total) + 100 && cent(v.tier) >= cent(v.total) - 100,
  `a barra fixa mostra o mesmo total arredondado (${v.tier})`);
const ppMostrado = cent(v.pp), ppConta = Math.round(cent(v.gastro) / parseInt(v.conv, 10));
ok(Math.abs(ppMostrado - ppConta) <= 2, `"por pessoa" = gastronomia ÷ convidados (${v.pp.trim()} vs ${brl(ppConta)})`);

/* mexer no número de convidados */
console.log('\n--- mudando convidados ---');
const porConvidados = {};
for (const n of [300, 200, 100, 30, 500]) {
  await p1.evaluate(q => mudarConvidados(q), n);
  await espera(450);
  v = await p1.evaluate(LER);
  const f = conferirFechamento(v, `${n} convidados`);
  conferirLinhas(v, `${n} convidados`);
  porConvidados[n] = { total: f.total, serv: f.somaServ, v };
  ok(parseInt(v.conv, 10) === n, `o card diz ${n} convidados`);
  const porPessoa = v.itens.filter(i => /por pessoa/.test(i.preco));
  const erradas = porPessoa.filter(i => parseInt(i.qtd, 10) !== n).map(i => i.nome);
  ok(erradas.length === 0, `todas as linhas por pessoa usam ${n} (${erradas.join(', ') || 'ok'})`);
}
ok(porConvidados[500].total > porConvidados[300].total && porConvidados[30].total < porConvidados[100].total,
  `o total sobe e desce junto com os convidados (30: ${brl(porConvidados[30].total)} · 500: ${brl(porConvidados[500].total)})`);
/* taxas por grupo de 100: 100 convidados = 1 grupo, 500 = 5 grupos */
const taxaDe = (n, nome) => cent((porConvidados[n].v.servLista.find(s => new RegExp(nome, 'i').test(s.nome)) || {}).valor || '0');
const seg100 = taxaDe(100, 'seguran'), seg500 = taxaDe(500, 'seguran');
ok(seg100 > 0 && Math.abs(seg500 - seg100 * 5) <= 200,
  `taxa de segurança acompanha os grupos de 100 (100 convidados ${brl(seg100)} · 500 ${brl(seg500)})`);
const lim100 = taxaDe(100, 'limpeza'), lim500 = taxaDe(500, 'limpeza');
ok(lim100 > 0 && Math.abs(lim500 - lim100 * 5) <= 200,
  `taxa de limpeza idem (${brl(lim100)} → ${brl(lim500)})`);
/* equipe: no CRM é um percentual sobre COMIDA E BEBIDA — tem que ser o mesmo
   percentual com qualquer número de convidados, e o mesmo do orçamento */
const pctDoOrcamento = (() => {
  const comida = orc.itens.filter(i => /alimentacao|bebidas/.test(i.bloco)).reduce((a, i) => a + i.valor_total, 0);
  const eq = (orc.servicos.find(s => /equipe/i.test(s.servico.nome)) || {}).valor_calculado || 0;
  return comida ? eq / comida : 0;
})();
const pctEquipe = n => {
  const e = cent((porConvidados[n].v.servLista.find(s => /equipe/i.test(s.nome)) || {}).valor || '0');
  const base = cent(porConvidados[n].v.gastro);
  return base ? e / base : 0;
};
const p100 = pctEquipe(100), p500 = pctEquipe(500);
console.log(`   percentual da equipe no orçamento do CRM: ${(pctDoOrcamento * 100).toFixed(2)}%`);
ok(Math.abs(p100 - p500) < 0.005, `a equipe mantém o percentual com 100 e com 500 convidados (${(p100 * 100).toFixed(1)}% e ${(p500 * 100).toFixed(1)}%)`);
ok(Math.abs(p500 - pctDoOrcamento) < 0.005, `e é o percentual do próprio orçamento (${(pctDoOrcamento * 100).toFixed(1)}%)`);

/* ---- as fórmulas são as do CRM (servicos_template.tipo_calculo) ---- */
console.log('\n--- fórmulas dos serviços, como no CRM ---');
const valorServ = (n, nome) => cent((porConvidados[n].v.servLista.find(s => new RegExp(nome, 'i').test(s.nome)) || {}).valor || '0');
for (const sv of orc.servicos) {
  const nome = sv.servico.nome, tipo = sv.servico.tipo_calculo;
  const v300 = valorServ(300, nome), v100 = valorServ(100, nome), v500 = valorServ(500, nome);
  const linha = `${nome} (${tipo}): 100→${brl(v100)} · 300→${brl(v300)} · 500→${brl(v500)}`;
  if (tipo === 'percentual_produtos') {
    const p = n => valorServ(n, nome) / cent(porConvidados[n].v.gastro);
    ok(Math.abs(p(100) - p(500)) < 0.005, `${linha} — percentual constante (${(p(300) * 100).toFixed(1)}%)`);
  } else if (tipo === 'por_grupo_convidados') {
    ok(v100 > 0 && Math.abs(v500 - v100 * 5) <= 200 && Math.abs(v300 - v100 * 3) <= 200,
      `${linha} — 1, 3 e 5 grupos de 100`);
  } else if (tipo === 'por_convidados') {
    ok(v100 > 0 && Math.abs(v500 - v100 * 5) <= 200, `${linha} — proporcional às pessoas`);
  } else {
    ok(v100 === v300 && v300 === v500, `${linha} — não muda com convidados`);
  }
}

/* voltar ao original tem que devolver exatamente o total do CRM */
await p1.evaluate(() => mudarConvidados(300));
await espera(450);
v = await p1.evaluate(LER);
ok(cent(v.total) === Math.round(orc.valor_total * 100), `voltando a 300, o total volta ao centavo do CRM (${v.total})`);

/* trocar e tirar cardápio */
console.log('\n--- mexendo nos cardápios ---');
const antesTroca = cent(v.total);
const trocou = await p1.evaluate(() => {
  const b = [...document.querySelectorAll('#cardsCoquetel .nivel')].find(x => x.textContent.includes('Pacote 4'));
  b.click(); return b.textContent.includes('Pacote 4');
});
await espera(600);
v = await p1.evaluate(LER);
conferirFechamento(v, 'trocou o coquetel');
ok(trocou && cent(v.total) > antesTroca, `trocar por um pacote mais caro sobe o total (${brl(antesTroca)} → ${v.total})`);
ok(/sujeito a confirmação/i.test(v.itens.map(i => i.preco).join(' ')),
  'o item que saiu do orçamento avisa que está sujeito a confirmação');
/* o último open bar não sai (o evento não pode ficar sem bebida); com um
   menu escolhido, o coquetel sai e as contas continuam fechando */
const protegido = await p1.evaluate(async () => {
  const esperar = ms => new Promise(r => setTimeout(r, ms));
  document.querySelector('#cardsOpenbar .nivel[aria-pressed="true"] .nivel__tirar').click();
  await esperar(400);
  const aviso = document.querySelector('.toast')?.textContent || '';
  const ficou = !!document.querySelector('#cardsOpenbar .nivel[aria-pressed="true"]');
  document.querySelectorAll('#cardsMenu .nivel')[0].click(); await esperar(700);
  document.querySelector('#cardsCoquetel .nivel[aria-pressed="true"] .nivel__tirar').click(); await esperar(700);
  return { aviso, ficou, coquetelSaiu: !document.querySelector('#cardsCoquetel .nivel[aria-pressed="true"]') };
});
ok(protegido.ficou && /sem bebida/i.test(protegido.aviso), `o último open bar não sai (${protegido.aviso.slice(0, 44)}…)`);
ok(protegido.coquetelSaiu, 'com um menu escolhido, o coquetel sai');
v = await p1.evaluate(LER);
conferirFechamento(v, 'depois de retirar o coquetel');
await p1.close();

/* ====================== 2 · MODO REAL, DOIS DIAS ====================== */
console.log('\n=== 2 · orçamento do CRM, dois dias ===');
const r2 = await fetch(`${CRM2}/api/public/proposta/${TOKEN}`);
const orc2 = ((await r2.json()).data).orcamento;
const p2 = await novaPagina(`${SITE}?proposta=${TOKEN}&api=${CRM2}`);
const subtotais = [];
for (let i = 0; i < orc2.dias.length; i++) {
  await p2.evaluate(k => document.querySelectorAll('#diasBarra [data-dia]')[k].click(), i);
  await espera(600);
  const vv = await p2.evaluate(LER);
  const linhas = vv.itens.filter(x => !x.sub).reduce((a, x) => a + (/incluso/i.test(x.total) ? 0 : cent(x.total)), 0);
  const sub = cent(vv.itens.find(x => x.sub).total);
  ok(Math.abs(linhas - sub) <= 2, `dia ${i + 1}: o subtotal é a soma das linhas do dia (${brl(linhas)} vs ${brl(sub)})`);
  conferirLinhas(vv, `dia ${i + 1}`);
  subtotais.push({ sub, serv: vv.servLista.reduce((a, s) => a + cent(s.valor), 0), total: cent(vv.total), v: vv });
}
const somaDias = subtotais.reduce((a, d) => a + d.sub, 0);
const servEvento = subtotais[0].serv;
ok(Math.abs(somaDias + servEvento - subtotais[0].total) <= 3,
  `a soma dos dias + serviços do evento = total (${brl(somaDias + servEvento)} vs ${brl(subtotais[0].total)})`);
ok(subtotais.every(d => d.total === subtotais[0].total), 'o total não muda ao trocar de dia');
ok(cent(subtotais[0].v.total) === Math.round(orc2.valor_total * 100), `total igual ao do CRM (${subtotais[0].v.total})`);
/* trocar o cardápio de um dia mexe só nele */
const antes2 = subtotais.map(d => d.sub);
await p2.evaluate(() => {
  document.querySelectorAll('#diasBarra [data-dia]')[1].click();
});
await espera(500);
await p2.evaluate(() => [...document.querySelectorAll('#cardsMenu .nivel')].find(x => x.textContent.includes('Menu Excellence')).click());
await espera(700);
const depois = [];
for (let i = 0; i < orc2.dias.length; i++) {
  await p2.evaluate(k => document.querySelectorAll('#diasBarra [data-dia]')[k].click(), i);
  await espera(550);
  const vv = await p2.evaluate(LER);
  depois.push(cent(vv.itens.find(x => x.sub).total));
  conferirFechamento(vv, `dia ${i + 1} depois da troca`, false);
}
ok(depois[0] === antes2[0], `o dia 1 fica intocado (${brl(depois[0])})`);
ok(depois[1] > antes2[1], `o dia 2 sobe com o menu mais caro (${brl(antes2[1])} → ${brl(depois[1])})`);
const vFinal = await p2.evaluate(LER);
ok(Math.abs(depois.reduce((a, x) => a + x, 0) + cent(vFinal.servicos) - cent(vFinal.total)) <= 3,
  `depois da troca, os dias + serviços continuam fechando o total (${vFinal.total})`);
await p2.close();

/* ====================== 3 · DEMO (sem token) ====================== */
console.log('\n=== 3 · demonstração, sem orçamento ===');
const p3 = await novaPagina(SITE);
v = await p3.evaluate(LER);
conferirFechamento(v, 'demo', false);
conferirLinhas(v, 'demo');
for (const n of [30, 240, 500]) {
  await p3.evaluate(q => mudarConvidados(q), n);
  await espera(400);
  v = await p3.evaluate(LER);
  conferirFechamento(v, `demo, ${n} convidados`, false);
}
/* extras com stepper: o total da linha acompanha a quantidade */
const extra = await p3.evaluate(async () => {
  const li = document.querySelector('#listaItens [data-edit]');
  if (!li) return null;
  const nome = li.querySelector('.item__nome').textContent.trim();
  const antes = { q: li.querySelector('.qtd__val').textContent, t: li.querySelector('.item__total').textContent };
  li.querySelector('[data-passo="1"]').click();
  await new Promise(r => setTimeout(r, 300));
  return { nome, antes, depois: { q: li.querySelector('.qtd__val').textContent, t: li.querySelector('.item__total').textContent } };
});
if (extra) {
  const un = (cent(extra.depois.t) - cent(extra.antes.t)) / Math.max(1, parseInt(extra.depois.q, 10) - parseInt(extra.antes.q, 10));
  ok(un > 0, `${extra.nome}: somar 1 soma o preço de 1 (${extra.antes.t} → ${extra.depois.t} = ${brl(un)} a unidade)`);
  v = await p3.evaluate(LER);
  conferirFechamento(v, 'demo com extra a mais', false);
}
await p3.close();

ok(erros.length === 0, `sem erros de JS ${erros.slice(0, 3).join(' | ')}`);
await b.close();
console.log(falhas ? `\n${falhas} FALHA(S)${avisos ? ` · ${avisos} aviso(s)` : ''}`
  : `\nCONTAS FECHAM${avisos ? ` · ${avisos} aviso(s) para olhar` : ''}`);
process.exit(falhas ? 1 : 0);
