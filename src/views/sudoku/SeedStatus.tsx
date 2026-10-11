import { Sprout } from 'lucide-react';

export interface SeedStatusProps {
  balance: number | string;
  bonus?: number | string;
  ariaLabel: string;
}

export function SeedStatus({ balance, bonus, ariaLabel }: SeedStatusProps) {
  return (
    <span className="seed-box" role="status" aria-label={ariaLabel}>
      <Sprout size={20} aria-hidden="true" />
      <span className="seed-count">{balance}</span>
      {bonus !== undefined && (
        <span className="seed-lives" aria-hidden="true">
          +{bonus}
        </span>
      )}
    </span>
  );
}
