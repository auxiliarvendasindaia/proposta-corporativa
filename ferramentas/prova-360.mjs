// O 360° DE TODAS AS CASAS (13/10/2026).
//
// Nasceu da varredura que o dono pediu: "faça a varredura nos 360, lembrando
// que o projeto deve apresentar o mesmo layout que o cliente montar no 2d".
// A varredura achou três coisas, e esta bateria guarda as três:
//
//  1. CASA SEM PANORÂMICA. A Cerimônia Mirante da Lagoa vem do CRM com zero
//     panos e uma só câmera interna; a aba abria e estourava em
//     PANOS[id].dinamico. Agora a aba nem entra na página.
//  2. PANORAMA VAZIO POR CAUSA DO VIDRO. Material com transmissão
//     (KHR_materials_transmission, nas maquetes v15.09+) exige do three uma
//     passada de render à parte que NÃO sobrevive à câmera de cubo: cinco das
//     seis faces voltavam em cor de fundo. Era o "360 não está funcionando" em
//     sete casas — e no Mediterrâneo a própria página escondia a aba, por
//     julgar o quadro liso. Mede-se pelo CÉU: fundo liso demais = quebrou de
//     novo.
//  3. O 360 TEM DE MOSTRAR O LAYOUT DO 2D. Mexe-se nas mesas e nas peças, e a
//     panorâmica precisa nascer de novo, diferente.
//
// Precisa de: node ferramentas/servir.mjs 8140
//   node ferramentas/prova-360.mjs
//   node ferramentas/prova-360.mjs --so salao_eventos,mediterraneo
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'module';

const require = createRequire(process.env.PUPPETEER_EM || 'C:/Users/User/Desktop/Comercial/crm-backend/package.json');
const puppeteer = require('puppeteer');
const sharp = require('sharp');
const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname.slice(1)), '..');
const SITE = process.env.PROPOSTA_URL || 'http://localhost:8140/index.html';
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const espera = ms => new Promise(r => setTimeout(r, ms));
let falhas = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHOU ✗ ') + m); if (!c) falhas++; };

/* as casas saem do índice do pacote do CRM: casa nova entra na bateria sozinha */
const indice = JSON.parse(fs.readFileSync(path.join(RAIZ, 'dados', 'ambientes-index.js'), 'utf8')
  .replace(/^[^[]*/, '').replace(/;\s*$/, ''));
const so = (arg('--so') || '').split(',').filter(Boolean);
const casas = indice.map(a => a.slug).filter(s => !so.length || so.includes(s));

/* quem não tem panorâmica nenhuma no pacote: a aba não pode aparecer */
const semPano = new Set(casas.filter(slug => {
  const t = fs.readFileSync(path.join(RAIZ, 'dados', 'ambientes', slug + '.js'), 'utf8');
  global.window = {}; eval(t);
  const d = global.window.__AMB_CRM__.dados;
  return (d.panos || []).length === 0 && (((d.camera || {}).internas) || []).length < 2;
}));

const navegador = await puppeteer.launch({
  headless: 'new', executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

for (const slug of casas) {
  const p = await navegador.newPage();
  await p.setViewport({ width: 900, height: 560 });
  const erros = [];
  p.on('pageerror', e => erros.push(String(e).slice(0, 120)));
  await p.goto(`${SITE}?espaco=${slug}`, { waitUntil: 'networkidle2', timeout: 120000 });
  await espera(1800);
  const temAba = await p.evaluate(() => !(document.querySelector('[data-visao="v360"]') || { hidden: true }).hidden);

  if (semPano.has(slug)) {
    ok(!temAba, `${slug}: sem panorâmica no pacote, a aba 360° não aparece`);
    ok(erros.length === 0, `${slug}: sem erro de página${erros.length ? ': ' + erros[0] : ''}`);
    await p.close();
    continue;
  }

  ok(temAba, `${slug}: a aba 360° está na página`);
  if (!temAba) { await p.close(); continue; }
  await p.evaluate(() => { document.querySelector('#visoes').scrollIntoView(); trocarVisao('v360'); });
  await p.waitForFunction(() => typeof P360 !== 'undefined' && (P360.pronto || P360.falhou), { timeout: 300000 });
  await espera(3500);

  const v = await p.evaluate(() => {
    const tx = P360.mat && P360.mat.map;
    let tons = 0, ceu = 0, n = 0;
    if (tx && tx.image && tx.image.data) {
      const d = tx.image.data, s = new Set();
      /* salto primo para varrer a esfera toda sem ler 33 milhões de bytes */
      for (let i = 0; i < d.length; i += 4 * 97) {
        s.add((d[i] >> 4) + '-' + (d[i + 1] >> 4) + '-' + (d[i + 2] >> 4)); n++;
        if (d[i] > 220 && d[i + 1] > 220 && d[i + 2] > 215) ceu++;
      }
      tons = s.size;
    }
    return { visao: visaoAtual, pronto: P360.pronto, tons, ceu: n ? Math.round(ceu * 100 / n) : 100 };
  });
  ok(v.pronto && v.visao === 'v360', `${slug}: a visão 360° abre e fica (a página não a julgou lisa)`);
  /* 60% é folgado de propósito: cerimônia ao ar livre é metade céu de verdade */
  ok(v.ceu < 60, `${slug}: a panorâmica tem salão, não fundo liso (céu ${v.ceu}%)`);
  ok(v.tons > 40, `${slug}: a panorâmica tem imagem (${v.tons} tons)`);
  ok(erros.length === 0, `${slug}: sem erro de página${erros.length ? ': ' + erros[0] : ''}`);
  await p.close();
}

/* ---- o 360 retrata o layout do 2D ---- */
for (const slug of ['salao_eventos', 'nova_veneza', 'mediterraneo'].filter(s => !so.length || so.includes(s))) {
  const p = await navegador.newPage();
  await p.setViewport({ width: 900, height: 560 });
  await p.goto(`${SITE}?espaco=${slug}`, { waitUntil: 'networkidle2', timeout: 120000 });
  await espera(1800);
  await p.evaluate(() => { document.querySelector('#visoes').scrollIntoView(); trocarVisao('v360'); });
  await p.waitForFunction(() => typeof P360 !== 'undefined' && P360.pronto, { timeout: 300000 });
  await espera(3500);
  const antes = await (await p.$('#panoBox')).screenshot({ type: 'png' });
  const r0 = await p.evaluate(() => PROPOSTA.rev);
  /* o cliente mexe na planta: tira metade das mesas e empurra o mobiliário */
  await p.evaluate(() => {
    PROPOSTA.mesas = PROPOSTA.mesas.filter((_, i) => i % 2 === 0).map(m => ({ ...m, x: m.x - 60 }));
    (PROPOSTA.pecas || []).forEach(q => { q.x += 70; });
    salvarMesas();
    trocarVisao('v2'); trocarVisao('v360');
  });
  await espera(1200);
  await p.evaluate(() => { panoMostrar(P360.ambiente); });
  await p.waitForFunction(() => PANOL.rev === PROPOSTA.rev, { timeout: 300000 });
  await espera(3500);
  const depois = await (await p.$('#panoBox')).screenshot({ type: 'png' });
  const r1 = await p.evaluate(() => PROPOSTA.rev);
  const [a, d] = await Promise.all([
    sharp(antes).greyscale().resize(220, 140, { fit: 'fill' }).raw().toBuffer(),
    sharp(depois).greyscale().resize(220, 140, { fit: 'fill' }).raw().toBuffer()]);
  let soma = 0; for (let i = 0; i < a.length; i++) soma += Math.abs(a[i] - d[i]);
  const dif = soma / a.length;
  ok(r1 > r0, `${slug}: mexer na planta avança a versão do layout (${r0}→${r1})`);
  ok(dif > 3, `${slug}: a panorâmica nasce de novo com o layout (diferença média ${dif.toFixed(1)})`);
  await p.close();
}

await navegador.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO VERDE');
process.exit(falhas ? 1 : 0);
