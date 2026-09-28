# Ferramentas de validação (obrigatórias antes de publicar)

## Servir a página na máquina

- `servir.mjs [porta]` — servidor estático da pasta (padrão 8140), para quem não tem Python.
  Equivale ao `python -m http.server 8140` da receita da casa.

## CRM de mentira (nenhum dado de cliente sai da máquina)

- `crm-falso.mjs [--multi-dia] [--porta 8141]` — responde `GET /api/public/proposta/<token>`
  com o orçamento ORC-2026-02412 transcrito do PDF. Com `--multi-dia`, o mesmo evento em
  2 dias e 2 espaços (dia 1 no Mediterrâneo 242, dia 2 no Solar), com `dia_id` nos itens.
- `crm-de-teste.mjs` — orçamento EXEMPLO-0000 na porta 8142, usado pela proposta fechada.

O parâmetro `&api=` da página só é aceito em `localhost` — em produção ela fala com o CRM oficial.

## Baterias

- `prova-proposta-real.mjs` — modo real: o total é o do CRM, as linhas e os serviços são os do
  orçamento, nada de desconto/cupom na tela, os ajustes do cliente sobrevivem ao recarregar e
  token sem resposta mostra aviso (nunca cai na demo).
- `prova-multi-dia.mjs` — evento de mais de um dia: barra de dias, itens e subtotal do dia
  escolhido, total do evento inteiro, planta do dia que acontece em outro espaço, convidados e
  cardápio travados. Precisa do `crm-falso.mjs --multi-dia`.
- `auditar-contas.mjs` — **auditoria das contas**: lê só o que está na TELA (linhas, serviços,
  subtotais, total) e confere se fecha, com o orçamento do CRM como referência. Cobre mudança
  de convidados (30 a 500), troca e retirada de cardápio, taxas por grupo de 100, percentual da
  equipe, multi-dia e a demo. Precisa dos dois CRMs de mentira no ar.
- `prova-espacos.mjs [slugs]` — **todos os espaços, todas as visões**: identidade, planta 2D,
  máscara, mesas válidas, botões do editor, arrasto real, maquete 3D (sem desfoque preso, com
  brilho medido na foto do elemento), atalhos de câmera, tour, 360° e as fotos da galeria.
- `prova-validade.mjs` — a faixa da validade: conta regressiva, barra fechando, alerta no último
  quarto e o que muda quando vence (o link continua abrindo e o convite vira conversa).
- `prova-social.mjs` — "Quem já fez aqui": garante que os depoimentos na tela são os que estão
  **congelados no arquivo**, que nenhum tem ressalva e que a página não busca avaliação em
  tempo real. Para trocar as avaliações, use
  `crm-backend/src/scripts/_ler-avaliacoes-google.ts` e atualize `PROVA_SOCIAL` no index.
- `prova-visual.mjs` — peso no celular, topo com imagem, algarismos alinhados, linha de item no
  celular e o aviso de quanto o total mudou.
- `gerar-simulacao-capa.mjs` — gera `_simulacao-capa.html` para comparar as formas de assinar a
  proposta (`?capa=hoje | logo | evento | tudo`). Não toca na página oficial.
- `prova-proposta-fechada.mjs` — `proposta.html`: valores travados, itens do orçamento virando
  peças no 2D/3D, ajustes de layout salvos e aviso quando o CRM não responde.
- `testar-mascara.mjs [url]` — bateria de arrasto real do Salão de Eventos (referência histórica).
- `smoke-pisos.mjs [url] [slugs]` — abas, botões, arrasto por aba, link `#L=` e persistência de
  CADA ambiente.
- `check-ambs3d.mjs` — atalhos de câmera por ambiente na maquete (precisa de servidor HTTP local).

## Como rodar

Em três terminais (ou em segundo plano):

```
node ferramentas/servir.mjs 8140
node ferramentas/crm-falso.mjs                 # 1 dia, porta 8141
node ferramentas/crm-falso.mjs --multi-dia --porta 8143
```

Depois, da raiz do repositório:

```
node ferramentas/auditar-contas.mjs
node ferramentas/prova-espacos.mjs
node ferramentas/prova-proposta-real.mjs
CRM_FALSO=http://localhost:8143 node ferramentas/prova-multi-dia.mjs
node ferramentas/prova-visual.mjs
PROPOSTA_URL=http://localhost:8140/index.html node ferramentas/testar-mascara.mjs
PROPOSTA_URL=http://localhost:8140/index.html node ferramentas/smoke-pisos.mjs
```

Variáveis que as baterias aceitam: `PROPOSTA_URL` (página a testar), `CRM_FALSO`/`API_TESTE`
(CRM de mentira), `PUPPETEER_EM` (o `package.json` de onde vem o puppeteer) e `PROVA_OUT`
(onde salvar as capturas — fora do repositório).

Requisitos: Node 18+, Google Chrome. Os scripts pegam o `puppeteer` de outro projeto via
`createRequire(...)` no topo — na tua máquina, rode `npm i puppeteer` nesta pasta e troque
essa linha por `import puppeteer from 'puppeteer'` (e remova o `executablePath` se o
Chromium baixado servir). 3D/360 exigem servidor HTTP na raiz do repo; o 2D roda direto em
`file://`. Critério de aprovação: TODOS os testes verdes e zero erros de JS.
