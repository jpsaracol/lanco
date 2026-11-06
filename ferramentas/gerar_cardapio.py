#!/usr/bin/env python3
"""Gera o cardápio do site a partir da planilha do dono da peixaria.

Uso:
    python3 ferramentas/gerar_cardapio.py                 # lê dados/cardapio.csv
    python3 ferramentas/gerar_cardapio.py dados/cardapio.xlsx
    python3 ferramentas/gerar_cardapio.py --verificar      # só confere, não grava

A planilha tem uma linha por item e estas colunas:
    categoria | item | descricao | preco | unidade | disponivel | observacao

- preco aceita "32,00", "32.00", "R$ 32" ou número do Excel.
- unidade é "kg" (vende em meio quilo) ou "un".
- disponivel aceita sim/não, s/n, 1/0, x ou vazio (vazio = sim).

Saídas:
    dados/cardapio.json      cardápio limpo, para outros sistemas
    js/cardapio-dados.js     o mesmo cardápio, lido pelo site (funciona até abrindo o arquivo direto)

Se alguma linha tiver erro (preço vazio, unidade desconhecida, item repetido),
o script mostra a linha e não grava nada, para o site nunca ficar com cardápio quebrado.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import unicodedata
from dataclasses import dataclass, asdict, field
from datetime import datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
COLUNAS = ["categoria", "item", "descricao", "preco", "unidade", "disponivel", "observacao"]
OBRIGATORIAS = {"categoria", "item", "preco"}
UNIDADES = {"kg", "un"}
SIM = {"sim", "s", "1", "x", "true", "verdadeiro", ""}
NAO = {"nao", "n", "0", "false", "falso", "esgotado"}


class ErroPlanilha(Exception):
    """Uma ou mais linhas da planilha estão erradas."""

    def __init__(self, erros: list[str]):
        super().__init__("\n".join(erros))
        self.erros = erros


@dataclass
class Item:
    id: str
    nome: str
    descricao: str
    preco_centavos: int
    unidade: str
    disponivel: bool
    observacao: str = ""


@dataclass
class Categoria:
    id: str
    nome: str
    itens: list[Item] = field(default_factory=list)


def sem_acento(texto: str) -> str:
    normal = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in normal if not unicodedata.combining(c))


def slug(texto: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", sem_acento(texto).lower()).strip("-")


def ler_preco(valor) -> int:
    """Converte o preço da planilha em centavos. Levanta ValueError se não der."""
    if isinstance(valor, (int, float)):
        return round(float(valor) * 100)
    texto = str(valor or "").strip().replace("R$", "").replace(" ", "")
    if not texto:
        raise ValueError("preço vazio")
    if "," in texto:  # formato brasileiro: 1.234,50
        texto = texto.replace(".", "").replace(",", ".")
    if not re.fullmatch(r"\d+(\.\d{1,2})?", texto):
        raise ValueError(f"preço ilegível: {valor!r}")
    return round(float(texto) * 100)


def ler_disponivel(valor) -> bool:
    texto = sem_acento(str(valor if valor is not None else "")).strip().lower()
    if texto in SIM:
        return True
    if texto in NAO:
        return False
    raise ValueError(f"disponível deve ser sim ou não, veio {valor!r}")


def ler_linhas(caminho: Path) -> list[dict]:
    """Lê .csv (separado por ; ou ,) ou .xlsx e devolve uma lista de dicionários."""
    if caminho.suffix.lower() == ".xlsx":
        try:
            from openpyxl import load_workbook
        except ImportError as exc:  # pragma: no cover
            raise SystemExit("Para ler .xlsx instale o openpyxl: pip install openpyxl") from exc
        planilha = load_workbook(caminho, read_only=True, data_only=True).active
        linhas = list(planilha.iter_rows(values_only=True))
        cabecalho = [slug(str(c or "")).replace("-", "_") for c in linhas[0]]
        return [dict(zip(cabecalho, linha)) for linha in linhas[1:]]

    texto = caminho.read_text(encoding="utf-8-sig")
    separador = ";" if texto.splitlines()[0].count(";") >= texto.splitlines()[0].count(",") else ","
    leitor = csv.DictReader(texto.splitlines(), delimiter=separador)
    return [{slug(k or "").replace("-", "_"): v for k, v in linha.items()} for linha in leitor]


def montar_cardapio(linhas: list[dict]) -> list[Categoria]:
    if linhas and not OBRIGATORIAS.issubset(linhas[0].keys()):
        faltando = sorted(OBRIGATORIAS - set(linhas[0].keys()))
        raise ErroPlanilha([f"Faltam colunas na planilha: {', '.join(faltando)}"])

    categorias: dict[str, Categoria] = {}
    vistos: set[str] = set()
    erros: list[str] = []

    for numero, linha in enumerate(linhas, start=2):  # linha 1 é o cabeçalho
        nome = str(linha.get("item") or "").strip()
        nome_categoria = str(linha.get("categoria") or "").strip()
        if not nome and not nome_categoria:
            continue  # linha em branco no fim da planilha
        try:
            if not nome:
                raise ValueError("item sem nome")
            if not nome_categoria:
                raise ValueError("item sem categoria")
            unidade = str(linha.get("unidade") or "un").strip().lower()
            if unidade not in UNIDADES:
                raise ValueError(f"unidade deve ser kg ou un, veio {unidade!r}")
            item = Item(
                id=slug(nome),
                nome=nome,
                descricao=str(linha.get("descricao") or "").strip(),
                preco_centavos=ler_preco(linha.get("preco")),
                unidade=unidade,
                disponivel=ler_disponivel(linha.get("disponivel")),
                observacao=str(linha.get("observacao") or "").strip(),
            )
            if item.preco_centavos <= 0:
                raise ValueError("preço precisa ser maior que zero")
            if item.id in vistos:
                raise ValueError("item repetido")
        except ValueError as erro:
            erros.append(f"Linha {numero} ({nome or 'sem nome'}): {erro}")
            continue

        vistos.add(item.id)
        chave = slug(nome_categoria)
        categorias.setdefault(chave, Categoria(id=chave, nome=nome_categoria)).itens.append(item)

    if erros:
        raise ErroPlanilha(erros)
    return list(categorias.values())


def resumo(categorias: list[Categoria]) -> str:
    itens = [i for c in categorias for i in c.itens]
    esgotados = [i.nome for i in itens if not i.disponivel]
    linhas = [f"{len(itens)} itens em {len(categorias)} categorias."]
    for c in categorias:
        precos = [i.preco_centavos for i in c.itens]
        linhas.append(
            f"  {c.nome:<18} {len(c.itens):>2} itens · de R$ {min(precos)/100:.2f} a R$ {max(precos)/100:.2f}".replace(".", ",")
        )
    linhas.append("Esgotados: " + (", ".join(esgotados) if esgotados else "nenhum"))
    return "\n".join(linhas)


def gravar(categorias: list[Categoria], raiz: Path = RAIZ) -> None:
    dados = {
        "atualizado_em": datetime.now().strftime("%Y-%m-%dT%H:%M"),
        "categorias": [asdict(c) for c in categorias],
    }
    texto = json.dumps(dados, ensure_ascii=False, indent=2)
    (raiz / "dados").mkdir(exist_ok=True)
    (raiz / "js").mkdir(exist_ok=True)
    (raiz / "dados" / "cardapio.json").write_text(texto + "\n", encoding="utf-8")
    (raiz / "js" / "cardapio-dados.js").write_text(
        "// Gerado por ferramentas/gerar_cardapio.py. Não edite à mão: edite a planilha.\n"
        f"window.CARDAPIO = {texto};\n",
        encoding="utf-8",
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("planilha", nargs="?", default=str(RAIZ / "dados" / "cardapio.csv"))
    parser.add_argument("--verificar", action="store_true", help="só confere a planilha, não grava")
    args = parser.parse_args(argv)

    caminho = Path(args.planilha)
    if not caminho.exists():
        print(f"Planilha não encontrada: {caminho}", file=sys.stderr)
        return 1
    try:
        categorias = montar_cardapio(ler_linhas(caminho))
    except ErroPlanilha as erro:
        print("A planilha tem erros, nada foi gravado:", file=sys.stderr)
        for linha in erro.erros:
            print("  - " + linha, file=sys.stderr)
        return 2

    print(resumo(categorias))
    if not args.verificar:
        gravar(categorias)
        print("Gravado em dados/cardapio.json e js/cardapio-dados.js")
    return 0


if __name__ == "__main__":
    sys.exit(main())
