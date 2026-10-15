import { Button } from './Button';

export interface ErrorFallbackProps {
  onRetry: () => void;
  onReload: () => void;
}

export function ErrorFallback({ onRetry, onReload }: ErrorFallbackProps) {
  return (
    <div className="error-fallback" role="alert">
      <p className="error-fallback-title">문제가 생겨 화면을 그리지 못했어요.</p>
      <p className="error-fallback-sub">기록은 기기에 그대로 있어요. 다시 시도해 보세요.</p>
      <div className="error-fallback-actions">
        <Button variant="sticker" className="btn-primary" onClick={onRetry}>
          다시 시도
        </Button>
        <Button variant="sticker" onClick={onReload}>
          새로고침
        </Button>
      </div>
    </div>
  );
}
