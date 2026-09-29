// Depende do puppeteer. A casa usa o que já existe no crm-backend; se a sua
// pasta for outra, aponte em PUPPETEER_EM ou instale aqui (npm i puppeteer).
import { createRequire } from "module";
const PUPPETEER_EM = process.env.PUPPETEER_EM || "C:/Users/User/Desktop/Comercial/crm-backend/package.json";
const require = createRequire(PUPPETEER_EM);
const puppeteer = require("puppeteer");
const BASE = process.env.PROPOSTA_URL || "http://localhost:8140";
const API = process.env.CRM_FALSO || "http://localhost:8141";

const espera = ms => new Promise(r => setTimeout(r, ms));
const cent = t => Math.round(Number(String(t).replace(/[^\d,]/g, '').replace(',', '.')) * 100);
const b = await puppeteer.launch({ headless: 'new', executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
let falhas = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHOU ✗ ') + m); if (!c) falhas++; };
const abrir = async (url) => {
  const p = await b.newPage(); await p.setViewport({ width: 1300, height: 950 });
  p.on('pageerror', e => { console.log('  ERRO JS:', String(e).slice(0, 140)); falhas++; });
  await p.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await p.reload({ waitUntil: 'networkidle2' }); await espera(1500);
  return p;
};
const estado = p => p.evaluate(() => ({
  titulo: document.title, versao: document.querySelector('#versaoBuild')?.textContent,
  total: document.querySelector('#totalGeral').textContent,
  itens: [...document.querySelectorAll('#listaItens .item .item__nome')].map(e => e.textContent),
  serv: [...document.querySelectorAll('#listaServicos li span')].map(e => e.textContent),
  aviso: document.querySelector('#avisoReal')?.textContent.replace(/\s+/g, ' ').trim(),
  conv: PROPOSTA.convidados, planta: document.querySelector('#plantaImg').getAttribute('src'),
  mesas: PROPOSTA.mesas.length, resumo: document.querySelector('#tbResumo').textContent,
  invisivel: document.getElementById('investimento')?.hidden, marca: document.querySelector('.brand__mono')?.textContent,
  corpo: document.body.innerText,
}));

/* 1 · SEM token: a demo DIMY tem de continuar idêntica */
let p = await abrir(`${BASE}/`);
let d = await estado(p);
console.log('\n— DEMO (sem token) —');
console.log(`   ${d.versao} · ${d.conv} convidados · total ${d.total} · ${d.itens.length} itens · ${d.serv.length} serviços`);
ok(cent(d.total) === 20849260 && d.conv === 200, 'demo com o total de sempre');
ok(d.itens.length === 9 && d.serv.length === 7, 'demo com os 9 itens e 7 serviços de sempre');
ok(!d.aviso && d.marca === 'DIMY', 'demo sem aviso de modo real e com a marca DIMY');
ok(d.planta === 'assets/planta-salao-eventos.jpg' && d.mesas === 19, 'planta e layout originais');
await p.close();

/* 2 · COM token: o orçamento real (ORC-2026-02412, cupom de R$ 11.250) */
p = await abrir(`${BASE}/?proposta=${'b'.repeat(40)}&api=${API}`);
let r = await estado(p);
console.log('\n— COM TOKEN (ORC-2026-02412) —');
console.log(`   ${r.titulo} · ${r.conv} convidados · total ${r.total}`);
r.itens.forEach(i => console.log('     ' + i));
console.log('   serviços:', r.serv.join(' · '));
console.log('   aviso:', r.aviso);
ok(cent(r.total) === 12378295, `total igual ao do CRM (${r.total})`);
ok(r.itens.length === 10 && r.serv.length === 6, `10 linhas e 6 serviços do orçamento (${r.itens.length}/${r.serv.length})`);
ok(!/Coffee Superior|DJ - Essencial|Crédito - Audiovisual|Sousplat/.test(r.itens.join('|')), 'nenhum item da demo sobrando');
ok(!/desconto|cupom/i.test(r.corpo), 'nenhuma menção a desconto ou cupom');
ok(/sujeito a confirmação/i.test(r.aviso || ''), 'aviso de confirmação presente');
ok(r.conv === 300 && /SEBRAE/i.test(r.titulo), `cliente e convidados do orçamento (${r.titulo})`);

/* RETIRAR DA PROPOSTA — o cliente tira o que não quer pelo botão do card, mas
   o evento nunca fica sem comida nem sem bebida */
const tirar = await p.evaluate(async () => {
  const esperar = ms => new Promise(r => setTimeout(r, ms));
  const btn = s => document.querySelector(`${s} .nivel[aria-pressed="true"] .nivel__tirar`);
  const r = { visiveis: [...document.querySelectorAll('.nivel[aria-pressed="true"] .nivel__tirar')].length };
  btn('#cardsOpenbar').click(); await esperar(400);
  r.semBebida = document.querySelector('.toast')?.textContent || '';
  r.openbarFicou = !!document.querySelector('#cardsOpenbar .nivel[aria-pressed="true"]');
  btn('#cardsCoquetel')?.click(); await esperar(400);
  r.semComida = document.querySelector('.toast')?.textContent || '';
  /* com um menu escolhido, o coquetel pode sair */
  document.querySelectorAll('#cardsMenu .nivel')[0].click(); await esperar(700);
  btn('#cardsCoquetel').click(); await esperar(700);
  r.coquetelSaiu = !document.querySelector('#cardsCoquetel .nivel[aria-pressed="true"]');
  r.total = document.getElementById('totalGeral').textContent;
  return r;
});
ok(tirar.visiveis >= 2, `o botão "Retirar da proposta" aparece nos cardápios escolhidos (${tirar.visiveis})`);
ok(/sem bebida/i.test(tirar.semBebida) && tirar.openbarFicou, `o último open bar não sai (${tirar.semBebida.slice(0, 44)}…)`);
ok(/sem comida/i.test(tirar.semComida), `a última comida não sai (${tirar.semComida.slice(0, 44)}…)`);
ok(tirar.coquetelSaiu, `com um menu escolhido, o coquetel sai (total ${tirar.total})`);
/* cliente mexe: sobe convidados e troca o cardápio */
await p.evaluate(() => mudarConvidados(350)); await espera(400);
const r2 = await estado(p);
ok(cent(r2.total) > cent(r.total) && /Valor estimado/.test(r2.aviso || ''), `mudou convidados: ${r.total} → ${r2.total}`);
await p.evaluate(() => { const b = [...document.querySelectorAll('#cardsMenu .nivel')].find(x => x.textContent.includes('Menu Excellence')); b.click(); });
await espera(500);
const r3 = await estado(p);
ok(cent(r3.total) > cent(r2.total), `trocou por um menu mais caro: ${r2.total} → ${r3.total}`);
/* o último open bar continua protegido mesmo pelo clique no card */
await p.evaluate(() => selecionar('openbar', PROPOSTA.openbar)); await espera(400);
const r4 = await estado(p);
const toast = await p.evaluate(() => document.querySelector('.toast')?.textContent || '');
ok(cent(r4.total) === cent(r3.total) && /sem bebida/i.test(toast), `bebida protegida também no clique (${toast.slice(0, 52)})`);
/* reabrir mantém os ajustes */
await p.reload({ waitUntil: 'networkidle2' }); await espera(1500);
const r5 = await estado(p);
ok(r5.conv === 350 && cent(r5.total) === cent(r4.total), 'ajustes continuam ao reabrir o link');
await p.close();

/* 3 · token que o CRM não entrega: nunca a demo */
p = await abrir(`${BASE}/?proposta=${'c'.repeat(40)}&api=http://localhost:8199`);
const q = await estado(p);
console.log('\n— TOKEN SEM RESPOSTA —');
console.log(`   ${q.titulo} · marca ${q.marca} · investimento escondido: ${q.invisivel}`);
ok(!/DIMY/.test(q.corpo), 'nada da DIMY aparece');
ok(q.invisivel === true && /não está mais disponível/i.test(q.corpo), 'mostra aviso e esconde os valores');
await p.close();
await b.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO VERDE');
process.exit(falhas ? 1 : 0);
