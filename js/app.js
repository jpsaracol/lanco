// Lanço · cardápio, comanda e envio pelo WhatsApp.
// Dados: window.LOJA (js/config.js) e window.CARDAPIO (gerado pelo script Python).
(function () {
  "use strict";
  document.documentElement.classList.add("js");

  const LOJA = window.LOJA;
  const CARDAPIO = window.CARDAPIO || { categorias: [] };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Formatação ---------- */
  const brl = (centavos) =>
    (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const qtdTexto = (item, q) =>
    item.unidade === "kg" ? `${q.toLocaleString("pt-BR")} kg` : `${q}×`;
  const passoDe = (item) => (item.unidade === "kg" ? 0.5 : 1);
  const inicialDe = (item) => 1;

  const itensPorId = {};
  CARDAPIO.categorias.forEach((c) => c.itens.forEach((i) => (itensPorId[i.id] = i)));

  /* ---------- Comanda (só os itens ficam no navegador; dados pessoais não) ---------- */
  const CHAVE = "lanco-comanda-v1";
  let comanda = {};
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) || "{}");
    for (const [id, q] of Object.entries(salvo)) {
      if (itensPorId[id] && itensPorId[id].disponivel && q > 0) comanda[id] = q;
    }
  } catch (e) { comanda = {}; }
  const salvar = () => { try { localStorage.setItem(CHAVE, JSON.stringify(comanda)); } catch (e) {} };

  function mudar(id, delta) {
    const item = itensPorId[id];
    if (!item || !item.disponivel) return;
    const atual = comanda[id] || 0;
    let novo = atual === 0 && delta > 0 ? inicialDe(item) : +(atual + delta * passoDe(item)).toFixed(2);
    if (novo <= 0) delete comanda[id];
    else comanda[id] = Math.min(novo, 99);
    salvar();
    anunciar(novo > 0 ? `${item.nome}: ${qtdTexto(item, comanda[id])} na comanda` : `${item.nome} saiu da comanda`);
    atualizarTudo(atual === 0 && novo > 0);
  }
  function remover(id) { delete comanda[id]; salvar(); anunciar(`${itensPorId[id].nome} saiu da comanda`); atualizarTudo(); }

  const linhas = () => Object.entries(comanda).map(([id, q]) => ({ item: itensPorId[id], q, valor: Math.round(itensPorId[id].preco_centavos * q) }));
  const subtotal = () => linhas().reduce((s, l) => s + l.valor, 0);

  /* ---------- Horário (sempre no fuso de Rio Grande) ---------- */
  const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const min = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  const horaTexto = (hhmm) => { const [h, m] = hhmm.split(":"); return m === "00" ? `${+h}h` : `${+h}h${m}`; };

  function agora() {
    const partes = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date());
    const p = Object.fromEntries(partes.map((x) => [x.type, x.value]));
    const dia = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
    return { dia, minutos: (+p.hour % 24) * 60 + +p.minute };
  }

  function estadoDaCasa() {
    const { dia, minutos } = agora();
    const turnos = LOJA.horarios[dia] || [];
    for (const [abre, fecha] of turnos) {
      if (minutos >= min(abre) && minutos < min(fecha)) return { aberto: true, texto: `Aberto agora, até as ${horaTexto(fecha)}`, curto: `Aberto até ${horaTexto(fecha)}` };
    }
    for (let d = 0; d < 8; d++) {
      const diaSemana = (dia + d) % 7;
      for (const [abre] of LOJA.horarios[diaSemana] || []) {
        if (d === 0 && min(abre) <= minutos) continue;
        const quando = d === 0 ? "hoje" : d === 1 ? "amanhã" : DIAS[diaSemana];
        return { aberto: false, texto: `Fechado agora. Abre ${quando} às ${horaTexto(abre)}`, curto: `Abre ${quando} às ${horaTexto(abre)}`, quando, hora: horaTexto(abre) };
      }
    }
    return { aberto: false, texto: "Fechado", curto: "Fechado" };
  }

  function resumoHorarios() {
    // Agrupa dias com o mesmo horário: "ter a sáb, 10h às 14h e 18h às 22h · dom, 10h às 14h · seg, fechado"
    const chave = (d) => (LOJA.horarios[d] || []).map(([a, f]) => `${horaTexto(a)} às ${horaTexto(f)}`).join(" e ");
    const ordem = [2, 3, 4, 5, 6, 0, 1];
    const grupos = [];
    for (const d of ordem) {
      const k = chave(d);
      const g = grupos[grupos.length - 1];
      if (g && g.k === k) g.fim = d; else grupos.push({ k, ini: d, fim: d });
    }
    return grupos.map((g) => `${DIAS_CURTOS[g.ini]}${g.fim !== g.ini ? " a " + DIAS_CURTOS[g.fim] : ""}, ${g.k || "fechado"}`).join(" · ");
  }

  /* ---------- Cardápio ---------- */
  function montarCardapio() {
    const caixa = $("[data-categorias]");
    caixa.innerHTML = "";
    CARDAPIO.categorias.forEach((cat, n) => {
      const d = document.createElement("details");
      d.className = "categoria";
      if (n === 0) d.open = true;
      const disp = cat.itens.filter((i) => i.disponivel).length;
      d.innerHTML = `<summary><span>${esc(cat.nome)}</span><span class="qtd-cat">${disp} ${disp === 1 ? "item" : "itens"}</span><span class="mais" aria-hidden="true"></span></summary><ul class="itens"></ul>`;
      const ul = $(".itens", d);
      // A lista só entra na página quando a categoria é aberta.
      const preencher = () => {
        if (ul.childElementCount) return;
        cat.itens.forEach(itemLi);
        atualizarItens();
      };
      d.addEventListener("toggle", () => d.open && preencher());
      if (d.open) preencher();
      function itemLi(item) {
        const li = document.createElement("li");
        li.className = "item" + (item.disponivel ? "" : " esgotado");
        li.dataset.id = item.id;
        const sufixo = item.unidade === "kg" ? " <small>/kg</small>" : "";
        li.innerHTML = `
          <span class="item-nome">${esc(item.nome)}</span>
          <span class="item-preco">${brl(item.preco_centavos)}${sufixo}</span>
          ${item.descricao ? `<span class="item-desc">${esc(item.descricao)}</span>` : ""}
          ${!item.disponivel && item.observacao ? `<span class="item-obs">${esc(item.observacao)}</span>` : ""}
          <span class="item-acao"></span>`;
        ul.appendChild(li);
      }
      caixa.appendChild(d);
    });
    caixa.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-acao]");
      if (!b) return;
      const id = b.closest("[data-id]").dataset.id;
      if (b.dataset.acao === "mais") mudar(id, 1);
      if (b.dataset.acao === "menos") mudar(id, -1);
    });

    const total = Object.keys(itensPorId).length;
    const disp = Object.values(itensPorId).filter((i) => i.disponivel).length;
    const quando = CARDAPIO.atualizado_em ? new Date(CARDAPIO.atualizado_em) : null;
    const data = quando && !isNaN(quando) ? quando.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "";
    $("[data-atualizado]").innerHTML =
      `O que a rede trouxe esta semana. <strong>${disp} de ${total} itens</strong> disponíveis${data ? `, cardápio atualizado em ${data}` : ""}.`;
  }

  function botoesDoItem(item) {
    const q = comanda[item.id] || 0;
    if (!item.disponivel) return `<span class="selo">Esgotado</span>`;
    if (!q) return `<button type="button" class="adicionar" data-acao="mais" aria-label="Adicionar ${esc(item.nome)}">Adicionar</button>`;
    return `<span class="passo"><button type="button" data-acao="menos" aria-label="Tirar ${item.unidade === "kg" ? "meio quilo" : "um"} de ${esc(item.nome)}">−</button><output aria-label="Quantidade de ${esc(item.nome)}">${qtdTexto(item, q)}</output><button type="button" data-acao="mais" aria-label="Pôr mais ${item.unidade === "kg" ? "meio quilo" : "um"} de ${esc(item.nome)}">+</button></span>`;
  }

  function atualizarItens() {
    $$(".item[data-id]").forEach((li) => {
      const item = itensPorId[li.dataset.id];
      const caixa = $(".item-acao", li);
      const foco = caixa.contains(document.activeElement) ? document.activeElement.dataset.acao : null;
      caixa.innerHTML = botoesDoItem(item);
      if (foco) (caixa.querySelector(`[data-acao="${foco}"]`) || caixa.querySelector("button"))?.focus();
    });
  }

  /* ---------- Formulário e conta ---------- */
  const form = $("[data-form]");
  const campo = (n) => form.elements[n];

  function preencherSelects() {
    const b = $("[data-bairros]");
    LOJA.bairros.forEach((x) => b.insertAdjacentHTML("beforeend", `<option value="${esc(x.nome)}">${esc(x.nome)} (entrega ${brl(x.taxa)})</option>`));
    const p = $("[data-pagamentos]");
    LOJA.pagamentos.forEach((x) => p.insertAdjacentHTML("beforeend", `<option>${esc(x)}</option>`));
  }

  const modo = () => form.elements.modo.value;
  const taxa = () => {
    if (modo() !== "entrega") return 0;
    const b = LOJA.bairros.find((x) => x.nome === campo("bairro").value);
    return b ? b.taxa : 0;
  };

  function atualizarComanda() {
    const caixa = $("[data-itens]");
    const ls = linhas();
    if (!ls.length) {
      caixa.innerHTML = `<p class="vazia">A comanda está vazia. <a href="#cardapio">Escolha no cardápio</a> e os itens aparecem aqui.</p>`;
    } else {
      const foco = caixa.contains(document.activeElement) ? [document.activeElement.closest("[data-id]")?.dataset.id, document.activeElement.dataset.acao] : null;
      caixa.innerHTML = ls.map(({ item, q, valor }) => `
        <div class="linha linha-item" data-id="${item.id}">
          <span>${qtdTexto(item, q)} ${esc(item.nome)}</span><span class="pontos" aria-hidden="true"></span><span>${brl(valor)}</span>
          <div class="ctrl">${botoesDoItem(item)}<button type="button" class="remover" data-acao="remover">Remover</button></div>
        </div>`).join("");
      if (foco && foco[0]) {
        const alvo = caixa.querySelector(`[data-id="${foco[0]}"] [data-acao="${foco[1]}"]`) || caixa.querySelector(`[data-id="${foco[0]}"] button`);
        alvo ? alvo.focus() : $("#t-comanda").focus?.();
      }
    }

    const sub = subtotal();
    const t = taxa();
    let conta = "";
    if (ls.length) {
      conta += `<div class="linha"><span>Subtotal</span><span class="pontos" aria-hidden="true"></span><span>${brl(sub)}</span></div>`;
      if (modo() === "entrega") {
        conta += campo("bairro").value
          ? `<div class="linha"><span>Entrega, ${esc(campo("bairro").value)}</span><span class="pontos" aria-hidden="true"></span><span>${brl(t)}</span></div>`
          : `<div class="linha"><span>Entrega</span><span class="pontos" aria-hidden="true"></span><span>escolha o bairro</span></div>`;
        if (sub < LOJA.pedidoMinimoEntrega) conta += `<p class="aviso-fechado">Faltam ${brl(LOJA.pedidoMinimoEntrega - sub)} para o pedido mínimo de entrega.</p>`;
      }
    }
    $("[data-conta]").innerHTML = conta;
    $("[data-total]").textContent = brl(sub + t);
    $("[data-previa]").textContent = mensagem();
  }

  function mensagem(codigo) {
    const ls = linhas();
    if (!ls.length) return "Escolha pelo menos um item do cardápio.";
    const f = (n) => (campo(n).value || "").trim();
    const partes = [`Olá, ${LOJA.nome}! Quero fazer um pedido${codigo ? ` (nº ${codigo})` : ""}:`, ""];
    ls.forEach(({ item, q, valor }) => partes.push(`${qtdTexto(item, q)} ${item.nome} · ${brl(valor)}`));
    partes.push("", `Subtotal: ${brl(subtotal())}`);
    if (modo() === "entrega") {
      partes.push(`Entrega (${f("bairro") || "bairro?"}): ${brl(taxa())}`);
    }
    partes.push(`Total: ${brl(subtotal() + taxa())}`, "");
    partes.push(`Nome: ${f("nome") || "?"}`);
    partes.push(modo() === "entrega" ? `Entregar em: ${f("endereco") || "?"}, ${f("bairro") || "?"}` : "Vou retirar na peixaria.");
    let pg = `Pagamento: ${f("pagamento")}`;
    if (f("pagamento") === "Dinheiro" && f("troco")) pg += ` (troco para R$ ${f("troco")})`;
    partes.push(pg);
    if (f("obs")) partes.push(`Obs.: ${f("obs")}`);
    return partes.join("\n");
  }

  function erro(nome, texto) {
    const el = form.querySelector(`[data-erro="${nome}"]`);
    if (el) el.textContent = texto || "";
    if (campo(nome)) campo(nome).setAttribute("aria-invalid", texto ? "true" : "false");
    return !texto;
  }

  function validar() {
    let ok = true;
    const primeiro = [];
    const marca = (n, t) => { if (!erro(n, t)) { ok = false; primeiro.push(n); } };
    marca("nome", campo("nome").value.trim().length < 2 ? "Diga seu nome para a peixaria saber de quem é o pedido." : "");
    if (modo() === "entrega") {
      marca("bairro", !campo("bairro").value ? "Escolha o bairro para calcular a entrega." : "");
      marca("endereco", campo("endereco").value.trim().length < 5 ? "Escreva a rua e o número." : "");
    } else { erro("bairro"); erro("endereco"); }
    if (campo("pagamento").value === "Dinheiro" && campo("troco").value.trim()) {
      const v = parseFloat(campo("troco").value.replace(/\./g, "").replace(",", "."));
      marca("troco", isNaN(v) || v * 100 < subtotal() + taxa() ? "O troco precisa ser maior que o total." : "");
    } else erro("troco");
    if (primeiro.length) campo(primeiro[0]).focus();
    return ok;
  }

  function enviar(e) {
    e.preventDefault();
    if (!linhas().length) { anunciar("A comanda está vazia."); $("#cardapio").scrollIntoView({ behavior: reduzido ? "auto" : "smooth" }); return; }
    if (!validar()) return;
    if (modo() === "entrega" && subtotal() < LOJA.pedidoMinimoEntrega) {
      anunciar(`Pedido mínimo para entrega: ${brl(LOJA.pedidoMinimoEntrega)}.`);
      return;
    }
    const codigo = window.Pedidos ? Pedidos.reservarCodigo() : "";
    const texto = encodeURIComponent(mensagem(codigo));
    const numero = (LOJA.whatsapp || "").replace(/\D/g, "");
    const url = numero ? `https://wa.me/${numero}?text=${texto}` : `https://wa.me/?text=${texto}`;
    window.open(url, "_blank", "noopener");

    // Demonstração: o pedido também vai para o painel do peixeiro, neste navegador.
    if (window.Pedidos) {
      const f = (n) => (campo(n).value || "").trim();
      Pedidos.salvar({
        codigo,
        nome: f("nome"),
        modo: modo(),
        bairro: modo() === "entrega" ? f("bairro") : "",
        endereco: modo() === "entrega" ? f("endereco") : "",
        pagamento: f("pagamento"),
        troco: f("pagamento") === "Dinheiro" ? f("troco") : "",
        obs: f("obs"),
        itens: linhas().map(({ item, q, valor }) => ({ id: item.id, nome: item.nome, unidade: item.unidade, q, valor })),
        subtotal: subtotal(), taxa: taxa(), total: subtotal() + taxa(),
      });
    }
    comanda = {};
    salvar();
    campo("obs").value = "";
    atualizarTudo();
    const ok = $("[data-enviado]");
    ok.hidden = false;
    ok.innerHTML = `<strong>Pedido nº ${esc(codigo)} montado.</strong> Confira a mensagem no WhatsApp e envie. Na demonstração, ele também aparece no <a href="painel.html">painel do peixeiro</a>.`;
    ok.focus();
  }

  /* ---------- Barra fixa e anúncios ---------- */
  const barra = $("[data-barra]");
  let comandaNaTela = false;
  function atualizarBarra(pular) {
    const ls = linhas();
    const qtd = ls.length;
    $("[data-barra-qtd]").textContent = `${qtd} ${qtd === 1 ? "item" : "itens"}`;
    $("[data-barra-total]").textContent = brl(subtotal());
    barra.hidden = !qtd || comandaNaTela;
    if (pular && !barra.hidden && !reduzido) { barra.classList.remove("pulo"); void barra.offsetWidth; barra.classList.add("pulo"); }
  }
  let anuncioTimer;
  function anunciar(t) { const el = $("[data-anuncio]"); clearTimeout(anuncioTimer); el.textContent = ""; anuncioTimer = setTimeout(() => (el.textContent = t), 60); }

  function atualizarTudo(pular) { atualizarItens(); atualizarComanda(); atualizarBarra(pular); }

  /* ---------- Textos da casa ---------- */
  function preencherCasa() {
    const est = estadoDaCasa();
    $$("[data-estado]").forEach((el) => { el.textContent = est.texto; el.classList.toggle("aberto", est.aberto); });
    const grande = $("[data-estado-grande]");
    grande.innerHTML = `${est.curto} <span class="seta" aria-hidden="true">→</span>`;
    grande.setAttribute("aria-label", `${est.texto}. Ir para a comanda`);
    const fechado = $("[data-fechado]");
    if (!est.aberto && est.quando) { fechado.hidden = false; fechado.textContent = `Estamos fechados agora. Pode mandar mesmo assim: o pedido é separado ${est.quando} a partir das ${est.hora}.`; }

    $$("[data-endereco]").forEach((el) => (el.textContent = LOJA.endereco));
    $$("[data-cidade]").forEach((el) => (el.textContent = LOJA.cidade));
    $("[data-horarios]").textContent = resumoHorarios();
    // Semana no contato, com o dia de hoje marcado.
    const hojeDia = agora().dia;
    const faixa = (d) => (LOJA.horarios[d] || []).map(([a, f]) => `${horaTexto(a)} às ${horaTexto(f)}`).join(" e ");
    const grupos = [];
    [2, 3, 4, 5, 6, 0, 1].forEach((d) => {
      const g = grupos[grupos.length - 1];
      if (g && g.k === faixa(d)) g.dias.push(d); else grupos.push({ k: faixa(d), dias: [d] });
    });
    $("[data-semana]").innerHTML = grupos.map((g) => {
      const nome = DIAS_CURTOS[g.dias[0]] + (g.dias.length > 1 ? " a " + DIAS_CURTOS[g.dias[g.dias.length - 1]] : "");
      const hoje = g.dias.includes(hojeDia);
      return `<div${hoje ? ' class="hoje"' : ""}><dt>${nome.charAt(0).toUpperCase() + nome.slice(1)}${hoje ? " (hoje)" : ""}</dt><dd>${g.k || "fechado"}</dd></div>`;
    }).join("");
    $("[data-encomenda]").textContent = `peixe limpo para o almoço, peça até as ${horaTexto(LOJA.encomendaAte)}`;
    $("[data-encomenda-hora]").textContent = horaTexto(LOJA.encomendaAte);
    $$("[data-minimo-texto]").forEach((el) => (el.textContent = brl(LOJA.pedidoMinimoEntrega)));
    $("[data-minimo]").textContent = `pedido mínimo de ${brl(LOJA.pedidoMinimoEntrega)}`;
    $("[data-taxas]").innerHTML = LOJA.bairros.map((b) => `<li><span>${esc(b.nome)}</span><span class="pontos" aria-hidden="true"></span><span>${brl(b.taxa)}</span></li>`).join("");
    const emp = LOJA.empresa;
    $("[data-legal]").textContent = `${emp.razaoSocial} · ${emp.documento} · Preços de exemplo. © ${new Date().getFullYear()}`;
    const cr = window.CREDITOS || [];
    $("[data-creditos]").innerHTML = cr.map((c) => `<li>“${esc(c.titulo)}”, ${esc(c.autor)}, <a href="${esc(c.pagina)}" rel="noopener" target="_blank">${c.licenca}</a>, via Wikimedia Commons</li>`).join("");
  }

  /* ---------- Fotos que trocam com a seção ---------- */
  const LEGENDAS = {
    "detalhe-de-barco-de-pesca.jpg": "Barco de pesca no cais de Rio Grande",
    "fisher-with-his-net.jpg": "Pescador puxando a rede no litoral sul",
    "cast-fish-net-slow-motion-kanagawa-japan.webm": "Uma tarrafa aberta no ar: isso é um lanço",
    "molhes-da-barra-rio-grande-rs.jpg": "Os Molhes da Barra, onde a lagoa encontra o mar",
  };
  function fotosQueTrocam() {
    $$("[data-palco]").forEach((palco) => {
      const imgs = $$(".foto-quadro img, .foto-quadro video", palco);
      const legenda = $("[data-legenda]", palco);
      const mostrar = (n) => {
        imgs.forEach((img, i) => {
          if (i === n && img.loading === "lazy") img.loading = "eager";
          img.classList.toggle("ativa", i === n);
          if (img.tagName === "VIDEO") {
            if (i === n && !reduzido) img.play().catch(() => {});
            else img.pause();
          }
        });
        const nome = imgs[n].getAttribute("src").split("/").pop();
        legenda.textContent = LEGENDAS[nome] || "";
      };
      let atual = 0;
      mostrar(0);
      if (!("IntersectionObserver" in window)) return;
      // o vídeo só toca enquanto o palco está na tela
      new IntersectionObserver((ents) => ents.forEach((e) => {
        if (e.isIntersecting) mostrar(atual); else $$("video", palco).forEach((v) => v.pause());
      }), { threshold: 0.05 }).observe(palco);
      const secoes = $$("[data-foto]", palco);
      const io = new IntersectionObserver((ents) => {
        ents.forEach((e) => { if (e.isIntersecting) { atual = +e.target.dataset.foto; mostrar(atual); } });
      }, { rootMargin: "-45% 0px -45% 0px" });
      secoes.forEach((s) => io.observe(s));
    });
  }

  /* ---------- Entradas ---------- */
  function entradas() {
    const grupos = [
      [".cartao-corpo", ":scope > *"],
      [".cardapio", ".palavra, .cardapio-info, .categoria"],
      [".comanda", ".comanda-texto > *, .papeleta"],
      [".carta", "h2, .carta-papel > *"],
      [".perguntas", "h2, .fatos li, .acordeao details, .perguntas > .botao"],
      [".contato", ":scope > *"],
      [".rodape-menu", ".rodape-marca, .rodape-links li, .rodape-blocos p"],
    ];
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((ents) => {
      ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("visto"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    grupos.forEach(([sec, filhos]) => {
      $$(sec).forEach((s) => $$(filhos, s).forEach((el, i) => {
        el.classList.add("revela");
        el.style.setProperty("--i", Math.min(i, 8));
        io.observe(el);
      }));
    });
  }

  /* ---------- Início ---------- */
  montarCardapio();
  preencherSelects();
  preencherCasa();
  fotosQueTrocam();
  entradas();
  atualizarTudo();

  $("[data-itens]").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-acao]");
    if (!b) return;
    const id = b.closest("[data-id]").dataset.id;
    if (b.dataset.acao === "mais") mudar(id, 1);
    if (b.dataset.acao === "menos") mudar(id, -1);
    if (b.dataset.acao === "remover") remover(id);
  });
  form.addEventListener("input", (e) => {
    if (e.target.name === "modo") $("[data-entrega]").hidden = modo() !== "entrega";
    if (e.target.name === "pagamento") $("[data-troco]").hidden = campo("pagamento").value !== "Dinheiro";
    if (e.target.getAttribute("aria-invalid") === "true") erro(e.target.name);
    atualizarComanda();
  });
  form.addEventListener("submit", enviar);

  if ("IntersectionObserver" in window) {
    new IntersectionObserver((ents) => { comandaNaTela = ents[0].isIntersecting; atualizarBarra(); }, { threshold: 0.15 })
      .observe($("#comanda"));
  }
  setInterval(preencherCasa, 60000);
})();

// Borda de baixo da papeleta cortada em zigue-zague (como papel de bloco destacado).
(function () {
  const el = document.querySelector(".papeleta");
  if (!el || !("ResizeObserver" in window)) return;
  const dente = 14, alto = 10;
  new ResizeObserver(() => {
    const w = el.offsetWidth, h = el.offsetHeight;
    const pts = ["0 0", `${w}px 0`, `${w}px ${h - alto}px`];
    for (let x = w; x > 0; x -= dente) {
      pts.push(`${Math.max(x - dente / 2, 0)}px ${h}px`, `${Math.max(x - dente, 0)}px ${h - alto}px`);
    }
    el.style.clipPath = `polygon(${pts.join(",")})`;
  }).observe(el);
})();
