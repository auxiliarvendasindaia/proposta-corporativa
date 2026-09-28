# O que a proposta precisa do CRM

Lista curta, para conversar com o Adriano. Nada aqui é urgente a ponto de travar a
página — ela já funciona sem esses campos —, mas cada um deles tira uma aproximação
do caminho e deixa a proposta **igual ao CRM**, que é a regra.

Rota envolvida: `GET /api/public/proposta/:token`
(`crm-backend/src/modules/orcamentos/orcamentos.service.ts` → `getPropostaByToken`).

## 1. Parâmetros de cálculo dos serviços (o que falta para bater 100%)

O payload já manda `servico.tipo_calculo` — a página usa a **mesma fórmula do CRM**
para recalcular quando o cliente muda alguma coisa. O que não vem são os
**parâmetros** de cada fórmula, que hoje a página deduz do próprio orçamento:

| tipo_calculo | parâmetro que falta | como a página se vira hoje |
|---|---|---|
| `percentual_produtos` | `percentual`, `campo_produto` | deduz o percentual dividindo o valor pelo total de comida e bebida; escolhe a base que dá um percentual de tabela (múltiplo de 0,5%) |
| `por_grupo_convidados` | `convidados_por_grupo`, `valor_por_grupo`, `max_grupos` | assume grupos de 100 e deduz o valor do grupo |
| `por_convidados` | `valor_por_pessoa`, `minimo_pessoas` | deduz o valor por pessoa; ignora o mínimo |

Pedido: incluir no payload público um `parametros` por serviço (só os de fórmula —
nada de piso de negociação, que é interno).

## 2. Identidade do cliente na proposta

- `nome_evento` — para a capa dizer "Convenção Nacional 2026 · proposta para a Algar"
  em vez de só o nome da empresa. **Não existe campo hoje**; o mais barato é a
  atendente digitar na hora de gerar o link (o token já guarda `consultor_nome` e
  `incluir_pagamento`, então é o mesmo caminho).
- `logo_url` do cliente — já existe em `companies.logo_url`. A página desenha a logo
  na assinatura do alto/rodapé e no telão de LED da maquete; sem ela, continua o nome
  escrito. Basta o orçamento apontar para a company (ou o token carregar a URL).

## 3. Conta regressiva da validade

- `criado_em` (ou `created_at`) do registro em `proposta_tokens`. Hoje a barra usa o
  **primeiro acesso do cliente** como início da contagem, porque só recebe o
  `expires_at`. Com o `criado_em` a barra passa a mostrar a validade inteira.

## 4. Link vencido tem que continuar abrindo

Hoje `getPropostaByToken` responde **400** quando `expires_at` já passou, e a página
mostra "este link não está mais disponível". A decisão de 16/09 é outra: o link
continua abrindo, o cliente continua vendo e mexendo, e o que muda é o convite
("falar com a equipe para renovar"). Pedido: devolver a proposta normalmente com um
`vencido: true` no lugar do erro.

## 5. Confirmar ajustes voltando para o CRM

Hoje "Confirmar ajustes" monta a mensagem e devolve o cliente para a conversa.
Gravar os ajustes no orçamento (ou numa fila de "o cliente pediu") exigiria uma rota
pública de escrita — que é justamente o que não se cria sem conversar antes.

## 6. Prova social (material que já temos)

`google_business_locations` guarda **nota média e total de avaliações por espaço**, e
`google_avaliacoes` guarda os comentários com autor, foto e data. É material real e
verificável para a proposta. Como a página é estática (GitHub Pages), o caminho que
respeita a regra das páginas públicas é gerar um `dados/prova-social.json` por script,
como o site montagem-saloes já faz — sem rota pública nova no CRM.
