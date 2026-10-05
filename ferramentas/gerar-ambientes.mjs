// OS SALÕES VÊM DO CRM (02/10/2026)
//
// Até aqui a página trazia CINCO salões escritos à mão no index.html, com a
// calibração medida a dedo (pxm, máscara, mesas padrão). O CRM tem VINTE E SEIS
// maquetes publicadas no módulo Operacional › Layouts, cada uma com a mesma
// ficha — e com a planta refeita em vista reta, as colunas marcadas como
// obstáculo e a montagem oficial da casa.
//
// Este script busca as 26 na rota pública do CRM e grava a FOTOGRAFIA em
// `dados/ambientes.json`. A página lê esse arquivo. É o mesmo caminho do site
// montagem-saloes: nada de rota nova no CRM, nada de a página depender do CRM
// estar no ar para abrir.
//
//   node ferramentas/gerar-ambientes.mjs                    → usa http://localhost:3333
//   node ferramentas/gerar-ambientes.mjs https://api…       → outra base
//
// As imagens e os GLBs NÃO são copiados: ficam no bucket público do Supabase
// (`assets_base` vem no pacote), como já acontece com as fotos da galeria.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.argv[2] || process.env.CRM_API || 'http://localhost:3333').replace(/\/+$/, '');
const SAIDA = path.join(RAIZ, 'dados', 'ambientes.json');

/* Os slugs publicados (26 em 01/10/2026). Para conferir se a lista mudou:
     select distinct ambiente_slug from espaco_maquetes where ativo = true;
   Slug que sumir do CRM vira falha ruidosa aqui — nunca um salão silencioso. */
const SLUGS = [
  'canto_lagoa', 'castelo', 'cerimonia_beira_mar_norte', 'cerimonia_canto_lagoa',
  'cerimonia_capela_cristal', 'cerimonia_cascata', 'cerimonia_castelo',
  'cerimonia_figueira', 'cerimonia_garden_joinville', 'cerimonia_gramado_nova_veneza',
  'cerimonia_lago_nova_veneza', 'cerimonia_mirante', 'cerimonia_praia',
  'cerimonia_praia_florianopolis', 'cristal', 'espaco_lago_nova_veneza', 'joinville',
  'lounge', 'mediterraneo', 'mezanino', 'mirante', 'nova_veneza', 'panoramico',
  'salao_eventos', 'salao_principal_itapema', 'solar',
];

/* o que a página PRECISA para desenhar o editor: sem um destes, o ambiente
   entra como "sem maquete" em vez de abrir quebrado */
const OBRIGATORIOS = ['id', 'nome', 'pxm', 'planta', 'mascara', 'areas', 'principal'];

async function pacote(slug) {
  const r = await fetch(`${BASE}/api/public/layouts-3d/ambientes/${slug}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const corpo = await r.json();
  const pac = corpo && (corpo.data || corpo);
  const maq = pac && pac.maquete;
  if (!maq || !maq.dados) throw new Error('pacote sem maquete.dados');
  return { dados: maq.dados, versao: maq.versao || '', base: maq.assets_base || '',
    atualizado: maq.updated_at || '', layouts: pac.layouts || [] };
}

const ambientes = {}, versoes = {}, falhas = [], resumo = [];
let base = '';

for (const slug of SLUGS) {
  try {
    const p = await pacote(slug);
    const faltando = OBRIGATORIOS.filter(k => p.dados[k] === undefined || p.dados[k] === null);
    if (faltando.length) { falhas.push(`${slug}: falta ${faltando.join(', ')}`); continue; }
    if (p.dados.id !== slug) falhas.push(`${slug}: o pacote se diz "${p.dados.id}"`);
    base = base || p.base;
    if (p.base && p.base !== base) falhas.push(`${slug}: assets_base diferente (${p.base})`);
    ambientes[slug] = p.dados;
    versoes[slug] = p.versao;
    const mesas = (p.dados.mesasPadrao || []).length;
    const pisos = (p.dados.pisos || []).length;
    resumo.push({ slug, nome: p.dados.nome, pxm: p.dados.pxm, mesas,
      pisos: pisos || 1, areas: (p.dados.areas || []).length,
      glb: !!(p.dados.glb && p.dados.glb.src), versao: p.versao });
  } catch (e) {
    falhas.push(`${slug}: ${e.message}`);
  }
}

if (!Object.keys(ambientes).length) {
  console.error('\nNenhum ambiente veio do CRM — o pacote não foi gravado.');
  console.error(falhas.map(f => '  ✗ ' + f).join('\n'));
  process.exit(1);
}

/* UM ARQUIVO POR SALÃO — a ficha inteira dos 25 dá 1,3 MB (a máscara do piso
   e os pisos extras pesam). A página precisa de UM salão por vez, então cada
   um vira um arquivo próprio, carregado só quando aquele link abre. É .js (e
   não .json) porque o carregamento precisa ser SÍNCRONO, antes do script da
   página montar o registro — ver o bloco "SALÃO DO CRM" no index.html. */
const PASTA = path.join(RAIZ, 'dados', 'ambientes');
fs.mkdirSync(PASTA, { recursive: true });
for (const f of fs.readdirSync(PASTA)) if (f.endsWith('.js')) fs.rmSync(path.join(PASTA, f));
let pesoTotal = 0;
for (const [slug, dados] of Object.entries(ambientes)) {
  const arq = path.join(PASTA, slug + '.js');
  const corpo = 'window.__AMB_CRM__=' + JSON.stringify({ slug, versao: versoes[slug], base, dados }) + ';' + '\n';
  fs.writeFileSync(arq, corpo);
  pesoTotal += corpo.length;
  const r = resumo.find(x => x.slug === slug);
  if (r) r.kb = (corpo.length / 1024).toFixed(0);
}

/* ÍNDICE PARA A PÁGINA — slug + nome dos 25, 3 KB. A página carrega SEMPRE
   (é leve) para saber reconhecer pelo nome o salão que o orçamento traz: sem
   isso, link sem `espaco=` de uma casa que não é a desenhada não tinha como
   achar a certa. */
fs.writeFileSync(path.join(RAIZ, 'dados', 'ambientes-index.js'),
  'window.__AMBS_CRM__=' + JSON.stringify(resumo.map(r => ({ slug: r.slug, nome: r.nome }))) + ';' + '
');

/* o índice completo é LEVE: serve às ferramentas e à bateria, não à página */
fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
const pacoteFinal = {
  gerado_em: new Date().toISOString().slice(0, 10),
  origem: `${BASE}/api/public/layouts-3d/ambientes/:slug`,
  assets_base: base,
  ambientes: resumo.map(r => ({ slug: r.slug, nome: r.nome, versao: r.versao,
    pxm: r.pxm, mesas: r.mesas, areas: r.areas, glb: r.glb, kb: Number(r.kb || 0) })),
  fora: falhas,
};
fs.writeFileSync(SAIDA, JSON.stringify(pacoteFinal, null, 1));

const kb = (fs.statSync(SAIDA).size / 1024).toFixed(0);
console.log(`\n${Object.keys(ambientes).length} de ${SLUGS.length} ambientes · ${kb} KB em ${path.relative(RAIZ, SAIDA)}`);
console.log(`assets_base: ${base}\n`);
const col = (t, n) => String(t).padEnd(n).slice(0, n);
console.log(col('slug', 30) + col('nome', 24) + col('pxm', 7) + col('mesas', 6) + col('áreas', 6) + col('3D', 4) + col('KB', 5) + 'versão');
for (const r of resumo) {
  console.log(col(r.slug, 30) + col(r.nome, 24) + col(r.pxm, 7) + col(r.mesas, 6)
    + col(r.areas, 6) + col(r.glb ? 'sim' : '—', 4) + col(r.kb || '?', 5) + (r.versao || '—'));
}
if (falhas.length) {
  console.log('\nNÃO ENTRARAM:');
  console.log(falhas.map(f => '  ✗ ' + f).join('\n'));
}
console.log(falhas.length ? `\n${falhas.length} fora do pacote` : '\nTodos os salões no pacote.');
