// Tudo o que é da peixaria fica aqui. Para usar o site em outro restaurante,
// troque este arquivo e a planilha (dados/cardapio.csv). O cardápio em si é gerado
// por ferramentas/gerar_cardapio.py.
window.LOJA = {
  nome: "Lanço",
  demonstracao: true,

  // Número com DDI e DDD, só dígitos: "5553999990000".
  // Vazio = demonstração: o WhatsApp abre para a pessoa escolher o contato.
  whatsapp: "",

  cidade: "Rio Grande/RS",
  endereco: "Endereço de demonstração, Centro",
  instagram: "",

  // Domingo = 0 ... sábado = 6. Cada dia tem zero ou mais turnos [abre, fecha].
  horarios: {
    0: [["10:00", "14:00"]],
    1: [],
    2: [["10:00", "14:00"], ["18:00", "22:00"]],
    3: [["10:00", "14:00"], ["18:00", "22:00"]],
    4: [["10:00", "14:00"], ["18:00", "22:00"]],
    5: [["10:00", "14:00"], ["18:00", "22:00"]],
    6: [["10:00", "14:00"], ["18:00", "22:00"]],
  },
  encomendaAte: "11:00",

  // Taxa em centavos.
  bairros: [
    { nome: "Centro", taxa: 600 },
    { nome: "Cidade Nova", taxa: 700 },
    { nome: "Getúlio Vargas", taxa: 800 },
    { nome: "Junção", taxa: 900 },
    { nome: "Parque Marinha", taxa: 1000 },
    { nome: "Cassino", taxa: 1500 },
  ],
  pedidoMinimoEntrega: 4000,
  pagamentos: ["Pix", "Cartão na entrega", "Dinheiro"],

  empresa: {
    razaoSocial: "Lanço Peixaria (empresa fictícia, projeto de demonstração)",
    documento: "CNPJ de demonstração",
    email: "",
  },
};
