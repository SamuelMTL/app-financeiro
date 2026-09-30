mod commands;
mod db;

use tauri_plugin_sql::{Migration, MigrationKind};

/// String de conexão usada tanto aqui (para registrar as migrations) quanto no
/// frontend, em `src/ipc/db.ts`, via `Database.load("sqlite:app_financeiro.db")`.
const DB_URL: &str = "sqlite:app_financeiro.db";

fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "init: contas, categorias, lançamentos, tags",
            sql: include_str!("../migrations/0001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "recorrências",
            sql: include_str!("../migrations/0002_recurrences.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DB_URL, migrations())
                .build(),
        )
        .setup(|app| {
            // Backup automático (Fase 1, docs/roadmap.md): copia o banco existente
            // antes que o frontend chame `Database.load` e dispare as migrations.
            if let Err(err) = db::backup_database_if_exists(app.handle()) {
                eprintln!("Aviso: falha ao gerar backup do banco: {err}");
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
