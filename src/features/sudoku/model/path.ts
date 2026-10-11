// 드래그 경로 계산. 연속 격자 좌표(x = 열, y = 행) 두 점을 잇는 선분이 지나는 칸을
// 순서대로 낸다. 가로·세로 한 칸씩만 옮기므로 결과는 항상 이어진 칸 열이다.

export type GridPoint = readonly [number, number]; // [x, y]

const EPS = 1e-9;

function clamp(v: number, size: number): number {
  return Math.min(Math.max(v, 0), size - EPS);
}

export function cellsAlongSegment(from: GridPoint, to: GridPoint, size: number): [number, number][] {
  const x0 = clamp(from[0], size);
  const y0 = clamp(from[1], size);
  const x1 = clamp(to[0], size);
  const y1 = clamp(to[1], size);
  let cx = Math.floor(x0);
  let cy = Math.floor(y0);
  const ex = Math.floor(x1);
  const ey = Math.floor(y1);
  const out: [number, number][] = [[cy, cx]];
  const dx = x1 - x0;
  const dy = y1 - y0;
  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  // 다음 세로·가로 격자선까지의 선분 매개변수 t (0..1)
  const nextT = (p: number, d: number, step: number, c: number) => {
    if (d === 0) return Infinity;
    const boundary = step > 0 ? c + 1 : c;
    return (boundary - p) / d;
  };
  let tx = nextT(x0, dx, stepX, cx);
  let ty = nextT(y0, dy, stepY, cy);
  const tdx = dx === 0 ? Infinity : Math.abs(1 / dx);
  const tdy = dy === 0 ? Infinity : Math.abs(1 / dy);
  let guard = size * size * 2;
  while ((cx !== ex || cy !== ey) && guard > 0) {
    guard -= 1;
    if (tx <= ty) {
      cx += stepX;
      tx += tdx;
    } else {
      cy += stepY;
      ty += tdy;
    }
    if (cx < 0 || cy < 0 || cx >= size || cy >= size) break;
    out.push([cy, cx]);
  }
  return out;
}
