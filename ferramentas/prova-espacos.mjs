// TODOS OS ESPAÇOS, TODAS AS VISÕES — abre cada ambiente e confere o que o
// cliente vê: a planta 2D (imagem, máscara, mesas válidas, contador), a
// maquete 3D (carrega, tem as mesas, atalhos de câmera), o 360° (panorama que
// não está vazio) e o tour. Também mede as fotos da galeria que não carregam.
//
// Precisa de: node ferramentas/servir.mjs 8140
//   node ferramentas/prova-espacos.mjs                    (todos)
//   node ferramentas/prova-espacos.mjs solar,mirante      (alguns)
import { createRequire } from 'module';
const require = createRequire(process.env.PUPPETEER_EM || 'C:/Users/User/Desktop/Comercial/crm-backend/package.json');
const puppeteer = require('puppeteer');
const SITE = process.env.PROPOSTA_URL || 'http://localhost:8140/index.html';
const SAIDA = process.env.PROVA_OUT || '.';
const espera = ms => new Promise(r => setTimeout(r, ms));

let falhas = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHOU ✗ ') + m); if (!c) falhas++; };

const b = await puppeteer.launch({ headless: 'new',
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--window-size=1500,960'] });

/* medir uma tela 3D/360 lendo o CANVAS por readPixels não funciona (o buffer
   já foi apresentado e volta preto — erro que já custou caro aqui). O jeito
   honesto é tirar a foto do elemento com o próprio navegador e medir a foto. */
const lupa = await b.newPage();
await lupa.goto('data:text/html,<title>lupa</title>');
async function medirFoto(elemento) {
  const b64 = await elemento.screenshot({ encoding: 'base64' });
  return lupa.evaluate(async src => {
    const img = new Image();
    await new Promise((ok, erro) => { img.onload = ok; img.onerror = erro; img.src = src; });
    const c = document.createElement('canvas');
    const w = c.width = Math.min(200, img.naturalWidth), h = c.height = Math.min(140, img.naturalHeight);
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, w, h);
    const px = g.getImageData(0, 0, w, h).data;
    const tons = new Set(); let soma = 0, escuros = 0;
    for (let i = 0; i < px.length; i += 4) {
      tons.add(`${px[i] >> 4},${px[i + 1] >> 4},${px[i + 2] >> 4}`);
      const luz = px[i] + px[i + 1] + px[i + 2];
      soma += luz; if (luz < 45) escuros++;
    }
    const n = w * h;
    return { tons: tons.size, brilho: Math.round(soma / n / 3), escuros: Math.round(escuros / n * 100) };
  }, 'data:image/png;base64,' + b64);
}

/* a lista de ambientes sai da própria página */
const p0 = await b.newPage();
await p0.goto(SITE, { waitUntil: 'networkidle2' });
const TODOS = await p0.evaluate(() => Object.keys(AMBIENTES));
await p0.close();
const AMBS = (process.argv[2] || '').split(',').filter(Boolean);
const lista = AMBS.length ? AMBS : TODOS;
console.log(`ambientes na página: ${TODOS.join(', ')}\ntestando: ${lista.join(', ')}\n`);

for (const amb of lista) {
  console.log(`\n=== ${amb} ===`);
  const p = await b.newPage();
  await p.setViewport({ width: 1500, height: 960 });
  const erros = [], faltando = [];
  p.on('pageerror', e => erros.push(String(e).slice(0, 160)));
  p.on('console', m => { if (m.type() === 'error') erros.push('console: ' + m.text().slice(0, 140)); });
  p.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) faltando.push(`${r.status()} ${r.url().split('/').pop()}`); });
  await p.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (e) {} });
  await p.goto(`${SITE}?espaco=${amb}&t=${Date.now()}`, { waitUntil: 'networkidle2', timeout: 90000 });
  await espera(1200);

  /* ---- identidade do espaço ---- */
  const id = await p.evaluate(() => ({
    slug: ESPACO, nome: AMB.nome, cardNome: document.getElementById('espacoNome').textContent.trim(),
    cidade: document.getElementById('espacoCidade').textContent.trim(),
    titulo: document.title, pisos: PISOS.length, fotos: (AMB.galeria || []).length,
  }));
  ok(id.slug === amb && id.cardNome === id.nome, `abre como ${id.nome} (${id.cidade})`);

  /* ---- 2D: planta, máscara, mesas ---- */
  await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; document.getElementById('planta').scrollIntoView(); });
  await p.waitForFunction(() => { const i = document.getElementById('plantaImg'); return i && i.complete; }, { timeout: 60000 }).catch(() => {});
  await espera(600);
  const d2 = await p.evaluate(() => {
    const img = document.getElementById('plantaImg');
    const todas = PROPOSTA.mesas;
    const fora = todas.filter(m => !pisoValido(m.x, m.y, m.p | 0)).length;
    return {
      planta: img.naturalWidth, src: img.getAttribute('src').split('/').pop(),
      mascara: !!MASCARA, mascaraBytes: MASCARA ? MASCARA.length : 0,
      mesas: todas.length, fora, lugares: todas.length * MESA.lugares,
      desenhadas: document.querySelectorAll('#mesasCamada .mesa').length,
      contador: document.querySelector('#plantaContador, .planta__nota')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 80) || '',
    };
  });
  console.log('   2D:', JSON.stringify(d2));
  ok(d2.planta > 0, `planta 2D carregou (${d2.src}, ${d2.planta}px)`);
  ok(d2.mascara && d2.mascaraBytes > 100, `máscara do piso decodificada (${d2.mascaraBytes} células)`);
  ok(d2.mesas > 0 && d2.fora === 0, `${d2.mesas} mesas do layout padrão, todas em piso válido`);
  ok(d2.desenhadas > 0, `mesas desenhadas na planta (${d2.desenhadas} no piso aberto)`);

  /* botões do editor */
  const botoes = await p.evaluate(async () => {
    const r = {};
    const n = () => PROPOSTA.mesas.length;
    const antes = n();
    document.querySelector('#btnAddMesa').click(); r.add = n() - antes;
    document.querySelector('#btnDistribuir').click();
    r.distribuir = n(); r.validas = PROPOSTA.mesas.every(m => pisoValido(m.x, m.y, m.p | 0));
    document.querySelector('#btnLimparMesas').click(); r.limpou = PROPOSTA.mesas.filter(m => (m.p | 0) === PISO_I).length;
    document.querySelector('#btnPadrao').click(); r.padrao = n();
    return r;
  });
  ok(botoes.add === 1 && botoes.distribuir > 0 && botoes.validas && botoes.limpou === 0 && botoes.padrao > 0,
    `adicionar / distribuir (${botoes.distribuir} mesas válidas) / limpar / restaurar (${botoes.padrao})`);

  /* arrasto real: joga a mesa para fora e ela tem que voltar para o piso */
  const arrasto = await p.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    const r = document.querySelector('#plantaSvg').getBoundingClientRect();
    window.scrollTo(0, window.scrollY + r.top - 20); return true;
  });
  const tela = (ix, iy) => p.evaluate((ix, iy) => {
    const svg = document.querySelector('#plantaSvg'); const pt = svg.createSVGPoint();
    pt.x = ix; pt.y = iy; const m = pt.matrixTransform(svg.getScreenCTM()); return { x: m.x, y: m.y };
  }, ix, iy);
  const anc = await p.evaluate(() => ({ ...PROPOSTA.mesas[0] }));
  const de = await tela(anc.x, anc.y), para = await tela(5, 5);
  await p.mouse.move(de.x, de.y); await p.mouse.down();
  await p.mouse.move(para.x, para.y, { steps: 10 }); await p.mouse.up();
  const fim = await p.evaluate(() => { const m = PROPOSTA.mesas[0]; return { ...m, valido: pisoValido(m.x, m.y, m.p | 0) }; });
  ok(arrasto && fim.valido && (fim.x !== anc.x || fim.y !== anc.y),
    `arrasto: (${anc.x},${anc.y}) → (${fim.x},${fim.y}), dentro do piso`);

  /* ---- 3D ---- */
  await p.evaluate(() => { const r = document.querySelector('#visoes').getBoundingClientRect(); window.scrollTo(0, window.scrollY + r.top - 20); });
  await p.evaluate(() => trocarVisao('v3d'));
  let tres = null;
  try {
    await p.waitForFunction(() => typeof T3 !== 'undefined' && T3.pronto && T3.raf > 0, { timeout: 240000 });
    await espera(1800);
    tres = await p.evaluate(() => ({
      mesas3d: T3.cena ? T3.cena.children.filter(o => /mesa/i.test(o.name || '')).length : -1,
      objetos: T3.cena ? T3.cena.children.length : 0,
      raio: +T3.orb.raio.toFixed(1), alvo: [+T3.alvo.x.toFixed(1), +T3.alvo.z.toFixed(1)],
      pills: [...document.querySelectorAll('#tresAmbs [data-amb3d]')].map(x => x.textContent.trim()),
      legenda: document.getElementById('tresLegenda')?.textContent.trim().slice(0, 60) || '',
    }));
  } catch (e) { ok(false, `a maquete 3D não ficou pronta (${String(e).slice(0, 60)})`); }
  if (tres) {
    console.log('   3D:', JSON.stringify(tres));
    ok(tres.objetos > 2, `maquete montada (${tres.objetos} objetos na cena)`);
    ok(tres.raio > 0, `câmera posicionada (raio ${tres.raio}, alvo ${tres.alvo})`);
    /* a maquete não pode estar preta nem vazia */
    const box = await p.$('#tresBox');
    const cores = box ? await medirFoto(box) : null;
    if (box) await box.screenshot({ path: `${SAIDA}/espaco-${amb}-3d.jpg`, type: 'jpeg', quality: 72 });
    /* a maquete não pode ficar com o desfoque da espera depois de pronta */
    const desfocada = await p.evaluate(() => !!document.querySelector('.tres__canvasbox.esperando'));
    ok(!desfocada, 'o desfoque da espera saiu quando a maquete ficou pronta');
    ok(cores && cores.tons > 8 && cores.brilho > 25,
      `a maquete aparece na tela (${cores && cores.tons} tons, brilho ${cores && cores.brilho}, ${cores && cores.escuros}% escuro)`);
    /* atalhos de câmera por ambiente: o último ambiente é o mais distante */
    if (tres.pills.length > 1) {
      const mudou = await p.evaluate(async () => {
        /* a ALTURA conta: no Mezanino os dois pisos ficam um sobre o outro e
           têm o mesmo centro em planta — medir só x/z dizia que a câmera não
           tinha mexido (02/10/2026, com as áreas do pacote do CRM). */
        const a0 = [T3.alvo.x, T3.alvo.y, T3.alvo.z];
        const bs = [...document.querySelectorAll('#tresAmbs [data-amb3d]')];
        bs[bs.length - 1].click();
        await new Promise(r => setTimeout(r, 700));
        return Math.abs(T3.alvo.x - a0[0]) + Math.abs(T3.alvo.y - a0[1]) + Math.abs(T3.alvo.z - a0[2]);
      });
      ok(mudou > 0.5, `atalhos de câmera mexem a vista (${tres.pills.length} ambientes: ${tres.pills.join(' · ')})`);
    }
    /* tour com o layout */
    await p.evaluate(() => document.getElementById('btnTour')?.click());
    await espera(4000);
    const tour = await p.evaluate(() => document.getElementById('tresLegenda')?.textContent.trim() || '');
    ok(/tour|passeio/i.test(tour), `o tour roda com o layout do cliente (${tour.slice(0, 50)})`);
  }

  /* ---- 360° ---- */
  await p.evaluate(() => trocarVisao('v360'));
  let pano = null;
  try {
    await p.waitForFunction(() => document.querySelector('#panoStatus') && document.querySelector('#panoStatus').hidden, { timeout: 180000 });
    await espera(2500);
    const box3 = await p.$('.visao[data-v="v360"]');
    pano = box3 ? await medirFoto(box3) : null;
    if (box3) await box3.screenshot({ path: `${SAIDA}/espaco-${amb}-360.jpg`, type: 'jpeg', quality: 72 });
  } catch (e) { ok(false, `o 360° não ficou pronto (${String(e).slice(0, 60)})`); }
  if (pano) {
    console.log('   360:', JSON.stringify(pano));
    /* 30/09: o 360° abria mirando um ponto a 1–3 m do olho, ou seja, num
       ângulo praticamente sorteado — escada escura no Mezanino, parede lisa no
       Mirante. Agora corre o eixo mais longo da sala, inclinado 15° para baixo,
       e o pior caso medido tem 29% de escuro. O teto cai de 55% para 38%. */
    ok(pano.tons > 8 && pano.escuros < 38, `o 360° mostra o salão (${pano.tons} tons, brilho ${pano.brilho}, ${pano.escuros}% escuro)`);
  }

  /* ---- fotos da galeria ---- */
  await p.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 450) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
    document.getElementById('galeria')?.scrollIntoView();
  });
  await espera(14000);   /* foto original é pesada: o retorno sem redimensionar demora */
  const fotos = await p.evaluate(() => {
    const imgs = [...document.querySelectorAll('#galeria img')];
    return { total: imgs.length, ok: imgs.filter(i => i.naturalWidth > 0).length,
      pendentes: imgs.filter(i => !i.complete).length,
      semTransform: imgs.filter(i => i.dataset.semTransform).length,
      hero: document.getElementById('heroImg') ? document.getElementById('heroImg').naturalWidth : -1 };
  });
  console.log('   fotos:', JSON.stringify(fotos));
  ok(fotos.total > 0 && fotos.ok + fotos.pendentes === fotos.total,
    `galeria: ${fotos.ok} de ${fotos.total} fotos na tela${fotos.semTransform ? ` (${fotos.semTransform} voltaram ao arquivo original)` : ''}`);
  ok(fotos.hero !== -1, `a faixa do topo continua com foto (${fotos.hero}px)`);
  ok(faltando.length === 0, `nenhum arquivo faltando (${faltando.slice(0, 3).join(' | ') || 'ok'})`);
  ok(erros.length === 0, `sem erros de JS (${erros.slice(0, 2).join(' | ') || 'nenhum'})`);
  await p.close();
}
await b.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTODOS OS ESPAÇOS OK');
process.exit(falhas ? 1 : 0);
