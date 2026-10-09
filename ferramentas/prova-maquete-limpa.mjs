// ARTE QUE NÃO É NOSSA NA MAQUETE (09/10/2026).
//
// As maquetes vieram de bibliotecas de modelo e trouxeram coisa colada na
// parede que nada tem a ver com o Indaiá: três quadros de casamento no Salão
// Principal, o selo de propaganda de um ar-condicionado no Cristal, pôsteres
// infantis no Solar, e na maquete antiga do Salão de Eventos um slide de
// template ("BUSINESS PROJECT · Presented by: Olivia Wilson") e a foto de um
// casal desconhecido. A página apaga a textura desses materiais ao carregar.
//
// Esta bateria garante as duas pontas:
//   · o material AINDA EXISTE na maquete (se a equipe reexportar e mudar o
//     nome, o conserto deixa de valer calado — e é isto que reprova aqui);
//   · e ele está sem textura, com a superfície lisa.
//
// Precisa de: node ferramentas/servir.mjs 8140
//   node ferramentas/prova-maquete-limpa.mjs
import { createRequire } from 'module';
const require = createRequire(process.env.PUPPETEER_EM || 'C:/Users/User/Desktop/Comercial/crm-backend/package.json');
const puppeteer = require('puppeteer');
const SITE = process.env.PROPOSTA_URL || 'http://localhost:8140/index.html';
const espera = ms => new Promise(r => setTimeout(r, ms));
let falhas = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHOU ✗ ') + m); if (!c) falhas++; };

/* os mesmos nomes da tabela FORA_DA_CASA da página */
const ALVOS = {
  salao_principal_itapema: ['*36', '*39', '*44'],
  cristal: ['Ar condicionado1_SELO', 'Ar condicionado1_Material.002'],
  solar: ['Color_', '[Color_001]4', 'Color_0021', '[Color_001]2'],
};

const b = await puppeteer.launch({ headless: 'new', executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

for (const [slug, nomes] of Object.entries(ALVOS)) {
  const p = await b.newPage();
  await p.setViewport({ width: 1000, height: 700 });
  const erros = [];
  p.on('pageerror', e => erros.push(String(e).slice(0, 140)));
  await p.goto(`${SITE}?espaco=${slug}`, { waitUntil: 'networkidle2', timeout: 120000 });
  await p.evaluate(() => { document.querySelector('#visoes').scrollIntoView(); trocarVisao('v3d'); });
  try {
    await p.waitForFunction(() => typeof T3 !== 'undefined' && T3.pronto && T3.salao, { timeout: 240000 });
  } catch (e) { ok(false, `${slug}: a maquete não ficou pronta`); await p.close(); continue; }
  await espera(1500);
  const v = await p.evaluate(ns => {
    const achados = {};
    T3.salao.traverse(o => {
      if (!o.isMesh) return;
      for (const mt of (Array.isArray(o.material) ? o.material : [o.material])) {
        if (!mt || !ns.includes(mt.name)) continue;
        achados[mt.name] = { comMapa: !!mt.map, cor: mt.color ? mt.color.getHexString() : null };
      }
    });
    return achados;
  }, nomes);
  const faltando = nomes.filter(n => !(n in v));
  ok(faltando.length === 0, `${slug}: os ${nomes.length} materiais continuam na maquete${faltando.length ? ' (sumiram: ' + faltando.join(', ') + ')' : ''}`);
  const comMapa = Object.entries(v).filter(([, x]) => x.comMapa).map(([n]) => n);
  ok(comMapa.length === 0, `${slug}: nenhum deles com textura${comMapa.length ? ' (ainda tem: ' + comMapa.join(', ') + ')' : ''}`);
  ok(erros.length === 0, `${slug}: sem erro de página${erros.length ? ': ' + erros[0] : ''}`);
  await p.close();
}
await b.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO VERDE');
process.exit(falhas ? 1 : 0);
