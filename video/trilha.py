# Gera public/trilha.wav: base instrumental de 60 s, 96 BPM, feita aqui mesmo (sem licença de terceiros).
# Pad em lá menor (Am F C G) com pulso de bumbo e chimbal. Fica baixa por baixo da locução.
#   python trilha.py
import wave
import numpy as np

SR = 44100
BPM = 96
DUR = 60.0
batida = 60 / BPM
n = int(SR * DUR)
t = np.arange(n) / SR
mix = np.zeros(n)

def nota(f):
    return 440.0 * 2 ** ((f - 69) / 12)

# acordes (MIDI), um por compasso de 4 tempos
acordes = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]
compasso = 4 * batida
for i in range(int(DUR / compasso) + 1):
    ini = i * compasso
    a, b = int(ini * SR), min(int((ini + compasso) * SR), n)
    if a >= n:
        break
    tt = t[a:b] - ini
    env = np.minimum(1, tt / 0.6) * np.minimum(1, (compasso - tt) / 0.4)
    for m in acordes[i % 4]:
        f = nota(m)
        onda = np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 2 * f * tt + 0.5) + 0.12 * np.sin(2 * np.pi * 3 * f * tt)
        mix[a:b] += 0.06 * onda * env
    # baixo na tônica
    f = nota(acordes[i % 4][0] - 12)
    mix[a:b] += 0.10 * np.sin(2 * np.pi * f * tt) * env

# bumbo em todo tempo, chimbal no contratempo
rng = np.random.default_rng(7)
k = int(0.25 * SR)
tk = np.arange(k) / SR
bumbo = np.sin(2 * np.pi * (50 + 90 * np.exp(-tk * 30)) * tk) * np.exp(-tk * 9)
h = int(0.06 * SR)
chimbal = rng.standard_normal(h) * np.exp(-np.arange(h) / SR * 60)
chimbal = np.diff(chimbal, prepend=0)  # tira o grave
for j in range(int(DUR / batida)):
    p = int(j * batida * SR)
    mix[p:p + k] += 0.35 * bumbo[: max(0, min(k, n - p))]
    q = int((j + 0.5) * batida * SR)
    mix[q:q + h] += 0.05 * chimbal[: max(0, min(h, n - q))]

# entrada e saída suaves, normaliza
mix *= np.minimum(1, t / 1.5) * np.minimum(1, (DUR - t) / 2)
mix = mix / np.max(np.abs(mix)) * 0.8
pcm = (mix * 32767).astype(np.int16)
estereo = np.column_stack([pcm, pcm]).ravel()
with wave.open('public/trilha.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(estereo.tobytes())
print('public/trilha.wav', DUR, 's')
