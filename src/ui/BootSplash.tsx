import { HamsterFace } from './HamsterFace';

export function BootSplash() {
  return (
    <div className="boot-splash" role="status" aria-label="불러오는 중">
      <div className="boot-mascot" aria-hidden="true">
        <HamsterFace />
      </div>
      <div className="boot-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
