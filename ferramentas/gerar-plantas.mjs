// PLANTA COM CARA DE PLANTA (09/10/2026).
//
// A imagem que o pacote do CRM manda não é uma planta: é uma FOTO da maquete
// 3D vista de cima, com o telhado removido. Vem com as manchas de luz das
// lâmpadas no piso, sombra cinza, o mar em azul chapado e as paredes sem
// linha nenhuma — só um cinza um pouco diferente do piso. O dono apontou
// ("a planta está feia esteticamente") e tem razão.
//
// Esta ferramenta trata a imagem do nosso lado, sem depender do pessoal da
// maquete, em três passos:
//   1. divide a imagem pelo próprio borrão (o campo de iluminação): apaga as
//      manchas das lâmpadas e a sombra, deixando o piso plano;
//   2. tira quase toda a cor, para o entorno (mar, areia, prédio vizinho)
//      parar de competir com o salão, e sobe o contraste;
//   3. desenha a LINHA DA PAREDE a partir da máscara de piso válido, que já
//      vem no pacote — a borda do piso é a parede, então a linha nasce
//      encaixada e ninguém precisa medir nada.
// A mistura final guarda 32% da imagem original, para o deck de madeira, a
// grama e o piso da pista não sumirem: a proposta não é projeto executivo.
//
// A linha da parede só entra na planta PRINCIPAL de cada casa. Nos pisos que
// têm imagem própria (Solar, Joinville, Mezanino) a máscara é a do térreo e
// não encaixaria, então esses levam só o tratamento de luz e cor.
//
//   node ferramentas/gerar-plantas.mjs            → todas
//   node ferramentas/gerar-plantas.mjs solar      → só uma
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'module';
const sharp = createRequire(process.env.SHARP_EM || 'C:/Users/User/Desktop/Comercial/crm-backend/package.json')('sharp');

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname.slice(1)), '..');
const SAIDA = path.join(RAIZ, 'assets', 'plantas');
const pedidos = process.argv[2] ? process.argv[2].split(',') : null;

function ficha(slug){
  const t = fs.readFileSync(path.join(RAIZ, 'dados', 'ambientes', `${slug}.js`), 'utf8');
  global.window = {}; eval(t);
  return global.window.__AMB_CRM__;
}
/* a borda do piso válido vira traço de parede */
function paredes(mascara, W, H){
  const bin = Buffer.from(mascara.b64, 'base64');
  const MG = { w: mascara.w, h: mascara.h, passo: mascara.passo };
  const val = (gx, gy) => {
    if (gx < 0 || gy < 0 || gx >= MG.w || gy >= MG.h) return false;
    const k = gy * MG.w + gx; return !!(bin[k >> 3] & (1 << (k & 7)));
  };
  const seg = [];
  for (let gy = 0; gy < MG.h; gy++) for (let gx = 0; gx < MG.w; gx++) {
    if (!val(gx, gy)) continue;
    const x = gx * MG.passo, y = gy * MG.passo, s = MG.passo;
    if (!val(gx - 1, gy)) seg.push(`M${x},${y}v${s}`);
    if (!val(gx + 1, gy)) seg.push(`M${x + s},${y}v${s}`);
    if (!val(gx, gy - 1)) seg.push(`M${x},${y}h${s}`);
    if (!val(gx, gy + 1)) seg.push(`M${x},${y + s}h${s}`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <path d="${seg.join('')}" fill="none" stroke="#2B3138" stroke-width="3"
      stroke-linecap="square" opacity=".82"/></svg>`;
}
async function tratar(url, W, H, mascara){
  const bruto = Buffer.from(await (await fetch(url)).arrayBuffer());
  const campo = await sharp(bruto).resize(W, H).blur(55).negate().toBuffer();
  const plano = await sharp(bruto).resize(W, H)
    .composite([{ input: campo, blend: 'colour-dodge' }])
    .modulate({ saturation: 0.18 }).linear(1.18, -16).toBuffer();
  /* devolve um pouco do original: sem isto a madeira e a grama somem */
  const original = await sharp(bruto).resize(W, H).modulate({ saturation: 0.5 }).ensureAlpha(0.32).png().toBuffer();
  let img = sharp(plano).composite([{ input: original, blend: 'over' }]);
  if (mascara) img = sharp(await img.toBuffer()).composite([{ input: Buffer.from(paredes(mascara, W, H)) }]);
  return img.jpeg({ quality: 86, mozjpeg: true }).toBuffer();
}

fs.mkdirSync(SAIDA, { recursive: true });
const slugs = (pedidos || fs.readdirSync(path.join(RAIZ, 'dados', 'ambientes')).map(f => f.replace('.js', '')));
const feitas = new Map();
for (const slug of slugs) {
  const A = ficha(slug), d = A.dados;
  const lista = [{ p: d.planta, mascara: d.mascara }];
  for (const piso of (d.pisos || []))
    if (piso.planta && piso.planta.src !== d.planta.src) lista.push({ p: piso.planta, mascara: null });
  for (const { p, mascara } of lista) {
    if (feitas.has(p.src)) continue;
    const nome = p.src.replace(/^assets\//, '').replace(/[\/]/g, '_');
    const saida = path.join(SAIDA, nome);
    const bytes = await tratar(A.base + p.src, p.w, p.h, mascara);
    fs.writeFileSync(saida, bytes);
    feitas.set(p.src, nome);
    console.log(`${slug.padEnd(28)} ${nome.padEnd(58)} ${(bytes.length / 1024 | 0)} KB${mascara ? ' · com paredes' : ''}`);
  }
}
/* o índice que a página consulta: caminho do CRM → arquivo local tratado */
fs.writeFileSync(path.join(RAIZ, 'dados', 'plantas-tratadas.js'),
  'window.__PLANTAS_TRATADAS__=' + JSON.stringify(Object.fromEntries(feitas), null, 1) + ';\n');
console.log(`\n${feitas.size} plantas tratadas em assets/plantas/`);
