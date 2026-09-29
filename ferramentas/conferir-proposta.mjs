/* CONFERÊNCIA — a página mostra exatamente o orçamento do CRM?
   Compara, campo a campo, o que `proposta.html` exibe com o que a rota pública
   devolve: data, convidados, espaço, cada item (nome, quantidade, valor),
   cada serviço, o total e as peças que foram para o layout.

   Uso:  node ferramentas/conferir-proposta.mjs <token> [base-da-api]
   Ex.:  node ferramentas/conferir-proposta.mjs b840d5a2…704a
*/
import { createRequire } from 'module';
const require = createRequire('C:/Users/User/Desktop/Comercial/crm-backend/package.json');
const puppeteer = require('puppeteer');
const espera = ms => new Promise(r => setTimeout(r, ms));

const TOKEN = process.argv[2];
const API = process.argv[3] || 'https://comercial-api.squareweb.app';
const SITE = process.env.SITE || 'http://localhost:8140';
if (!TOKEN) { console.error('uso: node ferramentas/conferir-proposta.mjs <token> [api]'); process.exit(2); }

const brl = v => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const num = t => Number(String(t).replace(/[^\d,]/g, '').replace(',', '.'));
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const resp = await fetch(`${API}/api/public/proposta/${TOKEN}`);
if (!resp.ok) { console.error('a rota pública respondeu', resp.status); process.exit(1); }
const orc = (await resp.json()).data.orcamento;

let falhas = 0;
const ok = (c, m, esperado, achado) => {
  console.log((c ? '  OK   ' : '  ✗    ') + m + (c ? '' : `\n         esperado: ${esperado}\n         na página: ${achado}`));
  if (!c) falhas++;
};

const navegador = await puppeteer.launch({ headless: 'new', executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const p = await navegador.newPage();
  await p.setViewport({ width: 1440, height: 950 });
  const url = `${SITE}/proposta.html?proposta=${TOKEN}` + (API.includes('localhost') ? `&api=${API}` : '');
  await p.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle2' });
  await espera(3000);

  const pg = await p.evaluate(() => {
    const t = s => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
    return {
      cliente: t('.brand__mono') || (document.querySelector('.brand__mono img') || {}).alt,
      titulo: document.title,
      data: t('#cardData .rcard__val'),
      convidados: t('.conv__val'),
      espaco: t('#espacoNome'),
      montagem: t('#layoutOrc'),
      total: t('#totalGeral'),
      subtotais: [t('#subGastro'), t('#subEstrutura'), t('#subServicos')],
      gastronomia: [...document.querySelectorAll('#cardapios .contratado')].map(c => ({
        nome: c.querySelector('.contratado__nome').textContent.trim(),
        preco: c.querySelector('.contratado__preco').textContent.replace(/\s+/g, ' ').trim(),
        filhos: [...c.querySelectorAll('.contratado__filho')].map(f => f.textContent.replace(/\s+/g, ' ').trim()),
      })),
      extras: [...document.querySelectorAll('#listaItens li')].map(li => ({
        nome: li.querySelector('.item__nome').textContent.trim(),
        qtd: (li.querySelector('.trava__qtd') || {}).textContent,
        total: (li.querySelector('.item__total') || {}).textContent.trim(),
      })),
      servicos: [...document.querySelectorAll('#listaServicos li')].map(li => ({
        nome: li.querySelector('span').textContent.trim(),
        valor: li.querySelector('b').textContent.trim(),
      })),
      pecas: (window.__PECAS__ ? window.__PECAS__.lista() : []).map(x => ({ tipo: x.tipo, nome: x.nome, larg: x.larg, prof: x.prof })),
    };
  });

  console.log(`\nORÇAMENTO ${orc.numero} · ${orc.cliente_nome}`);
  console.log(`(conferindo ${url})\n`);

  console.log('EVENTO');
  const dataBR = new Date(orc.data_evento + 'T12:00:00').toLocaleDateString('pt-BR');
  ok(pg.data === dataBR, 'data do evento', dataBR, pg.data);
  ok(pg.convidados === String(orc.num_convidados), 'número de convidados', orc.num_convidados, pg.convidados);
  ok(norm(pg.espaco) === norm(orc.espaco && orc.espaco.nome), 'espaço', orc.espaco && orc.espaco.nome, pg.espaco);
  if (orc.layout) ok(norm(pg.montagem || '').includes(norm(orc.layout.nome)), 'montagem do orçamento', orc.layout.nome, pg.montagem);
  ok(norm(pg.titulo).includes(norm(orc.cliente_nome)), 'cliente', orc.cliente_nome, pg.titulo);

  /* itens: cada linha contratada do CRM tem de estar na página, com a mesma conta */
  const contratados = (orc.itens || []).filter(i => i.contratado !== false);
  const naoContratados = (orc.itens || []).filter(i => i.contratado === false);
  const nomeDe = i => ((i.subproduto && i.subproduto.nome) || (i.produto && i.produto.nome) || '').trim();
  const naPagina = [
    ...pg.gastronomia.map(g => ({ nome: g.nome, texto: g.preco })),
    ...pg.gastronomia.flatMap(g => g.filhos.map(f => ({ nome: f.replace(/^↳\s*/, '').split('·')[0].trim(), texto: f }))),
    ...pg.extras.map(e => ({ nome: e.nome, texto: `${e.qtd} ${e.total}` })),
  ];

  console.log('\nITENS DO ORÇAMENTO (' + contratados.length + ')');
  /* o mesmo nome pode repetir no orçamento ("Crédito - Decoração" 6× e 1×):
     cada linha da página é consumida uma vez só */
  const usadas = new Set();
  for (const item of contratados) {
    const nome = nomeDe(item);
    const candidatas = naPagina.filter((l, i) => norm(l.nome) === norm(nome) && !usadas.has(i));
    const linha = candidatas.find(l => new RegExp(`\\b${item.quantidade}\\b`).test(l.texto)) || candidatas[0];
    if (linha) usadas.add(naPagina.indexOf(linha));
    if (!linha) { ok(false, `"${nome}"`, `${item.quantidade}× ${brl(item.valor_total)}`, 'não aparece'); continue; }
    const temQtd = new RegExp(`\\b${item.quantidade}\\b`).test(linha.texto);
    const temValor = Number(item.valor_total) === 0
      ? /incluso|—/.test(linha.texto)
      : linha.texto.includes(brl(item.valor_total).replace('R$ ', ''));
    ok(temQtd && temValor, `"${nome}"`, `${item.quantidade}× ${brl(item.valor_total)}`, linha.texto);
  }
  /* não contratado: aparece marcado (como na proposta oficial) e NÃO soma */
  for (const item of naoContratados) {
    const nome = nomeDe(item);
    const linha = pg.extras.find(e => norm(e.nome) === norm(nome));
    ok(!!linha && /^—|R\$ 0,00$/.test(linha.total),
      `"${nome}" listado como não contratado, sem valor`, 'linha marcada, total —', linha ? linha.total : 'não aparece');
  }

  /* com cupom no orçamento, a página ratea o abatimento nas linhas para que
     tudo feche com o total — o valor exibido é o do CRM vezes esse fator */
  const brutoServ = (orc.servicos || []).filter(s => s.ativo !== false).reduce((a, s) => a + Number(s.valor_calculado || 0), 0);
  const brutoItens = (orc.itens || []).filter(i => i.contratado !== false).reduce((a, i) => a + Number(i.valor_total || 0), 0);
  const fator = (brutoItens + brutoServ) > 0
    ? Number(orc.valor_total) / (brutoItens + brutoServ) : 1;
  console.log('\nSERVIÇOS' + (fator < 0.9999 ? ` (cupom rateado, fator ${fator.toFixed(4)})` : ''));
  for (const s of (orc.servicos || []).filter(s => s.ativo !== false)) {
    const nome = (s.servico && s.servico.nome) || '';
    const linha = pg.servicos.find(l => norm(l.nome) === norm(nome));
    const zero = Number(s.valor_calculado) === 0;
    if (!linha) { ok(zero && /reajuste/i.test(nome), `"${nome}"`, zero ? '(pode ficar fora)' : brl(s.valor_calculado), 'não aparece'); continue; }
    const esperado = Math.round(Number(s.valor_calculado) * fator * 100) / 100;
    ok(zero ? /incluso/i.test(linha.valor) : Math.abs(num(linha.valor) - esperado) < 0.02,
      `"${nome}"`, zero ? 'incluso' : brl(esperado), linha.valor);
  }

  console.log('\nTOTAL');
  /* o CRM abate cupom e desconto de template do valor_total */
  const bruto = contratados.reduce((a, i) => a + Number(i.valor_total || 0), 0)
    + (orc.servicos || []).filter(s => s.ativo !== false).reduce((a, s) => a + Number(s.valor_calculado || 0), 0);
  const abate = Number(orc.valor_desconto_cupom || 0) + Number(orc.valor_desconto_template || 0);
  const soma = bruto - abate;
  ok(Math.abs(num(pg.total) - Number(orc.valor_total)) < 0.02, 'total = valor_total do CRM', brl(orc.valor_total), pg.total);
  ok(Math.abs(soma - Number(orc.valor_total)) < 0.02,
    'linhas menos cupom fecham com o total' + (abate ? ' (cupom de ' + brl(abate) + ')' : ''),
    brl(orc.valor_total), brl(soma));
  /* na página os três subtotais têm de somar o total, com o cupom já rateado */
  const somaSub = pg.subtotais.reduce((a, t2) => a + num(t2), 0);
  ok(Math.abs(somaSub - Number(orc.valor_total)) < 0.02,
    'os três subtotais da página somam o total', brl(orc.valor_total), brl(somaSub));

  console.log('\nNO LAYOUT (itens que ocupam o salão)');
  for (const pc of pg.pecas) console.log(`  · ${pc.tipo.padEnd(7)} ${pc.larg}×${pc.prof} m — ${pc.nome}`);
  const semPeca = contratados
    .map(nomeDe)
    .filter(n => !pg.pecas.some(pc => norm(pc.nome) === norm(n) || norm(n).includes(norm(pc.nome))));
  console.log('  fora do layout (não ocupam piso ou vão na mesa): ' + (semPeca.join(' · ') || '—'));
} finally {
  await navegador.close();
}
console.log(falhas ? `\n${falhas} divergência(s)` : '\nTudo bate com o CRM.');
process.exit(falhas ? 1 : 0);
