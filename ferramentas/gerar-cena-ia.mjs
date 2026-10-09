// A CENA GERADA A PARTIR DO ORÇAMENTO (09/10/2026).
//
// O caminho que a proposta da Algar seguiu, agora a partir do orçamento e sem
// ninguém montando à mão. Em `proposta-algar-decoracao/` está o rastro: em
// `cru/` as vistas da maquete com o layout, em `fal-web/` as 25 imagens
// fotorrealistas que saíram delas, por câmera e por luz (dia, pôr do sol,
// noite), já com a marca do cliente dentro da cena.
//
// Aqui são três passos:
//   1. RENDERIZA a referência: a maquete do salão com o layout DESTE
//      orçamento (palco, telão, bistrôs e mesas que o cliente comprou), da
//      câmera pedida, em 1920x1080;
//   2. ESCREVE o prompt a partir do orçamento — tipo de evento, nº de
//      convidados, formato, itens contratados, marca e conceito. Nada que não
//      esteja na lista entra no texto: o filme não promete o que não foi
//      vendido;
//   3. GERA pela fal.ai (gpt-image-2, `image_size` em pixel exato), três
//      luzes, e guarda em video-prova/cenas-ia/.
//
// Sem FAL_API_KEY ele para no passo 2 e deixa a referência e o prompt no
// disco, para conferir antes de gastar. Cada imagem em 1920x1080 na qualidade
// alta custa US$ 0,158 (preço da fal em 09/10/2026).
//
//   node ferramentas/gerar-cena-ia.mjs --espaco mediterraneo --camera 1 \
//     --proposta <token> --api http://localhost:8141 --conceito "convenção corporativa"
//   ... e acrescente --gerar para chamar a fal de verdade.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'module';

const require = createRequire(process.env.PUPPETEER_EM || 'C:/Users/User/Desktop/Comercial/crm-backend/package.json');
const puppeteer = require('puppeteer');
const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname.slice(1)), '..');
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const ESPACO = arg('--espaco') || 'mediterraneo';
const CAMERA = Number(arg('--camera') ?? 1);
const TOKEN = arg('--proposta');
const API = arg('--api') || 'http://localhost:8141';
const CONCEITO = arg('--conceito') || '';
const SITE = process.env.PROPOSTA_URL || 'http://localhost:8140/index.html';
const GERAR = process.argv.includes('--gerar');
const LUZES = {
  dia: 'luz de dia, sol alto, sombras curtas, céu claro pela parede de vidro',
  pordosol: 'fim de tarde, sol baixo e dourado entrando pelo vidro, céu alaranjado',
  noite: 'noite, iluminação cênica acesa, luz quente pontual, céu escuro lá fora',
};
const SAIDA = path.join(RAIZ, 'video-prova', 'cenas-ia');
fs.mkdirSync(SAIDA, { recursive: true });

/* ---------- 1 · a referência: a maquete com o layout do orçamento ---------- */
const pacote = (() => {
  const t = fs.readFileSync(path.join(RAIZ, 'dados', 'ambientes', ESPACO + '.js'), 'utf8');
  global.window = {}; eval(t); return global.window.__AMB_CRM__;
})();
const dados = pacote.dados;
const interna = (dados.camera && dados.camera.internas || [])[CAMERA];
if (!interna) throw new Error('a casa não tem a câmera interna ' + CAMERA);
const ZONA = ((dados.pisos || [])[interna.piso | 0] || {}).nome || '';

const url = SITE + '?espaco=' + ESPACO + '&filme=1'
  + (TOKEN ? '&proposta=' + TOKEN + '&api=' + encodeURIComponent(API) : '');
const navegador = await puppeteer.launch({
  headless: 'new', executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1920,1180'],
});
const pag = await navegador.newPage();
await pag.setViewport({ width: 1920, height: 1080 });
await pag.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
await new Promise(r => setTimeout(r, 1500));
await pag.evaluate(() => {
  document.querySelector('#visoes').scrollIntoView();
  trocarVisao('v3d');
  const box = document.getElementById('tresBox');
  box.style.cssText = 'position:fixed;inset:0;z-index:9999;width:100vw;height:100vh;';
  document.querySelectorAll('.topbar,.expirada,.tierbar,.visao__foot').forEach(el => el.style.display = 'none');
});
await pag.waitForFunction(() => typeof T3 !== 'undefined' && T3.pronto && T3.raf > 0, { timeout: 300000 });
await pag.evaluate(() => {
  T3.renderer.setSize(innerWidth, innerHeight, false);
  T3.cam.aspect = innerWidth / innerHeight; T3.cam.updateProjectionMatrix();
});
await new Promise(r => setTimeout(r, 4000));
/* a câmera no olho da zona, à altura de quem está em pé */
const orcamento = await pag.evaluate(cam => {
  const olho = cam.olho, alvo = cam.alvo;
  /* a altura sai do PISO do modelo, não do olho da ficha (que varia por casa) */
  const chao = (AMB.glb && AMB.glb.pisoY) || 0;
  T3.cam.position.set(olho[0], chao + 1.62, olho[2]);
  T3.cam.lookAt(alvo[0], chao + 1.45, alvo[2]);
  if (T3.ctrl) { T3.ctrl.target.set(alvo[0], chao + 1.45, alvo[2]); T3.ctrl.update(); }
  /* o corte do telhado volta sozinho a cada quadro (tresCorte olha a altura da
     câmera): desligo a regra antes, senão o forro some e o teto sai branco */
  if (typeof window.tresCorte === 'function') window.tresCorte = function(){};
  if (typeof tresCorteAplicar === 'function') tresCorteAplicar(false);
  T3.renderer.render(T3.cena, T3.cam);
  const o = window.__PROPOSTA_CRM__ || {};
  return {
    numero: o.numero || null, cliente: o.cliente || null,
    convidados: (typeof PROPOSTA !== 'undefined' ? PROPOSTA.convidados : null),
    pecas: (typeof PROPOSTA !== 'undefined' ? (PROPOSTA.pecas || []).map(p => p.t) : []),
    mesas: (typeof PROPOSTA !== 'undefined' ? PROPOSTA.mesas.length : 0),
  };
}, interna);
await new Promise(r => setTimeout(r, 900));
const refArq = path.join(SAIDA, `ref-${ESPACO}-cam${CAMERA}.jpg`);
fs.writeFileSync(refArq, await pag.screenshot({ type: 'jpeg', quality: 92 }));
await navegador.close();
console.log('referência: ' + path.relative(RAIZ, refArq));

/* ---------- 2 · o prompt, escrito a partir do orçamento ---------- */
let CLIENTE = '', EVENTO = '', TIPO = '', CONV = orcamento.convidados || 0;
const itens = [];
if (TOKEN) {
  const o = ((await (await fetch(API + '/api/public/proposta/' + TOKEN)).json()).data || {}).orcamento || {};
  CLIENTE = (o.empresa && o.empresa.nome) || o.cliente_nome || '';
  EVENTO = o.nome_evento || '';
  TIPO = (o.tipo_evento && o.tipo_evento.nome) || '';
  CONV = o.num_convidados || CONV;
  for (const it of (o.itens || [])) itens.push(((it.produto && it.produto.nome) || it.nome || '').trim());
}
const tem = re => itens.some(n => re.test(n.toLowerCase()));
/* só entra no prompt o que está na lista do orçamento */
const montagem = [];
const conta = t => orcamento.pecas.filter(x => x === t).length;
if (conta('palco')) montagem.push(conta('palco') + ' palco modular de 4 × 4 m');
if (conta('telao')) montagem.push(conta('telao') + ' painel de LED grande ao fundo do palco');
if (conta('bistro')) montagem.push(conta('bistro') + ' mesas bistrô altas com banquetas');
if (orcamento.mesas) montagem.push(orcamento.mesas + ' mesas redondas postas com cadeiras');
if (tem(/coquetel|finger/)) montagem.push('estações de coquetel em pé');
if (tem(/open bar|bar\b/)) montagem.push('bar montado');

const marca = CLIENTE
  ? `No painel de LED, a marca "${CLIENTE}" em tela cheia, com a identidade visual da empresa; a iluminação cênica do ambiente acompanha a cor da marca.`
  : 'No painel de LED, uma arte institucional sóbria.';
const prompt = [
  'Fotografia arquitetônica profissional, fotorrealista, de um evento corporativo montado neste salão.',
  `Use a imagem de referência como a PLANTA E A ARQUITETURA EXATAS do lugar: mesma estrutura, mesmas proporções, mesmas aberturas, mesmo ponto de vista. Não invente paredes, vãos nem mobiliário fora do que está descrito.`,
  `Local: ${dados.nome}${dados.cidadeLonga ? ', ' + dados.cidadeLonga : ''}${ZONA ? ' — ambiente "' + ZONA.replace(/\s*[—–]\s*/g, ' · ') + '"' : ''}.`,
  EVENTO ? `Evento: ${EVENTO}${TIPO ? ' (' + TIPO + ')' : ''}${CONV ? `, para ${CONV} convidados` : ''}.` : '',
  CONCEITO ? `Conceito da proposta: ${CONCEITO}.` : '',
  montagem.length ? `Montagem contratada, que deve aparecer: ${montagem.join('; ')}.` : '',
  marca,
  'SEM PESSOAS na cena. O ambiente pronto, antes dos convidados chegarem.',
  'Acabamento de revista de arquitetura: luz natural equilibrada, cores fiéis, nitidez alta, sem distorção de grande angular, sem marca d\'água, sem texto inventado.',
].filter(Boolean).join(' ');

const base = { espaco: ESPACO, camera: CAMERA, zona: ZONA, orcamento: orcamento.numero, cliente: CLIENTE, evento: EVENTO, convidados: CONV, montagem, prompt };
fs.writeFileSync(path.join(SAIDA, `prompt-${ESPACO}-cam${CAMERA}.json`),
  JSON.stringify({ ...base, luzes: LUZES }, null, 1));
console.log('\n--- prompt ---\n' + prompt + '\n');
for (const [k, v] of Object.entries(LUZES)) console.log('  ' + k + ': ' + v);

/* ---------- 3 · a geração ---------- */
const CHAVE = process.env.FAL_API_KEY || (() => {
  const f = path.join(RAIZ, '.env');
  if (!fs.existsSync(f)) return null;
  const l = fs.readFileSync(f, 'utf8').split('\n').find(x => x.startsWith('FAL_API_KEY='));
  return l ? l.slice('FAL_API_KEY='.length).trim().replace(/^['"]|['"]$/g, '') : null;
})();
if (!GERAR) {
  console.log('\n(--gerar não foi pedido: parei na referência e no prompt, sem gastar nada)');
  process.exit(0);
}
if (!CHAVE) {
  console.log('\nFAL_API_KEY não está no ambiente nem em proposta-corporativa/.env.');
  console.log('A referência e o prompt ficaram em ' + path.relative(RAIZ, SAIDA) + ': é só pôr a chave e repetir.');
  process.exit(0);
}
/* a referência precisa estar acessível por URL para a fal ler */
const subir = async arq => {
  const fd = new FormData();
  fd.append('file', new Blob([fs.readFileSync(arq)], { type: 'image/jpeg' }), path.basename(arq));
  const r = await fetch('https://rest.alpha.fal.ai/storage/upload', {
    method: 'POST', headers: { Authorization: 'Key ' + CHAVE }, body: fd,
  });
  if (!r.ok) throw new Error('upload da referência: ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return (await r.json()).access_url;
};
const refUrl = await subir(refArq);
console.log('\nreferência no storage da fal: ' + refUrl);

const QUAL = arg('--qualidade') || 'high';
const quais = (arg('--luz') ? [arg('--luz')] : Object.keys(LUZES));
for (const luz of quais) {
  const corpo = {
    prompt: prompt + ' ' + LUZES[luz] + '.',
    image_urls: [refUrl],
    image_size: '1920x1080',
    quality: QUAL,
    num_images: 1,
    output_format: 'png',
  };
  const env = await fetch('https://queue.fal.run/fal-ai/gpt-image-2/edit', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Key ' + CHAVE },
    body: JSON.stringify(corpo),
  });
  if (!env.ok) { console.log('! ' + luz + ': ' + env.status + ' ' + (await env.text()).slice(0, 220)); continue; }
  const { status_url, response_url } = await env.json();
  let pronto = null;
  for (let i = 0; i < 90; i++) {
    await new Promise(r => setTimeout(r, 4000));
    const s = await (await fetch(status_url, { headers: { Authorization: 'Key ' + CHAVE } })).json();
    if (s.status === 'COMPLETED') { pronto = await (await fetch(response_url, { headers: { Authorization: 'Key ' + CHAVE } })).json(); break; }
    if (s.status === 'FAILED') { console.log('! ' + luz + ': a fal recusou'); break; }
  }
  if (!pronto) { console.log('! ' + luz + ': não voltou a tempo'); continue; }
  const saiu = (pronto.images || [])[0];
  if (!saiu) { console.log('! ' + luz + ': veio sem imagem'); continue; }
  const bytes = Buffer.from(await (await fetch(saiu.url)).arrayBuffer());
  const dest = path.join(SAIDA, `${ESPACO}-cam${CAMERA}-${luz}.png`);
  fs.writeFileSync(dest, bytes);
  console.log('✔ ' + path.relative(RAIZ, dest) + ' · ' + (bytes.length / 1e6).toFixed(1) + ' MB');
}
