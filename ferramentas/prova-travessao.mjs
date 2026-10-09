// TRAVESSÃO NO TEXTO DO CLIENTE (09/10/2026).
//
// Decisão do dono (05/10): travessão em texto de tela não entra — "não pode
// parecer que é IA". A primeira versão desta checagem media o travessão no
// texto VISÍVEL da página num instante, e por isso passava: a legenda da
// maquete ("Maquete do seu layout — 8 mesas") só existe depois de abrir o 3D,
// o aviso de multi-dia só num orçamento de dois dias, e assim por diante.
// Ficaram quarenta travessões no ar por três dias com a bateria verde.
//
// Agora a varredura é no FONTE, que não depende de a frase estar na tela:
// procura travessão dentro de texto de interface (HTML visível e literais de
// string do script), ignorando comentário, que ninguém lê.
//
//   node ferramentas/prova-travessao.mjs
import fs from 'node:fs';
const ARQ = process.argv[2] || 'index.html';
const TRAV = /[—–]/;
const L = fs.readFileSync(ARQ, 'utf8').split('\n');

let emComentarioHtml = false, emComentarioBloco = false;
const achados = [];
L.forEach((linha, i) => {
  const t = linha.trim();
  /* comentário de HTML, de bloco e de linha: fora da conta */
  if (emComentarioHtml) { if (t.includes('-->')) emComentarioHtml = false; return; }
  if (t.startsWith('<!--')) { if (!t.includes('-->')) emComentarioHtml = true; return; }
  if (emComentarioBloco) { if (t.includes('*/')) emComentarioBloco = false; return; }
  if (t.startsWith('/*')) { if (!t.includes('*/')) emComentarioBloco = true; return; }
  if (t.startsWith('*') || t.startsWith('//')) return;
  if (!TRAV.test(linha)) return;
  /* o que resta: travessão de PROSA (com espaço dos dois lados) é o proibido.
     Um "—" sozinho num campo vazio é marcador de valor, não frase, e fica. */
  const semComentarioSolto = linha.replace(/\/\*[\s\S]*?\*\//g, '');
  if (/\S\s[—–]\s\S/.test(semComentarioSolto)) achados.push({ n: i + 1, t: t.slice(0, 120) });
});

if (achados.length) {
  for (const a of achados) console.log('FALHOU ✗ ' + String(a.n).padStart(5) + '  ' + a.t);
  console.log(`\n${achados.length} travessão(ões) em texto de tela`);
  process.exit(1);
}
console.log('OK   nenhum travessão em texto de tela');
console.log('\nTUDO VERDE');
