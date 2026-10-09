// O SITE SEM VÍDEO (09/10/2026).
//
// Esta bateria testava o player da casa: botão de play, barra que anda, tela
// cheia, som. O dono mandou tirar o vídeo do site enquanto o caminho bom não
// existe — o que a página sabe gerar hoje é sobrevoo da maquete, e ele não
// mostra o evento do cliente; o caminho bom (imagem gerada a partir do
// orçamento, como na proposta da Algar) depende de uma chave da fal que ainda
// não temos.
//
// Então ela virou o contrário: garante que NÃO há vídeo. O risco agora não é
// o player quebrar, é alguém ligar `VIDEO_NO_SITE` sem querer, ou um salão
// novo trazer filme na ficha e o vídeo voltar sozinho para a frente do
// cliente. O player e os arquivos continuam no lugar; só estão desligados.
//
// Precisa de: node ferramentas/servir.mjs 8140 · node ferramentas/crm-falso.mjs
//   node ferramentas/prova-video.mjs
import { createRequire } from 'module';
const require = createRequire(process.env.PUPPETEER_EM || 'C:/Users/User/Desktop/Comercial/crm-backend/package.json');
const puppeteer = require('puppeteer');
const SITE = process.env.PROPOSTA_URL || 'http://localhost:8140/index.html';
const CRM = process.env.CRM_FALSO || 'http://localhost:8141';
const TOKEN = 'b'.repeat(40);
const espera = ms => new Promise(r => setTimeout(r, ms));
let falhas = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHOU ✗ ') + m); if (!c) falhas++; };

const b = await puppeteer.launch({
  headless: 'new', executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--autoplay-policy=no-user-gesture-required'],
});

/* as três portas por onde o vídeo entrava: a casa com filme próprio, a casa
   sem filme nenhum, e a proposta real (que tinha o passeio do evento) */
const casos = [
  ['Salão de Eventos (tinha filme da casa)', `${SITE}?espaco=salao_eventos`],
  ['Mediterrâneo (tinha o laço de capa)', `${SITE}?espaco=mediterraneo`],
  ['proposta real (tinha o passeio do evento)', `${SITE}?espaco=mediterraneo&proposta=${TOKEN}&api=${CRM}`],
];
for (const [rotulo, url] of casos) {
  const p = await b.newPage();
  await p.setViewport({ width: 1280, height: 900 });
  /* sem isto o Chrome headless diz que o usuário pede menos movimento e o
     filme da capa nem seria tentado — o teste passaria por acidente */
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  const erros = [];
  p.on('pageerror', e => erros.push(String(e).slice(0, 140)));
  const mp4 = [];
  p.on('response', r => { if (/\.mp4(\?|$)/.test(r.url())) mp4.push(r.url().split('/').pop()); });
  await p.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  await espera(4000);
  const v = await p.evaluate(() => ({
    chave: typeof VIDEO_NO_SITE !== 'undefined' ? VIDEO_NO_SITE : null,
    secao: (document.getElementById('filme') || { hidden: true }).hidden,
    naCapa: !!document.querySelector('.hero__fundo video'),
    comFonte: !!(document.getElementById('filmeVideo') || { querySelector: () => null }).querySelector('source'),
    foto: !!document.getElementById('heroImg'),
  }));
  ok(v.chave === false, `${rotulo}: a chave VIDEO_NO_SITE está desligada`);
  ok(v.secao, `${rotulo}: a seção do filme fica escondida`);
  ok(!v.naCapa && !v.comFonte, `${rotulo}: nenhum vídeo na capa nem fonte carregada`);
  ok(mp4.length === 0, `${rotulo}: nenhum .mp4 baixado${mp4.length ? ' (' + mp4.join(', ') + ')' : ''}`);
  ok(v.foto, `${rotulo}: a foto do topo continua no lugar`);
  ok(erros.length === 0, `${rotulo}: sem erro de página${erros.length ? ': ' + erros[0] : ''}`);
  await p.close();
}
await b.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO VERDE');
process.exit(falhas ? 1 : 0);
