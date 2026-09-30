// PESO DA PRIMEIRA TELA — a capa baixava 10,8 MB antes de o cliente ler uma
// linha: 9,8 MB do filme, 0,9 MB do sprite da mesa e 0,37 MB do poster.
//
// Esta ferramenta gera, a partir do que já existe:
//   · capa.mp4   — corte leve e em laço contínuo do passeio (720p, ~10 s) que
//                  roda ATRÁS do texto da capa. O passeio de 25 s continua
//                  inteiro no player da seção 05, onde o cliente escolhe ver.
//   · poster.jpg — reduzido para 1280 px (servia os dois players em 400 KB).
//   · mesa-foto.webp — o sprite da mesa do editor 2D, que era PNG de 920 KB.
//
//   node ferramentas/enxugar-midia.mjs            → tudo
//   node ferramentas/enxugar-midia.mjs --filmes   → só os vídeos e posters
//   node ferramentas/enxugar-midia.mjs --sprite   → só o sprite
//
// O corte da capa NÃO é regravado quadro a quadro: sai do próprio passeio já
// conferido, então nunca diverge dele.
import { createRequire } from 'module';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const require = createRequire(process.env.PUPPETEER_EM || 'C:/Users/User/Desktop/Comercial/crm-backend/package.json');
const sharp = require('sharp');
const FFMPEG = require('ffmpeg-static');
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SO = process.argv.slice(2).filter(a => a.startsWith('--'));
const fazer = o => SO.length === 0 || SO.includes('--' + o);

/* duração do laço e da costura entre o fim e o começo */
const N = 10, D = 1, LARG = 1280, ALT = 720;

const ff = args => { try { return String(execFileSync(FFMPEG, args, { stdio: ['ignore','pipe','pipe'] })); }
  catch (e) { return String(e.stdout || '') + String(e.stderr || ''); } };

/* trechos escuros do filme: as cartelas do começo e do fim e as fusões entre
   os planos. O laço da capa não pode cair em nenhum deles. */
function escuros(arq){
  const txt = ff(['-i', arq, '-vf', 'blackdetect=d=0.04:pix_th=0.12', '-an', '-f', 'null', '-']);
  return [...txt.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)]
    .map(m => ({ ini: +m[1], fim: +m[2] }));
}
function duracao(arq){
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(ff(['-i', arq]));
  return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : 0;
}
/* o melhor começo: o trecho limpo mais longo, do meio do passeio para a frente
   (os 4 primeiros segundos são a cartela de abertura) */
function melhorComeco(arq){
  const dur = duracao(arq), pretos = escuros(arq);
  const preciso = N + D + .2;
  let melhor = null;
  let t = 4;
  for (const p of [...pretos, { ini: dur, fim: dur }]) {
    const janela = p.ini - t;
    if (janela >= preciso && (!melhor || janela > melhor.janela)) melhor = { t, janela };
    t = Math.max(t, p.fim + .15);
  }
  if (melhor) return melhor.t + Math.max(0, (melhor.janela - preciso) / 2);
  return Math.max(4, (dur - preciso) / 2);   /* sem trecho limpo: o miolo */
}

function cortarCapa(pasta){
  const src = path.join(pasta, 'passeio.mp4');
  if (!fs.existsSync(src)) return;
  const destino = path.join(pasta, 'capa.mp4');
  const S = melhorComeco(src);
  fs.rmSync(destino, { force: true });
  /* LAÇO SEM EMENDA: o primeiro segundo do trecho é fundido por cima do
     último, então o fim do arquivo é igual ao começo dele e o vídeo repete
     sem salto. Sem isso o corte aparecia a cada 10 segundos, atrás do texto. */
  const fc = [
    `[0:v]scale=${LARG}:${ALT}:flags=lanczos,setsar=1,fps=30,split=3[a][b][c]`,
    `[a]trim=${D}:${N},setpts=PTS-STARTPTS[corpo]`,
    `[b]trim=${N}:${N + D},setpts=PTS-STARTPTS[fim]`,
    `[c]trim=0:${D},setpts=PTS-STARTPTS[ini]`,
    `[fim][ini]xfade=transition=fade:duration=${D}:offset=0[costura]`,
    `[corpo][costura]concat=n=2:v=1:a=0[out]`,
  ].join(';');
  execFileSync(FFMPEG, ['-y', '-ss', S.toFixed(2), '-t', String(N + D + .2), '-i', src,
    '-filter_complex', fc, '-map', '[out]', '-c:v', 'libx264', '-preset', 'slow',
    '-crf', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', destino], { stdio: 'pipe' });
  const mb = fs.statSync(destino).size / 1e6, antes = fs.statSync(src).size / 1e6;
  console.log(`  ✔ ${path.relative(RAIZ, destino)} · ${mb.toFixed(2)} MB (era ${antes.toFixed(1)} MB) · começa em ${S.toFixed(1)}s`);
  /* conferência: o laço não pode ter preto no meio */
  const meio = escuros(destino).filter(p => p.ini > .3 && p.fim < N - .3);
  if (meio.length) console.log(`  ✗ ${meio.length} trecho(s) preto(s) no laço — confira antes de publicar`);
}

async function enxugarPoster(pasta){
  const arq = path.join(pasta, 'poster.jpg');
  if (!fs.existsSync(arq)) return;
  const antes = fs.statSync(arq).size;
  if (antes < 180000) return;
  /* lê para a memória antes: no Windows o sharp segura o arquivo aberto e
     gravar por cima do mesmo caminho falha */
  const buf = await sharp(fs.readFileSync(arq)).resize({ width: 1280, withoutEnlargement: true })
    .jpeg({ quality: 72, mozjpeg: true }).toBuffer();
  fs.writeFileSync(arq, buf);
  console.log(`  ✔ ${path.relative(RAIZ, arq)} · ${(buf.length / 1024).toFixed(0)} KB (era ${(antes / 1024).toFixed(0)} KB)`);
}

const pastas = [];
const amb = path.join(RAIZ, 'assets', 'ambientes');
if (fs.existsSync(amb)) for (const d of fs.readdirSync(amb)) {
  const v = path.join(amb, d, 'video'); if (fs.existsSync(v)) pastas.push(v);
}
const props = path.join(RAIZ, 'assets', 'propostas');
if (fs.existsSync(props)) for (const d of fs.readdirSync(props)) pastas.push(path.join(props, d));

if (fazer('filmes')) {
  for (const pasta of pastas) {
    console.log(`\n=== ${path.relative(RAIZ, pasta)} ===`);
    cortarCapa(pasta);
    await enxugarPoster(pasta);
  }
}

if (fazer('sprite')) {
  console.log('\n=== sprite da mesa ===');
  const png = path.join(RAIZ, 'assets', 'mesa-foto.png');
  const webp = path.join(RAIZ, 'assets', 'mesa-foto.webp');
  if (fs.existsSync(png)) {
    const antes = fs.statSync(png).size;
    await sharp(png).webp({ quality: 82, effort: 6 }).toFile(webp);
    const dep = fs.statSync(webp).size;
    console.log(`  ✔ assets/mesa-foto.webp · ${(dep / 1024).toFixed(0)} KB (era ${(antes / 1024).toFixed(0)} KB em PNG)`);
  }
}
console.log('\nA página usa capa.mp4 no topo e cai no passeio.mp4 se ele não existir.');
