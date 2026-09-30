import { useCallback, useEffect, useState } from 'react';
import { todayISO } from '../domain/dates';
import { buildOverview, type Overview } from '../domain/overview/overview';
import type { Account } from '../domain/types';
import { loadOverviewData } from '../ipc/overview';

export interface OverviewState {
  overview: Overview | null;
  accounts: Account[];
  today: string;
  error: string | null;
  reload: () => void;
}

/** Carrega os dados e devolve a visão geral calculada pelo domínio (US-09, US-15, US-16). */
export function useOverview(refreshKey?: unknown): OverviewState {
  const [state, setState] = useState<Omit<OverviewState, 'reload'>>({
    overview: null,
    accounts: [],
    today: todayISO(),
    error: null,
  });

  const reload = useCallback(() => {
    const today = todayISO();
    loadOverviewData()
      .then((data) =>
        setState({ overview: buildOverview({ ...data, today }), accounts: data.accounts, today, error: null }),
      )
      .catch((err: unknown) =>
        setState((prev) => ({ ...prev, error: err instanceof Error ? err.message : String(err) })),
      );
  }, []);

  useEffect(() => {
    reload();
  }, [reload, refreshKey]); // `refreshKey` muda → recarrega (ex.: após editar contas)

  return { ...state, reload };
}
