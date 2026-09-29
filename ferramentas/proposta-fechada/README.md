# Proposta fechada (`proposta.html`) — URL própria

A página da proposta **como o CRM montou**: o cliente não mexe em valor nenhum
(nem cardápio, nem convidados, nem quantidade de extra). A única coisa viva é o
**layout do salão** — e os itens do próprio orçamento entram nele.

- **URL:** `proposta.html?proposta=<token>&espaco=<slug>` (o `espaco` é opcional;
  o padrão é `salao_eventos`). O token é o mesmo do link que o CRM gera em
  `sistema.eventosindaia.com.br/proposta/<token>`.
- **API:** o gerador grava `API_CRM_OFICIAL = https://comercial-api.squareweb.app`
  **só no proposta.html** (o index.html continua sem base oficial). Em `localhost`
  ainda dá para apontar outra com `&api=<base>`. O CORS do CRM já libera
  `auxiliarvendasindaia.github.io` e `proposta-corporativa.eventosindaia.com.br`.
- Sem token, a página **pede o link do consultor** — nunca cai na demo DIMY.
- A demo continua intacta no `index.html`, que não foi tocado.

## O que muda em relação ao index.html

| | index.html (demo/ajustável) | proposta.html (fechada) |
|---|---|---|
| Convidados | stepper | número do orçamento |
| Cardápios | o cliente escolhe o pacote | cartão "Contratado", com o cardápio completo quando o nome bate com um pacote publicado |
| Extras | stepper de quantidade | quantidade da proposta, travada |
| Total | recalculado na página | `valor_total` do CRM, sem recálculo |
| Layout | mesas | mesas **+ as peças do orçamento** (palco, telão, pista, lounge, bar, mesa de doces, DJ…), que o cliente tira e põe |

## A base do layout vem do CRM (Operacional › Layouts)

O salão não é mais o registro fixo do index: o gerador busca o **pacote público**
de cada ambiente (`GET /api/public/layouts-3d/ambientes/:slug`) e embute no
`proposta.html` — planta calibrada, máscara com as colunas, maquete GLB, a
**montagem oficial** de mesas e a mobília que a operação posicionou. São os 26
ambientes publicados (lista em `ambientes-crm.json`); ambiente sem pacote cai no
registro da página, que continua valendo como reserva.

- A proposta abre com a montagem do salão — o Salão de Eventos abre com as 24
  mesas / 192 lugares da "Montagem revisada", não com uma grade inventada aqui.
  Só as mesas que caem embaixo de um item contratado são afastadas.
- A **mobília da montagem** (cadeiras de cerimônia, altar, passarela, mesa de
  água…) entra como peça do layout — é o que faz as cerimônias abrirem montadas.
- Os botões "Trazer para o salão" usam o **catálogo de itens do espaço**
  (`pacote.itens`) quando ele existir. Hoje vem vazio para quase todos os salões:
  é preciso vincular os itens ao espaço no CRM (ou rodar o `sync-itens-3d`). Sem
  isso, valem os tipos internos (lounge, bar, mesa, bistrô, totem, palco…).
- Maquete ou montagem mudou no CRM ⇒ **rodar o gerador de novo**: os pacotes são
  congelados na geração, porque o script do index monta o ambiente no arranque
  (`const`) e não dá para esperar um fetch.
- A chave do layout salvo carrega a versão da maquete: calibração nova não
  reaproveita posição antiga.
- Peso: 2,3 MB de HTML com os 26 ambientes — 205 KB com gzip, que é como o Pages
  serve.

## A barra de peças, o passeio e o 360

- **Barra de peças** ao lado da planta, no espírito do editor do CRM: busca,
  abas (Tudo · Mobílias · Decorações · Estruturas) e um cartão por peça com nome,
  medida real e "Adicionar". Com o catálogo do espaço publicado, os cartões passam
  a ser os itens do CRM, com a miniatura do cadastro.
- **Passeio virtual no lugar do 360.** O panorama "Seu layout" é gerado por
  CubeCamera a partir da maquete; com a maquete nova do CRM ele volta com as faces
  vazias (só uma direção tem imagem) e o cliente via uma tela cinza. A aba 360 fica
  escondida e o botão do tour virou "Passeio virtual pelo salão", em destaque.
  Investigar depois no gerador de panorama — a cena está certa (render de dentro
  sai perfeito), o problema é o cubo.
- **Ponto de vista interno:** quando a maquete traz `camera.internas`, é dele que
  sai o olho do passeio. Sem isso, o cálculo da página achava um ponto "livre na
  máscara" que caía colado numa cortina.
- **Céu:** a maquete do CRM não tem forro em algumas vistas; a cena ganhou uma
  cúpula de fim de tarde para não mostrar o vazio do canvas.

## O que a página respeita do orçamento

- **Item com `contratado: false` não existe** para o cliente. A proposta oficial do
  CRM mostra a linha marcada como "Não Contratado" (upsell do consultor); aqui não
  aparece nada que ele não comprou — era o caso de "Assessoria e Cerimonial - Dia"
  e "Decoração - Essencial Permanente" no ORC-2026-01137.
- **O nome do subproduto manda**: o filho de "Open bar 1" chama-se "Open Drinks
  Classic", e não "Open bar 1" outra vez.
- **Item filho (`item_pai_id`) não é linha solta**: entra indentado sob o pai, como
  no CRM — senão o mesmo pacote parece contratado duas vezes.
- **Linha zerada** aparece como "incluso", nunca como R$ 0,00; serviço "Reajuste"
  zerado nem entra na lista.
- **Peça dentro de pacote**: o "Pacote audiovisual - FULL" não vira um telão
  genérico — os `itens_inclusos` dizem "01 Painel de LED 4x2 — fundo de palco" e
  "01 Painel de LED 4x1 — testeira", e é isso que aparece no salão.
- O total é o `valor_total` do CRM e bate com o "TOTAL À VISTA" da proposta oficial.
  Os descontos por linha existem no CRM (o unitário cheio riscado) mas **não
  aparecem aqui** — decisão congelada do dono: a página mostra só o que o cliente
  paga, sem "de X por Y".

## Tirar e pôr itens no layout

O cliente remove uma peça pelo **×** (ou tecla Delete) e traz outras pelos botões
"Trazer para o salão". **O preço não se mexe**: o que ele pediu vai como recado —
na nota abaixo da planta ("sem lounge · mais bar") e no resumo do "Confirmar a
proposta". Peça acrescentada por ele fica com contorno dourado tracejado; item da
proposta que ele tirou volta pelo mesmo botão. Tudo sobrevive ao recarregar (fica
no navegador dele, junto do layout).

## Tema da festa e marca do cliente

A proposta fechada não usa o cinza-grafite do index: veste **palha, dourado e
neutros claros** (`tema.css`, injetado no `<head>` depois do CSS original —
redefine as variáveis e clareia o bloco dos cardápios, que na demo é escuro).

A **única cor de marca na página é a logo do cliente**: topo, rodapé, CTA (num
selo palha, porque a foto por trás é escura) e o telão de LED da maquete 3D,
que passa a mostrar a logo em vez do nome em tipografia.

Para incluir outro cliente: baixe a logo em `assets/clientes/` e acrescente uma
linha em `LOGOS` (no `valores.js`) com a expressão que casa com o nome do
cliente no CRM, o caminho e a proporção do arquivo. Cliente sem logo cadastrada
continua com o nome em tipografia — e, se o nome for longo demais (o CRM guarda
"Mauricio - Marketing Oral Unic Franchising - WeSales"), os espaços curtos usam
o último pedaço ("WeSales").

## Os arquivos

- `valores.js` — busca `GET {api}/api/public/proposta/{token}`, organiza o
  orçamento (gastronomia / estrutura / serviços) e veste a página. Desliga o
  motor de cálculo da demo: `atualizarTotais` passa a repintar só o que depende
  do layout e devolve sempre os números do CRM.
- `pecas.js` — traduz cada item do orçamento em uma peça física (catálogo por
  palavra-chave, com a medida escrita no nome quando houver), posiciona no
  salão, deixa arrastar/girar, vira obstáculo para as mesas e desenha a mesma
  peça na maquete 3D e no 360°. O palco/telão/pista do cenário somem quando a
  proposta traz os seus.
- `tema.css` — a paleta do evento e os ajustes de seção.
- `../gerar-proposta-fechada.mjs` — costura os três no `index.html` e escreve
  `proposta.html`. **Rodar sempre que o index mudar.**
- `../crm-de-teste.mjs` — CRM de mentira na porta 8142, com um orçamento
  corporativo de exemplo, para testar sem link do CRM de verdade.
- `../prova-proposta-fechada.mjs` — a bateria (valores, trava, peças, 3D, 360,
  persistência, link ausente, CRM fora do ar).

## Conferir contra o CRM

```bash
node ferramentas/conferir-proposta.mjs <token>
```

Abre a página e compara com a rota pública: data, convidados, espaço, montagem,
cliente, cada item (nome, quantidade, valor), os não contratados que devem ficar
de fora, cada serviço, o total e as peças que foram para o layout. Roda antes de
mandar qualquer link para cliente.

## Testar local

```bash
python -m http.server 8140          # na raiz do repo (confira se a porta está livre)
node ferramentas/crm-de-teste.mjs   # CRM de mentira na 8142
node ferramentas/gerar-proposta-fechada.mjs
node ferramentas/prova-proposta-fechada.mjs
```

Orçamento de mentira (a página abre com **tarja vermelha de exemplo** e cliente
"EXEMPLO (teste)" — nunca confunda com proposta de cliente):
`http://localhost:8140/proposta.html?proposta=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0&api=http://localhost:8142`

Orçamento de verdade (basta o token do link do CRM — a base oficial já está na página):
`http://localhost:8140/proposta.html?proposta=<token>`

## O que ainda falta

1. **Mais nomes no catálogo de peças.** Já conferido contra o ORC-2026-01137
   (Sofá Bege, Mesa Bistrô, Árvore Francesa, Tapete Decorativo, Vaso para
   Ambiente e Pacote audiovisual viraram peça; sousplat, toalha, crédito,
   assessoria e afins ficam de fora). Produto novo que ocupe chão precisa entrar
   no `CATALOGO` — senão aparece só na lista de extras, sem peça no layout.
2. **Geometria de verdade** (fila da Grazi): hoje as peças são volumes na medida
   certa, não os GLBs da casa. Quando `assets/itens/<slug>/item.glb` existir para
   palco, telão, lounge e bar, trocar o box pelo modelo.
3. **Montagem oficial do CRM**: as mesas nascem de uma grade calculada aqui. O
   módulo Layouts do CRM já publica a montagem padrão de cada salão
   (`/api/public/layouts-3d/ambientes/{slug}`) — é dela que o layout inicial
   deveria sair.
4. **Registrar a escolha do cliente**: "Confirmar a proposta" mostra o resumo,
   mas nada volta para o CRM (a rota pública de confirmação não existe).
