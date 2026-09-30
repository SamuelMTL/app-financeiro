import './Lancamentos.css';

interface PlaceholderScreenProps {
  title: string;
  phase: string;
}

/** Telas cujas histórias ainda não chegaram no roadmap (docs/roadmap.md). */
export function PlaceholderScreen({ title, phase }: PlaceholderScreenProps) {
  return (
    <div className="screen">
      <header className="screen-header">
        <h1>{title}</h1>
      </header>
      <p className="muted">Esta tela chega na {phase} — ver docs/roadmap.md.</p>
    </div>
  );
}
