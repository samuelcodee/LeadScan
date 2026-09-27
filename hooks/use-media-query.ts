"use client";

import { useSyncExternalStore } from "react";

/** Media query reativa. No servidor assume "false" (layout mobile-first, sem flash de conteúdo quebrado). */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
