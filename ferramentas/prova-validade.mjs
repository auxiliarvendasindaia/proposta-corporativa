// A VALIDADE NA TELA — faixa fixa com a conta regressiva, a barra fechando e o
// que acontece quando vence: o link continua abrindo, o cliente continua vendo
// tudo, e o convite passa a ser falar com a equipe.
//
// Precisa de: node ferramentas/servir.mjs 8140 · node ferramentas/crm-falso.mjs
//   node ferramentas/prova-validade.mjs
import { createRequire } from 'module';
const require = createRequire(process.env.PUPPETEER_EM || 'C:/Users/User/Desktop/Comercial/crm-backend/package.json');
const puppeteer = require('puppeteer');
const SITE = process.env.PROPOSTA_URL || 'http://localhost:8140/';
const CRM = process.env.CRM_FALSO || 'http://localhost:8141';
const TOKEN = 'b'.repeat(40);
const espera = ms => new Promise(r => setTimeout(r, ms));
let falhas = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHOU ✗ ') + m); if (!c) falhas++; };

const b = await puppeteer.launch({ headless: 'new', executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const p = await b.newPage();
await p.setViewport({ width: 1360, height: 900 });
const erros = [];
p.on('pageerror', e => erros.push(String(e).slice(0, 140)));
await p.goto(`${SITE}?proposta=${TOKEN}&api=${CRM}`, { waitUntil: 'networkidle2' });
await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
await p.reload({ waitUntil: 'networkidle2' });
await espera(2000);

/* 1 · a faixa está lá, fixa, com a conta regressiva */
const faixa = await p.evaluate(() => {
  const el = document.querySelector('.expirada');
  if (!el) return null;
  const barra = el.querySelector('.expirada__barra');
  return { txt: el.textContent.replace(/\s+/g, ' ').trim(), pos: getComputedStyle(el).position,
    topo: getComputedStyle(el).top, escala: barra && barra.style.transform,
    antesDoConteudo: el.parentElement.firstElementChild === el };
});
ok(!!faixa && /válida até/.test(faixa.txt), `a faixa mostra a validade (${faixa && faixa.txt.slice(0, 60)})`);
ok(faixa && /restam/.test(faixa.txt), 'e o quanto ainda resta');
ok(faixa && faixa.pos === 'sticky' && faixa.antesDoConteudo, `fica fixa no alto ao rolar (${faixa.pos}, top ${faixa.topo})`);
ok(faixa && /scaleX/.test(faixa.escala || ''), `a barra desenha o tempo que sobra (${faixa.escala})`);

/* 2 · a conta anda sozinha */
const antes = await p.evaluate(() => document.querySelector('.expirada__restam').textContent);
await espera(2200);
const depois = await p.evaluate(() => document.querySelector('.expirada__restam').textContent);
ok(antes !== depois || /d /.test(antes), `a conta regressiva anda (${antes} → ${depois})`);

/* 3 · a barra encolhe de verdade numa validade curta (2 minutos) */
const curta = await p.evaluate(async () => {
  VALIDADE_FIM = new Date(Date.now() + 120e3);
  try { localStorage.removeItem(CHAVE + '_abriu'); } catch (e) {}
  aplicarValidade();
  await new Promise(r => setTimeout(r, 1200));
  const el = document.querySelector('.expirada');
  return { cls: el.className, escala: el.querySelector('.expirada__barra').style.transform,
    txt: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 70) };
});
const frac = parseFloat((curta.escala.match(/scaleX\(([\d.]+)\)/) || [])[1] || '1');
ok(frac < 0.5, `perto do fim a barra fica curta (${curta.escala})`);
ok(/is-final/.test(curta.cls), `e vira alerta no último quarto (${curta.cls})`);

/* 4 · vencida: o link continua abrindo e o convite muda */
const vencida = await p.evaluate(async () => {
  VALIDADE_FIM = new Date(Date.now() - 60e3);
  aplicarValidade();
  await new Promise(r => setTimeout(r, 400));
  const el = document.querySelector('.expirada');
  return {
    txt: el.textContent.replace(/\s+/g, ' ').trim(),
    cls: el.className,
    confirmar: document.getElementById('btnConfirmar').textContent.trim(),
    cta: document.getElementById('btnCtaFinal').textContent.trim(),
    fine: document.querySelector('.cta__fine').textContent.trim().slice(0, 60),
    total: document.getElementById('totalGeral').textContent,
    investimentoVisivel: !document.getElementById('investimento').hidden,
    plantaVisivel: !!document.querySelector('#plantaSvg'),
  };
});
ok(/venceu em/.test(vencida.txt) && /renovar/.test(vencida.txt), `a faixa avisa que venceu (${vencida.txt.slice(0, 80)})`);
ok(/is-vencida/.test(vencida.cls), 'a barra some quando não há mais prazo');
ok(/falar com a equipe/i.test(vencida.confirmar) && /renovar/i.test(vencida.cta),
  `os botões viram conversa (${vencida.confirmar} · ${vencida.cta})`);
ok(vencida.investimentoVisivel && vencida.plantaVisivel && /R\$/.test(vencida.total),
  `o cliente continua vendo tudo e mexendo (${vencida.total})`);

/* 5 · clicar em confirmar com a proposta vencida leva para a conversa */
const destino = await p.evaluate(() => {
  let url = null;
  const original = window.open;
  window.open = u => { url = u; return null; };
  document.getElementById('btnConfirmar').click();
  window.open = original;
  return url;
});
ok(!!destino && /wa\.me/.test(destino), `confirmar leva para a conversa (${String(destino).slice(0, 48)}…)`);
const corpo = await p.evaluate(() => document.body.innerText);
ok(!/desconto|cupom/i.test(corpo), 'nenhuma palavra de desconto na página');
ok(erros.length === 0, `sem erros de JS ${erros.slice(0, 2).join(' | ')}`);

await b.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO VERDE');
process.exit(falhas ? 1 : 0);
