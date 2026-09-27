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

/** Quadro do vídeo (para a capa moderada) + duração, lidos no próprio navegador. */
export async function readVideo(file: File): Promise<{ poster: Blob; durationMs: number }> {
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = url;
    await new Promise<void>((res, rej) => {
      v.onloadeddata = () => res();
      v.onerror = () => rej(new Error("vídeo ilegível"));
      setTimeout(() => rej(new Error("tempo esgotado")), 12_000);
    });
    const at = Math.min(1, (v.duration || 0) / 3);
    if (at > 0) {
      v.currentTime = at;
      await new Promise<void>((res) => {
        v.onseeked = () => res();
        setTimeout(res, 1500);
      });
    }
    const scale = Math.min(1, 720 / Math.max(v.videoWidth || 1, v.videoHeight || 1));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(64, Math.round((v.videoWidth || 640) * scale));
    canvas.height = Math.max(64, Math.round((v.videoHeight || 360) * scale));
    canvas.getContext("2d")?.drawImage(v, 0, 0, canvas.width, canvas.height);
    const poster = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.8));
    if (!poster) throw new Error("sem quadro");
    return { poster, durationMs: Math.round((v.duration || 0) * 1000) };
  } finally {
    URL.revokeObjectURL(url);
  }
}
