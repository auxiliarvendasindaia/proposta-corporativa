/* CRM DE TESTE — só na sua máquina. Responde à mesma rota pública do CRM
   (GET /api/public/proposta/:token) com um orçamento corporativo de exemplo,
   no formato real, para conferir a proposta fechada sem depender de um link
   do CRM de verdade.
   Uso:  node ferramentas/crm-de-teste.mjs [porta]
   Abrir: http://localhost:8140/proposta.html?proposta=<40 hex>&api=http://localhost:8142
*/
import http from 'node:http';

const PORTA = Number(process.argv[2]) || 8142;
const CONV = 180;

const item = (nome, qtd, unit, bloco = 'itens_extras', extra = {}) => ({
  id: nome, bloco, quantidade: qtd, valor_unitario: unit,
  valor_total: +(qtd * unit).toFixed(2),
  produto: { nome, ...extra },
});

const itens = [
  item('Coquetel Volante Superior', CONV, 48.9, 'alimentacao'),
  item('Menu Superior II', CONV, 169.9, 'alimentacao'),
  item('Open Bar Clássico', CONV, 74.5, 'bebidas'),
  item('Cadeira de Madeira', CONV, 10.0),
  item('Palco modular 4x4 m', 1, 2000.0),
  item('Telão de LED 4x3 m', 1, 3800.0),
  item('Pista de dança iluminada', 1, 2400.0),
  item('Lounge externo', 3, 890.0),
  item('Bar de apoio', 2, 650.0),
  item('Mesa de doces', 1, 1200.0),
  item('Cabine de DJ', 1, 1500.0),
];

const servicos = [
  { id: 's1', ativo: true, valor_calculado: 20000, servico: { nome: 'Locação do Espaço', tipo_calculo: 'fixo' } },
  { id: 's2', ativo: true, valor_calculado: 750, servico: { nome: 'Taxa de Ecad', tipo_calculo: 'fixo' } },
  { id: 's3', ativo: true, valor_calculado: 8974.5, servico: { nome: 'Equipe', tipo_calculo: 'percentual' } },
  { id: 's4', ativo: true, valor_calculado: 1200, servico: { nome: 'Segurança', tipo_calculo: 'por_grupo' } },
  { id: 's5', ativo: true, valor_calculado: 900, servico: { nome: 'Limpeza', tipo_calculo: 'por_grupo' } },
];

const total = +[...itens.map(i => i.valor_total), ...servicos.map(s => s.valor_calculado)]
  .reduce((a, b) => a + b, 0).toFixed(2);

const orcamento = {
  id: 'orcamento-de-teste', numero: 'EXEMPLO-0000', tipo_orcamento: 'corporativo',
  cliente_nome: 'EXEMPLO (teste)', cliente_email: null, cliente_telefone: null,
  data_evento: '2026-11-13', dia_semana: 'sexta', num_convidados: CONV,
  validade: '2026-09-25', valor_total: total,
  cidade: { nome: 'Itapema', estado: 'SC' }, espaco: { nome: 'Salão de Eventos' },
  tipo_evento: { nome: 'Corporativo' }, vendedor: { name: 'Dani Cardoso' },
  itens, servicos,
};

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (/^\/api\/public\/proposta\//.test(req.url)) {
    const corpo = {
      success: true,
      data: {
        orcamento,
        token: req.url.split('/').pop(),
        expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
        incluir_pagamento: false,
      },
    };
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(corpo));
  }
  res.writeHead(404); res.end('{}');
}).listen(PORTA, () => {
  console.log(`CRM de teste em http://localhost:${PORTA}`);
  console.log(`orçamento ${orcamento.numero} · ${orcamento.cliente_nome} · ${CONV} convidados · total R$ ${total.toLocaleString('pt-BR')}`);
});
