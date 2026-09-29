// QUEM JÁ FEZ AQUI — a prova social é ESCOLHIDA A DEDO e não muda sozinha.
// Esta bateria existe para garantir exatamente isso: os textos na tela são os
// que estão congelados no arquivo, a página não busca avaliação em lugar
// nenhum, e nada de negativo passa.
//
// Precisa de: node ferramentas/servir.mjs 8140
//   node ferramentas/prova-social.mjs
import { createRequire } from 'module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(process.env.PUPPETEER_EM || 'C:/Users/User/Desktop/Comercial/crm-backend/package.json');
const puppeteer = require('puppeteer');
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = process.env.PROPOSTA_URL || 'http://localhost:8140/index.html';
const espera = ms => new Promise(r => setTimeout(r, ms));
let falhas = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHOU ✗ ') + m); if (!c) falhas++; };

/* palavras que não podem aparecer num depoimento de proposta: ressalva,
   reclamação ou qualquer coisa que abra brecha na negociação */
const PROIBIDO = /demor|atras|fila|sujo|ruim|caro|pre[çc]o|reclam|problema|falta|porém|porem|mas o|único ponto|unico ponto|sugestão|sugestao|poderia|não recomendo|nao recomendo/i;

const b = await puppeteer.launch({ headless: 'new', executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const p = await b.newPage();
await p.setViewport({ width: 1360, height: 900 });
const erros = [], rede = [];
p.on('pageerror', e => erros.push(String(e).slice(0, 140)));
/* fonte do Google não conta — o que não pode é buscar AVALIAÇÃO na hora */
p.on('request', r => {
  const u = r.url();
  if (/localhost|fonts\.googleapis|fonts\.gstatic/.test(u)) return;
  if (/review|avalia|business|mybusiness|maps\.google/i.test(u)) rede.push(u.slice(0, 80));
});

await p.goto(`${SITE}?espaco=salao_eventos`, { waitUntil: 'networkidle2' });
await espera(1600);

/* 1 · o que está na tela é o que está congelado no arquivo */
const dados = await p.evaluate(() => ({ prova: PROVA_SOCIAL, mapa: PROVA_DO_ESPACO }));
ok(!!dados.prova.curadoria, `os dados trazem a data da curadoria (${dados.prova.curadoria})`);
const fonte = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
let confer = 0;
for (const chave of Object.keys(dados.prova)) {
  const bloco = dados.prova[chave];
  if (!bloco || !bloco.depoimentos) continue;
  for (const d of bloco.depoimentos) {
    confer++;
    ok(fonte.includes(d.txt.slice(0, 40)), `"${d.txt.slice(0, 38)}…" está escrito no arquivo (${chave})`);
    ok(!PROIBIDO.test(d.txt), `${d.nome}: nenhuma ressalva no texto`);
    ok(!!d.nome && !!d.data, `${d.nome}: tem nome e data`);
  }
}
ok(confer >= 6, `${confer} avaliações congeladas na página`);

/* 2 · cada espaço mostra a ficha certa */
const lerProva = () => p.evaluate(() => {
  const s = document.getElementById('prova');
  return { oculta: s.hidden, selo: document.getElementById('provaSelo').textContent.replace(/\s+/g, ' ').trim(),
    cards: [...document.querySelectorAll('.prova__card')].map(c => ({
      txt: c.querySelector('.prova__txt').textContent.trim(),
      quem: c.querySelector('.prova__quem b').textContent.trim(),
      rodape: c.querySelector('.prova__quem').textContent.replace(/\s+/g, ' ').trim() })) };
});
for (const [amb, esperado] of [['salao_eventos', '10.050'], ['mezanino', '10.050'],
  ['canto_lagoa', '1.587'], ['mirante', '1.687'], ['solar', '3.274']]) {
  await p.goto(`${SITE}?espaco=${amb}`, { waitUntil: 'networkidle2' });
  await espera(1300);
  const v = await lerProva();
  ok(!v.oculta && v.selo.includes(esperado), `${amb}: selo com ${esperado} avaliações (${v.selo.slice(0, 62)})`);
  ok(v.cards.length === 3, `${amb}: ${v.cards.length} depoimentos`);
  for (const c of v.cards) ok(!PROIBIDO.test(c.txt), `${amb} · ${c.quem}: texto limpo na tela`);
  /* Solar 915 não tem ficha própria: usa as casas de Florianópolis, e cada
     depoimento precisa dizer de qual casa veio */
  if (amb === 'solar') {
    ok(v.cards.every(c => /Mirante da Lagoa|Canto da Lagoa/.test(c.rodape)),
      `solar: cada depoimento diz a casa (${v.cards.map(c => c.rodape.split('·')[1]).join(' |')})`);
    ok(/Florian/i.test(v.selo), 'solar: o selo diz que a nota é de Florianópolis');
  }
}

/* 2b · manda o salão QUE ESTÁ NA TELA (decisão de 29/09): a proposta aberta
   no Salão de Eventos mostra avaliações de Itapema, mesmo que o orçamento
   seja do Mediterrâneo 242, em Florianópolis */
const CRM = process.env.CRM_FALSO || 'http://localhost:8141';
await p.goto(`${SITE}?espaco=salao_eventos&proposta=${'b'.repeat(40)}&api=${CRM}`, { waitUntil: 'networkidle2' });
await espera(2200);
const med = await lerProva();
ok(med.selo.includes('10.050') && /Itapema/i.test(med.selo),
  `a proposta aberta em Itapema mostra Itapema (${med.selo.slice(0, 62)})`);
ok(med.cards.length === 3 && med.cards.every(c => !/Florian/i.test(c.rodape)),
  'e nenhum depoimento é de outra cidade');

/* 3 · nada é buscado na hora: a página não fala com o Google nem com o CRM por isso */
ok(rede.length === 0, `nenhuma busca de avaliação em tempo real (${rede.slice(0, 2).join(' | ') || 'nenhuma'})`);
ok(erros.length === 0, `sem erros de JS ${erros.slice(0, 2).join(' | ')}`);

await b.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO VERDE');
process.exit(falhas ? 1 : 0);
