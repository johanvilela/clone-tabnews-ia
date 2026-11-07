"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type AudioEngine = {
  ctx: AudioContext;
  master: GainNode;
  osc1: OscillatorNode;
  osc2: OscillatorNode;
  flutter: OscillatorNode;
  panner: StereoPannerNode | null;
};

const TAU = Math.PI * 2;
const HALF = 48; // metade do tamanho da mosca (96px)
const PAD = 50; // margem para a mosca não encostar nas bordas

function makeNoiseBuffer(ctx: AudioContext) {
  const length = Math.floor(ctx.sampleRate * 1.5);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export default function Home() {
  const flyRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<AudioEngine | null>(null);
  const mutedRef = useRef(false);
  const exciteRef = useRef(0);
  const shooRef = useRef<(x: number, y: number) => void>(() => {});
  const [muted, setMuted] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);

  const ensureAudio = useCallback(() => {
    setHintVisible(false);

    if (audioRef.current) {
      if (audioRef.current.ctx.state === "suspended") {
        void audioRef.current.ctx.resume();
      }
      return;
    }

    const AudioContextClass =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();

    const master = ctx.createGain();
    master.gain.value = 0;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.ratio.value = 4;

    master.connect(compressor);
    compressor.connect(ctx.destination);

    // Tom principal do zumbido: dois osciladores levemente desafinados
    const osc1 = ctx.createOscillator();
    osc1.type = "sawtooth";
    osc1.frequency.value = 185;

    const osc2 = ctx.createOscillator();
    osc2.type = "square";
    osc2.frequency.value = 187;

    const osc2Gain = ctx.createGain();
    osc2Gain.gain.value = 0.32;

    const tone = ctx.createGain();
    tone.gain.value = 0.55;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 1500;
    lowpass.Q.value = 0.8;

    const buzz = ctx.createGain();
    buzz.gain.value = 0.5;

    osc1.connect(tone);
    osc2.connect(osc2Gain);
    osc2Gain.connect(tone);
    tone.connect(lowpass);
    lowpass.connect(buzz);

    // Tremulação rápida das asas (modulação de amplitude)
    const flutter = ctx.createOscillator();
    flutter.type = "sine";
    flutter.frequency.value = 26;
    const flutterAmt = ctx.createGain();
    flutterAmt.gain.value = 0.2;
    flutter.connect(flutterAmt);
    flutterAmt.connect(buzz.gain);

    // Vibrato leve para o tom "vivo"
    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = 7.5;
    const vibratoAmt = ctx.createGain();
    vibratoAmt.gain.value = 24;
    vibrato.connect(vibratoAmt);
    vibratoAmt.connect(osc1.frequency);
    vibratoAmt.connect(osc2.frequency);

    // Ruído agudo = sopro das asas
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx);
    noise.loop = true;
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 4300;
    bandpass.Q.value = 1.6;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.05;
    noise.connect(bandpass);
    bandpass.connect(noiseGain);

    // Posição estéreo segue o x da mosca
    const panner =
      typeof ctx.createStereoPanner === "function"
        ? ctx.createStereoPanner()
        : null;

    if (panner) {
      buzz.connect(panner);
      noiseGain.connect(panner);
      panner.connect(master);
    } else {
      buzz.connect(master);
      noiseGain.connect(master);
    }

    [osc1, osc2, vibrato, flutter, noise].forEach((node) => node.start());

    audioRef.current = { ctx, master, osc1, osc2, flutter, panner };

    if (ctx.state === "suspended") void ctx.resume();
  }, []);

  // Libera o áudio no primeiro toque/clique (política dos navegadores)
  useEffect(() => {
    window.addEventListener("pointerdown", ensureAudio);
    window.addEventListener("touchstart", ensureAudio, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", ensureAudio);
      window.removeEventListener("touchstart", ensureAudio);
    };
  }, [ensureAudio]);

  // Voo + áudio
  useEffect(() => {
    const fly = flyRef.current;
    if (!fly) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let x = width * 0.5;
    let y = height * 0.45;
    let vx = 0;
    let vy = 0;
    let targetX = x;
    let targetY = y;
    let angle = 0;
    let elapsed = 0;
    let speed = 0;
    let flapDuration = 0.08;
    let raf = 0;

    const phase = [
      Math.random() * TAU,
      Math.random() * TAU,
      Math.random() * TAU,
      Math.random() * TAU,
    ];

    const pickTarget = () => {
      targetX = PAD + Math.random() * Math.max(1, width - PAD * 2);
      targetY = PAD + Math.random() * Math.max(1, height - PAD * 2);
    };
    pickTarget();

    const updateAudio = (dt: number) => {
      const audio = audioRef.current;
      if (!audio) return;

      const now = audio.ctx.currentTime;
      const speedFactor = Math.min(1, speed / 420);

      exciteRef.current *= Math.exp(-2.6 * dt);

      const volume = mutedRef.current
        ? 0
        : 0.16 + speedFactor * 0.3 + exciteRef.current * 0.35;
      audio.master.gain.setTargetAtTime(volume, now, 0.06);

      const frequency = 160 + speedFactor * 110 + exciteRef.current * 40;
      audio.osc1.frequency.setTargetAtTime(frequency, now, 0.05);
      audio.osc2.frequency.setTargetAtTime(frequency * 1.015 + 2, now, 0.05);
      audio.flutter.frequency.setTargetAtTime(
        16 + speedFactor * 18,
        now,
        0.08,
      );

      if (audio.panner) {
        audio.panner.pan.setTargetAtTime(
          Math.max(-1, Math.min(1, (x / width) * 1.7 - 0.85)),
          now,
          0.05,
        );
      }
    };

    // Clicar na mosca a espanta
    shooRef.current = (clickX, clickY) => {
      const dx = x - clickX;
      const dy = y - clickY;
      const distance = Math.hypot(dx, dy) || 1;
      vx = (dx / distance) * 620;
      vy = (dy / distance) * 620;
      pickTarget();
      exciteRef.current = 1;
    };

    const frame = (now: number) => {
      let dt = (now - elapsed) / 1000;
      elapsed = now;
      if (!(dt > 0)) dt = 0;
      if (dt > 0.05) dt = 0.05;

      // Persegue um ponto aleatório da tela
      const dx = targetX - x;
      const dy = targetY - y;
      const distance = Math.hypot(dx, dy) || 1;
      if (distance < 70) pickTarget();

      let ax = (dx / distance) * 1100;
      let ay = (dy / distance) * 1100;

      // Ruído em várias frequências: o zig-zag característico
      ax +=
        Math.sin(elapsed * 15.3 + phase[0]) * 1500 +
        Math.sin(elapsed * 33.7 + phase[1]) * 800;
      ay +=
        Math.cos(elapsed * 12.1 + phase[2]) * 1500 +
        Math.cos(elapsed * 29.3 + phase[3]) * 800;

      // Arrancadas aleatórias
      if (Math.random() < dt * 0.7) {
        vx += (Math.random() - 0.5) * 1100;
        vy += (Math.random() - 0.5) * 1100;
        if (Math.random() < 0.35) pickTarget();
      }

      vx += ax * dt;
      vy += ay * dt;

      const drag = Math.exp(-2.3 * dt);
      vx *= drag;
      vy *= drag;

      speed = Math.hypot(vx, vy);
      const maxSpeed = 540;
      if (speed > maxSpeed) {
        vx *= maxSpeed / speed;
        vy *= maxSpeed / speed;
        speed = maxSpeed;
      }

      x += vx * dt;
      y += vy * dt;

      // Quica nas bordas
      if (x < PAD) {
        x = PAD;
        vx = Math.abs(vx) * 0.9;
        targetX = Math.max(targetX, PAD + 120);
      } else if (x > width - PAD) {
        x = width - PAD;
        vx = -Math.abs(vx) * 0.9;
        targetX = Math.min(targetX, width - PAD - 120);
      }
      if (y < PAD) {
        y = PAD;
        vy = Math.abs(vy) * 0.9;
        targetY = Math.max(targetY, PAD + 120);
      } else if (y > height - PAD) {
        y = height - PAD;
        vy = -Math.abs(vy) * 0.9;
        targetY = Math.min(targetY, height - PAD - 120);
      }

      // Vira a mosca para a direção do voo (com suavização)
      if (speed > 30) {
        const wantedAngle = (Math.atan2(vy, vx) * 180) / Math.PI + 90;
        const difference = ((wantedAngle - angle + 540) % 360) - 180;
        angle += difference * Math.min(1, dt * 14);
      }

      fly.style.transform = `translate3d(${x - HALF}px, ${y - HALF}px, 0) rotate(${angle}deg)`;

      // Frequência das asas aumenta com a velocidade
      const wantedFlap = Math.max(0.042, 0.1 - speed * 0.0001);
      if (Math.abs(wantedFlap - flapDuration) > 0.004) {
        flapDuration = wantedFlap;
        fly.style.setProperty("--flap", `${flapDuration.toFixed(3)}s`);
      }

      updateAudio(dt);
      raf = requestAnimationFrame(frame);
    };

    const onResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      x = Math.min(Math.max(x, PAD), Math.max(PAD, width - PAD));
      y = Math.min(Math.max(y, PAD), Math.max(PAD, height - PAD));
      pickTarget();
    };

    const onVisibilityChange = () => {
      const audio = audioRef.current;
      if (audio && document.hidden) {
        audio.master.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.05);
      }
    };

    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibilityChange);

    // Posição inicial antes do primeiro frame (evita "piscar" no canto)
    fly.style.transform = `translate3d(${x - HALF}px, ${y - HALF}px, 0)`;
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const toggleMute = () => {
    ensureAudio();
    const nextMuted = !mutedRef.current;
    mutedRef.current = nextMuted;
    setMuted(nextMuted);

    const audio = audioRef.current;
    if (audio) {
      audio.master.gain.setTargetAtTime(
        nextMuted ? 0 : 0.3,
        audio.ctx.currentTime,
        0.08,
      );
    }
  };

  return (
    <>
      <div
        id="fly"
        ref={flyRef}
        aria-hidden="true"
        onPointerDown={(event) => {
          ensureAudio();
          shooRef.current(event.clientX, event.clientY);
        }}
      >
        <svg viewBox="0 0 100 100">
          {/* asas (atrás do corpo) */}
          <g className="wing wing-l">
            <ellipse
              cx="34"
              cy="32"
              rx="20"
              ry="8.5"
              transform="rotate(-38 34 32)"
            />
          </g>
          <g className="wing wing-r">
            <ellipse
              cx="66"
              cy="32"
              rx="20"
              ry="8.5"
              transform="rotate(38 66 32)"
            />
          </g>

          {/* patas */}
          <g
            fill="none"
            stroke="#22282e"
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            <path d="M42 47 L31 55 L26 63" />
            <path d="M44 52 L35 63 L31 72" />
            <path d="M47 55 L43 68 L42 76" />
            <path d="M58 47 L69 55 L74 63" />
            <path d="M56 52 L65 63 L69 72" />
            <path d="M53 55 L57 68 L58 76" />
          </g>

          {/* abdômen */}
          <ellipse cx="50" cy="63" rx="12" ry="17" fill="#33383e" />
          <ellipse
            cx="50"
            cy="63"
            rx="12"
            ry="17"
            fill="none"
            stroke="#1d2126"
            strokeWidth="1.2"
          />
          <path
            d="M39 57 Q50 61 61 57"
            fill="none"
            stroke="#1d2126"
            strokeWidth="1.6"
            opacity=".8"
          />
          <path
            d="M38 66 Q50 70 62 66"
            fill="none"
            stroke="#1d2126"
            strokeWidth="1.6"
            opacity=".6"
          />

          {/* tórax */}
          <ellipse cx="50" cy="44" rx="13" ry="12" fill="#454b52" />
          <ellipse
            cx="50"
            cy="44"
            rx="13"
            ry="12"
            fill="none"
            stroke="#24282d"
            strokeWidth="1.2"
          />
          <path
            d="M37 41 Q50 45 63 41"
            fill="none"
            stroke="#24282d"
            strokeWidth="1.4"
            opacity=".7"
          />

          {/* cabeça e olhos */}
          <circle cx="50" cy="28" r="9" fill="#2c3137" />
          <ellipse cx="45.8" cy="26.5" rx="4.6" ry="5.4" fill="#b8402f" />
          <ellipse cx="54.2" cy="26.5" rx="4.6" ry="5.4" fill="#b8402f" />
          <circle cx="44.4" cy="24.8" r="1.5" fill="#f0b9ae" opacity=".9" />
          <circle cx="52.8" cy="24.8" r="1.5" fill="#f0b9ae" opacity=".9" />
        </svg>
      </div>

      <button
        id="sound"
        type="button"
        className={muted ? "muted" : undefined}
        aria-label="Ligar ou desligar o som"
        onClick={toggleMute}
      >
        {muted ? "🔇 Mudo" : "🔊 Som"}
      </button>

      <div id="hint" className={hintVisible ? undefined : "hidden"}>
        Clique em qualquer lugar para ouvir o zumbido 🪰
      </div>
    </>
  );
}
