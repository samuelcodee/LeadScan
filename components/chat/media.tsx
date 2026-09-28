"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/* eslint-disable @next/next/no-img-element -- mídia privada servida por /api/chat/media (com checagem de membro) */

export const chatMediaUrl = (id: string) => `/api/chat/media/${id}`;

export function fmtDuration(ms: number | null | undefined) {
  if (!ms || !Number.isFinite(ms)) return "0:00";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Foto com espaço reservado (proporção real) para a conversa não pular ao carregar. */
export function ChatImage({ src, width, height, onOpen }: { src: string; width: number | null; height: number | null; onOpen?: () => void }) {
  const ratio = width && height ? width / height : 4 / 3;
  const w = Math.min(260, ratio >= 1 ? 260 : Math.round(260 * ratio));
  return (
    <button type="button" onClick={onOpen} className="block overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label="Ver foto">
      <img src={src} alt="Foto enviada na conversa" width={width ?? undefined} height={height ?? undefined} loading="lazy" decoding="async" className="block h-auto max-h-80 bg-muted object-cover" style={{ width: w, aspectRatio: String(ratio) }} />
    </button>
  );
}

/**
 * Player de áudio compacto. A duração vem da mensagem: áudio gravado no navegador
 * (WebM) muitas vezes não informa a própria duração até tocar inteiro.
 */
export function AudioPlayer({ src, durationMs, mine }: { src: string; durationMs: number | null; mine: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [realDur, setRealDur] = useState(0);
  const total = (durationMs ?? 0) / 1000;

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const onTime = () => setPos(a.currentTime);
    const onEnd = () => {
      setPlaying(false);
      setPos(0);
    };
    const onPause = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    const onDur = () => Number.isFinite(a.duration) && a.duration > 0 && setRealDur(a.duration);
    a.addEventListener("durationchange", onDur);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    a.addEventListener("pause", onPause);
    a.addEventListener("play", onPlay);
    return () => {
      a.removeEventListener("durationchange", onDur);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("play", onPlay);
    };
  }, []);

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) {
      // Um áudio por vez na tela
      document.querySelectorAll<HTMLAudioElement>("audio[data-chat-audio]").forEach((x) => x !== a && x.pause());
      void a.play().catch(() => {});
    } else a.pause();
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audio.current;
    const dur = Number.isFinite(a?.duration) && a!.duration > 0 ? a!.duration : total;
    if (!a || !dur) return;
    const r = e.currentTarget.getBoundingClientRect();
    a.currentTime = Math.max(0, Math.min(dur, ((e.clientX - r.left) / r.width) * dur));
  };

  const dur = total || realDur;
  const pct = dur ? Math.min(100, (pos / dur) * 100) : 0;

  return (
    <div className="flex w-56 items-center gap-2.5 py-0.5">
      <audio ref={audio} src={src} preload="none" data-chat-audio />
      <button
        type="button"
        onClick={toggle}
        className={cn("grid size-9 shrink-0 place-items-center rounded-full transition-colors duration-150", mine ? "bg-lime text-ink" : "bg-ink text-white dark:bg-lime dark:text-ink")}
        aria-label={playing ? "Pausar áudio" : "Tocar áudio"}
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="relative h-1.5 cursor-pointer rounded-full bg-current/20" onClick={seek} role="presentation">
          <div className={cn("absolute inset-y-0 left-0 rounded-full", mine ? "bg-lime" : "bg-current")} style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-[11px] opacity-70 tabular">{playing || pos ? fmtDuration(pos * 1000) : fmtDuration(durationMs)}</p>
      </div>
    </div>
  );
}

/** Espera um evento do vídeo (ou desiste depois de ms). */
function waitFor(v: HTMLVideoElement, events: string[], ms: number) {
  return new Promise<boolean>((resolve) => {
    const done = (ok: boolean) => {
      clearTimeout(t);
      events.forEach((e) => v.removeEventListener(e, onOk));
      v.removeEventListener("error", onErr);
      resolve(ok);
    };
    const onOk = () => done(true);
    const onErr = () => done(false);
    const t = setTimeout(() => done(false), ms);
    events.forEach((e) => v.addEventListener(e, onOk, { once: true }));
    v.addEventListener("error", onErr, { once: true });
  });
}

/** Capa neutra (quadro escuro com o símbolo de play) quando o navegador não consegue tirar um quadro. */
async function fallbackPoster(): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = 360;
  const g = c.getContext("2d")!;
  g.fillStyle = "#111518";
  g.fillRect(0, 0, 640, 360);
  g.fillStyle = "#EFFF00";
  g.beginPath();
  g.moveTo(290, 140);
  g.lineTo(290, 220);
  g.lineTo(360, 180);
  g.closePath();
  g.fill();
  return new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("sem capa"))), "image/jpeg", 0.85));
}

/**
 * Quadro do vídeo (para a capa moderada) + duração, lidos no próprio navegador.
 * iPhone não carrega o quadro sem "tocar": pedimos só os metadados, pulamos para ~0,1 s e
 * esperamos o quadro aparecer. Vídeo que o navegador não decodifica (ex.: HEVC no Chrome do
 * Windows) ainda sobe, com uma capa neutra — a capa nunca impede o envio.
 */
export async function readVideo(file: Blob): Promise<{ poster: Blob; durationMs: number }> {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  try {
    v.muted = true;
    v.playsInline = true;
    v.setAttribute("playsinline", "");
    v.preload = "metadata";
    v.src = url;
    const meta = await waitFor(v, ["loadedmetadata"], 8_000);
    const durationMs = meta && Number.isFinite(v.duration) ? Math.round(v.duration * 1000) : 0;
    if (!meta || !v.videoWidth) return { poster: await fallbackPoster(), durationMs };
    v.currentTime = Math.min(1, (v.duration || 0) / 3) || 0.1;
    await waitFor(v, ["seeked", "loadeddata"], 3_000);
    const scale = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(64, Math.round(v.videoWidth * scale));
    canvas.height = Math.max(64, Math.round(v.videoHeight * scale));
    try {
      canvas.getContext("2d")?.drawImage(v, 0, 0, canvas.width, canvas.height);
    } catch {
      return { poster: await fallbackPoster(), durationMs };
    }
    const poster = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.8));
    return { poster: poster ?? (await fallbackPoster()), durationMs };
  } finally {
    v.removeAttribute("src");
    v.load();
    URL.revokeObjectURL(url);
  }
}

/**
 * Compacta um vídeo grande no próprio aparelho: toca em silêncio, redesenha num canvas menor
 * (até 854 px no lado maior) e grava com MediaRecorder (~1 Mbit/s). Leva o tempo do vídeo.
 * O áudio vem por Web Audio (sem tocar no alto-falante); se o navegador não deixar, sai sem som.
 * null = o navegador não sabe gravar vídeo (a tela avisa).
 */
export async function compressVideo(file: File, onProgress: (p: number) => void): Promise<Blob | null> {
  if (typeof MediaRecorder === "undefined" || typeof HTMLCanvasElement.prototype.captureStream !== "function") return null;
  const type = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t));
  if (!type) return null;
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.src = url;
  v.playsInline = true;
  v.setAttribute("playsinline", "");
  v.preload = "auto";
  let audioCtx: AudioContext | null = null;
  try {
    if (!(await waitFor(v, ["loadedmetadata"], 10_000)) || !v.videoWidth) return null;
    const scale = Math.min(1, 854 / Math.max(v.videoWidth, v.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round((v.videoWidth * scale) / 2) * 2;
    canvas.height = Math.round((v.videoHeight * scale) / 2) * 2;
    const g = canvas.getContext("2d")!;
    const stream = canvas.captureStream(30);
    try {
      audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();
      audioCtx.createMediaElementSource(v).connect(dest);
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      await audioCtx.resume().catch(() => {});
    } catch {
      v.muted = true; // sem Web Audio: vídeo sem som, melhor que não enviar
    }
    const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 1_000_000, audioBitsPerSecond: 96_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const stopped = new Promise<void>((res) => (rec.onstop = () => res()));
    let raf = 0;
    const draw = () => {
      g.drawImage(v, 0, 0, canvas.width, canvas.height);
      if (v.duration) onProgress(Math.min(0.99, v.currentTime / v.duration));
      if (!v.ended) raf = requestAnimationFrame(draw);
    };
    rec.start(1000);
    await v.play();
    draw();
    await waitFor(v, ["ended"], Math.max(15_000, (v.duration || 0) * 1000 * 1.6 + 10_000));
    cancelAnimationFrame(raf);
    rec.stop();
    await stopped;
    onProgress(1);
    const out = new Blob(chunks, { type: type.split(";")[0] });
    return out.size ? out : null;
  } catch {
    return null;
  } finally {
    v.pause();
    v.removeAttribute("src");
    v.load();
    URL.revokeObjectURL(url);
    await audioCtx?.close().catch(() => {});
  }
}
