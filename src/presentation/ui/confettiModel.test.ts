import { describe, expect, it } from 'vitest';
import { confettiPiecesModel } from './confettiModel';

describe('confettiPiecesModel (UI pure model)', () => {
  it('기본값 count=24 및 count=0, 색상 순환, 위치 및 지속시간을 정확히 생성한다', () => {
    // 1. count=0
    expect(confettiPiecesModel(0)).toEqual([]);

    // 2. 기본값 count=24
    const defaultPieces = confettiPiecesModel();
    expect(defaultPieces).toHaveLength(24);

    // 첫 조각: i=0 -> x='0%', c='#e5484d', d=1.6 + (0/10)=1.6
    expect(defaultPieces[0]).toEqual({
      id: 0,
      x: '0%',
      color: '#e5484d',
      duration: 1.6,
    });

    // 두번째 조각: i=1 -> x='41%', c='#f5a524', d=1.6 + 0.7 = 2.3
    expect(defaultPieces[1]).toEqual({
      id: 1,
      x: '41%',
      color: '#f5a524',
      duration: 2.3,
    });

    // 6번째 조각: i=6 -> c=COLORS[6 % 6] = COLORS[0] = '#e5484d' (색 순환)
    expect(defaultPieces[6].color).toBe('#e5484d');
  });
});
