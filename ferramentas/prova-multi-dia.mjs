// Prova do evento de mais de um dia: a página tem que mostrar a barra de dias,
// só os itens do dia escolhido, o subtotal do dia, o total do evento inteiro e
// o caminho para a planta do dia que acontece em outro espaço.
//
// Antes de rodar, em dois terminais:
//   node ferramentas/servir.mjs 8140
//   node ferramentas/crm-falso.mjs --multi-dia
//
// Depois:
//   node ferramentas/prova-multi-dia.mjs
import { createRequire } from 'module';
const require = createRequire(process.env.PUPPETEER_EM || 'C:/Users/User/Desktop/Comercial/crm-backend/package.json');
const puppeteer = require('puppeteer');
const CRM = process.env.CRM_FALSO || 'http://localhost:8141';
const URL_BASE = process.env.PROPOSTA_URL || 'http://localhost:8140/';
const TOKEN = 'b'.repeat(40);
const alvo = esp => `${URL_BASE}?proposta=${TOKEN}&api=${CRM}${esp ? `&espaco=${esp}` : ''}`;
const espera = ms => new Promise(r => setTimeout(r, ms));
const cent = t => Math.round(parseFloat(String(t).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')) * 100);

let falhas = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHOU ✗ ') + m); if (!c) falhas++; };

const b = await puppeteer.launch({ headless: 'new', executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const p = await b.newPage();
await p.setViewport({ width: 1360, height: 950 });
const erros = [];
p.on('pageerror', e => erros.push(String(e).slice(0, 160)));
p.on('console', m => { if (m.type() === 'error') erros.push('console: ' + m.text().slice(0, 140)); });

/* o orçamento que o CRM falso está servindo (para comparar de verdade) */
const resp = await fetch(`${CRM}/api/public/proposta/${TOKEN}`);
const bruto = await resp.json();
const orc = (bruto.data || bruto).orcamento;
const dias = orc.dias;
ok(dias && dias.length === 2, `CRM falso está em modo 2 dias (${dias ? dias.length : 0})`);

await p.goto(alvo(), { waitUntil: 'networkidle2' });
await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
await p.reload({ waitUntil: 'networkidle2' });
await espera(1800);

/* 1 · barra de dias */
const barra = await p.evaluate(() => {
  const el = document.getElementById('diasBarra');
  if (!el) return null;
  return {
    antesDaLista: el.nextElementSibling?.id === 'diasPlanta' || el.nextElementSibling?.id === 'listaItens',
    pills: [...el.querySelectorAll('[data-dia]')].map(b => ({ txt: b.textContent.replace(/\s+/g, ' ').trim(), sel: b.getAttribute('aria-selected') })),
  };
});
ok(!!barra && barra.pills.length === 2, `barra com um botão por dia (${barra ? barra.pills.length : 0})`);
ok(!!barra && barra.pills[0].sel === 'true' && barra.pills[1].sel === 'false', 'abre no dia 1');
console.log('   dia 1:', barra && barra.pills[0].txt);
console.log('   dia 2:', barra && barra.pills[1].txt);
for (const d of dias) {
  const pill = barra.pills[d.numero - 1].txt;
  ok(pill.includes(String(d.num_convidados)) && pill.includes(d.espaco.nome)
    && pill.includes(String(d.data_evento).slice(8, 10)), `dia ${d.numero} traz data, convidados e espaço`);
}

/* 2 · a lista mostra só os itens do dia ativo, e o subtotal fecha com eles */
const somaCent = num => Math.round(orc.itens.filter(i => i.dia_id === dias[num - 1].id)
  .reduce((a, i) => a + i.valor_total, 0) * 100);
const lerLista = () => p.evaluate(() => ({
  nomes: [...document.querySelectorAll('#listaItens .item:not(.item--subdia) .item__nome')].map(n => n.textContent.trim()),
  sub: document.querySelector('#subtotalDia .item__total')?.textContent || '',
  subNome: document.querySelector('#subtotalDia .item__nome')?.textContent || '',
  total: document.getElementById('totalGeral').textContent,
  nota: document.getElementById('diasPlanta')?.textContent.replace(/\s+/g, ' ').trim() || '',
  link: document.querySelector('#diasPlanta a')?.getAttribute('href') || '',
}));

const d1 = await lerLista();
const nomes1 = orc.itens.filter(i => i.dia_id === dias[0].id).map(i => i.produto.nome);
const nomes2 = orc.itens.filter(i => i.dia_id === dias[1].id).map(i => i.produto.nome);
ok(d1.nomes.length === nomes1.length, `dia 1 lista as ${nomes1.length} linhas dele (${d1.nomes.length})`);
ok(!d1.nomes.includes('Menu Superior II'), 'nenhum item do dia 2 aparece no dia 1');
ok(/Subtotal do dia 1/.test(d1.subNome), `fecha com o subtotal do dia (${d1.subNome})`);

/* 3 · total do evento = total do CRM (inteiro, nunca só o dia) */
ok(cent(d1.total) === Math.round(orc.valor_total * 100),
  `total é o do evento inteiro: ${d1.total} = ${orc.valor_total}`);
/* o subtotal do dia tem que ser menor que o total e proporcional às linhas */
const razao = cent(d1.sub) / somaCent(1);
ok(cent(d1.sub) < cent(d1.total) && razao > 0.7 && razao <= 1.001,
  `subtotal do dia 1 ${d1.sub} vem das linhas dele (rateio ${(razao * 100).toFixed(1)}%)`);

/* 4 · planta do dia 2: espaço diferente → link com o ?espaco= certo */
await p.click('[data-dia]:nth-child(2)');
await espera(600);
const d2 = await lerLista();
ok(d2.nomes.length === nomes2.length && d2.nomes.includes('Menu Superior II'),
  `dia 2 troca a lista pelas ${nomes2.length} linhas dele (${d2.nomes.join(' · ')})`);
ok(/Subtotal do dia 2/.test(d2.subNome), 'subtotal acompanha o dia escolhido');
ok(cent(d2.total) === Math.round(orc.valor_total * 100), `o total não muda ao trocar de dia (${d2.total})`);
ok(/solar/i.test(d2.nota) && /espaco=solar/.test(d2.link), `oferece a planta do outro espaço (${d2.link})`);
ok(cent(d2.sub) !== cent(d1.sub), 'subtotal do dia 2 é diferente do dia 1');

/* 5 · a planta do dia 2 abre de verdade, com a proposta ainda vestida */
const p2 = await b.newPage();
await p2.setViewport({ width: 1360, height: 950 });
p2.on('pageerror', e => erros.push('planta dia2: ' + String(e).slice(0, 140)));
await p2.goto(alvo('solar'), { waitUntil: 'networkidle2' });
await espera(1800);
const naSolar = await p2.evaluate(() => ({
  espaco: document.getElementById('espacoNome')?.textContent.trim(),
  total: document.getElementById('totalGeral').textContent,
  nota: document.getElementById('diasPlanta')?.textContent.replace(/\s+/g, ' ').trim() || '',
  temLink: !!document.querySelector('#diasPlanta a'),
  dia2: document.querySelector('[data-dia][aria-selected="true"]')?.textContent.replace(/\s+/g, ' ').trim(),
}));
ok(/solar/i.test(naSolar.espaco || ''), `abre a planta do Solar (${naSolar.espaco})`);
ok(cent(naSolar.total) === Math.round(orc.valor_total * 100), `mesma proposta, mesmo total (${naSolar.total})`);
await p2.evaluate(() => document.querySelectorAll('[data-dia]')[1].click());
await espera(500);
const notaSolar = await p2.evaluate(() => ({
  nota: document.getElementById('diasPlanta')?.textContent.replace(/\s+/g, ' ').trim() || '',
  temLink: !!document.querySelector('#diasPlanta a'),
}));
ok(!notaSolar.temLink && /deste dia/.test(notaSolar.nota),
  `no Solar, o dia 2 diz que a planta é dele (${notaSolar.nota})`);
await p2.close();

/* 6 · convidados seguem travados (cada dia tem o seu) */
const travas = await p.evaluate(() => {
  const st = document.querySelector('.stepper');
  return { stepperEscondido: !!st && st.hidden, leitura: document.getElementById('convDoDia')?.textContent };
});
ok(travas.stepperEscondido, `sem stepper de convidados no multi-dia (leitura: ${travas.leitura})`);

/* 7 · COMIDA E BEBIDA DE CADA DIA: a troca é individual e o total responde */
const barraNosCardapios = await p.evaluate(() => {
  const el = document.getElementById('diasBarraCard');
  return el ? { n: el.querySelectorAll('[data-dia]').length, dentro: !!el.closest('#cardapios'),
    ativo: el.querySelector('[aria-selected="true"]')?.textContent.replace(/\s+/g, ' ').trim() } : null;
});
ok(!!barraNosCardapios && barraNosCardapios.n === 2 && barraNosCardapios.dentro,
  `a seção de cardápios tem a barra de dias (ativo: ${barraNosCardapios && barraNosCardapios.ativo})`);
/* estamos no dia 2 (Menu Superior II, 180 convidados) — troca o menu dele */
const cardapioDoDia = () => p.evaluate(() => ({
  pressed: ['#cardsCoquetel', '#cardsMenu', '#cardsOpenbar'].map(s =>
    document.querySelector(`${s} .nivel[aria-pressed="true"] .nivel__nome`)?.textContent || '—'),
  linhas: [...document.querySelectorAll('#listaItens .item:not(.item--subdia) .item__nome')].map(n => n.textContent.trim()),
  sub: document.querySelector('#subtotalDia .item__total')?.textContent || '',
  total: document.getElementById('totalGeral').textContent,
}));
const antesTroca = await cardapioDoDia();
ok(antesTroca.pressed[1] === 'Menu Superior II', `o dia 2 abre com o menu dele marcado (${antesTroca.pressed.join(' · ')})`);
await p.evaluate(() => [...document.querySelectorAll('#cardsMenu .nivel')]
  .find(b => b.textContent.includes('Menu Privilege')).click());
await espera(700);
const depoisTroca = await cardapioDoDia();
ok(depoisTroca.linhas.includes('Menu Privilege') && !depoisTroca.linhas.includes('Menu Superior II'),
  `trocar o menu do dia 2 troca a linha dele (${depoisTroca.linhas.join(' · ')})`);
ok(cent(depoisTroca.sub) > cent(antesTroca.sub), `o subtotal do dia 2 sobe (${antesTroca.sub} → ${depoisTroca.sub})`);
ok(cent(depoisTroca.total) > cent(antesTroca.total), `o total do evento sobe (${antesTroca.total} → ${depoisTroca.total})`);
/* o dia 1 continua com o cardápio dele, intacto */
await p.evaluate(() => document.querySelectorAll('#diasBarra [data-dia]')[0].click());
await espera(700);
const dia1Depois = await cardapioDoDia();
ok(!dia1Depois.linhas.includes('Menu Privilege') && dia1Depois.linhas.includes('Pacote 1'),
  `o dia 1 não foi contaminado (${dia1Depois.linhas.slice(0, 3).join(' · ')})`);
ok(cent(dia1Depois.sub) === cent(d1.sub), `subtotal do dia 1 intacto (${dia1Depois.sub})`);
ok(dia1Depois.pressed[0] === 'Pacote 1', `os cards mostram o cardápio do dia aberto (${dia1Depois.pressed.join(' · ')})`);
/* tirar a única alimentação do dia 1 é barrado, e o aviso fala do dia */
await p.evaluate(() => [...document.querySelectorAll('#cardsCoquetel .nivel')]
  .find(b => b.getAttribute('aria-pressed') === 'true').click());
await espera(500);
const barrado = await p.evaluate(() => ({ toast: document.querySelector('.toast')?.textContent || '',
  linhas: [...document.querySelectorAll('#listaItens .item__nome')].map(n => n.textContent.trim()) }));
ok(/dia 1/i.test(barrado.toast) && barrado.linhas.includes('Pacote 1'),
  `não deixa o dia 1 ficar sem comida (${barrado.toast.slice(0, 70)})`);
/* o que o cliente mexeu sobrevive ao recarregar */
await p.reload({ waitUntil: 'networkidle2' });
await espera(1800);
const aposRecarregar = await p.evaluate(() => {
  const l = () => [...document.querySelectorAll('#listaItens .item__nome')].map(n => n.textContent.trim());
  const d1 = l();
  document.querySelectorAll('#diasBarra [data-dia]')[1].click();
  return { d1, d2: l(), total: document.getElementById('totalGeral').textContent };
});
ok(aposRecarregar.d2.includes('Menu Privilege') && !aposRecarregar.d1.includes('Menu Privilege'),
  'a troca do dia 2 continua lá depois de recarregar (e só nele)');
ok(cent(aposRecarregar.total) === cent(depoisTroca.total), `o total volta igual (${aposRecarregar.total})`);
/* volta ao cardápio original do dia 2, para o resumo do fim de fluxo */
await p.evaluate(() => [...document.querySelectorAll('#cardsMenu .nivel')]
  .find(b => b.textContent.includes('Menu Superior II')).click());
await espera(700);
const voltou = await p.evaluate(() => document.getElementById('totalGeral').textContent);
ok(cent(voltou) === Math.round(orc.valor_total * 100), `voltando o cardápio, o total volta ao do CRM (${voltou})`);

/* 8 · resumo do fim de fluxo com os dois dias */
/* o botão agora vai direto para a conversa; o resumo por dia continua
   existindo e é o que a mensagem leva — abrimos o modal à mão para conferir */
await p.evaluate(() => abrirModal());
await espera(600);
const modal = await p.evaluate(() => {
  const el = document.querySelector('.modal__lista');
  return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
});
ok(/Dia 1/.test(modal) && /Dia 2/.test(modal), `o resumo lista os dois dias (${modal.slice(0, 120)})`);
ok(!/desconto|cupom/i.test(modal), 'nenhuma palavra de desconto no resumo');
const msg = decodeURIComponent((await p.evaluate(() => linkDaConversa())).split('text=')[1] || '');
ok(/Dia 1/.test(msg) || /Dia 2/.test(msg) || /Total/.test(msg), `a conversa recebe os ajustes ("${msg.slice(0, 60).replace(/\s+/g, ' ')}…")`);

/* 9 · nada de desconto/pagamento na página */
const corpo = await p.evaluate(() => document.body.innerText);
ok(!/desconto|cupom/i.test(corpo), 'a página inteira não fala de desconto');
ok(!/parcela|entrada de|condições de pagamento/i.test(corpo), 'nem de condições de pagamento');
ok(erros.length === 0, `sem erros de JS ${erros.slice(0, 3).join(' | ')}`);

await b.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO VERDE');
process.exit(falhas ? 1 : 0);
