// Depende do puppeteer. A casa usa o que já existe no crm-backend; se a sua
// pasta for outra, aponte em PUPPETEER_EM ou instale aqui (npm i puppeteer).
import { createRequire } from "module";
const PUPPETEER_EM = process.env.PUPPETEER_EM || "C:/Users/User/Desktop/Comercial/crm-backend/package.json";
const require = createRequire(PUPPETEER_EM);
const puppeteer = require("puppeteer");
const BASE = process.env.PROPOSTA_URL || "http://localhost:8140";
const API = process.env.CRM_FALSO || "http://localhost:8141";

const espera = ms => new Promise(r => setTimeout(r, ms));
const b = await puppeteer.launch({ headless: 'new', executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
let falhas = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHOU ✗ ') + m); if (!c) falhas++; };

/* celular: peso e linha de item */
const p = await b.newPage(); await p.setViewport({ width: 400, height: 820, isMobile: true, deviceScaleFactor: 2 });
let originais = 0;
p.on('response', r => { if (/midias\/chat\/full/.test(r.url()) && !/render\/image/.test(r.url())) originais++; });
/* PESO DE VERDADE (05/10/2026) — somar o content-length declarado contava os
   10 MB do filme inteiro: o <video> pede a faixa, o servidor responde 206 com
   o tamanho do arquivo e o Chrome lê só o começo. O que conta para o cliente
   é o que desce pelo fio: o encodedDataLength de cada pedido. */
const cdp = await p.createCDPSession(); await cdp.send('Network.enable');
let bytes = 0;
cdp.on('Network.loadingFinished', e => { bytes += e.encodedDataLength; });
const erros = []; p.on('pageerror', e => erros.push(String(e).slice(0, 130)));
await p.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); bytes = 0; await p.reload({ waitUntil: 'networkidle2' }); await espera(1200);
await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } });
await espera(3000);
console.log(`\npeso no celular (página inteira): ${(bytes / 1e6).toFixed(1)} MB`);
ok(bytes < 6e6, `abaixo de 6 MB (era 22,9 MB)`);
ok(originais === 0, `nenhuma foto original de 11 MB baixada (${originais})`);
const linha = await p.evaluate(() => {
  const li = [...document.querySelectorAll('#listaItens .item')].find(x => x.querySelector('.trava'));
  const t = li.querySelector('.trava').getBoundingClientRect(), tot = li.querySelector('.item__total').getBoundingClientRect();
  return { mesmaAltura: Math.abs(t.top - tot.top) < 12, altura: Math.round(li.getBoundingClientRect().height),
    notaEscondida: getComputedStyle(li.querySelector('.trava__nota')).display === 'none',
    figuras: getComputedStyle(li.querySelector('.item__total')).fontVariantNumeric };
});
ok(linha.mesmaAltura && linha.notaEscondida, `quantidade e valor na mesma linha (altura da linha ${linha.altura}px)`);
ok(/lining/.test(linha.figuras), `algarismos alinhados nos valores (${linha.figuras})`);
await p.close();

/* desktop: topo com imagem + efeito do ajuste */
const d = await b.newPage(); await d.setViewport({ width: 1360, height: 900 });
d.on('pageerror', e => erros.push(String(e).slice(0, 130)));
await d.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
await d.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await d.reload({ waitUntil: 'networkidle2' }); await espera(2500);
const hero = await d.evaluate(() => {
  const f = document.querySelector('.hero__fundo'), i = document.getElementById('heroImg');
  return { existe: !!f, carregou: f?.classList.contains('is-loaded'), largura: i?.naturalWidth || 0, url: (i?.currentSrc || ''), remota: /supabase/.test(i?.currentSrc || '') };
});
ok(hero.existe && hero.carregou && hero.largura > 0, `topo com imagem do espaço (${hero.largura}px de largura)`);
ok(!hero.remota || hero.url.includes('render/image'), `imagem do topo no tamanho certo (${hero.remota ? 'remota redimensionada' : 'arquivo local do render'})`);
/* muda convidados e confere o aviso do delta */
await d.evaluate(() => { document.getElementById('investimento').scrollIntoView(); mudarConvidados(220); });
await espera(700);
const delta = await d.evaluate(() => { const b = document.getElementById('invDelta'); return b ? { txt: b.textContent, on: b.classList.contains('on'), cls: b.className } : null; });
console.log('   aviso do ajuste:', delta && delta.txt, delta && delta.cls);
ok(delta && delta.on && /^\+/.test(delta.txt), 'mostra quanto o total subiu');
await d.evaluate(() => mudarConvidados(180)); await espera(700);
const delta2 = await d.evaluate(() => { const b = document.getElementById('invDelta'); return { txt: b.textContent, desce: /desce/.test(b.className) }; });
ok(delta2.desce && /^−/.test(delta2.txt), `e quanto desceu (${delta2.txt})`);
await d.screenshot({ path: 'vis-final-total.png', clip: await d.evaluate(() => { const r = document.querySelector('.inv__total').getBoundingClientRect(); return { x: r.x - 20, y: r.y + window.scrollY - 30, width: r.width + 40, height: r.height + 80 }; }) });
ok(erros.length === 0, `sem erros de JS ${erros.slice(0, 2).join(' | ')}`);
await b.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO VERDE');
process.exit(falhas ? 1 : 0);
