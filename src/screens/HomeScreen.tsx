import { Button } from '../ui/Button';
import { HamsterFace } from '../ui/HamsterFace';

export function HomeScreen({ onStart }: { onStart(): void }) {
  return (
    <div className="home">
      <div className="home-mascot" aria-hidden="true">
        <HamsterFace />
      </div>
      <h1 className="home-title">🐹 hamsudoku</h1>
      <p className="home-sub">숨은 햄스터를 찾아라</p>
      <Button variant="sticker" className="btn-primary" onClick={onStart}>
        시작하기
      </Button>
    </div>
  );
}
