"use client";

import { Monitor, Smartphone, Tablet } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { DevicePreview, type Device } from "@/components/prototypes/device-preview";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { SiteSpec } from "@/lib/templates/types";

const NARROW = "(max-width: 639px)";
const subscribeNarrow = (cb: () => void) => {
  const mq = window.matchMedia(NARROW);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** Site de exemplo de um template, inteiro e rolável, em desktop, tablet ou celular. */
export function TemplateViewer({ spec }: { spec: SiteSpec }) {
  // No celular abre já no formato celular (o desktop reduzido a 390 px fica ilegível)
  const narrow = useSyncExternalStore(subscribeNarrow, () => window.matchMedia(NARROW).matches, () => false);
  const [picked, setDevice] = useState<Device | null>(null);
  const device = picked ?? (narrow ? "mobile" : "desktop");
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex justify-center border-b bg-card px-4 py-2">
        <ToggleGroup type="single" variant="outline" size="sm" value={device} onValueChange={(v) => v && setDevice(v as Device)} aria-label="Dispositivo">
          <ToggleGroupItem value="desktop" aria-label="Desktop">
            <Monitor /> <span className="hidden sm:inline">Desktop</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="tablet" aria-label="Tablet">
            <Tablet /> <span className="hidden sm:inline">Tablet</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="mobile" aria-label="Celular">
            <Smartphone /> <span className="hidden sm:inline">Celular</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <DevicePreview spec={spec} device={device} className="min-h-0 flex-1 bg-muted/60" />
    </div>
  );
}
