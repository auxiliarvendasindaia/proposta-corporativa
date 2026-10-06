// O SALÃO PELO ID DO ESPAÇO (06/10/2026).
//
// Medido no link real da Sebrae: o orçamento diz "Mediterrâneo 242" e a maquete
// se chama "Mediterrâneo Indaiá · Praia da Joaquina". Um nome não contém o
// outro, o casamento por nome falhava, e o link SEM espaco= abria no Salão de
// Eventos com o aviso de "em preparação" — com a casa inteira pronta na página.
// O CRM já publica a ligação certa: o pacote público por ID devolve o
// ambiente_slug. Esta bateria garante que:
//   · com o ID no orçamento, o link sem salão cai na casa certa sozinho;
//   · sem o ID (ou com o CRM mudo), continua valendo o aviso honesto — nunca
//     a planta de outra casa;
//   · o salão ESCRITO NO LINK continua mandando (decisão de 29/09).
//
// Precisa de três terminais:
//   node ferramentas/servir.mjs 8140
//   node ferramentas/crm-falso.mjs                            (sem id)
//   node ferramentas/crm-falso.mjs --com-id --porta 8152      (com id)
//   node ferramentas/prova-salao-pelo-id.mjs
import { createRequire } from 'module';
const require = createRequire(process.env.PUPPETEER_EM || 'C:/Users/User/Desktop/Comercial/crm-backend/package.json');
const puppeteer = require('puppeteer');
const SITE = process.env.PROPOSTA_URL || 'http://localhost:8140/index.html';
const SEM_ID = process.env.CRM_FALSO || 'http://localhost:8141';
const COM_ID = process.env.CRM_COM_ID || 'http://localhost:8152';
const TOKEN = 'b'.repeat(40);
const espera = ms => new Promise(r => setTimeout(r, ms));
let falhas = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHOU ✗ ') + m); if (!c) falhas++; };

const b = await puppeteer.launch({ headless: 'new', executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [];

async function abrir(url){
  const p = await b.newPage();
  p.on('pageerror', e => erros.push(String(e).slice(0, 150)));
  await p.setViewport({ width: 1280, height: 900 });
  await p.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  await espera(4500);
  const v = await p.evaluate(() => ({
    espaco: ESPACO, nome: AMB.nome, url: location.search,
    aviso: !document.getElementById('semMaquete').hidden,
    planta: !document.getElementById('planta').hidden,
  }));
  await p.close();
  return v;
}

/* 1 · COM o ID: o link não diz salão nenhum e a página acha a casa certa */
erros.length = 0;
const comId = await abrir(`${SITE}?proposta=${TOKEN}&api=${COM_ID}`);
ok(comId.espaco === 'mediterraneo' && !comId.aviso && comId.planta,
  `com o ID, o link sem salão abre em ${comId.nome} com a planta`);
ok(/espaco=mediterraneo/.test(comId.url), `e o salão fica escrito na URL (${comId.url.slice(0, 60)})`);

/* 2 · SEM o ID: nada de chute — o aviso honesto, com o nome do orçamento */
const semId = await abrir(`${SITE}?proposta=${TOKEN}&api=${SEM_ID}`);
ok(semId.aviso && !semId.planta,
  `sem o ID, continua o aviso honesto e sem planta de outra casa (abriu ${semId.nome})`);

/* 3 · o salão do LINK manda, mesmo com o ID dizendo outro (decisão de 29/09:
   foi a atendente que escolheu o salão ao gerar o link) */
const doLink = await abrir(`${SITE}?espaco=solar&proposta=${TOKEN}&api=${COM_ID}`);
ok(doLink.espaco === 'solar', `o salão escrito no link continua mandando (${doLink.nome})`);

ok(erros.length === 0, 'sem erro de página' + (erros.length ? ': ' + erros[0] : ''));
await b.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO VERDE');
process.exit(falhas ? 1 : 0);
