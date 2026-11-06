"""Testes do gerador de cardápio. Rode com: python3 -m unittest discover ferramentas"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import gerar_cardapio as g  # noqa: E402


def linha(**campos):
    base = {"categoria": "Pratos", "item": "Moqueca", "descricao": "", "preco": "112,00",
            "unidade": "un", "disponivel": "sim", "observacao": ""}
    base.update(campos)
    return base


class TestPreco(unittest.TestCase):
    def test_formatos(self):
        self.assertEqual(g.ler_preco("32,00"), 3200)
        self.assertEqual(g.ler_preco("R$ 1.234,50"), 123450)
        self.assertEqual(g.ler_preco("54.9"), 5490)
        self.assertEqual(g.ler_preco(38), 3800)
        self.assertEqual(g.ler_preco(12.5), 1250)

    def test_invalidos(self):
        for valor in ("", None, "doze", "12,3,4"):
            with self.assertRaises(ValueError):
                g.ler_preco(valor)


class TestDisponivel(unittest.TestCase):
    def test_valores(self):
        self.assertTrue(g.ler_disponivel("Sim"))
        self.assertTrue(g.ler_disponivel(""))
        self.assertFalse(g.ler_disponivel("não"))
        self.assertFalse(g.ler_disponivel("ESGOTADO"))
        with self.assertRaises(ValueError):
            g.ler_disponivel("talvez")


class TestMontar(unittest.TestCase):
    def test_agrupa_por_categoria_na_ordem_da_planilha(self):
        cats = g.montar_cardapio([
            linha(categoria="Peixe fresco", item="Tainha", unidade="kg"),
            linha(categoria="Pratos", item="Moqueca"),
            linha(categoria="Peixe fresco", item="Corvina", unidade="KG"),
        ])
        self.assertEqual([c.nome for c in cats], ["Peixe fresco", "Pratos"])
        self.assertEqual([i.id for i in cats[0].itens], ["tainha", "corvina"])
        self.assertEqual(cats[0].itens[1].unidade, "kg")

    def test_junta_todos_os_erros(self):
        with self.assertRaises(g.ErroPlanilha) as ctx:
            g.montar_cardapio([
                linha(item="A", preco=""),
                linha(item="B", unidade="caixa"),
                linha(item="C"),
                linha(item="C"),
            ])
        self.assertEqual(len(ctx.exception.erros), 3)
        self.assertIn("Linha 2", ctx.exception.erros[0])

    def test_ignora_linha_em_branco(self):
        cats = g.montar_cardapio([linha(), {"categoria": "", "item": ""}])
        self.assertEqual(len(cats[0].itens), 1)

    def test_coluna_faltando(self):
        with self.assertRaises(g.ErroPlanilha):
            g.montar_cardapio([{"item": "X", "preco": "1"}])


class TestArquivos(unittest.TestCase):
    def test_csv_com_virgula_e_gravacao(self):
        with tempfile.TemporaryDirectory() as pasta:
            raiz = Path(pasta)
            csv = raiz / "c.csv"
            csv.write_text("Categoria,Item,Preço,Disponível\nPastéis,Pastel de siri,13,sim\n", encoding="utf-8")
            cats = g.montar_cardapio(g.ler_linhas(csv))
            g.gravar(cats, raiz)
            js = (raiz / "js" / "cardapio-dados.js").read_text(encoding="utf-8")
            self.assertIn("window.CARDAPIO", js)
            self.assertIn("Pastel de siri", js)

    def test_planilha_do_projeto_e_valida(self):
        cats = g.montar_cardapio(g.ler_linhas(g.RAIZ / "dados" / "cardapio.csv"))
        self.assertGreater(len(cats), 3)


if __name__ == "__main__":
    unittest.main()
