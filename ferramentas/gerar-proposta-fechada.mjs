/* Gera `proposta.html` — a proposta FECHADA, URL própria.
   Parte do index.html (a página de sempre) e aplica o que difere:
     · valores exatamente como o CRM montou, sem nada editável;
     · os itens do orçamento posicionados no layout 2D e na maquete 3D;
     · o palco/telão/pista do cenário nomeados, para sumirem quando a
       proposta trouxer a peça equivalente.
   Uso: node ferramentas/gerar-proposta-fechada.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(AQUI, '..');
const ler = f => fs.readFileSync(path.join(AQUI, 'proposta-fechada', f), 'utf8');

let s = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
const trocar = (de, para) => {
  const antes = s;
  s = s.replace(de, () => para);
  if (s === antes) throw new Error('trecho não encontrado: ' + de);
};

/* 1 · identidade da página: sem a demo DIMY no <head> (o cliente real vem do token) */
trocar('<title>Proposta DIMY · Indaiá Eventos</title>', '<title>Proposta · Indaiá Eventos</title>');
trocar(/<meta name="description" content="Proposta interativa corporativa[^"]*">/,
  '<meta name="description" content="Proposta interativa corporativa — Indaiá Eventos.">');

/* 2 · objetos do cenário ganham nome: pecas.js esconde o que a proposta repete */
trocar('  pista.rotation.x = -Math.PI/2;', '  pista.name = \'casa_pista\';\n  pista.rotation.x = -Math.PI/2;');
trocar('  palco.castShadow = palco.receiveShadow = true;', '  palco.name = \'casa_palco\';\n  palco.castShadow = palco.receiveShadow = true;');
trocar('  moldura.castShadow = true;', '  moldura.name = \'casa_telao\';\n  moldura.castShadow = true;');
trocar('  telao.position.set(telaoC.x-.045, telaoY, telaoC.z);', '  telao.name = \'casa_telao\';\n  telao.position.set(telaoC.x-.045, telaoY, telaoC.z);');

/* 2.1 · tema da festa (palha e dourado) — entra no fim do <head>, depois do
   CSS do index, para redefinir as variáveis sem tocar na página original */
trocar('</head>', `<style>\n${ler('tema.css')}\n</style>\n</head>`);

/* 2.2 · AMBIENTES DO MÓDULO DE LAYOUTS DO CRM ────────────────────────────
   A base do salão não é mais o registro fixo do index: vem do pacote público
   (/api/public/layouts-3d/ambientes/:slug), que é o que a equipe edita em
   Operacional › Layouts — planta calibrada, máscara com as colunas, maquete
   GLB, a MONTAGEM oficial de mesas e os itens decorativos do espaço.
   Os pacotes são embutidos AQUI, na geração: o script do index monta o
   ambiente no arranque (const), não dá para esperar um fetch. Maquete nova
   no CRM ⇒ rodar este gerador de novo. */
const API_PUBLICA = process.env.API_CRM || 'https://comercial-api.squareweb.app';
const SLUGS = JSON.parse(fs.readFileSync(path.join(AQUI, 'proposta-fechada', 'ambientes-crm.json'), 'utf8'));
const pacotes = {};
for (const slug of SLUGS) {
  let pac;
  try {
    const r = await fetch(`${API_PUBLICA}/api/public/layouts-3d/ambientes/${slug}`);
    if (!r.ok) { console.log(`  · ${slug}: HTTP ${r.status} — fica com o registro da página`); continue; }
    pac = (await r.json()).data;
  } catch (e) { console.log(`  · ${slug}: ${e.message} — fica com o registro da página`); continue; }

  const d = pac.maquete.dados, base = pac.maquete.assets_base;
  const url = (s) => (typeof s === 'string' && !/^https?:/.test(s) ? base + s : s);
  d.planta = { ...d.planta, src: url(d.planta.src) };
  (d.pisos || []).forEach((p) => { if (p.planta) p.planta = { ...p.planta, src: url(p.planta.src) }; });
  d.glb = { ...d.glb, src: url(d.glb.src) };
  if (d.envMap) d.envMap = url(d.envMap);
  (d.panos || []).forEach((p) => { if (p.src) p.src = url(p.src); });
  (d.props || []).forEach((p) => { if (p.glb) p.glb = url(p.glb); });

  /* a montagem oficial do salão vira o layout com que a proposta abre */
  const montagem = (pac.layouts || []).find((l) => l.escopo === 'padrao') || (pac.layouts || [])[0];
  if (montagem?.mesas?.length) {
    const mesas = montagem.mesas.map((m) => ({ x: Math.round(m.x), y: Math.round(m.y), p: m.p | 0 }));
    d.mesasPadrao = mesas;
    /* cada piso leva as SUAS mesas: pisos[i].mesasPadrao vazio venceria a lista geral */
    (d.pisos || []).forEach((p, i) => { p.mesasPadrao = mesas.filter((m) => (m.p | 0) === i).map(({ x, y }) => ({ x, y })); });
  }
  pacotes[slug] = {
    versao: pac.maquete.versao,
    montagem: montagem?.nome || null,
    convidados: montagem?.convidados ?? null,
    /* peças da montagem que NÃO são a mesa padrão: a mobília que a casa já põe */
    mobilias: (montagem?.mobilias || []).map((p) => ({
      nome: p.nome, x: Math.round(p.x), y: Math.round(p.y), p: p.piso | 0, rot: p.rotacao || 0,
      larg: p.largura, prof: p.profundidade, alt: p.altura, cor: p.cor, forma: p.forma, glb: p.glb_url,
    })),
    /* catálogo de itens decorativos vinculados ao espaço (o que a tela de
       Layouts oferece para inserir). Vazio enquanto ninguém vincular. */
    itens: (pac.itens || []).map((i) => ({
      slug: i.slug, nome: i.nome, categoria: i.categoria,
      footprint: i.footprint_m, glb: i.glb_url, thumb: i.thumb_url,
    })),
    dados: d,
  };
  console.log(`  · ${slug.padEnd(30)} ${String(pac.maquete.versao).padEnd(28)} ${(d.mesasPadrao || []).length} mesas · ${pacotes[slug].mobilias.length} mobílias · ${pacotes[slug].itens.length} itens`);
}

trocar('const ESPACO = (()=>{', `/* ---- ambientes do módulo de Layouts do CRM (embutidos na geração) ----
   O salão vem travado no link (?espaco=slug). Ambiente sem pacote publicado
   cai no registro fixo da página, que continua valendo como reserva. */
const PACOTES_CRM = ${JSON.stringify(pacotes)};
(()=>{
  const slug = new URLSearchParams(location.search).get('espaco') || 'salao_eventos';
  const pac = PACOTES_CRM[slug];
  if(!pac) return;
  const molde = AMBIENTES[slug] || AMBIENTES.salao_eventos;   /* textos e fotos da página */
  AMBIENTES[slug] = Object.assign({}, molde, pac.dados, {id:slug});
  window.__PACOTE_CRM__ = {slug, versao:pac.versao, montagem:pac.montagem,
    convidados:pac.convidados, mobilias:pac.mobilias, itens:pac.itens};
})();
const ESPACO = (()=>{`);

/* calibração nova = layout salvo antigo não vale mais: a chave carrega a versão */
trocar("const CHAVE = 'proposta_dimy_prototipo'",
  "const CHAVE = 'proposta_crm_' + ((window.__PACOTE_CRM__||{}).versao || 'fixo').replace(/[^a-z0-9]+/gi,'').slice(0,18)");

/* 3 · base oficial do CRM: publicada fora do localhost, a página só busca o
   orçamento se souber o endereço da API (o parâmetro `api` da URL é aceito
   apenas em localhost, de propósito). O index.html segue com o campo vazio. */
trocar("const API_CRM_OFICIAL = '';", "const API_CRM_OFICIAL = 'https://comercial-api.squareweb.app';");

/* 4 · carimbo: a proposta fechada tem versão própria */
trocar(/<span id="versaoBuild">([^<]*)<\/span>/, '<span id="versaoBuild">proposta fechada · v18.09-2</span>');

/* 4 · os dois módulos entram DENTRO do mesmo <script> do index — precisam
   enxergar PROPOSTA, MASCARA, tresMesas… que são const/let do script e não
   existem em window. Entram no fim, depois de vestirPropostaCRM(). */
trocar(/aoRolar\(\);\r?\n<\/script>/, `aoRolar();

/* ===== PROPOSTA FECHADA (gerado por ferramentas/gerar-proposta-fechada.mjs) ===== */
${ler('valores.js')}
${ler('pecas.js')}
</script>`);

const saida = path.join(REPO, 'proposta.html');
fs.writeFileSync(saida, s);
console.log('ok · proposta.html (' + Math.round(s.length / 1024) + ' KB)');
