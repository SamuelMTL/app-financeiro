# Caderno — app desktop de gastos pessoais

Aplicativo de controle financeiro pessoal, de uso próprio, para desktop (macOS primeiro).
Idioma da interface e dos textos: **português do Brasil**. Moeda: **BRL**.

## Como trabalhar neste projeto
1. Leia `docs/user-stories.md`, `docs/business-rules.md` e `docs/data-model.md` antes de codar.
2. Implemente **uma fase por vez**, na ordem de `docs/roadmap.md`. Não adiantar fases.
3. As telas de referência estão em `design/screens/` (HTML) e `design/reference/` (PNG). São **referência visual**, não código para reaproveitar: reimplemente em React usando `design/tokens.css`.
4. Regra de negócio fica em `src/domain` (funções puras + testes). A interface só chama o domínio.
5. Ao terminar cada fase: testes passando, `docs/roadmap.md` atualizado (marcar o que ficou pronto) e um resumo do que mudou.

## Stack (decidida)
- **Tauri 2** + **React + TypeScript** (Vite)
- **SQLite local** (dados só no computador do usuário), com migrations versionadas em `src-tauri/migrations`
- Testes: **Vitest** para o domínio; testes de integração do banco com SQLite em memória
- Gráficos simples (barras) feitos em SVG/CSS, sem biblioteca pesada, a menos que haja motivo

## Princípios inegociáveis
- **Dinheiro sempre em centavos inteiros** (`INTEGER`). Nunca `float`. Formatação pt-BR só na borda da UI.
- **Datas** em ISO (`YYYY-MM-DD`), mês como `YYYY-MM`. Fuso: America/Sao_Paulo.
- **Transferência e pagamento de fatura não contam como gasto** nem como renda.
- **Mês fechado é imutável**: bloqueio na camada de dados (triggers/validação no domínio), não só desabilitar botão.
- Compras parceladas geram **todas as parcelas de uma vez**, cada uma na fatura certa.
- Exportar dados (CSV/Excel) nunca altera nada e deve funcionar a qualquer momento.
- Sem telemetria, sem rede, sem contas online. Tudo local.

## Design
- Tema **escuro** (paleta "grafite, menta e coral"), tokens em `design/tokens.css` e `design/tokens.json`.
- Fontes: **IBM Plex Sans** (textos, títulos, números grandes) e **IBM Plex Mono** (valores pequenos em tabelas e listas). Empacotar as fontes localmente, não carregar de CDN.
- Menta = ok/positivo/ação principal. Coral = atenção (80%+ do orçamento/teto) e acima do limite. Nunca depender só da cor: sempre há texto ou ícone junto.
- Botões, campos e alvos clicáveis com pelo menos 44px de altura. Contraste mínimo 4.5:1 para texto.
- Atalho global **Ctrl/Cmd + N** abre "Novo lançamento" de qualquer tela.

## Comandos
(Preencher após o scaffold da fase 1: dev, build, test, lint.)

## Primeira tarefa
Ler os docs e implementar a **Fase 1** do roadmap (base do app + lançamentos + contas/cartões + categorias), com testes.
Antes de escrever código, proponha a estrutura de pastas e o esquema inicial do banco e espere confirmação.
