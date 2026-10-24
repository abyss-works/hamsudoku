/** 작은 마스코트의 표정. 마스코트 명세의 표정 변형 규칙에 따라 눈과 입만 바꾼다. */
export type HamsterExpression = 'base' | 'smile' | 'excited' | 'surprised';

const INK = '#4a3426';
const EYE = '#442d23';
// 작은 크기 단계는 선을 비례보다 두껍게 그려야 48px 이하에서 표정이 보인다.
const LINE = 12;
// 눈 좌표는 기준 디자인 값이다. 놀란 눈은 타원과 하이라이트를 눈 중심 기준 1.15배로 키운 값이다.
const EYE_SHAPES = {
  base: [
    { cx: 120, hx: 114.5, hy: 140.5 },
    { cx: 247, hx: 241.5, hy: 140.5 },
  ],
  surprised: [
    { cx: 120, hx: 113.7, hy: 139.4 },
    { cx: 247, hx: 240.7, hy: 139.4 },
  ],
} as const;
const EYE_SIZE = { base: { rx: 17.5, ry: 19, r: 5 }, surprised: { rx: 20.1, ry: 21.9, r: 5.75 } } as const;
const SMILE_EYES = ['M103 152 Q 120 130 137 152', 'M230 152 Q 247 130 264 152'];

function Eyes({ expression }: { expression: HamsterExpression }) {
  if (expression === 'smile' || expression === 'excited') {
    return (
      <g stroke={INK} strokeWidth={LINE} strokeLinecap="round" fill="none">
        {SMILE_EYES.map((d) => <path key={d} d={d} />)}
      </g>
    );
  }
  const shape = expression === 'surprised' ? 'surprised' : 'base';
  const size = EYE_SIZE[shape];
  return (
    <>
      {EYE_SHAPES[shape].map((eye) => (
        <g key={eye.cx}>
          <ellipse cx={eye.cx} cy="148" rx={size.rx} ry={size.ry} fill={EYE} />
          <circle cx={eye.hx} cy={eye.hy} r={size.r} fill="#ffffff" />
        </g>
      ))}
    </>
  );
}

function Mouth({ expression }: { expression: HamsterExpression }) {
  const philtrum = <path d="M184 184 L 184 197" />;
  if (expression === 'excited') {
    return (
      <>
        <g stroke={INK} strokeWidth={LINE} strokeLinecap="round" fill="none">{philtrum}</g>
        <path d="M160 199 Q 160 234 184 234 Q 208 234 208 199 Z" fill={INK} />
        <ellipse cx="184" cy="224" rx="12" ry="7" fill="#ee9182" />
      </>
    );
  }
  if (expression === 'surprised') {
    return (
      <>
        <g stroke={INK} strokeWidth={LINE} strokeLinecap="round" fill="none">{philtrum}</g>
        <ellipse cx="184" cy="214" rx="11" ry="13" fill={INK} />
      </>
    );
  }
  return (
    <g stroke={INK} strokeWidth={LINE} strokeLinecap="round" strokeLinejoin="round" fill="none">
      {philtrum}
      <path d="M155 200 Q 158 211 169 211 Q 181 211 184 197 Q 187 211 199 211 Q 210 211 213 200" />
    </g>
  );
}

/**
 * 마스코트 기준 디자인의 작은 크기 단계. 귀·몸통·얼굴 크림·볼·눈·코·입만 그리고 털은 단색이다.
 * SVG id를 쓰지 않아 한 화면에 여러 개를 그려도 충돌하지 않는다.
 */
export function HamsterFace({ expression = 'base' }: { expression?: HamsterExpression }) {
  return (
    <svg viewBox="0 0 370 342" role="img" aria-label="햄스터">
      <circle cx="75" cy="57" r="44" fill="#ba8e68" />
      <circle cx="81" cy="62" r="29" fill="#f1b696" />
      <circle cx="293" cy="57" r="44" fill="#ba8e68" />
      <circle cx="287" cy="62" r="29" fill="#f1b696" />
      <path
        fill="#f4c687"
        d="M184 31 C 150 31 122 36 102 47 C 80 59 62 76 52 98 C 45 112 41 120 37 128 C 33 141 27 150 19 155
           L 12 154 L 16 163 C 10 175 6 188 4 202 C 2 214 2 226 4 236 L 0 242 L 5 246 C 6 268 10 292 14 318
           L 354 318 C 358 292 362 268 363 246 L 368 242 L 364 236 C 366 226 366 214 364 202
           C 362 188 358 175 352 163 L 356 154 L 349 155 C 341 150 335 141 331 128 C 327 120 323 112 316 98
           C 306 76 288 59 266 47 C 246 36 218 31 184 31 Z"
      />
      <path
        fill="#fff5e1"
        d="M30 204 C 34 186 52 176 76 171 C 100 167 135 168 152 162 C 160 152 171 147 184 147
           C 197 147 208 152 216 162 C 233 168 268 167 292 171 C 316 176 334 186 338 204
           C 344 244 290 275 184 275 C 78 275 24 244 30 204 Z"
      />
      <circle cx="100" cy="196" r="33" fill="#fbcca5" />
      <circle cx="269" cy="196" r="33" fill="#fbcca5" />
      <Eyes expression={expression} />
      <path fill="#ee9182" d="M167 167 C 167 160 201 160 201 167 C 201 175 191 184 184 184 C 177 184 167 175 167 167 Z" />
      <Mouth expression={expression} />
    </svg>
  );
}
