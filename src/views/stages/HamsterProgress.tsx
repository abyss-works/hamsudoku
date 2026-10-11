export interface ProgressDot {
  id: string | number;
  on: boolean;
}

export interface HamsterProgressProps {
  dots: ReadonlyArray<ProgressDot>;
  ariaLabel: string;
}

export function HamsterProgress({ dots, ariaLabel }: HamsterProgressProps) {
  return (
    <div className="dots" role="status" aria-label={ariaLabel}>
      {dots.map((dot) => (
        <span key={dot.id} className={dot.on ? 'dot on' : 'dot'} aria-hidden="true" />
      ))}
    </div>
  );
}
