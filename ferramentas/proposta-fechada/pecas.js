/* =================================================================
   PROPOSTA FECHADA — os ITENS DO ORÇAMENTO dentro do layout.
   Cada item contratado que ocupa chão (palco, telão, pista, lounge,
   bar, mesa de doces, cabine de DJ, totem…) vira uma PEÇA: desenhada
   na planta 2D, arrastável e girável pelo cliente, obstáculo para as
   mesas, e presente na maquete 3D e no passeio 360° na mesma posição.
   O que o cliente NÃO pode é tirar um item da proposta — peça some
   só quando o consultor refaz o orçamento.
   Injetado no fim do <script> do index; enxerga PROPOSTA, MASCARA,
   pxm, clampMesa, renderMesas, T3… do escopo do script original.
   ================================================================= */
(()=>{
const NS = 'http://www.w3.org/2000/svg';
const norm = s => String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();

/* ---- 1 · catálogo: do nome do produto para a peça física ----
   larg × prof em METROS (vista de cima), alt para a maquete. `chao:true`
   = marcação no piso (a pista de dança): não tem volume no 3D, mas continua
   sendo obstáculo — mesa nenhuma fica em cima da pista.
   `max` limita quantas peças um item repete na planta. */
const CATALOGO = [
  {re:/\bpalco\b|tablado/,                          tipo:'palco',   rot:'PALCO',        larg:4,   prof:4,   alt:.40, max:2, cor:'#2c2620', cor3d:0x23282E},
  {re:/tel(ao|ã)o|painel de led|\bled\b|audiovisual/,tipo:'telao',   rot:'TELÃO',        larg:4,   prof:.55, alt:2.2, max:3, medidaEhAltura:true, cor:'#15181c', cor3d:0x14181D},
  {re:/pista de dan|pista\b/,                        tipo:'pista',   rot:'PISTA',        larg:8,   prof:6,   alt:0,   max:1, cor:'#c9a96a', cor3d:0xC9A96A, chao:true},
  {re:/lounge|sof(a|á)|poltrona|puff|chill/,         tipo:'lounge',  rot:'LOUNGE',       larg:2.6, prof:1.8, alt:.42, max:6, cor:'#4a3f33', cor3d:0x5A4A3A},
  {re:/\bbar\b|balc(ao|ão)|chopeira|carrinho de drink/,tipo:'bar',   rot:'BAR',          larg:3,   prof:.9,  alt:1.1, max:4, cor:'#3a2f26', cor3d:0x4A3B2E},
  {re:/doces|bolo|sobremesa|ilha gastron|buffet|mesa retangular|mesa posta|welcome/,
                                                     tipo:'mesa',    rot:'MESA',         larg:2.4, prof:.9,  alt:.78, max:6, cor:'#6b5a46', cor3d:0x7A6750},
  {re:/\bdj\b|sonoriza|som e luz/,                   tipo:'dj',      rot:'DJ',           larg:2,   prof:.9,  alt:1.1, max:2, cor:'#23201c', cor3d:0x2A2622},
  {re:/bistr(o|ô)|mesa alta/,                        tipo:'bistro',  rot:'BISTRÔ',       larg:.75, prof:.75, alt:1.05,max:10,cor:'#5b4a38', cor3d:0x6B5742, redonda:true},
  {re:/(a|á)rvore|figueira|topiaria/,                tipo:'arvore',  rot:'ÁRVORE',       larg:1.4, prof:1.4, alt:2.6, max:4, cor:'#3c4a33', cor3d:0x4A5A3C, redonda:true},
  {re:/tapete|passadeira/,                           tipo:'tapete',  rot:'TAPETE',       larg:2,   prof:3,   alt:0,   max:6, cor:'#b9a488', cor3d:0xB9A488, chao:true},
  {re:/vaso|cachep(o|ô)|arranjo alto/,               tipo:'vaso',    rot:'VASO',         larg:.5,  prof:.5,  alt:1.1, max:8, cor:'#4a4238', cor3d:0x5A5246, redonda:true},
  {re:/totem|photo|espelho m(a|á)gico|cabine de foto/,tipo:'totem',  rot:'TOTEM',        larg:.9,  prof:.9,  alt:2.0, max:4, cor:'#2e2a24', cor3d:0x36312A},
  {re:/p(e|é)rgola|tenda|gazebo|estrutura de/,       tipo:'tenda',   rot:'ESTRUTURA',    larg:4,   prof:4,   alt:2.8, max:2, cor:'#453b30', cor3d:0x554838},
  {re:/altar|passarela/,                             tipo:'altar',   rot:'CERIMÔNIA',    larg:3,   prof:2,   alt:.3,  max:1, cor:'#59493a', cor3d:0x6A5843},
];
/* itens que NUNCA viram peça: são serviço, crédito, item de mesa posta ou
   coisa que não ocupa chão. Testado ANTES do catálogo. */
const FORA = /cadeira|mesa redonda|menu|jantar|coquetel|open bar|open drinks|drinks classic|welcome drink|bebida|refrigerante|(a|á)gua|caf(e|é)|t(e|é)rmica|rolha|taxa|equipe|seguran|limpeza|ecad|gerador|assessoria|cerimonial|cr(e|é)dito|hora extra|permanente|luz c(e|ê)nica|ilumina(c|ç)(a|ã)o|sousplat|toalha|guardanapo|talher|lou(c|ç)a|centro de mesa|banqueta|decora(c|ç)(a|ã)o floral|sonoriza(c|ç)(a|ã)o b(a|á)sica|brinde|convite/i;

/* medida escrita no nome ("Palco 6x4 m", "Telão 4 × 3") manda no catálogo */
function medidaDoNome(nome){
  const m = /(\d+(?:[.,]\d+)?)\s*(?:m)?\s*[x×]\s*(\d+(?:[.,]\d+)?)/i.exec(nome);
  if(!m) return null;
  const a = parseFloat(m[1].replace(',','.')), b = parseFloat(m[2].replace(',','.'));
  if(!(a>0 && b>0) || a>40 || b>40) return null;
  return {larg:a, prof:b};
}

/* ---- 2 · onde cada tipo nasce, em FRAÇÃO da área principal do salão ----
   Nada de pixel fixo: a planta e a calibração vêm do módulo de Layouts do CRM
   e mudam a cada revisão da maquete (e cada salão tem a sua). Em fração, a
   sugestão continua valendo em qualquer ambiente; a espiral resolve o resto,
   respeitando a máscara. */
const SUGERIDO = {
  palco:  {fx:.85, fy:.50}, telao: {fx:.95, fy:.50, girada:true},
  pista:  {fx:.50, fy:.50}, lounge:{fx:.80, fy:.86},
  bar:    {fx:.10, fy:.28}, mesa:  {fx:.22, fy:.86},
  dj:     {fx:.90, fy:.74}, totem: {fx:.12, fy:.14},
  tenda:  {fx:.12, fy:.45}, altar: {fx:.88, fy:.30},
  bistro: {fx:.34, fy:.12}, arvore:{fx:.94, fy:.14},
  tapete: {fx:.08, fy:.55}, vaso:  {fx:.26, fy:.10},
};
/* a caixa do PISO DE VERDADE: varre a máscara (que já é o piso válido do
   ambiente, com colunas e paredes descontadas) e devolve o retângulo que a
   contém. Mais confiável que as áreas declaradas — a planta do CRM traz
   deck, jardim e praia na mesma folha. */
let _caixaPiso = null;
function areaPrincipal(){
  if(_caixaPiso) return _caixaPiso;
  const {orig:M, G} = mascOrig(0);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for(let gy=0; gy<G.h; gy++) for(let gx=0; gx<G.w; gx++){
    const i = gy*G.w+gx;
    if(!(M[i>>3] & (1<<(i&7)))) continue;
    const x = gx*G.passo, y = gy*G.passo;
    if(x<x0) x0 = x; if(x>x1) x1 = x;
    if(y<y0) y0 = y; if(y>y1) y1 = y;
  }
  if(!isFinite(x0)){
    const P = PISOS[0], areas = P.areas || AMB.areas || [];
    _caixaPiso = areas[P.principal != null ? P.principal : (AMB.principal||0)] || areas[0] || {x0:0, x1:1920, y0:0, y1:1080};
  }else _caixaPiso = {x0, y0, x1, y1};
  return _caixaPiso;
}
function pontoBase(tipo){
  const A = areaPrincipal();
  const f = SUGERIDO[tipo] || {fx:.5, fy:.5};
  return {x: Math.round(A.x0 + (A.x1-A.x0)*f.fx), y: Math.round(A.y0 + (A.y1-A.y0)*f.fy), girada: f.girada};
}

/* ---- 3 · estado: as peças vivem junto do layout do cliente ---- */
/* este link já foi aberto antes? se sim, o layout salvo é do cliente e
   ninguém mexe nele; se não, a página monta o salão em volta das peças */
const PRIMEIRO_USO = !localStorage.getItem(CHAVE);
function lerSalvas(){
  try{
    const s = JSON.parse(localStorage.getItem(CHAVE)||'null');
    return (s && Array.isArray(s.pecas)) ? s.pecas : null;
  }catch(e){ return null; }
}
let PECAS = [];

/* geometria em px */
const meia = pc=>({x: pc.larg*pxm/2, y: pc.prof*pxm/2});
function retangulo(pc){
  const g = pc.girada ? {x: pc.prof*pxm/2, y: pc.larg*pxm/2} : meia(pc);
  return {x0:pc.x-g.x, y0:pc.y-g.y, x1:pc.x+g.x, y1:pc.y+g.y};
}
const distRet = (r,x,y)=>Math.hypot(Math.max(r.x0-x, 0, x-r.x1), Math.max(r.y0-y, 0, y-r.y1));

/* ---- 4 · máscara: peça é obstáculo para as mesas ---- */
const MASCS = [];
const registrar = (arr, G)=>{ if(arr && !MASCS.some(m=>m.arr===arr)) MASCS.push({arr, orig:arr.slice(), G}); };
registrar(MASCARA, MG);
PISOS.forEach((P,i)=>registrar(mascaraDoPiso(i), gradeDoPiso(i)));
const mascOrig = p=>MASCS.find(m=>m.arr===mascaraDoPiso(p)) || MASCS[0];
const pisoOrig = (x, y, p)=>{
  const {orig:M, G} = mascOrig(p);
  const gx = limita(Math.round(x/G.passo), 0, G.w-1), gy = limita(Math.round(y/G.passo), 0, G.h-1);
  const i = gy*G.w+gx; return !!(M[i>>3] & (1<<(i&7)));
};
function aplicarMascara(){
  for(const {arr, orig} of MASCS) arr.set(orig);
  for(const pc of PECAS){
    const r = retangulo(pc);
    const alvos = [mascOrig(pc.p)].concat(pc.p===0 ? MASCS.filter(m=>m.arr===MASCARA) : []);
    for(const {arr, G} of alvos){
      const gx0 = Math.max(0, Math.floor((r.x0-MESA_R)/G.passo)), gx1 = Math.min(G.w-1, Math.ceil((r.x1+MESA_R)/G.passo));
      const gy0 = Math.max(0, Math.floor((r.y0-MESA_R)/G.passo)), gy1 = Math.min(G.h-1, Math.ceil((r.y1+MESA_R)/G.passo));
      for(let gy=gy0; gy<=gy1; gy++) for(let gx=gx0; gx<=gx1; gx++){
        if(distRet(r, gx*G.passo, gy*G.passo) < MESA_R){ const i = gy*G.w+gx; arr[i>>3] &= ~(1<<(i&7)); }
      }
    }
  }
}
/* a peça cabe: os 4 cantos e o centro caem em piso válido (na máscara ORIGINAL) */
function cabe(pc, x, y, p){
  const g = pc.girada ? {x: pc.prof*pxm/2, y: pc.larg*pxm/2} : meia(pc);
  const dx = Math.max(0, g.x - MESA_R), dy = Math.max(0, g.y - MESA_R);
  for(const [ox,oy] of [[-dx,-dy],[0,-dy],[dx,-dy],[-dx,0],[0,0],[dx,0],[-dx,dy],[0,dy],[dx,dy]])
    if(!pisoOrig(x+ox, y+oy, p)) return false;
  return true;
}
/* não empilha peça em cima de peça (`vizinhas` = com quem comparar: as peças
   do layout, ou as já colocadas enquanto a proposta é montada) */
function livreDeOutras(pc, x, y, p, vizinhas, folga){
  const r = retangulo({...pc, x, y});
  return !(vizinhas||PECAS).some(o=>o!==pc && o.p===p && sobrepoe(r, retangulo(o), folga));
}
/* FOLGA_PECA: respiro que a página deixa ao POSICIONAR sozinha — para as peças
   não nascerem coladas. No arrasto e nas setas a folga é zero: o cliente
   encosta uma na outra se quiser (só não sobrepõe). */
const FOLGA_PECA = 0.5*pxm;
const sobrepoe = (a,b,folga)=>{ const f = folga||0;
  return a.x0-f < b.x1 && b.x0 < a.x1+f && a.y0-f < b.y1 && b.y0 < a.y1+f; };

function posicaoValida(pc, x, y, p, vizinhas, folga){ return cabe(pc, x, y, p) && livreDeOutras(pc, x, y, p, vizinhas, folga); }

/* a peça não nasce em cima das mesas da montagem: elas são o layout que a
   operação desenhou. No arrasto isso não vale — lá o cliente manda, e a mesa
   é que se afasta. */
function livreDeMesas(pc, x, y, p){
  const g = pc.girada ? {x:pc.prof*pxm/2, y:pc.larg*pxm/2} : meia(pc);
  const r = {x0:x-g.x, y0:y-g.y, x1:x+g.x, y1:y+g.y};
  return !PROPOSTA.mesas.some(m=>pisoDe(m)===p && distRet(r, m.x, m.y) < MESA_R + 2);
}

/* busca em espiral a partir do ponto sugerido do tipo */
function lugarInicial(pc, vizinhas){
  const base = pontoBase(pc.tipo);
  /* 1ª volta: lugar livre de mesas; 2ª: aceita empurrar mesa, se não houver vaga */
  for(const respeitarMesas of [true, false]){
    for(let t=0; t<=1600; t++){
      const ang = t*2.4, raio = 7*Math.sqrt(t);
      const x = Math.round(base.x + raio*Math.cos(ang)), y = Math.round(base.y + raio*Math.sin(ang));
      if(!posicaoValida(pc, x, y, 0, vizinhas, FOLGA_PECA)) continue;
      if(respeitarMesas && !livreDeMesas(pc, x, y, 0)) continue;
      return {x, y};
    }
  }
  return null;
}

/* vaga de mesa mais próxima: piso válido (a máscara já exclui as peças) e
   sem encostar em outra mesa — é o que impede o amontoado quando uma peça
   grande entra no meio do layout */
function vagaLivre(x, y, p, ignorar){
  const lim = 2*MESA_R + FOLGA_MIN;
  const cabeAqui = (nx,ny)=> pisoValido(nx, ny, p) && !PROPOSTA.mesas.some((m,i)=>
    i!==ignorar && pisoDe(m)===p && Math.hypot(m.x-nx, m.y-ny) < lim);
  if(cabeAqui(x, y)) return {x:Math.round(x), y:Math.round(y), p};
  for(let t=1; t<=1600; t++){
    const ang = t*2.4, raio = 4*Math.sqrt(t);
    const nx = Math.round(x + raio*Math.cos(ang)), ny = Math.round(y + raio*Math.sin(ang));
    if(cabeAqui(nx, ny)) return {x:nx, y:ny, p};
  }
  return null;
}
/* PRIMEIRA ABERTURA: com palco, pista e lounges ocupando chão, o layout
   padrão da casa (desenhado num salão vazio) não serve mais. A página
   redesenha as fileiras em volta das peças — mesmo passo do padrão da
   casa (footprint + 30 cm), centradas na área principal, só onde a
   máscara (já com as peças) aceita o centro da mesa. */
function fileirasEmVolta(){
  const P = PISOS[0];
  const areas = P.areas || AMB.areas;
  /* o salão INTEIRO (união das áreas), não só o bloco principal: com o centro
     ocupado pela pista, as mesas precisam dos braços laterais */
  const a = areas.reduce((u,r)=>({x0:Math.min(u.x0,r.x0), x1:Math.max(u.x1,r.x1),
    y0:Math.min(u.y0,r.y0), y1:Math.max(u.y1,r.y1)}), {...areas[0]});
  const need = Math.ceil(PROPOSTA.convidados / MESA.lugares);
  const passo = 2*MESA_R + FOLGA_MIN + 1;
  const cols = Math.floor((a.x1-a.x0-2*MESA_R)/passo)+1;
  const rows = Math.floor((a.y1-a.y0-2*MESA_R)/passo)+1;
  if(cols<1 || rows<1) return null;
  const cx = (a.x0+a.x1)/2, cy = (a.y0+a.y1)/2;
  /* varre pequenos deslocamentos da grade e fica com o que couber mais mesas */
  let melhor = [];
  for(let dx=-3; dx<=3; dx++) for(let dy=-3; dy<=3; dy++){
    const ox = cx + dx*passo/7, oy = cy + dy*passo/7;
    const cabem = [];
    for(let r=0; r<rows; r++) for(let c=0; c<cols; c++){
      const x = Math.round(ox + (c-(cols-1)/2)*passo), y = Math.round(oy + (r-(rows-1)/2)*passo);
      if(pisoValido(x, y, 0)) cabem.push({x, y});
    }
    if(cabem.length > melhor.length) melhor = cabem;
    if(melhor.length >= need) break;
  }
  if(!melhor.length) return null;
  /* mais vagas que mesas: fica com as mais centrais, para o salão não ficar
     com uma fileira solta na quina */
  if(melhor.length > need){
    melhor.sort((m,n)=>Math.hypot(m.x-cx, m.y-cy) - Math.hypot(n.x-cx, n.y-cy));
    melhor = melhor.slice(0, need);
    melhor.sort((m,n)=> m.y-n.y || m.x-n.x);
  }
  return melhor;
}

/* mesas que a peça cobre saem de baixo dela — e as que ficaram coladas
   umas nas outras no caminho também são reacomodadas */
function empurrarMesas(){
  let n = 0;
  PROPOSTA.mesas.forEach((m,i)=>{
    const p = pisoDe(m);
    const bate = PECAS.some(pc=>p===pc.p && distRet(retangulo(pc), m.x, m.y) < MESA_R);
    if(!bate) return;
    const vaga = vagaLivre(m.x, m.y, p, i) || clampMesa(m.x, m.y, p);
    PROPOSTA.mesas[i] = vaga; n++;
  });
  /* passadas seguintes: desfazem a sobreposição que o empurrão criou */
  for(let volta=0; volta<5; volta++){
    const pertos = paresPertos(PROPOSTA.mesas);
    if(!pertos.size) break;
    [...pertos].forEach(i=>{
      const m = PROPOSTA.mesas[i]; if(!m) return;
      const vaga = vagaLivre(m.x, m.y, pisoDe(m), i);
      if(vaga) PROPOSTA.mesas[i] = vaga;
    });
  }
  return n;
}

/* ---- 5 · monta as peças a partir do orçamento ---- */
/* peça a partir de um nome + quantidade; `hit` do catálogo já resolvido */
function montarPeca(hit, nome, seq, extra){
  /* 'Telão 4x3' é largura × ALTURA — a profundidade do painel é sempre a do catálogo */
  const escrita = medidaDoNome(nome);
  const med = !escrita ? {larg:hit.larg, prof:hit.prof, alt:hit.alt}
    : hit.medidaEhAltura ? {larg:escrita.larg, prof:hit.prof, alt:escrita.prof}
    : {larg:escrita.larg, prof:escrita.prof, alt:hit.alt};
  return Object.assign({id:`${hit.tipo}-${seq}`, tipo:hit.tipo, nome, rot:hit.rot,
    larg:med.larg, prof:med.prof, alt:med.alt, cor:hit.cor, cor3d:hit.cor3d,
    chao:!!hit.chao, redonda:!!hit.redonda,
    girada:false, x:0, y:0, p:0, origem:'orcamento'}, extra||{});
}

/* O que vem DENTRO de um pacote também ocupa o salão: o "Pacote audiovisual -
   FULL" lista, nos itens_inclusos, "01 Painel de LED 4x2 — fundo de palco" e
   "01 Painel de LED 4x1 — testeira". Só tipos que de fato ocupam piso entram —
   som, fumaça e microfone não viram peça. */
const PECA_EM_PACOTE = /painel de led|tel(ao|ã)o|\bpalco\b|pista de dan/;
function pecasDosInclusos(linha, seqInicial){
  const achadas = [];
  let seq = seqInicial;
  for(const inc of (linha.inclusos || [])){
    const texto = String((inc && inc.descricao) || '');
    for(const trecho of texto.split(/[,;\n]/)){
      const t = norm(trecho);
      if(!PECA_EM_PACOTE.test(t)) continue;
      /* "Painel de LED 4x2 — fundo de palco" é TELÃO, não palco: quem manda é
         o objeto citado primeiro, não qualquer palavra que apareça no trecho */
      const tipo = /painel de led|tel(ao|ã)o/.test(t) ? 'telao'
        : /\bpalco\b/.test(t) ? 'palco'
        : /pista de dan/.test(t) ? 'pista' : null;
      const hit = tipo && CATALOGO.find(c=>c.tipo===tipo);
      if(!hit) continue;
      const quantas = Math.min(parseInt((/^\s*0?(\d+)\s/.exec(trecho)||[])[1] || '1', 10) || 1, hit.max);
      /* nome curto para a etiqueta: "Painel de LED 4x2" em vez da frase inteira */
      /* etiqueta curta: "Painel de LED 4x2", não a frase inteira do pacote */
      const rotulo = (/(?:painel de led|tel[ãa]o|palco|pista(?: de dan[çc]a)?)(?:\s*\d+(?:[.,]\d+)?\s*[x×]\s*\d+(?:[.,]\d+)?)?/i
        .exec(trecho) || [trecho])[0].replace(/\s+/g, ' ').trim();
      for(let k=0; k<quantas; k++) achadas.push(montarPeca(hit, rotulo, seq++, {doPacote: linha.nome}));
    }
  }
  return achadas;
}

/* ---- 5.1 · o que a MONTAGEM do CRM já põe no salão ----
   Em Operacional › Layouts, a montagem tem mesas e mobília (cadeiras de
   cerimônia, altar, passarela, lounges…). As mesas viram MESAS_PADRAO no
   pacote; a mobília vem aqui, na posição que a operação desenhou. */
function daMontagem(){
  const pac = window.__PACOTE_CRM__;
  if(!pac || !Array.isArray(pac.mobilias) || !pac.mobilias.length) return [];
  return pac.mobilias.map((m, i)=>{
    const hit = CATALOGO.find(c=>c.re.test(norm(m.nome))) || null;
    const rot = hit ? hit.rot : String(m.nome||'ITEM').toUpperCase().slice(0, 20);
    return {id:`casa-${i}`, tipo: hit ? hit.tipo : 'casa', nome: m.nome || 'Item da montagem', rot,
      larg: Number(m.larg) || (hit ? hit.larg : 1), prof: Number(m.prof) || (hit ? hit.prof : 1),
      alt: Number(m.alt) || (hit ? hit.alt : .8),
      cor: m.cor || (hit ? hit.cor : '#6b5a46'), cor3d: hit ? hit.cor3d : 0x7A6750,
      chao: !!(hit && hit.chao), redonda: m.forma === 'elipse' || !!(hit && hit.redonda),
      girada: false, x: Math.round(m.x), y: Math.round(m.y), p: m.p|0,
      origem: 'montagem', glbCrm: m.glb || null};
  });
}

/* ---- 5.2 · catálogo de itens decorativos do espaço (Operacional › Layouts) ----
   Vem no pacote público (`itens`). Enquanto a equipe não vincular itens ao
   salão, a página oferece a lista interna de sempre. */
function catalogoDoCrm(){
  const pac = window.__PACOTE_CRM__;
  const lista = (pac && Array.isArray(pac.itens)) ? pac.itens : [];
  return lista.map(i=>{
    const hit = CATALOGO.find(c=>c.re.test(norm(i.nome))) || null;
    const lado = Number(i.footprint) || 1;
    return {slug:i.slug, nome:i.nome, categoria:i.categoria,
      tipo: hit ? hit.tipo : 'crm-'+i.slug, rot: (hit ? hit.rot : i.nome).toUpperCase(),
      larg: hit ? hit.larg : lado, prof: hit ? hit.prof : lado, alt: hit ? hit.alt : 1,
      cor: hit ? hit.cor : '#6b5a46', cor3d: hit ? hit.cor3d : 0x7A6750,
      max: hit ? hit.max : 8, glbCrm: i.glb || null, thumb: i.thumb || null};
  });
}

function daProposta(R){
  const salvas = lerSalvas();
  const novas = daMontagem();
  let seq = 0;
  for(const linha of (R.itensBrutos||[])){
    if(FORA.test(linha.nome)) continue;
    const hit = CATALOGO.find(c=>c.re.test(norm(linha.nome)));
    /* pacote (audiovisual, decoração): as peças saem do que ele inclui */
    const dosInclusos = pecasDosInclusos(linha, seq);
    if(dosInclusos.length){
      dosInclusos.forEach(pc=>novas.push(pc));
      seq += dosInclusos.length;
      continue;
    }
    if(!hit) continue;
    const quantas = Math.min(Math.max(1, linha.qtd|0), hit.max);
    for(let k=0; k<quantas; k++) novas.push(montarPeca(hit, linha.nome, seq++, {qtdTotal:linha.qtd}));
  }
  /* itens que o cliente tinha ACRESCENTADO neste link voltam junto */
  for(const sv of (salvas||[])){
    if(sv.origem !== 'cliente') continue;
    const hit = CATALOGO.find(c=>c.tipo===sv.tipo);
    if(!hit) continue;
    SEQ_CLIENTE = Math.max(SEQ_CLIENTE, (parseInt(String(sv.id).replace(/\D/g,''), 10) || 0) + 1);
    novas.push(montarPeca(hit, sv.nome || hit.rot, String(sv.id).replace(/^[a-z]+-/,''), {origem:'cliente', id:sv.id}));
  }

  /* posições: as que o cliente já tinha mexido neste link mandam; as demais
     entram uma a uma, cada qual desviando das que já foram colocadas */
  const colocadas = [], ativas = [], removidas = [];
  novas.forEach(pc=>{
    const sv = salvas && salvas.find(s=>s.id===pc.id);
    /* item que o cliente tirou do layout continua fora ao reabrir o link */
    if(sv && sv.foraDoLayout){ pc.foraDoLayout = true; removidas.push(pc); return; }
    if(sv && Number.isFinite(sv.x) && Number.isFinite(sv.y)){
      pc.x = sv.x; pc.y = sv.y; pc.p = sv.p|0; pc.girada = !!sv.girada;
      if(!cabe(pc, pc.x, pc.y, pc.p)){ const l = lugarInicial(pc, colocadas); if(l){ pc.x = l.x; pc.y = l.y; } }
    }else{
      pc.girada = !!pontoBase(pc.tipo).girada;
      const l = lugarInicial(pc, colocadas);
      if(l){ pc.x = l.x; pc.y = l.y; } else { const b = pontoBase(pc.tipo); pc.x = b.x; pc.y = b.y; }
    }
    colocadas.push(pc); ativas.push(pc);
  });
  return {ativas, removidas};
}

/* ---- 6 · desenho na planta 2D ---- */
const svg = document.querySelector('#plantaSvg');
const camada = document.createElementNS(NS, 'g'); camada.id = 'pecasCamada';
svg.insertBefore(camada, document.querySelector('#mesasCamada'));
{
  const d = document.createElementNS(NS, 'g');
  d.innerHTML = `<defs>
    <linearGradient id="pcTopo" x1="0" y1="0" x2=".35" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".16"/><stop offset="1" stop-color="#000000" stop-opacity=".18"/></linearGradient>
    <filter id="pcSombra" x="-30%" y="-30%" width="170%" height="180%">
      <feDropShadow dx="2" dy="6" stdDeviation="6" flood-color="#14100c" flood-opacity=".45"/></filter>
  </defs>`;
  svg.appendChild(d.firstElementChild);
}
document.head.appendChild(Object.assign(document.createElement('style'), {textContent:`
.pc{cursor:grab;touch-action:none;outline:none;}
.pc--drag{cursor:grabbing;}
.pc__base{stroke:rgba(8,6,4,.8);stroke-width:1.5;}
.pc__luz{fill:url(#pcTopo);pointer-events:none;}
/* peça estreita (o telão): o rótulo vai para fora, com halo claro para ler sobre a planta */
.pc__fora{font-size:12px;letter-spacing:.16em;fill:rgba(28,22,16,.78);paint-order:stroke;stroke:rgba(255,250,242,.8);stroke-width:3.5;}
.pc__txt{font-family:var(--sans);font-size:14px;font-weight:600;letter-spacing:.2em;fill:rgba(240,232,216,.88);pointer-events:none;}
.pc__sub{font-family:var(--sans);font-size:11px;letter-spacing:.1em;fill:rgba(240,232,216,.55);pointer-events:none;}
.pc__anel{fill:none;stroke:transparent;stroke-width:4;}
.pc--sel .pc__anel,.pc:focus-visible .pc__anel{stroke:var(--gold);}
.pc--chao .pc__base{stroke-dasharray:7 6;}
/* × de tirar do layout: só na peça escolhida, igual ao das mesas */
.pc__x{opacity:0;pointer-events:none;cursor:pointer;}
.pc--sel .pc__x{opacity:1;pointer-events:auto;}
.pc__x-fundo{fill:rgba(46,38,25,.92);}
.pc__x-tra{stroke:#FBF8F1;stroke-width:2.4;stroke-linecap:round;fill:none;}
/* peça que o cliente pediu a mais: contorno dourado tracejado */
.pc--extra .pc__base{stroke:var(--gold);stroke-dasharray:6 5;stroke-width:2;}
/* ---- barra de peças ao lado da planta (espelha o editor do CRM) ---- */
.visao__frame--editor{display:flex;align-items:stretch;gap:0;}
.visao__frame--editor > .planta__scroll{flex:1 1 auto;min-width:0;}
/* a altura do quadro do editor é a da PLANTA (o index deixa solta quando há
   recorte ou vários pisos): a barra nunca puxa o quadro para baixo */
.pecasbar{flex:0 0 232px;display:flex;flex-direction:column;background:var(--cream);
  border-right:1px solid var(--line);max-height:min(58vh, 540px);overflow:hidden;}
.pecasbar__topo{padding:10px 12px 8px;border-bottom:1px solid var(--line-soft);}
.pecasbar__busca{width:100%;font-family:var(--sans);font-size:.8rem;color:var(--brown-deep);
  padding:.5em .7em;border:1px solid var(--line);border-radius:8px;background:#fff;}
.pecasbar__abas{display:flex;gap:4px;margin-top:8px;}
.pecasbar__aba{flex:1 1 auto;font-size:.63rem;letter-spacing:0;color:var(--taupe);padding:.42em .12em;white-space:nowrap;
  border:1px solid transparent;border-radius:7px;background:none;cursor:pointer;}
.pecasbar__aba.on{background:var(--cream-2);border-color:var(--line);color:var(--brown-deep);font-weight:600;}
.pecasbar__conta{font-size:.68rem;color:var(--taupe);margin:8px 0 0;}
.pecasbar__grade{flex:1 1 auto;overflow-y:auto;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:10px 12px 14px;}
.pecacard{display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 6px 6px;
  border:1px solid var(--line-soft);border-radius:10px;background:#fff;text-align:center;}
.pecacard__fig{display:block;width:var(--w);height:var(--h);background:var(--pc);border-radius:var(--r);
  opacity:var(--op,1);border:2px var(--tr,solid) transparent;margin:6px 0 2px;}
.pecacard__img{width:100%;height:58px;object-fit:contain;}
.pecacard__nome{font-size:.72rem;line-height:1.3;color:var(--brown-deep);margin:2px 0 0;}
.pecacard__med{font-size:.66rem;color:var(--taupe);margin:0;}
.pecacard__add{width:100%;font-size:.68rem;color:var(--brown-deep);background:var(--cream-2);
  border:1px solid var(--line);border-radius:7px;padding:.38em 0;margin-top:4px;cursor:pointer;}
.pecacard__add:hover{background:var(--gold);border-color:var(--gold);color:#2A2318;}
@media (max-width:760px){
  .visao__frame--editor{flex-direction:column;}
  .pecasbar{flex:0 0 auto;border-right:0;border-bottom:1px solid var(--line);}
  .pecasbar__grade{grid-template-columns:repeat(auto-fill,minmax(104px,1fr));max-height:216px;}
}
.pecas__mudou{display:inline-block;margin-top:6px;color:var(--gold-deep);}
.pecas__nota{font-size:.78rem;color:var(--taupe);margin:8px 0 0;line-height:1.65;width:100%;}
.pecas__nota b{color:var(--brown-deep);}
.pecas__nota i{font-style:normal;color:var(--brown-deep);border-bottom:1px dotted var(--gold);}
/* chip escolhido sobre a maquete: o fundo claro de .ambs3d apagava o texto creme */
.ambs3d .pill[aria-pressed="true"]{background:var(--brown-deep);color:var(--cream);}
`}));

let sel = null, drag = null;
function desenhar(){
  const visiveis = PECAS.filter(pc=>pc.p===PISO_I);
  camada.innerHTML = visiveis.map(pc=>{
    const g = pc.girada ? {x:pc.prof*pxm/2, y:pc.larg*pxm/2} : meia(pc);
    const L = 2*g.x, A = 2*g.y;
    const medida = `${(pc.girada?pc.prof:pc.larg).toLocaleString('pt-BR')} × ${(pc.girada?pc.larg:pc.prof).toLocaleString('pt-BR')} m`;
    const cabeTexto = L > 70 && A > 34;
    return `<g class="pc${sel===pc.id?' pc--sel':''}${pc.chao?' pc--chao':''}${pc.origem==='cliente'?' pc--extra':''}" data-pc="${pc.id}" tabindex="0" role="button"
        aria-label="${esc(pc.nome)}. Arraste para posicionar, R gira, setas movem." transform="translate(${pc.x},${pc.y})">
      <g ${pc.chao?'':'filter="url(#pcSombra)"'}>
        ${pc.redonda
          ? `<circle class="pc__base" r="${(L/2).toFixed(1)}" fill="${pc.cor}" fill-opacity=".95"/>`
          : `<rect class="pc__base" x="${-g.x}" y="${-g.y}" width="${L}" height="${A}" rx="${pc.chao?10:3}"
          fill="${pc.cor}" fill-opacity="${pc.chao?.22:.95}"/>`}
      </g>
      ${(pc.chao||pc.redonda)?'':`<rect class="pc__luz" x="${-g.x+2}" y="${-g.y+2}" width="${Math.max(0,L-4)}" height="${Math.max(0,A-4)}" rx="2"/>`}
      ${cabeTexto ? `<text class="pc__txt" x="0" y="${A>58?-2:5}" text-anchor="middle">${esc(pc.rot)}</text>
        ${A>58?`<text class="pc__sub" x="0" y="17" text-anchor="middle">${medida}</text>`:''}`
        : (pc.larg >= 1.2 || sel===pc.id)   /* peça miúda só mostra o nome quando escolhida */
          ? `<text class="pc__txt pc__fora" x="0" y="${-g.y-9}" text-anchor="middle">${esc(pc.rot)}</text>` : ''}
      <rect class="pc__anel" x="${-g.x-5}" y="${-g.y-5}" width="${L+10}" height="${A+10}" rx="5"/>
      <g class="pc__x" aria-hidden="${sel===pc.id?'false':'true'}">
        <circle cx="${g.x-2}" cy="${-g.y+2}" r="15" class="pc__x-fundo"/>
        <path class="pc__x-tra" d="M${g.x-7.2} ${-g.y-3.2} l10.4 10.4 M${g.x+3.2} ${-g.y-3.2} l-10.4 10.4"/>
      </g>
    </g>`;
  }).join('');
}

/* ---- barra de peças, no espírito do editor do CRM ----
   Coluna ao lado da planta: busca, abas por categoria e um cartão por peça
   com nome, medida real e "Adicionar". Quando o espaço tiver itens vinculados
   no CRM, é o catálogo de lá que aparece aqui (com a miniatura do cadastro). */
const CATEGORIA_DE = {
  lounge:'mobilias', bar:'mobilias', mesa:'mobilias', bistro:'mobilias', dj:'estruturas',
  palco:'estruturas', telao:'estruturas', tenda:'estruturas', totem:'estruturas',
  arvore:'decoracoes', vaso:'decoracoes', tapete:'decoracoes', pista:'estruturas', altar:'estruturas',
};
const ABAS = [['tudo','Tudo'], ['mobilias','Mobílias'], ['decoracoes','Decorações'], ['estruturas','Estruturas']];

function pecasDisponiveis(){
  const doCrm = catalogoDoCrm();
  if(doCrm.length) return doCrm.map(i=>({...i, cat: catDe(i.categoria) || CATEGORIA_DE[i.tipo] || 'mobilias'}));
  return CATALOGO.map(c=>({tipo:c.tipo, nome:NOME_CHIP[c.tipo] || c.rot, larg:c.larg, prof:c.prof,
    cor:c.cor, redonda:c.redonda, chao:c.chao, cat:CATEGORIA_DE[c.tipo] || 'mobilias'}));
}
const catDe = c=>({mobiliario:'mobilias', decoracao:'decoracoes', cenografia:'decoracoes',
  estrutura:'estruturas', audiovisual:'estruturas'})[norm(c)];

function painelAdicionar(){
  const box = document.createElement('div');
  box.className = 'pecasbar'; box.id = 'pecasBar';
  const lista = pecasDisponiveis();
  box.innerHTML = `
    <div class="pecasbar__topo">
      <input type="search" class="pecasbar__busca" id="pecasBusca" placeholder="Mesa, sofá, arranjo…" aria-label="Procurar peça">
      <div class="pecasbar__abas" role="tablist">${ABAS.map(([id,rot],i)=>
        `<button type="button" class="pecasbar__aba${i===0?' on':''}" data-aba="${id}" aria-pressed="${i===0}">${rot}</button>`).join('')}</div>
      <p class="pecasbar__conta"><b id="pecasConta">${lista.length}</b> peças · medidas reais</p>
    </div>
    <div class="pecasbar__grade" id="pecasGrade">${lista.map(i=>cartaoPeca(i)).join('')}</div>`;

  const pintar = ()=>{
    const aba = box.querySelector('.pecasbar__aba.on').dataset.aba;
    const busca = norm(box.querySelector('#pecasBusca').value);
    let n = 0;
    box.querySelectorAll('.pecacard').forEach(c=>{
      const bate = (aba==='tudo' || c.dataset.cat===aba) && (!busca || norm(c.dataset.nome).includes(busca));
      c.hidden = !bate;
      if(bate) n++;
    });
    box.querySelector('#pecasConta').textContent = n;
  };
  box.addEventListener('click', ev=>{
    const aba = ev.target.closest('.pecasbar__aba');
    if(aba){
      box.querySelectorAll('.pecasbar__aba').forEach(b=>{ b.classList.toggle('on', b===aba); b.setAttribute('aria-pressed', String(b===aba)); });
      pintar(); return;
    }
    const add = ev.target.closest('[data-add]');
    if(add) adicionarPeca(add.dataset.add);
  });
  box.querySelector('#pecasBusca').addEventListener('input', pintar);
  return box;
}

function cartaoPeca(i){
  const medida = `${Number(i.larg).toLocaleString('pt-BR')} × ${Number(i.prof).toLocaleString('pt-BR')} m`;
  const figura = i.thumb
    ? `<img class="pecacard__img" src="${esc(i.thumb)}" alt="" loading="lazy">`
    : `<span class="pecacard__fig" style="--pc:${i.cor};--w:${Math.min(76, 18+Number(i.larg)*14)}px;--h:${Math.min(56, 14+Number(i.prof)*14)}px;
         --r:${i.redonda?'50%':'4px'};${i.chao?'--op:.45;--tr:dashed;':''}"></span>`;
  return `<article class="pecacard" data-cat="${i.cat}" data-nome="${esc(i.nome)}">
    ${figura}
    <p class="pecacard__nome">${esc(i.nome)}</p>
    <p class="pecacard__med">${medida}</p>
    <button type="button" class="pecacard__add" data-add="${esc(i.tipo)}">+ Adicionar</button>
  </article>`;
}

/* nota abaixo da barra do editor: o que está no salão e como mexer */
const nota = document.createElement('p');
nota.className = 'pecas__nota'; nota.id = 'pecasNota';
function pintarNota(){
  const contagem = {};
  PECAS.forEach(pc=>{ contagem[pc.rot] = (contagem[pc.rot]||0)+1; });
  const lista = Object.entries(contagem).map(([r,n])=>`<i>${n>1?n+'× ':''}${r.toLowerCase()}</i>`).join(' · ');
  const mudou = mudancasDoCliente();
  nota.hidden = false;
  nota.innerHTML = (lista
      ? `<b>No seu salão:</b> ${lista}. Arraste para posicionar (a tecla <b>R</b> gira, as setas
         ajustam fino, <b>Delete</b> tira do layout). As mesas se afastam sozinhas para abrir espaço.`
      : `<b>O seu salão está só com as mesas.</b> Use os botões acima para trazer os itens de volta.`)
    + (mudou.length
      ? `<br><span class="pecas__mudou"><b>Ajustes seus:</b> ${esc(mudou.join(' · '))} — o layout vai
         assim para o consultor; o valor da proposta só muda se ele refizer o orçamento.</span>`
      : '');
}

function tudo(){ aplicarMascara(); desenhar(); pintarNota(); }

/* ---- 7 · arrasto, giro e teclado ---- */
const ponto = ev=>{ const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
const achar = id=>PECAS.find(p=>p.id===id);

svg.addEventListener('pointerdown', ev=>{
  const g = ev.target.closest('.pc');
  if(!g){ if(sel){ sel = null; desenhar(); } return; }
  const pc = achar(g.dataset.pc); if(!pc) return;
  if(ev.target.closest('.pc__x')){ removerPeca(pc.id); return; }
  sel = pc.id;
  const pt = ponto(ev);
  drag = {pc, dx:pc.x-pt.x, dy:pc.y-pt.y};
  desenhar();
  const novo = camada.querySelector(`[data-pc="${pc.id}"]`);
  if(novo){ novo.classList.add('pc--drag'); novo.focus({preventScroll:true}); }
  svg.setPointerCapture(ev.pointerId);
}, true);
svg.addEventListener('pointermove', ev=>{
  if(!drag) return;
  const pt = ponto(ev);
  const x = Math.round(pt.x+drag.dx), y = Math.round(pt.y+drag.dy);
  if(!posicaoValida(drag.pc, x, y, drag.pc.p)) return;
  drag.pc.x = x; drag.pc.y = y;
  const g = camada.querySelector(`[data-pc="${drag.pc.id}"]`);
  if(g) g.setAttribute('transform', `translate(${x},${y})`);
});
function fimDrag(){
  if(!drag) return;
  drag = null;
  assentar();
}
svg.addEventListener('pointerup', fimDrag);
svg.addEventListener('pointercancel', fimDrag);
svg.addEventListener('keydown', ev=>{
  const g = ev.target.closest && ev.target.closest('.pc');
  if(!g) return;
  const pc = achar(g.dataset.pc); if(!pc) return;
  if(ev.key==='Delete' || ev.key==='Backspace'){ ev.preventDefault(); removerPeca(pc.id); return; }
  if(ev.key==='r' || ev.key==='R'){
    ev.preventDefault();
    const antes = pc.girada; pc.girada = !antes;
    if(!posicaoValida(pc, pc.x, pc.y, pc.p)){ pc.girada = antes; mostrarToast('Não há espaço para girar aqui'); return; }
    assentar(); focar(pc.id); return;
  }
  const passo = 0.25*pxm;
  const dir = {ArrowUp:[0,-passo], ArrowDown:[0,passo], ArrowLeft:[-passo,0], ArrowRight:[passo,0]}[ev.key];
  if(!dir) return;
  ev.preventDefault();
  const x = Math.round(pc.x+dir[0]), y = Math.round(pc.y+dir[1]);
  if(!posicaoValida(pc, x, y, pc.p)) return;
  pc.x = x; pc.y = y;
  assentar(); focar(pc.id);
});
const focar = id=>{ const g = camada.querySelector(`[data-pc="${id}"]`); if(g) g.focus({preventScroll:true}); };

function assentar(){
  aplicarMascara();
  const n = empurrarMesas();
  PROPOSTA.pecas = PECAS.concat(REMOVIDAS);
  salvarMesas();                 /* grava o layout (mesas + peças) e sobe a versão */
  renderMesas(); tudo(); atualizarTotais();
  if(T3 && T3.pronto) pecas3d();
  if(n) mostrarToast(`${n} ${n===1?'mesa foi afastada':'mesas foram afastadas'} para abrir espaço`);
}

/* ---- 7.1 · o cliente tira e põe itens no salão ----
   Regra: o PREÇO não se mexe. Tirar um item contratado ou pedir um a mais é
   um recado para o consultor, que refaz o orçamento se for o caso. A página
   mostra o layout do jeito que o cliente quer ver e leva as mudanças no
   "Confirmar a proposta". */
const TIPOS_QUE_O_CLIENTE_ADICIONA = ['lounge','bar','mesa','bistro','totem','palco','vaso','arvore'];

function removerPeca(id){
  const i = PECAS.findIndex(p=>p.id===id);
  if(i<0) return;
  const pc = PECAS[i];
  if(pc.origem === 'cliente'){
    PECAS.splice(i, 1);                      /* era pedido do cliente: some de vez */
  }else{
    pc.foraDoLayout = true;                  /* veio da proposta: fica registrado */
    PECAS.splice(i, 1);
    REMOVIDAS.push(pc);
  }
  sel = null;
  assentar();
  mostrarToast(`${pc.rot.charAt(0)+pc.rot.slice(1).toLowerCase()} tirado do layout`);
}
const REMOVIDAS = [];

function adicionarPeca(tipo){
  /* o tipo pode vir do catálogo do CRM (itens do espaço) ou da lista interna */
  const hit = CATALOGO.find(c=>c.tipo===tipo) || catalogoDoCrm().find(i=>i.tipo===tipo);
  if(!hit) return;
  /* item que o cliente tinha tirado volta antes de a página criar um novo */
  const i = REMOVIDAS.findIndex(p=>p.tipo===tipo);
  let pc;
  if(i>=0){
    pc = REMOVIDAS.splice(i, 1)[0];
    delete pc.foraDoLayout;
  }else{
    pc = montarPeca(hit, hit.rot.charAt(0)+hit.rot.slice(1).toLowerCase(), 'cli'+(SEQ_CLIENTE++), {origem:'cliente'});
    pc.girada = !!pontoBase(pc.tipo).girada;
  }
  const lugar = lugarInicial(pc, PECAS);
  if(!lugar){ mostrarToast('Não há espaço livre para mais um item neste piso'); if(i>=0) REMOVIDAS.push(pc); return; }
  pc.x = lugar.x; pc.y = lugar.y; pc.p = PISO_I;
  PECAS.push(pc);
  sel = pc.id;
  assentar();
  focar(pc.id);
  mostrarToast(pc.origem === 'cliente'
    ? `${pc.rot.charAt(0)+pc.rot.slice(1).toLowerCase()} incluído no layout — a confirmar com o consultor`
    : `${pc.rot.charAt(0)+pc.rot.slice(1).toLowerCase()} de volta ao layout`);
}
let SEQ_CLIENTE = 0;

/* o que mudou em relação ao que o consultor montou */
function mudancasDoCliente(){
  const conta = lista=>{ const c = {}; lista.forEach(pc=>{ c[pc.rot] = (c[pc.rot]||0)+1; }); return c; };
  const tirados = conta(REMOVIDAS);
  const postos = conta(PECAS.filter(pc=>pc.origem === 'cliente'));
  const frase = (c, verbo)=>Object.entries(c).map(([r,n])=>`${verbo} ${n>1?n+'× ':''}${r.toLowerCase()}`);
  return frase(tirados, 'sem').concat(frase(postos, 'mais'));
}

/* botão: devolve cada item ao lugar sugerido pela nossa operação */
const btnRepor = document.createElement('button');
btnRepor.type = 'button'; btnRepor.className = 'btn btn--ghost'; btnRepor.id = 'btnReporPecas';
btnRepor.textContent = 'Reposicionar os itens da proposta';
function reposicionar(){
  const colocadas = [];
  PECAS.forEach(pc=>{
    pc.girada = !!pontoBase(pc.tipo).girada;
    const l = lugarInicial(pc, colocadas);
    if(l){ pc.x = l.x; pc.y = l.y; }
    colocadas.push(pc);
  });
  assentar();
}
btnRepor.addEventListener('click', reposicionar);

/* o "Restaurar layout padrão" do editor também recoloca as peças */
const btnPadrao = document.querySelector('#btnPadrao');
if(btnPadrao) btnPadrao.addEventListener('click', ()=>setTimeout(reposicionar, 0));

/* troca de piso redesenha */
const trocarPisoOriginal = trocarPiso;
trocarPiso = function(i){ trocarPisoOriginal(i); sel = null; tudo(); };

/* ---- 8 · as mesmas peças na MAQUETE 3D ---- */
function pecas3d(){
  const TH = window.THREE;
  if(!TH || !T3 || !T3.cena) return;
  if(T3.pecasGrupo){
    T3.cena.remove(T3.pecasGrupo);
    T3.pecasGrupo.traverse(o=>{ if(o.isMesh && o.geometry) o.geometry.dispose(); });
  }
  const g = new TH.Group(); g.name = 'pecas-orcamento';
  for(const pc of PECAS){
    const c = pxParaM(pc.x, pc.y);
    const piso = pisoYEm(pc.x, pc.y, pc.p);
    const L = pc.girada ? pc.prof : pc.larg, P = pc.girada ? pc.larg : pc.prof;
    if(pc.chao){                               /* pista: marcação luminosa no piso */
      const m = new TH.Mesh(new TH.PlaneGeometry(L, P),
        new TH.MeshStandardMaterial({color:pc.cor3d, emissive:0x8A6B33, emissiveIntensity:.28,
          transparent:true, opacity:.2, roughness:.4, depthWrite:false}));
      m.rotation.x = -Math.PI/2;
      m.position.set(c.x, piso+.006, c.z);
      g.add(m);
      continue;
    }
    if(pc.tipo==='telao'){                     /* moldura + painel aceso, de frente pro salão */
      /* aqui valem as medidas FÍSICAS do painel: quem vira o telão para o
         salão é a rotação, não a troca largura↔profundidade do editor 2D */
      const Lf = pc.larg, Pf = Math.max(.12, pc.prof);
      const alvo = mirarSalao(pc);
      const corpo = new TH.Mesh(new TH.BoxGeometry(Lf, pc.alt, Pf),
        new TH.MeshStandardMaterial({color:0x14181D, roughness:.55}));
      corpo.position.set(c.x, piso + pc.alt/2 + .35, c.z);
      corpo.rotation.y = alvo;
      corpo.castShadow = true;
      g.add(corpo);
      const tela = new TH.Mesh(new TH.PlaneGeometry(Lf*.94, pc.alt*.88), telaoMaterial(TH));
      tela.position.set(c.x, piso + pc.alt/2 + .35, c.z);
      tela.rotation.y = alvo;
      tela.translateZ(Pf/2 + .01);
      g.add(tela);
      continue;
    }
    const alt = Math.max(.05, pc.alt);
    /* árvore: tronco fino (a copa vem logo abaixo); bistrô: pé que afina;
       demais redondas: cilindro cheio */
    const geo = pc.tipo==='arvore' ? new TH.CylinderGeometry(.09, .14, alt*.55, 10)
      : pc.redonda ? new TH.CylinderGeometry(L/2, L/2*(pc.tipo==='bistro'?.35:.8), alt, 18)
      : new TH.BoxGeometry(L, alt, P);
    const m = new TH.Mesh(geo,
      new TH.MeshStandardMaterial({color:pc.cor3d, roughness:.8, metalness:.02}));
    m.position.set(c.x, piso + (pc.tipo==='arvore' ? alt*.275 : alt/2), c.z);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    /* lounge ganha um par de assentos claros; bar e DJ, um tampo mais claro */
    if(pc.tipo==='lounge'){
      const enc = new TH.Mesh(new TH.BoxGeometry(L, .42, .22),
        new TH.MeshStandardMaterial({color:0x8B7355, roughness:.9}));
      enc.position.set(c.x, piso + alt + .21, c.z - P/2 + .12);
      g.add(enc);
    }else if(pc.tipo==='arvore'){
      const raio = Math.max(.6, L*.55);
      const copa = new TH.Mesh(new TH.SphereGeometry(raio, 14, 12),
        new TH.MeshStandardMaterial({color:0x5C6E48, roughness:.95}));
      copa.position.set(c.x, piso + alt*.55 + raio*.75, c.z);
      copa.scale.set(1, .85, 1);
      copa.castShadow = true;
      g.add(copa);
    }else if(pc.tipo==='bistro'){
      const tampo = new TH.Mesh(new TH.CylinderGeometry(L/2, L/2, .05, 18),
        new TH.MeshStandardMaterial({color:0xF1EAD9, roughness:.6}));
      tampo.position.set(c.x, piso + alt + .02, c.z);
      g.add(tampo);
    }else if(pc.tipo==='bar' || pc.tipo==='dj' || pc.tipo==='mesa'){
      const tampo = new TH.Mesh(new TH.BoxGeometry(L+.08, .06, P+.08),
        new TH.MeshStandardMaterial({color:pc.tipo==='mesa'?0xF1EAD9:0x9A8B75, roughness:.6}));
      tampo.position.set(c.x, piso + alt + .03, c.z);
      g.add(tampo);
    }
  }
  T3.pecasGrupo = g;
  T3.cena.add(g);
  if(T3.renderer) T3.renderer.shadowMap.needsUpdate = true;
}
/* gira a peça para "olhar" o centro do salão (telão de costas para a parede) */
function mirarSalao(pc){
  const alvoPx = (AMB.camera && AMB.camera.alvoPx) || pontoBase('pista');
  const a = pxParaM(pc.x, pc.y), b = pxParaM(alvoPx.x, alvoPx.y);
  return Math.atan2(b.x-a.x, b.z-a.z);
}

/* ---- 8.1 · atalhos de câmera: "me mostra o palco" ----
   Uma fileira de chips acima da maquete, um por item da proposta. Clicar
   leva a câmera até a peça — é o jeito mais curto de o cliente ver, em 3D,
   o que ele contratou. */
const NOME_CHIP = {palco:'Palco', telao:'Telão', pista:'Pista', lounge:'Lounge', bar:'Bar',
  mesa:'Mesa', dj:'DJ', totem:'Totem', tenda:'Estrutura', altar:'Cerimônia',
  bistro:'Bistrô', arvore:'Árvore', tapete:'Tapete', vaso:'Vaso'};
function pintarChips3d(){
  const box = document.querySelector('#tresAmbs');
  if(!box || !PECAS.length) return;
  const rotulos = [];
  PECAS.forEach(pc=>{ if(!rotulos.some(r=>r.tipo===pc.tipo)) rotulos.push({tipo:pc.tipo, rot:pc.rot, id:pc.id}); });
  /* a maquete refaz as mesas a cada mudança de layout e chama isto de novo:
     os chips são REESCRITOS, senão duplicam a cada passada */
  const doIndex = [...box.querySelectorAll('[data-amb3d]')].map(b=>b.outerHTML).join('');
  box.hidden = false;
  box.dataset.pecas = '1';
  box.innerHTML = (doIndex || '<button type="button" class="pill" data-amb3d="-1" aria-pressed="true">Espaço inteiro</button>')
    + rotulos.map(r=>`<button type="button" class="pill" data-peca3d="${r.id}" aria-pressed="false">${esc(NOME_CHIP[r.tipo] || r.rot)}</button>`).join('');
}
function olharPeca(id){
  const pc = achar(id);
  if(!pc || !T3 || !T3.pronto) return;
  const c = pxParaM(pc.x, pc.y);
  T3.alvo.set(c.x, pisoYEm(pc.x, pc.y, pc.p) + Math.max(1, pc.alt||1)/2, c.z);
  T3.orb.raio = limita(Math.max(pc.larg, pc.prof)*2.4 + 9, 12, 26);
  T3.orb.phi = .84;
  T3.orb.theta = mirarSalao(pc);               /* câmera do lado do salão, olhando a peça */
  tresCamera();
  const box = document.querySelector('#tresAmbs');
  if(box) [...box.querySelectorAll('.pill')].forEach(b=>b.setAttribute('aria-pressed', String(b.dataset.peca3d===id)));
}
document.addEventListener('click', ev=>{
  const b = ev.target.closest('#tresAmbs [data-peca3d]');
  if(b) olharPeca(b.dataset.peca3d);
});

/* ---- 8.3 · céu ----
   A maquete nova do CRM é feita para a vista de cima: não tem forro. De dentro
   (passeio 360° e tour), olhar para cima dava o vazio cinza do canvas. Um céu
   de fim de tarde fecha a cena — e ainda combina com a paleta do evento. */
function porCeu(){
  const TH = window.THREE;
  if(!TH || !T3 || !T3.cena || T3.ceuPosto) return;
  const cv = document.createElement('canvas');
  cv.width = 8; cv.height = 256;
  const g = cv.getContext('2d').createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0,   '#8FA9BE');   /* alto: azul de fim de tarde */
  g.addColorStop(.52, '#DCC9A8');   /* horizonte: palha */
  g.addColorStop(1,   '#F3E9D6');   /* baixo: areia clara */
  const ctx = cv.getContext('2d');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 8, 256);
  const tx = new TH.CanvasTexture(cv);
  tx.colorSpace = TH.SRGBColorSpace;
  /* cúpula de verdade (esfera invertida), não `scene.background`: o panorama é
     renderizado por CubeCamera, e ali o background equiretangular sai preto */
  const centro = pxParaM(
    (areaPrincipal().x0 + areaPrincipal().x1)/2,
    (areaPrincipal().y0 + areaPrincipal().y1)/2);
  const ceu = new TH.Mesh(
    new TH.SphereGeometry(160, 24, 16),
    new TH.MeshBasicMaterial({map:tx, side:TH.BackSide, depthWrite:false, fog:false}));
  ceu.position.set(centro.x, 0, centro.z);
  ceu.name = 'ceu';
  T3.cena.add(ceu);
  T3.ceuPosto = true;
}

/* ---- 8.4 · de onde se olha o salão ----
   A maquete do CRM traz `camera.internas` — o ponto de vista que a equipe
   escolheu dentro do salão. Sem isso, o cálculo da página achava um ponto
   "livre na máscara" que, na maquete nova, caía colado numa cortina: o 360
   abria mostrando pano de parede. */
if(typeof panoOlho === 'function'){
  const olhoOriginal = panoOlho;
  panoOlho = function(){
    const c = AMB.camera && Array.isArray(AMB.camera.internas) ? AMB.camera.internas[0] : null;
    if(c && Array.isArray(c.olho)){
      const cal = AMB.glb.cal;
      const px = Math.round(cal.px0 + (c.olho[0] - cal.x0)*pxm);
      const py = Math.round(cal.py0 + (c.olho[2] - cal.z0)*pxm);
      if(pisoValido(px, py, 0)) return {x:px, y:py};
    }
    return olhoOriginal.apply(this, arguments);
  };
}

/* o passeio 360° renderiza a cena por conta própria (CubeCamera) e pode
   acontecer antes de a maquete 3D ser aberta: o céu e as peças precisam estar
   lá também nesse caminho */
if(typeof layoutRenderizarPanorama === 'function'){
  const panoOriginal = layoutRenderizarPanorama;
  layoutRenderizarPanorama = function(){
    porCeu();
    if(T3 && T3.cena && !T3.pecasGrupo) pecas3d();
    return panoOriginal.apply(this, arguments);
  };
}

/* a maquete recria as mesas a cada mudança de layout: as peças vão junto */
const mesas3dOriginal = tresMesas;
tresMesas = function(){
  mesas3dOriginal.apply(this, arguments);
  porCeu();
  pecas3d();
  esconderFixosDaCasa();
  pintarChips3d();
};
/* o palco/telão/pista que o GLB do ambiente já tinha somem quando a proposta
   traz a peça equivalente — senão o cliente veria dois palcos */
function esconderFixosDaCasa(){
  if(!T3 || !T3.cena) return;
  const tem = t=>PECAS.some(p=>p.tipo===t);
  const mapa = {casa_palco:'palco', casa_telao:'telao', casa_pista:'pista'};
  T3.cena.traverse(o=>{
    const tipo = mapa[o.name];
    if(tipo) o.visible = !tem(tipo);
  });
}

/* ---- 8.2 · a lista de extras aponta para o layout ----
   Item que virou peça ganha um "ver no salão": leva o cliente até a planta
   com a peça já destacada. É o que costura o orçamento ao layout. */
function ligarListaAoLayout(){
  const ul = document.querySelector('#listaItens');
  if(!ul) return;
  ul.querySelectorAll('li.item').forEach(li=>{
    const nome = (li.querySelector('.item__nome')||{}).textContent || '';
    const pc = PECAS.find(p=>norm(p.nome)===norm(nome) || (p.doPacote && norm(p.doPacote)===norm(nome)));
    if(!pc || li.querySelector('.item__nolayout')) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'item__nolayout';
    b.textContent = 'ver no salão';
    b.addEventListener('click', ()=>{
      const pill = document.querySelector('[data-visao="v2"]');
      if(pill) pill.click();
      document.querySelector('#planta').scrollIntoView({behavior:'smooth', block:'start'});
      if(pc.p!==PISO_I) trocarPiso(pc.p);
      sel = pc.id; desenhar();
      setTimeout(()=>{ const g = camada.querySelector(`[data-pc="${pc.id}"]`); if(g) g.focus({preventScroll:true}); }, 420);
    });
    li.querySelector('.item__info').appendChild(b);
  });
}
document.head.appendChild(Object.assign(document.createElement('style'), {textContent:`
.item__nolayout{display:inline-block;margin-top:.35rem;font-size:.74rem;letter-spacing:.1em;text-transform:uppercase;
  color:var(--brown-deep);background:none;border:0;border-bottom:1px solid var(--gold);padding:0 0 2px;cursor:pointer;}
.item__nolayout:hover{color:var(--gold);}
`}));

/* ---- 8.5 · passeio virtual no lugar do 360 ----
   O panorama "Seu layout" é gerado por CubeCamera a partir da maquete; com a
   maquete nova do CRM ele volta com as faces vazias (só uma direção tem
   imagem), e o cliente via uma tela cinza. Enquanto isso não se resolve no
   gerador de panorama, a proposta mostra o PASSEIO VIRTUAL — o tour animado
   pela maquete, que roda com o layout do cliente e é o que a casa quer
   apresentar. A aba 360 fica escondida, não removida. */
function passeioNoLugarDo360(){
  const pill360 = document.querySelector('[data-visao="v360"]');
  const visao360 = document.querySelector('.visao[data-v="v360"]');
  if(pill360) pill360.hidden = true;
  if(visao360) visao360.hidden = true;
  if(pill360 && pill360.getAttribute('aria-pressed') === 'true'){
    const p2 = document.querySelector('[data-visao="v2"]');
    if(p2) p2.click();
  }
  const btnTour = document.querySelector('#btnTour');
  if(btnTour){
    btnTour.textContent = '▶ Passeio virtual pelo salão';
    btnTour.classList.remove('btn--ghost');
    btnTour.classList.add('btn--solid');
  }
  const nota = document.querySelector('#tourNota');
  if(nota) nota.textContent = 'O passeio percorre o salão com o seu layout — e o vídeo sai do jeito que você deixou.';
}

/* ---- 9 · liga tudo quando o orçamento chega ---- */
document.addEventListener('proposta-fechada:pronta', ev=>{
  const montado = daProposta(ev.detail);
  PECAS = montado.ativas;
  REMOVIDAS.push(...montado.removidas);
  PROPOSTA.pecas = PECAS.concat(REMOVIDAS);
  const barra = document.querySelector('#btnSalvarLayout');
  if(barra) barra.insertAdjacentElement('beforebegin', btnRepor);
  /* a barra de peças fica COLADA na planta, como no editor do CRM */
  const frame = document.querySelector('.visao[data-v="v2"] .visao__frame--editor');
  const rolagem = frame && frame.querySelector('.planta__scroll');
  if(rolagem) rolagem.before(painelAdicionar());
  const aviso = document.querySelector('#plantaAviso');
  if(aviso) aviso.before(nota);
  aplicarMascara();
  /* Primeira abertura do link: o salão abre com a MONTAGEM OFICIAL do CRM
     (Operacional › Layouts) — ela já vem em MESAS_PADRAO pelo pacote. Só as
     mesas que caem embaixo de uma peça contratada são afastadas.
     Ambiente sem montagem publicada cai na grade calculada aqui. */
  const temMontagem = !!(window.__PACOTE_CRM__ && window.__PACOTE_CRM__.montagem && MESAS_PADRAO.length);
  if(PRIMEIRO_USO && !temMontagem){
    const fileiras = fileirasEmVolta();
    if(fileiras && fileiras.length) PROPOSTA.mesas = fileiras.map(m=>({...m}));
  }
  empurrarMesas();
  PROPOSTA.pecas = PECAS.concat(REMOVIDAS);
  salvar();
  renderMesas(); tudo(); atualizarTotais();
  ligarListaAoLayout();
  passeioNoLugarDo360();
  if(T3 && T3.pronto) tresMesas();
});

window.__PECAS__ = {
  lista: ()=>PECAS,
  resumo: ()=>{
    const c = {};
    PECAS.forEach(pc=>{ c[pc.rot] = (c[pc.rot]||0)+1; });
    return Object.entries(c).map(([r,n])=>`${n>1?n+'× ':''}${r.toLowerCase()}`);
  },
  reposicionar,
  mudancas: mudancasDoCliente,
  adicionar: adicionarPeca,
  remover: removerPeca,
  olhar: olharPeca,
  tres: ()=>T3,          /* alça das provas headless: cena, grupos e visibilidade */
};
})();
