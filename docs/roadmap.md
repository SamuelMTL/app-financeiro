# Roadmap

Marcar `[x]` ao concluir. Cada fase termina com testes passando e o app abrindo.

## Fase 1 — Base do app
Histórias: US-01, US-04, US-07, US-08, US-20 (parcial)
- [x] Scaffold Tauri 2 + React + TS + Vite; SQLite com migrations; lint e testes configurados
- [x] Backup automático simples: copiar o `.sqlite` com timestamp para uma pasta de backups a cada abertura do app, mantendo os últimos N (não é feature completa, é rede de segurança mínima — dado financeiro real, sem nuvem)
- [x] Contas e cartões (CRUD), categorias com grupo
- [x] Lançamentos simples (gasto e renda): criar, editar, excluir, tags, observação
- [x] Tela Lançamentos com busca e filtros, painel de edição (implementado como modal reaproveitado, não painel lateral como no mockup — ver nota abaixo)
- [x] Formulário "Novo lançamento" com atalho Ctrl/Cmd+N e "Salvar e novo"
- [x] Tema escuro com tokens, fontes empacotadas (subsets latin/latin-ext do IBM Plex via @fontsource)
**Pronto quando:** dá para registrar, achar, corrigir e apagar gastos e rendas em várias contas/cartões, e o banco tem backup automático a cada abertura.

**Verificado:** `npm run test` (47/47 — domínio + integração do banco com SQLite em memória contra a migration real), `npm run lint`, `npm run build` (tsc + vite) e `cargo build` (src-tauri) todos passando. **Não verificado:** rodar `npm run tauri dev` e clicar no app de verdade (fluxo completo criar/editar/excluir na UI, atalho Ctrl/Cmd+N na janela real, fidelidade visual pixel a pixel com `design/screens/*.html`) — a UI usa os tokens de cor/fonte corretos mas tem layout mais simples que os mockups; um passe de polimento visual fica pendente.

## Fase 2 — Parcelas, recorrências, transferências e estornos
Histórias: US-02, US-03, US-05, US-06
- [x] Parcelamento com prévia e criação de todas as parcelas
- [x] Recorrências idempotentes
- [x] Transferência e pagamento de fatura (não contam como gasto)
- [x] Estorno vinculado
**Pronto quando:** a soma de parcelas fecha ao centavo, recorrências não duplicam e transferências não aparecem nos totais.

**Verificado:** `npm run test` (98/98 — inclui casos de soma exata de parcelas com resto de centavos, mês de fatura antes/depois do fechamento, idempotência de recorrência via UNIQUE constraint real no SQLite em memória, teto de estorno), `npm run lint`, `npm run build` e `cargo build` todos passando. **Não verificado:** app rodando de verdade (mesma ressalva da Fase 1 — ambiente em segundo plano não mantém a janela do Tauri aberta). Geração de recorrências hoje só roda para o mês corrente ao abrir o app; "gerar ao navegar para um mês futuro" fica pendente até a Fase 4 (Visão geral), que introduz navegação por mês.

## Fase 3 — Importação de fatura
Histórias: US-10
- [x] Regra de criação da linha `statements` (fatura): nasce no primeiro lançamento do cartão que cai naquele período de fechamento (lazy), não precomputada — ver `docs/data-model.md`
- [x] CSV (leitor PicPay e Itaú Azul), conferência, duplicados, parcelas, categorias sugeridas
- [ ] PDF — **não implementado nesta passada** (ver nota abaixo). Mantido só CSV, como o próprio roadmap já previa como saída aceitável.
**Pronto quando:** importar duas vezes a mesma fatura não duplica nada e o total confere.
**Por quê antes de visão geral/orçamento:** traz dados reais para o app o quanto antes — as fases seguintes (projeções, tetos, orçamento) passam a ser testadas e usadas com lançamentos reais, não só fictícios.

**Verificado:** `npm run test` (138/138 — inclui normalização de descrição, hash de duplicado, detecção de parcela N/M, mapeamento de CSV, classificação Novo/Já lançado/Parcela/Revisar, e integração real contra a migration 0003: UNIQUE de fatura por mês, índice único parcial de `import_hash`), `npm run lint`, `npm run build` e `cargo build` todos passando. **Não verificado:** app rodando de verdade (mesma ressalva das fases anteriores); e — importante — **os nomes de coluna dos leitores "PicPay" e "Itaú Azul" são palpites**, sem arquivo de exportação real para conferir. A tela sempre deixa o mapeamento de colunas editável (dropdown com os cabeçalhos reais do arquivo), então funciona mesmo se o palpite errar, mas vale ajustar os presets assim que você tiver um export de verdade em mãos.

**Decisões de escopo:**
- PDF ficou fora desta passada — extração de texto de PDF é uma frente própria (layout varia muito por emissor) e o próprio roadmap já previa cair para "só CSV" se fosse impraticável; preferi não simular sem arquivo real para testar.
- "Total da fatura" é conferido contra o que a pessoa digita (não existe uma fonte automática do total — normalmente vem do PDF/papel da fatura).
- Import não usa transação SQL explícita (BEGIN/COMMIT) — em vez disso, cada linha é inserida de forma idempotente (índice único de `import_hash`), então repetir a confirmação após uma falha parcial não duplica nada, só pula o que já foi gravado. Mais simples que orquestrar uma transação Rust dedicada e cobre a garantia que a história pede.
- Corrigido de passagem: parcelas criadas manualmente (Fase 2) tinham "(N/M)" embutido no texto da descrição, o que quebraria o casamento de grupo na importação. Agora fica como selo separado na tela (usando as colunas `installment_no`/`installments_total`, que já existiam).

## Fase 4 — Visão geral e projeções
Histórias: US-09, US-15, US-16
- [ ] Faturas por cartão, comprometido futuro (gráfico) e parcelamentos em andamento
- [ ] Saldo previsto e "posso gastar por dia"
- [ ] Tela Visão geral e tela Cartões e contas
**Pronto quando:** os números batem com os exemplos de `docs/business-rules.md`.

## Fase 5 — Orçamento, tetos, metas e alertas
Histórias: US-11, US-12, US-13, US-14, US-17
- [ ] Orçamento por categoria e cópia do mês anterior
- [ ] Tetos por forma de pagamento (crédito e débito/Pix/dinheiro) + aviso no formulário
- [ ] Distribuição 50/30/20 e meta de investimento
- [ ] Alertas 80%/100% (uma vez por mês) e notificação do sistema
**Pronto quando:** estourar um teto ou categoria dispara o alerta exatamente uma vez.

## Fase 6 — Análise, fechamento e exportação
Histórias: US-18, US-19, US-21, US-22, US-23
- [ ] Análise (comparativo mensal, maiores gastos, categorias que mais cresceram)
- [ ] Fechar e reabrir mês com bloqueio no banco + resumo mensal
- [ ] Exportação CSV e Excel
- [ ] Smoke tests de integração via Tauri (não só domínio isolado): criar lançamento, fechar mês e tentar editar (deve bloquear), importar a mesma fatura duas vezes (não deve duplicar)
**Pronto quando:** mês fechado recusa qualquer alteração, inclusive por caminhos alternativos.

## Depois (fora do escopo inicial)
Versão de celular para registro rápido, backup automático mais completo (ex.: para nuvem própria do usuário, restauração pela UI — a Fase 1 já cobre uma cópia local simples a cada abertura), atualização de valores por índices.
