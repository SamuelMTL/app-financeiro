# Regras de negócio

## Tipos de lançamento
| Tipo | Efeito em gasto/renda | Efeito no saldo |
|---|---|---|
| `expense` (gasto) | conta como gasto | reduz saldo (conta) ou aumenta a fatura (cartão) |
| `income` (renda) | conta como renda | aumenta saldo |
| `transfer` | não conta | move saldo entre contas |
| `card_payment` (pagamento de fatura) | não conta | reduz saldo da conta e quita a fatura |
| `refund` (estorno) | reduz o gasto original | devolve saldo ou reduz a fatura |

## Competência e caixa
- **Orçamento, tetos e análises usam a data da compra** (competência). Compra no cartão em 10/10 conta em outubro, mesmo que a fatura venha em novembro.
- **Saldo previsto usa caixa**: o que sai de fato da conta até o fim do mês (faturas com vencimento no mês, recorrentes em conta).

## Parcelas
- Comprar `N` parcelas de `V` cria `N` lançamentos com o mesmo `installment_group_id`, `installment_no` de 1 a `N`.
- Valor de cada parcela = `floor(V / N)`; o resto de centavos vai na 1ª parcela.
- Mês da fatura: se a data da compra é **depois** do dia de fechamento do cartão, a 1ª parcela cai na fatura do mês seguinte; senão, no mês corrente. As demais seguem mês a mês.
- Excluir/editar parcela: perguntar escopo (só esta, esta e futuras, todas).

## Recorrências
- Uma recorrência é um modelo. Os lançamentos do mês são criados de forma **idempotente** (chave única `recurrence_id + mês`).
- Gerar ao abrir o app e ao navegar para um mês futuro/atual.
- Mudar valor vale a partir do mês seguinte; meses fechados nunca são alterados.
- Recorrência no cartão entra na fatura; recorrência em conta entra no saldo previsto. Não contar duas vezes.

## Saldo previsto (fim do mês)
```
saldo_previsto = saldo_atual_das_contas
               + rendas_previstas_restantes
               − recorrentes_em_conta_restantes
               − faturas_a_vencer_no_mes (não pagas)
```

## Quanto posso gastar por dia
```
dias_restantes = dias entre amanhã e o último dia do mês (mín. 1)
por_dia = max(0, saldo_previsto) / dias_restantes
```
Exemplo de referência do design: em 12/10, 19 dias restantes (13 a 31).

## Tetos por forma de pagamento
- Duas formas: **crédito** e **débito/Pix/dinheiro**.
- `usado` = soma dos gastos do mês (por data da compra) na forma, descontados estornos.
- No crédito, compra parcelada conta a **parcela do mês** da compra.
- Decisão em aberto (padrão: **não** contar): parcelas de compras antigas que caem no mês entram no teto de crédito? Deixar como opção nas configurações.
  - Essa opção afeta tanto o "comprometido futuro" (Fase 4) quanto o teto de crédito em si (Fase 5). Implementar a função de domínio já parametrizada (`incluirParcelasAntigasNoTeto: boolean`) desde a Fase 4, com teste cobrindo os dois valores — assim a Fase 5 não corre o risco de descobrir que a base de cálculo mudou por baixo.
- Situação: `< 80%` dentro do teto; `80–99%` perto; `≥ 100%` estourado. `restante = teto − usado` (pode ficar negativo; mostrar como "acima").

## Orçamento por categoria e alertas
- Orçamento: valor planejado por categoria por mês. `uso% = realizado / planejado`.
- Limiares padrão 80% e 100%. Cada limiar dispara **uma vez por mês por item** (tabela `alert_events`).
- Copiar mês anterior: copia planejado, grupo e alertas; pede confirmação se já houver orçamento no mês.

## Distribuição 50/30/20
- Grupos: Necessidade, Querer, Investimento.
- `% realizado do grupo = gasto do grupo / renda do mês`. Planejado padrão 50/30/20, editável.
- Renda do mês = rendas lançadas no mês (usar as previstas se ainda não lançadas).

## Meta de investimento
- Meta em valor fixo ou em % da renda do mês. Aportado = lançamentos de categorias do grupo Investimento.

## Estornos
- `refund_of_id` aponta para o gasto. Soma dos estornos ≤ valor do gasto.
- O estorno herda categoria e conta/cartão do gasto original por padrão.

## Fechamento de mês
- Tabela `closed_months`. Enquanto o mês estiver fechado, **bloquear** criar, editar e excluir lançamentos, orçamentos e tetos daquele mês (triggers no SQLite + validação no domínio).
- Reabrir exige confirmação e registra data.
- Resumo do mês: entrou, saiu, aportes, sobrou; itens que fugiram do planejado (categorias acima do planejado, meta de investimento abaixo).

## Importação de fatura
- CSV primeiro; PDF depois. Um "leitor" por emissor (PicPay, Itaú Azul…), com mapeamento de colunas.
- **Duplicado**: mesma conta/cartão + data + valor + descrição normalizada (sem acento, maiúsculas, sem espaços extras). Guardar `import_hash`.
- Detectar `N/M` na descrição como parcela N de M; se for a 1ª parcela, criar as demais; se não, vincular ao grupo existente quando houver.
- Categoria sugerida por histórico (mesma descrição normalizada → última categoria usada).
- Total: `novos + já lançados = total da fatura`; se não bater, mostrar a diferença antes de confirmar.
- Nada é gravado antes da confirmação; a importação inteira é uma transação do banco.

## Exportação
- CSV (UTF-8 com BOM, separador `;`, decimal com vírgula) e Excel (.xlsx). Período e conteúdo selecionáveis.
