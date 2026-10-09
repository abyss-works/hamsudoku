"""자리채움 효과음 생성기. 진짜 에셋이 오면 public/sfx/ 파일을 교체한다.

44.1kHz 모노 16비트 WAV를 합성한다. 의존성 없음(표준 라이브러리만).
재생: python3 tools/gen-sfx-placeholders.py
"""
import math
import struct
import wave
from pathlib import Path

SR = 44100
OUT = Path(__file__).resolve().parent.parent / "public" / "sfx"


def sine(freq: float, t: float) -> float:
    return math.sin(2 * math.pi * freq * t)


def envelope(i: int, n: int) -> float:
    return math.exp(-4.0 * i / n)


def tone(freqs: list, durs: list, wave_fn=sine) -> list:
    out: list = []
    for freq, dur in zip(freqs, durs):
        n = int(SR * dur)
        out.extend(wave_fn(freq, i / SR) * envelope(i, n) for i in range(n))
    return out


def chirp(f0: float, f1: float, dur: float) -> list:
    n = int(SR * dur)
    out = []
    for i in range(n):
        f = f0 + (f1 - f0) * i / n
        out.append(sine(f, i / SR) * envelope(i, n))
    return out


def buzz(freq: float, dur: float) -> list:
    n = int(SR * dur)
    out = []
    for i in range(n):
        s = 1.0 if sine(freq, i / SR) > 0 else -1.0
        out.append(0.5 * s * envelope(i, n))
    return out


def write(name: str, samples: list) -> None:
    peak = max([abs(s) for s in samples] + [1e-6])
    gain = 0.8 / peak
    frames = b"".join(struct.pack("<h", int(max(-1.0, min(1.0, s * gain)) * 32767)) for s in samples)
    OUT.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUT / name), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(frames)
    print(f"{name}: {len(samples) / SR:.2f}s")


SOUNDS = {
    "ui-click.wav": tone([880.0], [0.08]),
    "mark.wav": tone([660.0], [0.12]),
    "erase.wav": chirp(440.0, 330.0, 0.12),
    "good.wav": tone([523.25, 659.25, 783.99, 1046.5, 1318.51], [0.15, 0.15, 0.15, 0.15, 0.45]),
    "bad.wav": buzz(140.0, 0.35),
    "clear.wav": tone([523.25, 659.25, 783.99, 1046.5], [0.15, 0.15, 0.15, 0.5]),
    "gameover.wav": tone([392.0, 311.13, 233.08], [0.3, 0.3, 0.4]),
    "seed.wav": tone([987.77, 1318.51], [0.09, 0.25]),
}

for name, samples in SOUNDS.items():
    write(name, samples)
