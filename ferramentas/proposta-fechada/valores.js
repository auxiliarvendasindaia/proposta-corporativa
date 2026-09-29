/* =================================================================
   PROPOSTA FECHADA — os valores são os do CRM e NÃO se mexem.
   Diferença para a página de sempre (index.html): aqui o cliente não
   troca cardápio, não mexe no número de convidados e não ajusta
   quantidade de extra nenhum. A página mostra EXATAMENTE o orçamento
   que o consultor montou — itens, serviços e total do CRM — e a única
   coisa viva é o LAYOUT (mesas, palco e as peças do próprio orçamento,
   em pecas.js).
   Entra por injeção no fim do <script> do index (ver gerar-proposta-fechada.mjs):
   enxerga PROPOSTA, AMB, MENUS, fmt, esc… do escopo do script original.
   ================================================================= */
(()=>{
const norm = s => String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
const cent = v => Math.round(Number(v||0)*100);
const el = (tag, cls, html)=>{ const n = document.createElement(tag); if(cls) n.className = cls; if(html!=null) n.innerHTML = html; return n; };
/* troca um botão pelo seu clone: leva junto os listeners do modo demo */
const semOuvintes = sel=>{ const b = document.querySelector(sel); if(!b) return null; const c = b.cloneNode(true); b.replaceWith(c); return c; };

/* ---- 1 · o que a página fechada esconde (a trava é de CSS + DOM) ---- */
document.documentElement.classList.add('fechada');
document.head.appendChild(el('style', null, `
.fechada .stepper,
.fechada #btnReset,
.fechada .niveis-wrap,
.fechada .extras__micro{display:none!important;}
.fechada .item .qtd{display:none;}
.conv__val{font-family:var(--serif);font-size:2.1rem;line-height:1;color:var(--brown-deep);margin:.1rem 0 .35rem;}
.contratado{display:flex;flex-wrap:wrap;align-items:baseline;gap:.6rem 1.1rem;padding:1.05rem 1.25rem;
  border:1px solid rgba(236,224,203,.22);border-radius:14px;background:rgba(255,246,230,.045);}
.contratado__nome{font-family:var(--serif);font-size:1.35rem;color:var(--cream);margin:0;flex:1 1 16rem;}
.contratado__preco{font-size:.95rem;color:rgba(236,224,203,.72);margin:0;white-space:nowrap;}
.contratado__selo{font-size:.72rem;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);
  border:1px solid rgba(201,169,106,.45);border-radius:999px;padding:.24rem .7rem;}
.contratado__res{flex:1 1 100%;font-size:.88rem;line-height:1.7;color:rgba(236,224,203,.62);margin:.1rem 0 0;}
.contratado__filho{flex:1 1 100%;font-size:.86rem;color:var(--brown);margin:.15rem 0 0;padding-left:.2rem;}
.item__filho{flex:1 1 100%;font-size:.82rem;color:var(--taupe);margin:.3rem 0 0;}
/* linha do que NÃO foi contratado: presente, mas apagada */
.item--fora{opacity:.55;}
.item--fora .item__nome{text-decoration:line-through;text-decoration-color:rgba(122,106,84,.5);}
.trava--fora{font-size:.74rem;letter-spacing:.12em;text-transform:uppercase;color:var(--taupe);}
.travado__aviso{display:flex;gap:.7rem;align-items:flex-start;max-width:720px;margin:1.6rem auto 0;
  padding:.95rem 1.15rem;border:1px solid rgba(201,169,106,.4);border-radius:14px;background:rgba(201,169,106,.07);
  font-size:.86rem;line-height:1.65;color:var(--taupe);}
.travado__aviso b{color:var(--brown-deep);}
.inv__linha--serv{align-items:flex-start;}
.semlink{max-width:620px;margin:22vh auto;padding:0 24px;text-align:center;font-family:var(--sans);color:var(--brown-deep);}
.semlink h1{font-family:var(--serif);font-size:2rem;margin:0 0 .6rem;}
.semlink p{color:var(--taupe);line-height:1.7;}
`));

/* ---- 1.1 · tarja de exemplo ----
   Quando os dados vêm de um CRM local (o crm-de-teste.mjs), a página avisa em
   letra garrafal. Sem isso, o orçamento de mentira passa por proposta real —
   já aconteceu de conferirem data e cardápio do exemplo achando que era o do
   cliente. */
if(/localhost|127\.0\.0\.1/.test(API_CRM||'')){
  document.head.appendChild(el('style', null, `
.tarja-teste{position:sticky;top:0;z-index:99;display:block;width:100%;padding:.55rem 1rem;
  background:#8A2E2E;color:#FFF3E6;font-family:var(--sans);font-size:.78rem;letter-spacing:.14em;
  text-transform:uppercase;text-align:center;}
.tarja-teste b{color:#FFD9A6;}`));
  addEventListener('DOMContentLoaded', ()=>{
    const t = el('div', 'tarja-teste', 'Exemplo · dados de teste — <b>não é a proposta de um cliente</b>');
    document.body.insertBefore(t, document.body.firstChild);
  });
}

/* ---- 2 · sem token não existe proposta: a página não inventa valores ---- */
if(!PROPOSTA_TOKEN || !API_CRM){
  document.body.innerHTML = `<div class="semlink">
    <h1>Esta proposta abre pelo link do seu consultor</h1>
    <p>O endereço que você abriu está sem o código da proposta. Peça o link para quem está
    atendendo você — ele abre a sua proposta com os valores e o salão da sua data.</p></div>`;
  return;
}

/* ---- 3 · o motor de cálculo da demo sai de cena ---- */
const totaisOriginal = atualizarTotais;
let REAL = null;                 /* orçamento do CRM, em centavos, já separado por seção */

/* nada de stepper: o número de convidados é o do orçamento */
['#convMenos','#convMais'].forEach(s=>{ const b = document.querySelector(s); if(b) b.disabled = true; });
mudarConvidados = function(){};
selecionar = function(){};       /* clique em card de cardápio não troca nada */

/* atualizarTotais no modo fechado: repinta o que depende do LAYOUT e
   devolve sempre os números do CRM (o editor de mesas chama isto a cada
   arrasto — ele não pode recalcular preço nenhum). */
atualizarTotais = function(){
  if(!REAL){ try{ return totaisOriginal(); }catch(e){ return null; } }
  pintarInvestimento();
  pintarTierbar();
  pintarPlanta();
  return {total: REAL.total, itens: [], servLista: REAL.servicos.map(s=>[s.nome, s.valor]),
    gastro: REAL.gastro, estrutura: REAL.estrutura, servicos: REAL.servTotal, bruto: REAL.total, desconto: 0,
    coq:{nome:'', curto:''}, menu:{nome:''}, bar:{nome:''}};
};

/* ---- 4 · busca o orçamento e veste a página ---- */
fetch(`${API_CRM}/api/public/proposta/${PROPOSTA_TOKEN}`)
  .then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
  .then(j=>{
    const raiz = j.data || j, o = raiz.orcamento || raiz;
    if(!o || !Array.isArray(o.itens)) throw new Error('orçamento vazio');
    REAL = lerOrcamento(o, raiz);
    window.__ORCAMENTO_FECHADO__ = REAL;
    vestir(REAL);
  })
  .catch(e=>{
    console.warn('[proposta fechada] não carregou:', e);
    document.body.innerHTML = `<div class="semlink">
      <h1>Não conseguimos abrir a sua proposta agora</h1>
      <p>O link pode ter vencido ou a conexão falhou. Fale com o seu consultor — ele reenvia
      o link atualizado em um minuto.</p></div>`;
  });

/* ---- 5 · leitura do orçamento: nada é calculado, só organizado ---- */
function lerOrcamento(o, raiz){
  const conv = parseInt(o.num_convidados,10) || PROPOSTA.convidados;
  const R = {conv, numero: o.numero || '', cliente: (o.cliente_nome||'').trim(),
    layout: (o.layout && o.layout.nome) || '', espaco: (o.espaco && o.espaco.nome) || '',
    validade: String(o.validade||raiz.expires_at||'').slice(0,10),
    gastronomia: [], estrutural: [], naoContratados: [], servicos: [], gastro: 0, estrutura: 0, servTotal: 0,
    total: cent(o.valor_total), itensBrutos: []};

  for(const it of (o.itens||[])){
    const produto = it.produto || {};
    /* item marcado como NÃO contratado no CRM: aparece na lista escrito
       "Não contratado", como na proposta oficial — e NUNCA entra em soma
       nenhuma nem vira peça do layout */
    if(it.contratado === false){
      R.naoContratados.push({nome: ((it.subproduto && it.subproduto.nome) || produto.nome || 'Item').trim()});
      continue;
    }
    /* o nome do SUBPRODUTO manda quando existe — é assim que o CRM exibe
       ("Open bar 1" tem o filho "Open Drinks Classic") */
    const nome = ((it.subproduto && it.subproduto.nome) || produto.nome || it.nome || 'Item').trim();
    const qtd = Number(it.quantidade) || 1;
    const unit = cent(it.valor_unitario != null ? it.valor_unitario : (Number(it.valor_total||0)/(qtd||1)));
    const total = it.valor_total != null ? cent(it.valor_total) : unit*qtd;
    const bloco = String(it.bloco||'');
    const linha = {id: it.id, pai: it.item_pai_id || null, nome, qtd, unit, total, bloco,
      porPessoa: qtd===conv,
      inclusos: produto.itens_inclusos || (it.subproduto && it.subproduto.itens_inclusos) || null};
    R.itensBrutos.push(linha);
    if(bloco==='alimentacao' || bloco==='bebidas' || bloco==='rolhas'){ R.gastronomia.push(linha); R.gastro += total; }
    else { R.estrutural.push(linha); R.estrutura += total; }
  }
  /* filho (item_pai_id) não é linha solta: vira sub-linha do pai, como no CRM */
  const porId = new Map(R.itensBrutos.map(l=>[l.id, l]));
  for(const linha of R.itensBrutos){
    if(!linha.pai) continue;
    const pai = porId.get(linha.pai);
    if(pai){ (pai.filhos = pai.filhos || []).push(linha); linha.aninhada = true; }
  }
  R.gastronomia = R.gastronomia.filter(l=>!l.aninhada);
  R.estrutural = R.estrutural.filter(l=>!l.aninhada);
  for(const s of (o.servicos||[])){
    if(s.ativo === false) continue;
    const nome = (s.servico && s.servico.nome) || s.nome || 'Serviço';
    const valor = cent(s.valor_calculado != null ? s.valor_calculado : s.valor_base);
    R.servicos.push({nome, valor});
    R.servTotal += valor;
  }
  /* o total é SEMPRE o do CRM; se ele não vier, soma o que veio */
  if(!R.total) R.total = R.gastro + R.estrutura + R.servTotal;
  /* Cupom e desconto de template abatem do total no CRM, mas NUNCA aparecem
     aqui (regra congelada). Para os três subtotais continuarem fechando com o
     total, o abatimento é rateado entre eles — o cliente vê números que somam,
     sem nenhum "de X por Y". */
  const bruto = R.gastro + R.estrutura + R.servTotal;
  R.fator = (bruto > 0 && R.total > 0) ? R.total / bruto : 1;
  return R;
}

/* ---- logos de clientes ----
   A logo é a ÚNICA coisa da marca do cliente que entra na página: o resto
   segue a paleta do evento (palha e dourado). Casa pelo nome do cliente do
   orçamento. Cliente sem logo cadastrada continua com o nome em tipografia.
   Para incluir outro: baixe o arquivo em assets/clientes/ e acrescente aqui. */
const LOGOS = [
  {re:/wesales/, src:'assets/clientes/wesales-logo-fundo-claro.png', alt:'WeSales CRM',
   proporcao:1000/315},   /* largura ÷ altura do arquivo, para o telão */
];
const logoDoCliente = nome=>LOGOS.find(l=>l.re.test(norm(nome))) || null;

/* "Mauricio - Marketing Oral Unic - WeSales" → "WeSales" (só onde o espaço
   é curto). Nome sem separador, ou curto o bastante, fica como está. */
function nomeCurto(nome){
  const inteiro = String(nome||'').trim();
  if(inteiro.length <= 24) return inteiro;
  const partes = inteiro.split(/\s+[-–|·/]\s+/).map(s=>s.trim()).filter(s=>s.length>=3);
  if(partes.length>1) return partes[partes.length-1];
  return inteiro;
}

/* ---- 6 · a página vestida ---- */
function vestir(R){
  PROPOSTA.convidados = R.conv;            /* o contador de lugares da planta usa isto */

  /* 6.1 resumo: convidados viram número travado */
  const card = document.querySelector('#convVal') && document.querySelector('#convVal').closest('.rcard');
  if(card){
    card.querySelector('.stepper').insertAdjacentElement('beforebegin',
      el('p', 'conv__val', String(R.conv)));
    const sub = card.querySelector('.rcard__sub');
    if(sub) sub.textContent = 'conforme a proposta montada com o seu consultor';
  }

  /* 6.1b o layout que o consultor escolheu no CRM (ex.: "Com Cerimônia Interna")
     entra no card do local — é o que a operação vai montar */
  if(R.layout){
    const cidade = document.querySelector('#espacoCidade');
    if(cidade && !document.querySelector('#layoutOrc'))
      cidade.insertAdjacentHTML('afterend',
        `<p class="rcard__nota" id="layoutOrc">Montagem da proposta: <b>${esc(R.layout)}</b></p>`);
  }

  /* 6.2 gastronomia: o que foi contratado, sem escolha */
  vestirGastronomia(R);

  /* 6.3 extras e estrutura: linhas do orçamento, quantidade travada */
  vestirEstrutura(R);

  /* 6.4 investimento e barra de resumo */
  pintarInvestimento();
  pintarTierbar();

  /* 6.4b nome curto para os lugares apertados (marca do topo e telão do 3D).
     O CRM guarda o cliente como o consultor digitou — às vezes
     "Fulano - Empresa Tal - Marca". Nos espaços curtos fica a última parte;
     o título da aba e o resto da página seguem com o nome inteiro. */
  const logo = logoDoCliente(R.cliente);
  const curto = nomeCurto(R.cliente);
  if(logo){
    /* topo, rodapé e CTA passam a mostrar a marca do cliente em imagem */
    const porImagem = ()=>document.querySelectorAll('.brand__mono').forEach(el=>{
      if(el.querySelector('img.marca-logo')) return;
      el.innerHTML = `<img class="marca-logo" src="${logo.src}" alt="${esc(logo.alt)}">`;
    });
    porImagem();
    document.querySelectorAll('.brand__mono').forEach(el=>
      new MutationObserver(porImagem).observe(el, {childList:true, characterData:true, subtree:true}));
    const eyebrowCta = document.querySelector('.cta .eyebrow');
    if(eyebrowCta) eyebrowCta.insertAdjacentHTML('beforebegin',
      `<img class="marca-logo" src="${logo.src}" alt="${esc(logo.alt)}">`);
    telaoComLogo(logo);
    /* o eyebrow do hero repete o cliente inteiro ("Mauricio - Marketing… -
       WeSales") e quebra em três linhas: com a logo no topo, o nome curto basta */
    if(curto && curto !== R.cliente) document.querySelectorAll('.eyebrow').forEach(el=>{
      if(el.textContent.includes(R.cliente)) el.textContent = el.textContent.replace(R.cliente, curto);
    });
  }else if(curto && curto !== R.cliente){
    const marcar = ()=>document.querySelectorAll('.brand__mono').forEach(el=>{
      if(el.textContent !== curto) el.textContent = curto;
    });
    marcar();
    /* vestirPropostaCRM() pode terminar depois de nós e reescrever a marca */
    document.querySelectorAll('.brand__mono').forEach(el=>
      new MutationObserver(marcar).observe(el, {childList:true, characterData:true, subtree:true}));
    const telaoOriginal = telaoMaterial;
    telaoMaterial = function(TH){
      const antes = TELAO_TITULO;
      TELAO_TITULO = curto;
      const material = telaoOriginal(TH);
      TELAO_TITULO = antes;
      return material;
    };
  }

  /* 6.5 número do orçamento: o do CRM, não o da demo (hero e rodapé) */
  if(R.numero){
    document.querySelectorAll('.hero__validade, .footer__fine').forEach(el=>{
      el.childNodes.forEach(n=>{
        if(n.nodeType===3 && /ORC-\d{4}-\d+/.test(n.nodeValue))
          n.nodeValue = n.nodeValue.replace(/ORC-\d{4}-\d+/g, R.numero);
      });
    });
  }

  /* 6.6 textos que prometiam ajuste */
  const heroSub = document.querySelector('.hero__sub');
  if(heroSub && !/layout/i.test(heroSub.textContent))
    heroSub.insertAdjacentHTML('beforeend', ' Os valores são os da sua proposta — o que você monta aqui é o <em>layout</em> do salão.');
  const introResumo = document.querySelector('#resumo .sec__intro');
  if(introResumo) introResumo.textContent = 'Data, lugar e tamanho da festa, exatamente como combinado com o seu consultor.';
  const introCard = document.querySelector('#cardapios .sec__intro');
  if(introCard) introCard.textContent = 'O que já está contratado na sua proposta. Toque para ver o cardápio completo de cada um.';
  const introExtras = document.querySelector('#extras .sec__intro');
  if(introExtras) introExtras.textContent = 'Tudo o que acompanha o seu evento, com a quantidade fechada na proposta.';
  const introPlanta = document.querySelector('#planta .sec__intro');
  if(introPlanta) introPlanta.textContent = 'Aqui é onde você manda: arraste as mesas e os itens da sua proposta, veja em 3D e passeie em 360°.';
  const passo1 = document.querySelector('.passos li h3');
  if(passo1){
    passo1.textContent = 'Você monta o salão aqui';
    const p = passo1.nextElementSibling;
    if(p) p.textContent = 'O layout é seu: mesas, palco e os itens contratados, do jeito que a sua equipe vai ocupar o espaço.';
  }
  const ctaFine = document.querySelector('.cta__fine');
  if(ctaFine) ctaFine.textContent = 'O seu layout segue junto para a nossa equipe de operações.';

  /* 6.7 confirmação: o que viaja é o layout, não o preço */
  const btnTier = semOuvintes('#btnConfirmar');
  if(btnTier){ btnTier.textContent = 'Confirmar a proposta'; btnTier.addEventListener('click', modalFechado); }
  const btnCta = semOuvintes('#btnCtaFinal');
  if(btnCta){ btnCta.textContent = 'Confirmar a proposta e o layout'; btnCta.addEventListener('click', modalFechado); }
  const btnSalvar = document.querySelector('#btnSalvarLayout');
  if(btnSalvar) btnSalvar.textContent = 'Salvar o meu layout';

  document.dispatchEvent(new CustomEvent('proposta-fechada:pronta', {detail: R}));
}

/* palavra-chave que diz de que bloco a linha é, quando o nome não bate
   exatamente com um pacote publicado da página */
const PISTA_TIPO = {
  coquetel: /coquetel|aperitivo|welcome|entrada volante|finger|couvert/,
  openbar:  /open bar|openbar|bar de bebidas|drinks|caipirinha|chopp/,
  menu:     /menu|jantar|almo(c|ç)o|buffet|ceia|prato/,
};
function vestirGastronomia(R){
  const catalogo = [...COQUETEIS.map(c=>({...c, tipo:'coquetel'})), ...MENUS.map(m=>({...m, tipo:'menu'})), ...OPENBARS.map(b=>({...b, tipo:'openbar'}))];
  const BLOCOS = {coquetel:'#bloco-coquetel', menu:'#bloco-menu', openbar:'#bloco-openbar'};
  const porTipo = {coquetel:[], menu:[], openbar:[]};
  const sobra = [];
  /* 1º o nome exato de um pacote publicado; 2º a palavra-chave do tipo */
  for(const linha of R.gastronomia){
    const hit = catalogo.find(c=>norm(c.nome)===norm(linha.nome));
    let tipo = hit ? hit.tipo : Object.keys(PISTA_TIPO).find(t=>PISTA_TIPO[t].test(norm(linha.nome)));
    if(tipo && !porTipo[tipo].length) porTipo[tipo].push({linha, hit: hit || null});
    else sobra.push(linha);                    /* 2ª linha do mesmo tipo, rolha, água… */
  }
  for(const tipo of Object.keys(BLOCOS)){
    const bloco = document.querySelector(BLOCOS[tipo]);
    if(!bloco) continue;
    const lista = porTipo[tipo];
    if(!lista.length){ bloco.hidden = true; continue; }   /* não contratou: o bloco some */
    const {linha, hit} = lista[0];
    if(hit){ PROPOSTA[tipo] = hit.id; pintarVitrine(tipo); }
    bloco.querySelector('.niveis-wrap')
      .insertAdjacentElement('afterend', cardContratado(linha, hit, tipo));
    const botao = bloco.querySelector('.vitrine');
    if(botao && !hit) botao.remove();                     /* sem cardápio publicado para mostrar */
  }
  /* o que sobrou continua sendo comida e bebida: fica na mesma seção,
     numa lista curta — nunca vai parar em "extras e estrutura" */
  if(sobra.length){
    const wrap = document.querySelector('#cardapios .wrap');
    const bloco = el('div', 'gbloco', `
      <div class="gbloco__head">
        <h3 class="gbloco__title">Também <em>incluso</em></h3>
        <p class="gbloco__hint">Contratado na sua proposta</p>
      </div>`);
    sobra.forEach(linha=>bloco.appendChild(cardContratado(linha, null, null)));
    wrap.appendChild(bloco);
  }
}

function cardContratado(linha, hit, tipo){
  const porPessoa = linha.porPessoa || /pessoa/i.test(linha.nome);
  const resumo = hit ? (tipo==='menu' ? resumoMenu(hit) : tipo==='coquetel' ? resumoCoquetel(hit) : resumoOpenbar(hit)) : '';
  /* o que vem dentro do pacote (subproduto) entra indentado, como no CRM */
  const filhos = (linha.filhos||[]).map(f=>`<p class="contratado__filho">↳ ${esc(f.nome)} ·
    ${fmt(f.unit)} ${f.porPessoa ? 'por pessoa' : 'a unidade'} · ${f.qtd}× · <b>${fmt(f.total)}</b></p>`).join('');
  return el('div', 'contratado', `
    <p class="contratado__nome">${esc(linha.nome)}</p>
    <span class="contratado__selo">Contratado</span>
    <p class="contratado__preco">${fmt(linha.unit)} ${porPessoa ? 'por pessoa' : 'a unidade'} · ${linha.qtd}× · <b>${fmt(linha.total)}</b></p>
    ${filhos}
    ${resumo ? `<p class="contratado__res">${resumo}</p>` : ''}`);
}

function vestirEstrutura(R){
  const ul = document.querySelector('#listaItens');
  if(!ul) return;
  const linhas = R.estrutural.concat(R.estruturaExtra || []);
  ul.innerHTML = '';
  if(!linhas.length){ const s = document.querySelector('#extras'); if(s) s.hidden = true; return; }
  for(const linha of linhas){
    const li = el('li', 'item');
    li.dataset.orc = norm(linha.nome);
    /* linha zerada é cortesia da casa: "incluso", nunca R$ 0,00 */
    const cortesia = linha.total === 0;
    li.innerHTML = `<div class="item__info"><p class="item__nome">${esc(linha.nome)}</p>
        <p class="item__preco">${cortesia ? 'incluso na proposta'
          : fmt(linha.unit) + (linha.porPessoa ? ' por pessoa' : ' a unidade')}</p></div>
      <span class="trava"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
        <b class="trava__qtd">${linha.qtd}</b>&nbsp;· ${linha.porPessoa ? 'acompanha o nº de convidados' : 'quantidade da proposta'}</span>
      <p class="item__total">${cortesia ? '—' : fmt(linha.total)}</p>
      ${(linha.filhos||[]).map(f=>`<p class="item__filho">↳ ${esc(f.nome)} · ${f.qtd}× ${fmt(f.unit)}
        <b>${fmt(f.total)}</b></p>`).join('')}`;
    ul.appendChild(li);
  }
  /* o que ficou de fora da proposta — igual à proposta oficial do CRM, para o
     cliente saber que existe e poder pedir ao consultor */
  for(const linha of (R.naoContratados||[])){
    const li = el('li', 'item item--fora');
    li.innerHTML = `<div class="item__info"><p class="item__nome">${esc(linha.nome)}</p>
        <p class="item__preco">não faz parte desta proposta</p></div>
      <span class="trava trava--fora">Não contratado</span>
      <p class="item__total">—</p>`;
    ul.appendChild(li);
  }
}

function pintarInvestimento(){
  const R = REAL; if(!R) return;
  const q = s=>document.querySelector(s);
  const f = R.fator || 1;                    /* rateio do cupom/template, se houver */
  const gastro = Math.round(R.gastro*f), estrutura = Math.round(R.estrutura*f);
  /* o terceiro subtotal fecha a conta: evita centavo perdido no arredondamento */
  const servicos = R.total - gastro - estrutura;
  if(q('#subGastro')) q('#subGastro').textContent = fmt(gastro);
  if(q('#invPP')) q('#invPP').textContent = R.conv ? `· ${fmt(Math.round(gastro/R.conv))} por pessoa` : '';
  if(q('#subEstrutura')) q('#subEstrutura').textContent = fmt(estrutura);
  if(q('#subServicos')) q('#subServicos').textContent = fmt(servicos);
  if(q('#totalGeral')) q('#totalGeral').textContent = fmt(R.total);
  if(q('#invConvidados')) q('#invConvidados').textContent = R.conv;
  /* serviço zerado entra como "incluso"; reajuste zerado é ruído do CRM e some */
  if(q('#listaServicos')) q('#listaServicos').innerHTML = R.servicos
    .filter(s=>s.valor>0 || !/reajuste/i.test(s.nome))
    .map(s=>`<li><span>${esc(s.nome)}</span><b>${s.valor>0 ? fmt(Math.round(s.valor*f)) : 'incluso'}</b></li>`).join('');
  const nota = q('.inv__nota');
  if(nota && !q('#invTrava')){
    nota.insertAdjacentElement('afterend', el('p', 'travado__aviso', `
      <svg class="ic" viewBox="0 0 24 24" aria-hidden="true" style="flex:0 0 auto;"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
      <span id="invTrava"><b>Estes são os valores da sua proposta</b>, do jeito que o seu consultor montou.
      Quer mudar cardápio, número de convidados ou incluir algo novo? É só falar com ele — a proposta é
      refeita e o link se atualiza. O que você ajusta por aqui é o layout do salão.</span>`));
  }
}

function pintarTierbar(){
  const R = REAL; if(!R) return;
  const mesas = PROPOSTA.mesas.length;
  const resumo = document.querySelector('#tbResumo'), total = document.querySelector('#tbTotal');
  if(resumo) resumo.textContent = `${R.conv} convidados · ${mesas} ${mesas===1?'mesa':'mesas'} no seu layout`;
  if(total) total.textContent = fmt0(R.total);
}

/* ---- 6.8 · o telão de LED da maquete mostra a LOGO ----
   Troca a arte do painel: fundo palha aceso (é um LED claro, combina com a
   festa) e a logo do cliente ao centro. A imagem pode chegar depois do
   primeiro desenho — o canvas se repinta quando ela carrega. */
function telaoComLogo(logo){
  const original = telaoMaterial;
  telaoMaterial = function(TH){
    const cv = document.createElement('canvas');
    cv.width = 1024; cv.height = 564;
    const ctx = cv.getContext('2d');
    const tx = new TH.CanvasTexture(cv);
    tx.colorSpace = TH.SRGBColorSpace;
    const img = new Image();
    const desenhar = ()=>{
      ctx.fillStyle = '#F6F0E3';                       /* palha clara: o painel aceso */
      ctx.fillRect(0, 0, 1024, 564);
      const brilho = ctx.createRadialGradient(512, 250, 40, 512, 282, 620);
      brilho.addColorStop(0, 'rgba(255,255,255,.85)');
      brilho.addColorStop(1, 'rgba(214,188,138,.18)');
      ctx.fillStyle = brilho; ctx.fillRect(0, 0, 1024, 564);
      if(img.complete && img.naturalWidth){
        const larg = 660, alt = larg / (logo.proporcao || (img.naturalWidth/img.naturalHeight));
        ctx.drawImage(img, (1024-larg)/2, 250 - alt/2, larg, alt);
      }
      ctx.textAlign = 'center';
      ctx.fillStyle = '#8A6E39';
      if('letterSpacing' in ctx) ctx.letterSpacing = '10px';
      ctx.font = 'italic 400 46px "Cormorant Garamond", Georgia, serif';
      ctx.fillText(TELAO_SUB, 512+5, 452);
      ctx.strokeStyle = 'rgba(138,110,57,.45)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(412, 388); ctx.lineTo(612, 388); ctx.stroke();
      tx.needsUpdate = true;
    };
    img.onload = desenhar;
    img.src = logo.src;
    desenhar();
    if(document.fonts && document.fonts.ready) document.fonts.ready.then(desenhar).catch(()=>{});
    return new TH.MeshStandardMaterial({map:tx, emissive:0xffffff, emissiveMap:tx,
      emissiveIntensity:.55, roughness:.45, metalness:0, color:0xBFBFBF});
  };
  telaoMaterial.original = original;
}

/* ---- 7 · modal de confirmação: resume o LAYOUT, não os ajustes de preço ---- */
function modalFechado(){
  const R = REAL || {total:0, conv:PROPOSTA.convidados};
  const modal = document.querySelector('#modal'), panel = document.querySelector('#modalPanel');
  const mesas = PROPOSTA.mesas.length;
  const pecas = (window.__PECAS__ && window.__PECAS__.resumo()) || [];
  const mudou = (window.__PECAS__ && window.__PECAS__.mudancas()) || [];
  panel.innerHTML = `
    <button type="button" class="modal__fechar" data-fecha-modal aria-label="Fechar">
      <svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
    <h3 class="modal__titulo" id="modalTitulo">Confirmar a proposta</h3>
    <ul class="modal__lista">
      <li><span>Convidados</span><b>${R.conv}</b></li>
      <li><span>Data do evento</span><b>${DATA_EVENTO_BR}</b></li>
      <li><span>Local</span><b>${esc(AMB.nome)}</b></li>
      <li><span>Seu layout</span><b>${mesas ? `${mesas} mesas · ${mesas*MESA.lugares} lugares` : 'ainda sem mesas'}</b></li>
      ${pecas.length ? `<li><span>Itens no salão</span><b style="white-space:normal;text-align:right;max-width:56%;">${esc(pecas.join(' · '))}</b></li>` : ''}
      ${mudou.length ? `<li><span>Ajustes que você pediu</span><b style="white-space:normal;text-align:right;max-width:56%;color:var(--gold-deep);">${esc(mudou.join(' · '))}</b></li>` : ''}
      <li class="total"><span>Total do investimento</span><b>${fmt(R.total)}</b></li>
    </ul>
    <p class="modal__aviso">Os valores são os da proposta montada pelo seu consultor. Ao confirmar, ele recebe
      o seu layout e segue com a reserva da data.</p>
    <div class="modal__acoes">
      <button type="button" class="btn btn--solid" id="btnEnviarFechado">Confirmar e enviar o layout</button>
      <button type="button" class="btn btn--ghost" data-fecha-modal>Voltar</button>
    </div>`;
  panel.querySelector('#btnEnviarFechado').addEventListener('click', ()=>{
    panel.innerHTML = `
      <button type="button" class="modal__fechar" data-fecha-modal aria-label="Fechar">
        <svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
      <div class="modal__ok" role="status">
        <svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m7.5 12.5 3 3 6-6.5"/></svg>
        <h4 id="modalTitulo">Layout enviado!</h4>
        <p>O seu consultor recebe o layout e retorna para confirmar a disponibilidade da data.</p>
        <small>Teste local: nada foi enviado de verdade.</small>
      </div>`;
    panel.querySelector('.modal__fechar').focus();
  });
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  panel.querySelector('.modal__fechar').focus();
}
})();
