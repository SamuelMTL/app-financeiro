# Histórias de usuário

Cada história tem critérios de aceite. A fase em que entra está em `roadmap.md`.

## Registro e edição de gastos
**US-01 — Editar e excluir lançamentos.** Para corrigir erros.
- Abrir um lançamento permite editar valor, data, descrição, categoria, conta/cartão, tags e observação.
- Excluir pede confirmação. Excluir uma parcela pergunta se é só essa, esta e as futuras, ou todas.
- Não é possível editar nem excluir lançamento de mês fechado (mensagem clara).

**US-02 — Gastos parcelados (ex.: 3/10).** Para as parcelas futuras aparecerem sozinhas.
- Ao informar valor total e nº de parcelas, o app mostra a prévia (mês, nº e valor de cada parcela).
- Todas as parcelas são criadas de uma vez, cada uma no mês da fatura correspondente.
- A soma das parcelas é exatamente o valor total (a diferença de centavos vai para a primeira ou a última).
- Parcelas já lançadas aparecem como `3/10`.

**US-03 — Gastos e rendas recorrentes.** Aluguel, assinaturas, salário.
- Cadastro com valor, dia do mês, categoria, conta/cartão e data de início (fim opcional).
- Os lançamentos do mês aparecem sem digitar, marcados como "Recorrente".
- Alterar o valor de uma recorrência vale daqui para frente, sem mexer nos meses passados.

**US-04 — Vários cartões e contas.** Escolher qual usei em cada gasto.
- Tipos: conta corrente, dinheiro e cartão de crédito.
- Cartão tem limite, dia de fechamento e dia de vencimento.
- O app lembra a última conta/cartão usada como padrão no novo lançamento.

**US-05 — Transferências e pagamento de fatura sem contar como gasto.**
- Transferência move dinheiro entre contas (origem e destino).
- Pagamento de fatura sai da conta e quita a fatura do cartão.
- Nenhum dos dois entra em totais de gasto, orçamento ou tetos.

**US-06 — Estornos e reembolsos vinculados a um gasto.**
- A partir de um gasto, "Registrar estorno" cria um lançamento ligado a ele.
- O estorno não pode passar do valor do gasto (somando estornos anteriores).
- O gasto original mostra o vínculo e reduz o total da categoria dele.

**US-07 — Observação e tags.**
- Cada lançamento tem observação livre e várias tags.
- A busca encontra por texto da descrição, observação e tags.

**US-08 — Registro rápido.**
- Ctrl/Cmd+N abre o formulário com foco no valor, data de hoje e última conta usada.
- Salvar com Enter; "Salvar e novo" mantém o formulário aberto e limpo.
- Registrar um gasto simples leva poucos toques. (Versão de celular fica fora do escopo inicial.)

## Cartão de crédito
**US-09 — Ver o comprometido em faturas futuras.**
- Gráfico por mês, empilhado por cartão, com o total de cada mês futuro.
- Lista de parcelamentos em andamento: parcela atual, valor e quanto falta.

**US-10 — Importar fatura (PDF ou CSV).**
- Passos: escolher arquivo → conferir lançamentos → confirmar.
- Cada linha mostra situação: Novo, Já lançado (duplicado, desmarcado), Parcela N/M detectada, Revisar.
- Sugere categoria por histórico; linhas sem categoria ficam destacadas.
- Confirma que "novos + já lançados = total da fatura".
- Só importa o que estiver marcado; nada é gravado antes de confirmar.

## Planejamento e controle
**US-11 — Alertas de orçamento.**
- Por categoria, alertas em 80% e 100% (configuráveis). Cada limite dispara uma vez por mês.
- Alerta aparece na Visão geral e como notificação do sistema.

**US-12 — Metas de investimento.**
- Meta em valor ou % da renda do mês; mostra aportado, meta e quanto falta.

**US-13 — Distribuição ideal (ex.: 50/30/20).**
- Cada categoria pertence a: Necessidade, Querer ou Investimento.
- Mostra planejado × realizado de cada grupo, em % da renda.

**US-14 — Copiar o orçamento do mês anterior.**
- Um clique copia planejado, grupos e alertas; não sobrescreve sem confirmar.

**US-15 — Saldo previsto até o fim do mês.**
- Saldo atual + rendas a receber − recorrentes a vencer − faturas a vencer.

**US-16 — Quanto posso gastar por dia.**
- Saldo previsto dividido pelos dias que restam no mês.

**US-17 — Tetos por forma de pagamento.** (adicionada durante o design)
- Definir teto mensal para **Crédito** e para **Débito, Pix e dinheiro**.
- Visão geral mostra "ainda posso gastar" em cada, barra de uso e situação (dentro / perto do teto / estourado).
- Ao lançar uma compra que passa do teto, o formulário avisa antes de salvar.
- Alertas em 80% e 100% como nas categorias.

## Análise e histórico
**US-18 — Comparar meses.** Gasto total e por categoria, com diferença em R$ e %.
**US-19 — Maiores gastos e categorias que mais cresceram.**
**US-20 — Filtrar e buscar lançamentos** por período, categoria, conta/cartão, valor (faixa) e texto.
**US-21 — Resumo mensal ao fechar o mês.** Quanto entrou, saiu, sobrou, e o que fugiu do planejado.

## Dados e uso
**US-22 — Exportar dados (CSV/Excel).** Escolher formato, período e o que incluir.
**US-23 — Fechar o mês.** Bloqueia edições no período; reabrir exige confirmação. Checklist antes de fechar: lançamentos conferidos, faturas conciliadas, saldos conferidos.
