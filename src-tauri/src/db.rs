//! Acesso ao arquivo SQLite e backup automático do banco.
//!
//! Regra de negócio (parcelas, recorrências, orçamento etc.) NÃO mora aqui — fica em
//! `src/domain` (TypeScript), testada com Vitest. Este módulo só cuida do arquivo:
//! onde ele fica e como copiá-lo antes de cada abertura do app.

use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Nome do arquivo do banco, deve bater com o `sqlite:` usado em `lib.rs` e no
/// `Database.load(...)` do frontend (`src/ipc`).
pub const DB_FILE_NAME: &str = "app_financeiro.db";

/// Quantos backups manter na pasta `backups/`. Um por abertura do app; 30 cobre
/// cerca de um mês de uso diário sem crescer sem limite.
const MAX_BACKUPS: usize = 30;

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}

pub fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join(DB_FILE_NAME))
}

fn backups_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app_data_dir(app)?.join("backups");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Copia o banco existente para `backups/<timestamp>.db`, a cada abertura do app,
/// e apaga os mais antigos além de `MAX_BACKUPS`. Roda no `setup()` do Tauri, antes
/// da janela carregar o frontend (que é quem dispara as migrations via
/// `Database.load`) — então o backup é sempre do estado anterior à sessão atual.
///
/// Não é uma feature completa de backup (isso é "depois", ver `docs/roadmap.md`):
/// é só uma rede de segurança mínima para não perder dado financeiro real.
pub fn backup_database_if_exists(app: &AppHandle) -> Result<(), String> {
    let db = db_path(app)?;
    if !db.exists() {
        return Ok(()); // primeira execução: banco ainda não existe, nada a copiar
    }

    let dir = backups_dir(app)?;
    let timestamp = chrono::Utc::now().format("%Y%m%d-%H%M%S");
    let backup_path = dir.join(format!("{}-{timestamp}.db", DB_FILE_NAME.trim_end_matches(".db")));
    fs::copy(&db, &backup_path).map_err(|e| e.to_string())?;

    prune_old_backups(&dir)
}

fn prune_old_backups(dir: &PathBuf) -> Result<(), String> {
    let mut entries: Vec<_> = fs::read_dir(dir)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.path().extension().is_some_and(|ext| ext == "db"))
        .collect();

    // Nomes de arquivo com timestamp YYYYMMDD-HHMMSS ordenam igual cronologicamente.
    entries.sort_by_key(|entry| entry.file_name());

    if entries.len() > MAX_BACKUPS {
        for entry in &entries[..entries.len() - MAX_BACKUPS] {
            // Falha ao apagar um backup antigo não deve derrubar o app.
            let _ = fs::remove_file(entry.path());
        }
    }
    Ok(())
}
