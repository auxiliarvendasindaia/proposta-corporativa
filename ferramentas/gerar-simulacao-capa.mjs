// SIMULAÇÃO LOCAL da capa e da marca do cliente — gera _simulacao-capa.html a
// partir do index.html, sem tocar em nada da página oficial. Serve para
// comparar, lado a lado, as três formas de assinar a proposta:
//
//   ?capa=hoje     como está hoje: o nome do cliente escrito em Cormorant
//   ?capa=logo     a logo do cliente assinando o alto, o rodapé e o telão
//   ?capa=evento   a capa falando do evento ("Convenção Nacional 2026 · …")
//   ?capa=tudo     logo + capa do evento
//
// A logo é um exemplo desenhado aqui (nenhuma marca real é usada).
//   node ferramentas/gerar-simulacao-capa.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let s = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');

const trocar = (de, para) => {
  const antes = s;
  s = s.replace(de, () => para);
  if (s === antes) throw new Error('trecho não encontrado: ' + de);
};
trocar(/<span id="versaoBuild">([^<]*)<\/span>/, '<span id="versaoBuild">CAPA · SIMULAÇÃO LOCAL</span>');

const script = `
/* ===== SIMULAÇÃO LOCAL — capa e marca do cliente (não vai para o ar) ===== */
(()=>{
  const Q = new URLSearchParams(location.search);
  const MODO = Q.get('capa') || 'hoje';
  if(MODO === 'hoje') return;
  const EMPRESA = Q.get('empresa') || 'Algar';
  const EVENTO  = Q.get('evento')  || 'Convenção Nacional 2026';
  const COR     = Q.get('cor')     || '#0E7C86';
  /* logo de exemplo: um losango e o nome, nas cores e no traço da marca */
  const svg = \`<svg xmlns="http://www.w3.org/2000/svg" width="420" height="96" viewBox="0 0 420 96">
    <g fill="\${COR}"><path d="M46 8 84 48 46 88 8 48Z" opacity=".9"/><circle cx="46" cy="48" r="13" fill="#fff"/></g>
    <text x="104" y="64" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="46"
      font-weight="700" letter-spacing="1" fill="\${COR}">\${EMPRESA.toUpperCase()}</text></svg>\`;
  const LOGO = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);

  const vestir = ()=>{
    if(MODO === 'logo' || MODO === 'tudo'){
      CLIENTE_NOME = EMPRESA;
      LOGO_CLIENTE = LOGO; COR_CLIENTE = COR;
      document.querySelectorAll('.brand__mono').forEach(el=>el.textContent = EMPRESA);
      vestirMarcaCliente();
      LOGO_TELAO = null;                       /* o telão redesenha com a logo */
    }
    if(MODO === 'evento' || MODO === 'tudo'){
      EVENTO_NOME = EVENTO;
      const chapeu = EVENTO + ' · proposta para ' + EMPRESA;
      document.querySelectorAll('.eyebrow').forEach(el=>{
        if(/DIMY|Proposta corporativa/i.test(el.textContent)) el.textContent = chapeu;
      });
      document.title = chapeu;
      TELAO_SUB = EVENTO;
    }
  };
  vestir();
  /* a proposta real veste depois da resposta do CRM: veste de novo por cima */
  setTimeout(vestir, 2500);
})();
`;
trocar('</body>', `<script>\n${script}\n</script>\n</body>`);
fs.writeFileSync(path.join(RAIZ, '_simulacao-capa.html'), s);
console.log('ok · _simulacao-capa.html  (abra com ?capa=hoje | logo | evento | tudo)');
