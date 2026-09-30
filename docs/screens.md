# Telas de referência

Arquivos em `design/screens/*.html` (abrir no navegador) e `design/reference/*.png`.
As imagens foram geradas com fonte substituta, então as letras não são as finais (Plex); use os HTML e os tokens como referência de cor, espaçamento e hierarquia.
Os HTML carregam as fontes do Google Fonts apenas para pré-visualizar; no app, empacote as fontes localmente.

| Tela | Arquivo | Histórias |
|---|---|---|
| Visão geral | `Main` | US-11, US-15, US-16, US-17 |
| Lançamentos + painel de edição | `Lancamentos` | US-01, US-05, US-06, US-07, US-20 |
| Novo lançamento (modal) | `NovoLancamento` | US-02, US-03, US-04, US-08, US-17 |
| Cartões e contas | `Cartoes` | US-04, US-09 |
| Importar fatura | `ImportarFatura` | US-10 |
| Planejamento | `Planejamento` | US-11, US-12, US-13, US-14, US-17 |
| Análise | `Analise` | US-18, US-19 |
| Fechamento e exportação | `Fechamento` | US-21, US-22, US-23 |

## Navegação
Barra lateral fixa: Visão geral, Lançamentos, Cartões e contas, Importar fatura, Planejamento, Análise, Fechamento. Botão "Novo lançamento" no topo da barra e atalho Ctrl/Cmd+N.

## Observações de design
- Os valores dos exemplos (R$ 2.982,05, R$ 156,95, tetos de R$ 600 no crédito etc.) são dados fictícios para o design. Servem de caso de teste para o domínio, mas o app real usa os dados do usuário.
- Teto de crédito de R$ 600,00 e teto de débito/Pix de R$ 4.000,00 são exemplos.
- A tela de Novo lançamento mostra o aviso de "acima do teto de crédito" quando a compra passa do que resta.
