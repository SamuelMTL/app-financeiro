import { alertMessage, decideAlerts, type AlertThreshold } from '../domain/planning/alerts';
import { getDb } from './db';
import { loadPlanningView } from './planning';

async function notifySystem(title: string, body: string): Promise<void> {
  try {
    const { isPermissionGranted, requestPermission, sendNotification } = await import(
      '@tauri-apps/plugin-notification'
    );
    let granted = await isPermissionGranted();
    if (!granted) granted = (await requestPermission()) === 'granted';
    if (granted) sendNotification({ title, body });
  } catch (err) {
    // Sem notificação do sistema (ex.: rodando só no navegador): o alerta continua na Visão geral.
    console.warn('Notificação do sistema indisponível:', err);
  }
}

export interface FiredAlert {
  title: string;
  body: string;
  threshold: AlertThreshold;
}

/**
 * Confere orçamento e tetos do mês e dispara os alertas que ainda não dispararam
 * (US-11, US-17). Cada limiar dispara **uma vez por mês por item**: o registro em
 * `alert_events` usa `INSERT OR IGNORE` e só notifica quando a linha foi de fato
 * inserida — então duas conferências seguidas (ou duas janelas) não repetem aviso.
 */
export async function checkAlerts(month: string): Promise<FiredAlert[]> {
  const view = await loadPlanningView(month);
  const db = await getDb();
  const rows = await db.select<{ subject: string; threshold: number }[]>(
    'SELECT subject, threshold FROM alert_events WHERE month = ?',
    [month],
  );
  const fired = new Set(rows.map((r) => `${r.subject}|${r.threshold}`));

  const result: FiredAlert[] = [];
  for (const decision of decideAlerts(view.alertSubjects, fired)) {
    let notifyThresholdInserted = false;
    for (const threshold of decision.newlyCrossed) {
      const res = await db.execute(
        'INSERT OR IGNORE INTO alert_events (month, subject, threshold) VALUES (?, ?, ?)',
        [month, decision.subject.subject, threshold],
      );
      if (res.rowsAffected === 1 && threshold === decision.notify) notifyThresholdInserted = true;
    }
    if (decision.notify !== null && notifyThresholdInserted) {
      const message = alertMessage(decision.subject, decision.notify);
      await notifySystem(message.title, message.body);
      result.push({ ...message, threshold: decision.notify });
    }
  }
  return result;
}
