// Lanço · painel do peixeiro: as comandas do dia, por etapa.
(function () {
  "use strict";
  const LOJA = window.LOJA;
  const CARDAPIO = window.CARDAPIO || { categorias: [] };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const brl = (c) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const qtd = (u, q) => (u === "kg" ? `${q.toLocaleString("pt-BR")} kg` : `${q}×`);

  const PROXIMO = {
    novo: { etapa: "separando", rotulo: "Começar a separar" },
    separando: { etapa: "pronto", rotulo: "Marcar como pronto" },
    pronto: { etapa: "concluido", rotulo: null },
  };
  const ANTERIOR = { separando: "novo", pronto: "separando", concluido: "pronto" };

  let vistos = null; // códigos já mostrados, para destacar os que chegam depois

  function haQuanto(ms) {
    const min = Math.max(0, Math.round((Date.now() - ms) / 60000));
    if (min < 1) return "agora";
    if (min < 60) return `há ${min} min`;
    const h = Math.floor(min / 60);
    return `há ${h} h${min % 60 ? ` ${min % 60} min` : ""}`;
  }
  const hora = (ms) => new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const doDia = (p) => new Date(p.criadoEm).toDateString() === new Date().toDateString();

  function papeleta(p, novo) {
    const prox = PROXIMO[p.etapa];
    const rotuloFinal = p.modo === "entrega" ? "Saiu para entrega" : "Cliente retirou";
    const botao = prox ? (prox.rotulo || rotuloFinal) : "";
    const pagamento = p.pagamento + (p.troco ? `, troco para R$ ${esc(p.troco)}` : "");
    return `
      <li class="papeleta-p${novo ? " chegou" : ""}" data-codigo="${esc(p.codigo)}">
        <article aria-labelledby="pp-${esc(p.codigo)}">
          <header class="pp-cabeca">
            <h3 id="pp-${esc(p.codigo)}">nº ${esc(p.codigo)} · ${esc(p.nome || "sem nome")}</h3>
            <time datetime="${new Date(p.criadoEm).toISOString()}" title="${hora(p.criadoEm)}">${haQuanto(p.criadoEm)}</time>
          </header>
          <p class="pp-modo"><strong>${p.modo === "entrega" ? `Entrega · ${esc(p.bairro)}` : "Retirada no balcão"}</strong>${p.modo === "entrega" && p.endereco ? `<br>${esc(p.endereco)}` : ""}</p>
          <ul class="pp-itens">
            ${(p.itens || []).map((i) => `<li><span class="pp-q">${qtd(i.unidade, i.q)}</span><span>${esc(i.nome)}</span><span class="pp-v">${brl(i.valor)}</span></li>`).join("")}
          </ul>
          ${p.obs ? `<p class="pp-obs">${esc(p.obs)}</p>` : ""}
          <dl class="pp-conta">
            ${p.taxa ? `<div><dt>Entrega</dt><dd>${brl(p.taxa)}</dd></div>` : ""}
            <div class="pp-total"><dt>Total</dt><dd>${brl(p.total)}</dd></div>
            <div><dt>Pagamento</dt><dd>${esc(pagamento)}</dd></div>
          </dl>
          <div class="pp-acoes">
            ${botao ? `<button type="button" class="botao pp-avancar" data-acao="avancar">${botao}</button>` : ""}
            <div class="pp-menores">
              ${ANTERIOR[p.etapa] ? `<button type="button" class="acao-texto" data-acao="voltar">Voltar etapa</button>` : ""}
              <button type="button" class="acao-texto" data-acao="imprimir">Imprimir</button>
            </div>
          </div>
          ${p.exemplo ? `<p class="pp-exemplo">pedido de exemplo</p>` : ""}
        </article>
      </li>`;
  }

  function desenhar() {
    const todos = Pedidos.listar(CARDAPIO, LOJA.bairros).filter((p) => p.etapa !== "concluido" || doDia(p));
    const hoje = todos.filter(doDia);
    if (!vistos) vistos = new Set(todos.map((p) => p.codigo));
    const chegaram = todos.filter((p) => !vistos.has(p.codigo));
    chegaram.forEach((p) => vistos.add(p.codigo));
    if (chegaram.length) anunciar(chegaram.length === 1 ? `Pedido novo: nº ${chegaram[0].codigo}, ${chegaram[0].nome}` : `${chegaram.length} pedidos novos`);

    // Raias: mais antigo em cima, porque é o primeiro a separar.
    const foco = document.activeElement?.closest("[data-codigo]")?.dataset.codigo;
    ["novo", "separando", "pronto"].forEach((etapa) => {
      const raia = $(`[data-raia="${etapa}"]`);
      const lista = todos.filter((p) => p.etapa === etapa).sort((a, b) => a.criadoEm - b.criadoEm);
      $("[data-lista]", raia).innerHTML = lista.map((p) => papeleta(p, chegaram.includes(p))).join("");
      $("[data-qtd]", raia).textContent = lista.length;
      $(".raia-vazia", raia).hidden = lista.length > 0;
    });
    if (foco) $(`[data-codigo="${foco}"] .pp-avancar, [data-codigo="${foco}"] button`)?.focus();

    // Resumo
    const validos = hoje;
    $('[data-n="hoje"]').textContent = validos.length;
    $('[data-n="separar"]').textContent = validos.filter((p) => p.etapa === "novo" || p.etapa === "separando").length;
    $('[data-n="prontos"]').textContent = validos.filter((p) => p.etapa === "pronto").length;
    $('[data-n="vendido"]').textContent = brl(validos.reduce((s, p) => s + (p.total || 0), 0));

    // Separar no balcão: soma por item dos pedidos ainda não separados.
    const soma = {};
    todos.filter((p) => p.etapa === "novo" || p.etapa === "separando").forEach((p) => (p.itens || []).forEach((i) => {
      soma[i.id] = soma[i.id] || { nome: i.nome, unidade: i.unidade, q: 0, pedidos: 0 };
      soma[i.id].q += i.q; soma[i.id].pedidos += 1;
    }));
    const ordem = Object.values(soma).sort((a, b) => (a.unidade === b.unidade ? b.q - a.q : a.unidade === "kg" ? -1 : 1));
    $("[data-balcao]").innerHTML = ordem.length
      ? ordem.map((s) => `<li><strong>${qtd(s.unidade, +s.q.toFixed(2)).replace("×", "")}</strong><span>${esc(s.nome)}</span><small>${s.pedidos} ${s.pedidos === 1 ? "pedido" : "pedidos"}</small></li>`).join("")
      : `<li class="vazio">Nada para separar agora.</li>`;

    const feitos = hoje.filter((p) => p.etapa === "concluido").sort((a, b) => b.criadoEm - a.criadoEm);
    $("[data-feitos]").innerHTML = feitos.length
      ? feitos.map((p) => `<li data-codigo="${esc(p.codigo)}"><span>nº ${esc(p.codigo)} · ${esc(p.nome)}</span><span class="pp-v">${brl(p.total)}</span><button type="button" class="acao-texto" data-acao="voltar" aria-label="Reabrir pedido ${esc(p.codigo)}">Reabrir</button></li>`).join("")
      : `<li class="vazio">Nenhum ainda hoje.</li>`;

    const abertos = todos.filter((p) => p.etapa === "novo").length;
    document.title = `${abertos ? `(${abertos}) ` : ""}Comandas · Lanço`;
  }

  function acharPedido(codigo) {
    return Pedidos.listar(CARDAPIO, LOJA.bairros).find((p) => p.codigo === codigo);
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-acao]");
    if (!b) return;
    const codigo = b.closest("[data-codigo]")?.dataset.codigo;
    const p = codigo && acharPedido(codigo);
    if (!p) return;
    if (b.dataset.acao === "avancar" && PROXIMO[p.etapa]) {
      Pedidos.mudarEtapa(codigo, PROXIMO[p.etapa].etapa, p.exemplo);
      anunciar(`Pedido ${codigo}: ${b.textContent.trim().toLowerCase()}`);
    }
    if (b.dataset.acao === "voltar" && ANTERIOR[p.etapa]) {
      Pedidos.mudarEtapa(codigo, ANTERIOR[p.etapa], p.exemplo);
      anunciar(`Pedido ${codigo} voltou uma etapa`);
    }
    if (b.dataset.acao === "imprimir") {
      const li = b.closest(".papeleta-p");
      li.classList.add("imprimir");
      document.body.classList.add("imprimindo");
      window.print();
      li.classList.remove("imprimir");
      document.body.classList.remove("imprimindo");
      return;
    }
    desenhar();
  });

  $("[data-apagar]").addEventListener("click", () => {
    Pedidos.apagarMeus();
    vistos = null;
    desenhar();
    anunciar("Pedidos de teste apagados. Os de exemplo voltaram ao começo.");
  });

  // Pedido enviado em outra aba aparece na hora.
  window.addEventListener("storage", (e) => { if (!e.key || e.key.startsWith(Pedidos.CHAVE)) desenhar(); });

  function cabecalho() {
    const d = new Date();
    const txt = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    $("[data-data]").textContent = txt.charAt(0).toUpperCase() + txt.slice(1);
    // estado da casa: mesma regra do site
    const partes = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value]));
    const dia = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(partes.weekday);
    const agora = (+partes.hour % 24) * 60 + +partes.minute;
    const m = (s) => { const [h, mm] = s.split(":").map(Number); return h * 60 + mm; };
    const turno = (LOJA.horarios[dia] || []).find(([a, f]) => agora >= m(a) && agora < m(f));
    const el = $("[data-estado]");
    el.textContent = turno ? `aberto até ${turno[1].replace(":00", "h")}` : "fechado agora";
    el.classList.toggle("aberto", !!turno);
  }

  let anuncioT;
  function anunciar(t) { const el = $("[data-anuncio]"); clearTimeout(anuncioT); el.textContent = ""; anuncioT = setTimeout(() => (el.textContent = t), 60); }

  cabecalho();
  desenhar();
  setInterval(() => { cabecalho(); $$("time[datetime]").forEach((t) => (t.textContent = haQuanto(Date.parse(t.getAttribute("datetime"))))); }, 30000);
})();
