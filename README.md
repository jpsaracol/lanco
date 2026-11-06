# Lanço · cardápio digital com pedido pelo WhatsApp

Projeto de portfólio: cardápio de uma peixaria fictícia de Rio Grande/RS. O cliente monta o pedido no celular, confere a comanda com a conta feita e envia a mensagem pronta pelo WhatsApp. Sem aplicativo de delivery, sem comissão por pedido, sem servidor.

## O que tem aqui

| Parte | Arquivo | O que faz |
| --- | --- | --- |
| Site | `index.html`, `css/style.css`, `js/app.js` | Cardápio por categoria, quantidade por quilo (meio em meio) ou unidade, itens esgotados, comanda com taxa por bairro, pedido mínimo, troco, validação e mensagem pronta. |
| Dados da loja | `js/config.js` | WhatsApp, horários, bairros e taxas, formas de pagamento. Trocar este arquivo adapta o site a outro restaurante. |
| Planilha | `dados/cardapio.csv` ou `dados/cardapio.xlsx` | O dono edita preços e marca o que acabou. |
| Automação (Python) | `ferramentas/gerar_cardapio.py` | Lê a planilha, confere cada linha e gera `js/cardapio-dados.js` e `dados/cardapio.json`. Se houver erro, aponta a linha e não grava nada. |
| Testes | `ferramentas/test_gerar_cardapio.py` | `python3 -m unittest discover ferramentas` |
| Publicação automática | `.github/workflows/cardapio.yml` | No GitHub, ao subir uma planilha nova, os testes rodam e o cardápio é regerado sozinho. |
| Painel do peixeiro | `painel.html`, `js/painel.js`, `css/painel.css` | Comandas do dia em três etapas (novos, separando, prontos), soma do que separar no balcão, entregues do dia e impressão de uma comanda. |
| Pedidos | `js/pedidos.js` | Onde os pedidos ficam. Na demonstração, no navegador; para produção só este arquivo muda (ex.: gravar numa planilha via Apps Script). |
| Privacidade | `privacidade.html` | LGPD, termos do pedido, trocas, acessibilidade e créditos das imagens. |

## Atualizar o cardápio

```bash
python3 ferramentas/gerar_cardapio.py                    # usa dados/cardapio.csv
python3 ferramentas/gerar_cardapio.py dados/cardapio.xlsx
python3 ferramentas/gerar_cardapio.py --verificar        # só confere
```

Saída de exemplo:

```
23 itens em 6 categorias.
  Peixe fresco        5 itens · de R$ 32,00 a R$ 89,00
  ...
Esgotados: Camarão-rosa da lagoa
```

## Rodar o site

Abra `index.html` direto no navegador, ou sirva a pasta (`python3 -m http.server`). Para usar com um número real, preencha `whatsapp` em `js/config.js` (só dígitos, com 55 e DDD). Vazio, o WhatsApp abre para a pessoa escolher o contato.

## Privacidade

Não há cookies, rastreadores nem backend. Os itens da comanda ficam no `localStorage` do navegador. Na demonstração, o pedido enviado também fica salvo no navegador de quem enviou, para aparecer no painel. Num uso real, o painel precisa de senha e de um lugar seguro para os pedidos (planilha com Apps Script, por exemplo).

## Imagens

Fotos, pintura e vídeo de licença livre (Wikimedia Commons), com crédito no rodapé e em `privacidade.html`. Lista completa em `assets/credits.json`. São imagens da cidade e da pesca, não da peixaria.

Peixaria, pessoas, endereço e preços são fictícios.
