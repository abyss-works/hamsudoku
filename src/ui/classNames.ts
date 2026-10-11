export function buttonClass(variant: 'plain' | 'sticker', className: string): string {
  const trimmed = className.trim();
  const stickerPart = variant === 'sticker' ? 'btn-sticker' : '';
  const parts = ['btn', stickerPart, trimmed].filter(Boolean);
  return parts.join(' ');
}

export function textInputClass(className: string): string {
  const trimmed = className.trim();
  return trimmed ? `text-input ${trimmed}` : 'text-input';
}
