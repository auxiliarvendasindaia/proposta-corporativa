/* Bateria da PROPOSTA FECHADA (proposta.html).
   Sobe nada: espera o site em http://localhost:8140 e o CRM de teste em 8142
   (node ferramentas/crm-de-teste.mjs). Confere, no Chrome headless:
     1. os valores são EXATAMENTE os do orçamento e nada é editável;
     2. os itens do orçamento viram peças no 2D e na maquete 3D;
     3. o que o cliente mexe no layout sobrevive ao recarregar;
     4. sem link (ou com o CRM fora do ar) a página avisa em vez de inventar.
   Uso: node ferramentas/prova-proposta-fechada.mjs
*/
import { createRequire } from 'module';
const require = createRequire('C:/Users/User/Desktop/Comercial/crm-backend/package.json');
const puppeteer = require('puppeteer');
const espera = ms => new Promise(r => setTimeout(r, ms));

const SITE = process.env.SITE || 'http://localhost:8140';
const API = process.env.API_TESTE || 'http://localhost:8142';
const TOKEN = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0';
const URL = `${SITE}/proposta.html?proposta=${TOKEN}&api=${API}`;

let falhas = 0;
const ok = (c, m, extra) => { console.log((c ? 'OK     ' : 'FALHOU ') + m + (extra != null && !c ? ' → ' + extra : '')); if (!c) falhas++; };
const brl = t => Number(String(t).replace(/[^\d,]/g, '').replace(',', '.'));

const navegador = await puppeteer.launch({ headless: 'new', executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const orc = (await (await fetch(`${API}/api/public/proposta/${TOKEN}`)).json()).data.orcamento;

  /* ---------- 1 · a proposta aberta ---------- */
  const p = await navegador.newPage();
  await p.setViewport({ width: 1440, height: 950 });
  const erros = [];
  p.on('pageerror', e => erros.push(String(e).slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error') erros.push('console: ' + m.text().slice(0, 140)); });
  /* limpa UMA vez (o teste 4 recarrega a página e precisa do que foi salvo) */
  await p.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle2' });
  await espera(1400);

  const d = await p.evaluate(() => {
    const t = s => { const e = document.querySelector(s); return e ? e.textContent.trim() : null; };
    return {
      cliente: t('.brand__mono'), total: t('#totalGeral'), convidados: t('.conv__val'),
      logo: (document.querySelector('.brand__mono img.marca-logo') || {}).getAttribute
        ? document.querySelector('.brand__mono img.marca-logo').getAttribute('alt') : null,
      tema: getComputedStyle(document.documentElement).getPropertyValue('--gold').trim(),
      blocoCardapios: getComputedStyle(document.querySelector('#cardapios')).backgroundColor,
      gastro: t('#subGastro'), estrutura: t('#subEstrutura'), servicos: t('#subServicos'),
      linhasServico: [...document.querySelectorAll('#listaServicos li')].map(li => li.textContent.trim()),
      extras: [...document.querySelectorAll('#listaItens .item__nome')].map(e => e.textContent),
      contratados: [...document.querySelectorAll('.contratado__nome')].map(e => e.textContent),
      editaveis: document.querySelectorAll('.stepper:not([hidden]), #listaItens .qtd, #btnReset').length,
      visiveis: [...document.querySelectorAll('.stepper, #listaItens .qtd, #btnReset, .niveis-wrap')].filter(e => e.offsetParent).length,
      pecas: window.__PECAS__ ? window.__PECAS__.lista().map(x => ({ id: x.id, tipo: x.tipo, x: x.x, y: x.y })) : [],
      desenhadas: document.querySelectorAll('#pecasCamada .pc').length,
      mesas: (JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /^proposta_/.test(k)) || '') || '{}').mesas || []).length,
      montagem: (window.__PACOTE_CRM__ || {}).montagem || null,
    };
  });

  /* o topo mostra a logo do cliente quando ela existe; senão, o nome */
  ok(d.logo ? /wesales/i.test(d.logo) : d.cliente === orc.cliente_nome,
    'identidade do cliente no topo (logo ou nome)', d.logo || d.cliente);
  ok(d.tema === '#BE9E5E', 'tema da festa aplicado (dourado palha)', d.tema);
  ok(d.blocoCardapios === 'rgb(235, 225, 204)', 'bloco dos cardápios em palha, não grafite', d.blocoCardapios);
  ok(Math.abs(brl(d.total) - orc.valor_total) < 0.02, `total = valor_total do CRM (${orc.valor_total})`, brl(d.total));
  ok(d.convidados === String(orc.num_convidados), 'convidados = os do orçamento', d.convidados);
  ok(Math.abs(brl(d.gastro) + brl(d.estrutura) + brl(d.servicos) - orc.valor_total) < 0.05,
    'os três subtotais somam o total do CRM', `${brl(d.gastro)}+${brl(d.estrutura)}+${brl(d.servicos)}`);
  ok(d.linhasServico.length === orc.servicos.filter(s => s.ativo !== false).length,
    'todos os serviços ativos aparecem', d.linhasServico.length);
  ok(d.visiveis === 0, 'nada editável em valores (stepper, quantidade, restaurar, cardápios)', d.visiveis);
  const itensQueViramPeca = ['Palco', 'Telão', 'Pista', 'Lounge', 'Bar', 'Mesa de doces', 'Cabine de DJ'];
  ok(d.pecas.length >= 9, 'itens do orçamento viraram peças do layout', d.pecas.map(x => x.tipo).join(','));
  ok(d.desenhadas === d.pecas.length, 'todas as peças desenhadas na planta', `${d.desenhadas}/${d.pecas.length}`);
  ok(d.mesas > 0, 'o salão abriu montado', d.mesas);
  ok(erros.length === 0, 'sem erro de JS na abertura', erros.join(' || '));

  /* ---------- 2 · a maquete 3D ---------- */
  await p.evaluate(() => document.querySelector('[data-visao="v3d"]').click());
  await espera(15000);
  const tres = await p.evaluate(() => {
    const T = window.__PECAS__.tres();
    let fixos = [];
    T.cena.traverse(o => { if (/^casa_/.test(o.name)) fixos.push(o.name + (o.visible ? ':visível' : ':oculto')); });
    return { pecas3d: T.pecasGrupo ? T.pecasGrupo.children.length : 0, fixos, chips: document.querySelectorAll('#tresAmbs [data-peca3d]').length };
  });
  ok(tres.pecas3d >= 9, 'peças presentes na maquete 3D', tres.pecas3d);
  /* a maquete nova do CRM já traz o palco no próprio GLB (telao:false), então
     pode não haver objeto `casa_*` nenhum — o que houver tem de estar oculto */
  ok(tres.fixos.every(f => /oculto/.test(f)),
    'palco/telão/pista do cenário não duplicam os da proposta', tres.fixos.join(' ') || '(a maquete não tem)');
  ok(tres.chips >= 5, 'atalhos de câmera por item', tres.chips);

  /* ---------- 3 · passeio virtual (no lugar do 360, que sai cinza nesta maquete) ---------- */
  const passeio = await p.evaluate(() => ({
    pills: [...document.querySelectorAll('[data-visao]')].filter(b => !b.hidden).map(b => b.textContent.trim()),
    botao: (document.querySelector('#btnTour') || {}).textContent || '',
    chips: document.querySelectorAll('#tresAmbs .pill').length,
  }));
  ok(!passeio.pills.some(t => /360/.test(t)), 'a aba 360 fica escondida', passeio.pills.join(' · '));
  ok(/passeio virtual/i.test(passeio.botao), 'o passeio virtual está em destaque no 3D', passeio.botao);
  ok(passeio.chips > 0 && passeio.chips < 20, 'atalhos de câmera sem duplicar', passeio.chips);
  await p.evaluate(() => document.querySelector('#btnTour').click());
  await espera(5000);
  const tour = await p.evaluate(() => (document.querySelector('#tresLegenda') || {}).textContent || '');
  ok(/tour/i.test(tour), 'o passeio roda com o layout do cliente', tour);
  await p.keyboard.press('Escape');
  await espera(800);

  /* ---------- 4 · o cliente mexe e o ajuste fica salvo ---------- */
  await p.evaluate(() => document.querySelector('[data-visao="v2"]').click());
  await espera(600);
  const movido = await p.evaluate(() => {
    const pc = window.__PECAS__.lista().find(x => x.tipo === 'lounge');
    const antes = { x: pc.x, y: pc.y };
    const g = document.querySelector(`[data-pc="${pc.id}"]`);
    g.focus();
    for (let i = 0; i < 4; i++) g.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    const depois = window.__PECAS__.lista().find(x => x.id === pc.id);
    return { id: pc.id, antes, depois: { x: depois.x, y: depois.y } };
  });
  ok(movido.depois.x < movido.antes.x, 'seta move a peça na planta', JSON.stringify(movido));
  await p.reload({ waitUntil: 'networkidle2' });
  await espera(1600);
  const guardado = await p.evaluate(id => {
    const pc = window.__PECAS__.lista().find(x => x.id === id);
    return pc ? { x: pc.x, y: pc.y } : null;
  }, movido.id);
  ok(guardado && guardado.x === movido.depois.x && guardado.y === movido.depois.y,
    'a posição escolhida pelo cliente sobrevive ao recarregar', JSON.stringify(guardado));

  /* ---------- 4.1 · o cliente tira e põe itens no salão ---------- */
  const mexeu = await p.evaluate(() => {
    const antes = window.__PECAS__.lista().length;
    document.querySelector('[data-add="bar"]').click();
    const comBar = window.__PECAS__.lista().length;
    const lounge = window.__PECAS__.lista().find(x => x.tipo === 'lounge');
    window.__PECAS__.remover(lounge.id);
    return { antes, comBar, fim: window.__PECAS__.lista().length, mudancas: window.__PECAS__.mudancas() };
  });
  ok(mexeu.comBar === mexeu.antes + 1, 'adicionar bar entra no layout', JSON.stringify(mexeu));
  ok(mexeu.fim === mexeu.antes, 'tirar um item contratado sai do layout', JSON.stringify(mexeu));
  ok(mexeu.mudancas.some(m => /^sem /.test(m)) && mexeu.mudancas.some(m => /^mais /.test(m)),
    'as mudanças do cliente ficam registradas para o consultor', mexeu.mudancas.join(' · '));
  await p.reload({ waitUntil: 'networkidle2' });
  await espera(1800);
  const depoisDeRecarregar = await p.evaluate(() => window.__PECAS__.mudancas());
  ok(depoisDeRecarregar.length === mexeu.mudancas.length,
    'os ajustes do layout sobrevivem ao recarregar', depoisDeRecarregar.join(' · '));
  const totalIntacto = await p.evaluate(() => document.querySelector('#totalGeral').textContent);
  ok(Math.abs(brl(totalIntacto) - orc.valor_total) < 0.02,
    'mexer no layout NÃO muda o valor da proposta', totalIntacto);

  /* ---------- 5 · sem link e com o CRM fora do ar ---------- */
  const p2 = await navegador.newPage();
  await p2.goto(`${SITE}/proposta.html`, { waitUntil: 'networkidle2' });
  await espera(600);
  const semLink = await p2.evaluate(() => document.body.textContent);
  ok(/link do seu consultor/i.test(semLink), 'sem token, a página pede o link em vez de mostrar demo');

  const p3 = await navegador.newPage();
  await p3.goto(`${SITE}/proposta.html?proposta=${TOKEN}&api=http://localhost:8199`, { waitUntil: 'networkidle2' });
  await espera(2500);
  const semCrm = await p3.evaluate(() => document.body.textContent);
  ok(/não conseguimos abrir a sua proposta/i.test(semCrm), 'CRM fora do ar: avisa e não inventa valores');
} finally {
  await navegador.close();
}
console.log(falhas ? `\n${falhas} falha(s)` : '\nbateria verde');
process.exit(falhas ? 1 : 0);
