//! Comandos Rust expostos ao frontend.
//!
//! CRUD de contas/categorias/lançamentos NÃO mora aqui: o frontend fala com o SQLite
//! direto via `@tauri-apps/plugin-sql` (JS) a partir de `src/ipc`, sem passar por um
//! comando Rust por entidade — evita duplicar uma camada de acesso a dados nos dois
//! lados. Este módulo fica reservado para o que realmente precisa de Rust: leitura de
//! CSV/PDF de fatura (Fase 3), notificação do sistema (Fase 5) etc.
