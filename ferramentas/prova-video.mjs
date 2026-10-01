// O VÍDEO CURTO PARA ENVIAR — recorte de ~25 s do tour, com a cartela do
// evento na abertura, o telão com a marca do cliente no meio e a assinatura
// da casa no fim. Roda o vídeo inteiro e confere o arquivo que sai.
//
// Precisa de: node ferramentas/servir.mjs 8140 · node ferramentas/crm-falso.mjs
//   node ferramentas/prova-video.mjs
import { createRequire } from 'module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(process.env.PUPPETEER_EM || 'C:/Users/User/Desktop/Comercial/crm-backend/package.json');
const puppeteer = require('puppeteer');
const SITE = process.env.PROPOSTA_URL || 'http://localhost:8140/index.html';
const CRM = process.env.CRM_FALSO || 'http://localhost:8141';
const SAIDA = path.resolve(process.env.PROVA_OUT || '.', 'video-prova');
const espera = ms => new Promise(r => setTimeout(r, ms));
let falhas = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHOU ✗ ') + m); if (!c) falhas++; };

fs.rmSync(SAIDA, { recursive: true, force: true });
fs.mkdirSync(SAIDA, { recursive: true });

const b = await puppeteer.launch({ headless: 'new',
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--window-size=1500,960'] });
const p = await b.newPage();
await p.setViewport({ width: 1400, height: 900 });
const erros = [];
p.on('pageerror', e => erros.push(String(e).slice(0, 140)));
const cdp = await p.target().createCDPSession();
await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: SAIDA });

await p.goto(`${SITE}?espaco=salao_eventos&proposta=${'b'.repeat(40)}&api=${CRM}`, { waitUntil: 'networkidle2' });
await espera(2600);
await p.evaluate(() => { document.querySelector('#visoes').scrollIntoView(); trocarVisao('v3d'); });
await p.waitForFunction(() => typeof T3 !== 'undefined' && T3.pronto && T3.raf > 0, { timeout: 240000 });
await espera(3000);

/* 1 · o recorte tem os planos que importam e cabe no tempo de um envio */
const roteiro = await p.evaluate(() => {
  const c = tourRoteiroCurto(), t = tourMontarRoteiro();
  return { n: c.length, dur: +c.reduce((a, s) => a + s.dur, 0).toFixed(1),
    legendas: c.map(s => s.legenda || '(sem nome)'), durInteiro: +t.reduce((a, s) => a + s.dur, 0).toFixed(1) };
});
console.log(`   tour inteiro: ${roteiro.durInteiro}s · curto: ${roteiro.dur}s · ${roteiro.legendas.join(' → ')}`);
ok(roteiro.dur >= 20 && roteiro.dur <= 30, `o vídeo curto dura ${roteiro.dur}s (o tour inteiro tem ${roteiro.durInteiro}s)`);
ok(roteiro.n >= 3 && roteiro.n <= 4, `${roteiro.n} planos, emendados por fusão`);
ok(roteiro.legendas.some(l => /tel[aã]o|palco/i.test(l)), `o telão com a marca do cliente entra no recorte (${roteiro.legendas.join(' · ')})`);
ok(roteiro.legendas[0] === 'Entrada', 'começa pela entrada, como quem chega no dia');

/* 2 · a cartela de abertura aparece e some */
await p.evaluate(() => document.getElementById('btnVideoCurto').click());
await espera(900);
const abertura = await p.evaluate(() => ({ op: +TOUR.cartela.toFixed(2), gravando: !!TOUR.gravador, curto: TOUR.curto }));
ok(abertura.op === 1, `a cartela de abertura cobre a tela (opacidade ${abertura.op})`);
ok(abertura.gravando, 'e a gravação já está rodando');
await espera(3000);
const depois = await p.evaluate(() => +TOUR.cartela.toFixed(2));
ok(depois === 0, `passados 4 s, a cartela saiu e a cena aparece (${depois})`);

/* 3 · o fim: cartela da casa e o arquivo baixado */
await p.waitForFunction(() => !TOUR.ativo, { timeout: 60000 });
await espera(2500);
const fim = await p.evaluate(() => ({ ultimo: TOUR.ultimoTamanho, toast: document.querySelector('.toast')?.textContent || '' }));
ok(fim.ultimo > 200000, `o vídeo tem tamanho de vídeo (${(fim.ultimo / 1e6).toFixed(1)} MB)`);
ok(/pronto para enviar/i.test(fim.toast), `o aviso fala em enviar (${fim.toast.slice(0, 56)}…)`);

const arquivos = fs.readdirSync(SAIDA).filter(f => !f.endsWith('.crdownload'));
console.log('   baixado:', arquivos.join(', ') || '(nada)');
ok(arquivos.length === 1, `saiu um arquivo (${arquivos.length})`);
const nome = arquivos[0] || '';
ok(/^convite-/.test(nome), `o nome diz o que é: ${nome}`);
/* o arquivo leva o nome de QUEM está na proposta, seja ele quem for */
const slugCliente = await p.evaluate(() => CLIENTE_NOME.toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));
ok(nome.includes(slugCliente), `e leva o nome do cliente (${slugCliente})`);
ok(/\.(mp4|webm)$/.test(nome), `formato de vídeo (${nome.split('.').pop()})`);
if (/\.webm$/.test(nome)) console.log('   ~  este navegador não grava MP4; no Chrome novo sai .mp4, que toca no WhatsApp');
const tam = fs.statSync(path.join(SAIDA, nome)).size;
ok(tam > 200000 && tam < 60e6, `${(tam / 1e6).toFixed(1)} MB — cabe num envio`);

/* A PROPOSTA NÃO SE BAIXA (decisão de 18/09: ela tem validade). Sem
   controlsList o menu "⋮" do Chrome oferecia "Baixar vídeo" — achado em
   01/10, depois de o botão de download já ter saído da página. */
const player = await p.evaluate(() => {
  const v = document.getElementById('filmeVideo');
  const lista = v ? (v.getAttribute('controlsList') || '') : '';
  return { tem: !!v, nativo: !!v && v.hasAttribute('controls'), nodownload: /nodownload/.test(lista),
    gigante: !!document.getElementById('filmeGigante'),
    barra: ['filmeToca','filmeTrilho','filmeTempo','filmeSom','filmeTela'].filter(id => !document.getElementById(id)) };
});
ok(player.tem && !player.nativo, 'o vídeo não usa os controles nativos do navegador');
ok(player.nodownload, 'e mantém nodownload como rede de segurança na tela cheia');
ok(player.gigante && player.barra.length === 0,
  `o player da casa está montado${player.barra.length ? ' — falta ' + player.barra.join(', ') : ''}`);
/* o botão grande toca, a barra anda e o tempo acompanha */
const andou = await p.evaluate(async () => {
  const v = document.getElementById('filmeVideo');
  const esperar = ms => new Promise(r => setTimeout(r, ms));
  document.getElementById('filmeGigante').click();
  await esperar(1500);
  const tocando = { on: !v.paused, classe: document.getElementById('filmePlayer').classList.contains('tocando'),
    prog: document.getElementById('filmeProg').style.width, tempo: document.getElementById('filmeTempo').textContent };
  document.getElementById('filmeToca').click();
  await esperar(400);
  return { ...tocando, pausou: v.paused };
});
ok(andou.on && andou.classe, 'o botão grande dá play');
ok(parseFloat(andou.prog) > 0 && /\d+:\d\d \/ \d+:\d\d/.test(andou.tempo),
  `a barra anda e o tempo acompanha (${andou.prog} · ${andou.tempo})`);
ok(andou.pausou, 'e o botão da barra pausa');
ok(erros.length === 0, `sem erros de JS ${erros.slice(0, 2).join(' | ')}`);
await b.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO VERDE');
process.exit(falhas ? 1 : 0);
