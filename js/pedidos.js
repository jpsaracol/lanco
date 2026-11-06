// Lanço · onde os pedidos ficam guardados.
// Na demonstração, no localStorage deste navegador: o pedido enviado pelo site aparece no painel.
// Numa versão real, só este arquivo muda (gravar numa planilha via Apps Script, por exemplo);
// o site e o painel continuam chamando Pedidos.salvar / listar / mudarStatus.
(function () {
  "use strict";
  const CHAVE = "lanco-pedidos-v1";
  const ETAPAS = ["novo", "separando", "pronto", "concluido"];

  const ler = () => {
    try { const v = JSON.parse(localStorage.getItem(CHAVE) || "[]"); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  };
  const gravar = (lista) => { try { localStorage.setItem(CHAVE, JSON.stringify(lista)); return true; } catch (e) { return false; } };

  function novoCodigo(existentes) {
    const usados = new Set(existentes.map((p) => p.codigo));
    let c;
    do { c = String(1000 + Math.floor(Math.random() * 9000)); } while (usados.has(c));
    return c;
  }

  // Pedidos de exemplo: sempre "agora há pouco", para o painel nunca abrir vazio.
  // Gerados a partir da data, então são os mesmos ao recarregar no mesmo dia.
  function exemplos(cardapio, bairros) {
    const hoje = new Date();
    let semente = hoje.getFullYear() * 1000 + hoje.getMonth() * 40 + hoje.getDate();
    const sorte = () => ((semente = (semente * 9301 + 49297) % 233280) / 233280);
    const itens = {};
    (cardapio.categorias || []).forEach((c) => c.itens.forEach((i) => { if (i.disponivel) itens[i.id] = i; }));
    const modelos = [
      { min: 4, nome: "Rosângela", itens: [["tainha-inteira", 2], ["pirao", 1]], modo: "entrega", pg: "Pix", obs: "Tainha aberta para a brasa" },
      { min: 9, nome: "Diego", itens: [["pastel-de-camarao", 4], ["pastel-de-siri", 2], ["refrigerante-lata", 2]], modo: "retirada", pg: "Cartão na entrega" },
      { min: 17, nome: "Marta", itens: [["file-de-pescada", 1.5], ["corvina-em-posta", 1]], modo: "entrega", pg: "Dinheiro", troco: "150", obs: "Pescada em filé fino" },
      { min: 26, nome: "Seu Valdir", itens: [["moqueca-de-peixe", 1], ["arroz-branco", 1], ["suco-de-laranja", 2]], modo: "entrega", pg: "Pix" },
      { min: 41, nome: "Lu", itens: [["isca-de-peixe", 1], ["batata-frita", 1]], modo: "retirada", pg: "Pix" },
      { min: 58, nome: "Carla", itens: [["tainha-inteira", 3], ["siri-desfiado", 1]], modo: "retirada", pg: "Cartão na entrega", obs: "Escamar e tirar a cabeça" },
      { min: 83, nome: "Jorge", itens: [["file-de-pescada-a-milanesa", 2], ["agua-mineral", 2]], modo: "entrega", pg: "Dinheiro", troco: "100" },
    ];
    return modelos.map((m, n) => {
      const ls = m.itens.filter(([id]) => itens[id]).map(([id, q]) => ({ id, nome: itens[id].nome, unidade: itens[id].unidade, q, valor: Math.round(itens[id].preco_centavos * q) }));
      const bairro = m.modo === "entrega" ? bairros[Math.floor(sorte() * bairros.length)] : null;
      const subtotal = ls.reduce((s, l) => s + l.valor, 0);
      const taxa = bairro ? bairro.taxa : 0;
      const etapa = m.min < 12 ? "novo" : m.min < 30 ? "separando" : m.min < 50 ? "pronto" : "concluido";
      return {
        codigo: String(4101 + n * 7 + Math.floor(sorte() * 6)),
        criadoEm: Date.now() - m.min * 60000,
        nome: m.nome,
        modo: m.modo,
        bairro: bairro ? bairro.nome : "",
        endereco: bairro ? ["Rua Senador Corrêa, 210", "Av. Rio Grande, 1450, ap 302", "Rua General Osório, 88", "Rua Zalony, 35"][n % 4] : "",
        pagamento: m.pg,
        troco: m.troco || "",
        obs: m.obs || "",
        itens: ls,
        subtotal, taxa, total: subtotal + taxa,
        etapa,
        exemplo: true,
      };
    });
  }

  window.Pedidos = {
    ETAPAS,
    salvar(pedido) {
      const lista = ler();
      const p = Object.assign({ codigo: novoCodigo(lista), criadoEm: Date.now(), etapa: "novo" }, pedido);
      lista.push(p);
      gravar(lista);
      return p;
    },
    reservarCodigo() { return novoCodigo(ler()); },
    // Pedidos do visitante + exemplos do dia. Os exemplos guardam a etapa que o peixeiro escolher.
    listar(cardapio, bairros) {
      const meus = ler();
      let estados = {};
      try { estados = JSON.parse(localStorage.getItem(CHAVE + "-exemplos") || "{}"); } catch (e) {}
      const ex = exemplos(cardapio, bairros).map((p) => (estados[p.codigo] ? Object.assign(p, { etapa: estados[p.codigo] }) : p));
      return meus.concat(ex).sort((a, b) => b.criadoEm - a.criadoEm);
    },
    mudarEtapa(codigo, etapa, exemplo) {
      if (exemplo) {
        let estados = {};
        try { estados = JSON.parse(localStorage.getItem(CHAVE + "-exemplos") || "{}"); } catch (e) {}
        estados[codigo] = etapa;
        try { localStorage.setItem(CHAVE + "-exemplos", JSON.stringify(estados)); } catch (e) {}
        return;
      }
      const lista = ler();
      const p = lista.find((x) => x.codigo === codigo);
      if (p) { p.etapa = etapa; if (etapa === "concluido") p.concluidoEm = Date.now(); gravar(lista); }
    },
    apagarMeus() { gravar([]); try { localStorage.removeItem(CHAVE + "-exemplos"); } catch (e) {} },
    CHAVE,
  };
})();
