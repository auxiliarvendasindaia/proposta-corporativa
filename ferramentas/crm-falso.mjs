// CRM DE MENTIRA — só na sua máquina. Responde
//   GET /api/public/proposta/<token>
// no mesmo formato da rota real do CRM, para testar a página vestida com um
// orçamento sem depender de link de teste.
//
//   node ferramentas/crm-falso.mjs                 → orçamento de 1 dia (ORC-2026-02412)
//   node ferramentas/crm-falso.mjs --multi-dia     → o mesmo, em 2 dias e 2 espaços
//   node ferramentas/crm-falso.mjs --porta 8142
//
// Depois é só abrir:
//   http://localhost:8140/?proposta=<40 caracteres hex>&api=http://localhost:8141
import http from 'node:http';

const arg = (nome, padrao) => { const i = process.argv.indexOf(nome); return i > 0 ? process.argv[i + 1] : padrao; };
const MULTI = process.argv.includes('--multi-dia');
const PORTA = Number(arg('--porta', 8141));

const conv = 300;

const DIA1 = 'dia-1-8f2c', DIA2 = 'dia-2-77ab';
const CONV_DIA = { [DIA1]: conv, [DIA2]: 180 };
/* espelha o payload real da rota pública: o produto diz se a quantidade
   acompanha o número de convidados (`vinculado_convidados`) */
const item = (nome, qtd, unit, bloco, dia_id = null) => ({ id: `${nome}-${dia_id || 1}`, bloco, dia_id,
  quantidade: qtd, valor_unitario: unit, valor_total: +(qtd * unit).toFixed(2),
  produto: { nome, vinculado_convidados: qtd === (dia_id ? CONV_DIA[dia_id] : conv) } });

/* Orçamento transcrito do PDF real ORC-2026-02412 (Bandeira Azul · Mediterrâneo).
   Os valores unitários já são os COM desconto; o cupom aparece só na diferença
   entre a soma das linhas e o valor_total — a página rateia e nunca mostra. */
const itens1 = [
  item('Coquetel Pacote 1', conv, 125.10, 'alimentacao'),
  item('Open bar 1', conv, 68.31, 'bebidas'),
  item('Open bar Vinho Tinto ou Branco', conv, 41.40, 'bebidas'),
  item('Open bar Espumante Perini (Brut ou Moscatel)', conv, 69.30, 'bebidas'),
  item('Open Coffee', 1, 1800.00, 'estrutura'),
  item('Mesa Bistrô c/ 2 Banqueta', 10, 192.50, 'estrutura'),
  item('Pacote audiovisual - LED (DJ não incluso)', 1, 6000.00, 'estrutura'),
  item('Cadeira de Madeira', conv, 0.00, 'estrutura'),
  item('Palco', 2, 2000.00, 'estrutura'),
  item('Rolha Suco (1L)', 14, 10.00, 'estrutura'),
];
/* tipo_calculo com os MESMOS nomes do CRM (servicos_template.tipo_calculo):
   percentual_produtos · valor_fixo · valor_fixo_ambiente · por_convidados ·
   valor_minimo_ambiente_dia · valor_minimo_ambiente · por_grupo_convidados ·
   reajuste_temporal. Equipe = 15% sobre os itens com taxa de serviço
   (alimentação + bebidas): 91.233,00 × 15% = 13.684,95. */
const servicos = [
  { id: 's1', ativo: true, valor_calculado: 13684.95, valor_base: null, servico: { nome: 'Equipe', tipo_calculo: 'percentual_produtos' } },
  { id: 's2', ativo: true, valor_calculado: 10000.00, valor_base: 12000.00, servico: { nome: 'Locação do Espaço', tipo_calculo: 'valor_minimo_ambiente_dia' } },
  { id: 's3', ativo: true, valor_calculado: 1500.00, valor_base: null, servico: { nome: 'Taxa de Segurança', tipo_calculo: 'por_grupo_convidados' } },
  { id: 's4', ativo: true, valor_calculado: 750.00, valor_base: 750.00, servico: { nome: 'Taxa de Ecad', tipo_calculo: 'valor_fixo' } },
  { id: 's5', ativo: true, valor_calculado: 2500.00, valor_base: 2500.00, servico: { nome: 'Gerador de Energia', tipo_calculo: 'valor_minimo_ambiente_dia' } },
  { id: 's6', ativo: true, valor_calculado: 1500.00, valor_base: null, servico: { nome: 'Taxa de Limpeza', tipo_calculo: 'por_grupo_convidados' } },
];
/* o orçamento do PDF não tem serviço `por_convidados`; com --por-convidados
   entra um (R$ 3,00 por pessoa) só para provar essa fórmula */
if (process.argv.includes('--por-convidados')) {
  servicos.push({ id: 's7', ativo: true, valor_calculado: 900.00, valor_base: null,
    servico: { nome: 'Recepcionistas', tipo_calculo: 'por_convidados' } });
}

/* versão de 2 dias: dia 1 no Salão de Eventos, dia 2 no Solar (espaços
   diferentes de propósito, para testar a troca de planta por dia) */

const itensMulti = [
  ...itens1.map(i => ({ ...i, id: i.id + '-d1', dia_id: DIA1 })),
  item('Menu Superior II', 180, 152.91, 'alimentacao', DIA2),
  item('Open bar 1', 180, 68.31, 'bebidas', DIA2),
  item('Coffee Superior', 180, 56.62, 'alimentacao', DIA2),
  item('Cadeira de Madeira', 180, 0.00, 'estrutura', DIA2),
];
const dias = [
  { id: DIA1, numero: 1, data_evento: '2026-11-06', dia_semana: 'sexta', num_convidados: conv,
    espaco: { id: 'e1', nome: 'Mediterrâneo 242' }, layout: { id: 'l1', nome: 'Coquetel' } },
  { id: DIA2, numero: 2, data_evento: '2026-11-07', dia_semana: 'sabado', num_convidados: 180,
    espaco: { id: 'e2', nome: 'Solar' }, layout: { id: 'l2', nome: 'Jantar' } },
];

const itens = MULTI ? itensMulti : itens1;
const soma = itens.reduce((a, i) => a + i.valor_total, 0) + servicos.reduce((a, s) => a + s.valor_calculado, 0);
const TOTAL = MULTI ? +(soma * 0.92).toFixed(2) : 123782.95;   /* 1 dia: total do PDF (com cupom) */

const orcamento = {
  id: '91b0c5c1-c1a2-4982-a21d-60bd51e5c175', numero: MULTI ? 'ORC-2026-02412-D2' : 'ORC-2026-02412',
  tipo_orcamento: MULTI ? 'multi_dia' : 'corporativo',
  cliente_nome: 'SEBRAE',
  /* logo da empresa: no CRM real virá de companies.logo_url (hoje vazio em
     todas as 32 empresas). Aqui aponta para um arquivo local de teste. */
  empresa: { nome: 'SEBRAE', logo_url: 'assets/clientes/sebrae.svg' },
  nome_evento: 'Cerimônia Nacional de Entrega da Bandeira Azul',
  cliente_email: null, cliente_telefone: null,
  data_evento: '2026-11-06', dia_semana: 'sexta', num_convidados: conv,
  validade: '2026-10-01', valor_total: TOTAL,
  cidade: { nome: 'Florianópolis', estado: 'SC' },
  espaco: { nome: MULTI ? 'Mediterrâneo 242' : 'Mediterrâneo 242' },
  layout: { nome: 'Coquetel' }, tipo_evento: { nome: 'Corporativo' },
  vendedor: { name: 'Dani Cardoso' },
  itens, servicos, ...(MULTI ? { dias } : {}),
};

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (/^\/api\/public\/proposta\//.test(req.url)) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ success: true, data: { orcamento, token: req.url.split('/').pop(),
      expires_at: new Date(Date.parse(orcamento.validade) + 864e5).toISOString(), incluir_pagamento: false } }));
  }
  res.writeHead(404); res.end('{}');
}).listen(PORTA, () => {
  const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  console.log(`CRM falso em http://localhost:${PORTA} · ${orcamento.numero}${MULTI ? ' · 2 dias' : ''}`);
  console.log(`  soma das linhas ${brl(soma)} · total ${brl(TOTAL)} (diferença de ${brl(soma - TOTAL)} nunca aparece na página)`);
  console.log(`  abra: http://localhost:8140/?proposta=${'b'.repeat(40)}&api=http://localhost:${PORTA}`);
});
