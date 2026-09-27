import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * CSP básica (sem nonce): scripts e estilos só do próprio app; imagens https (Unsplash,
 * fotos dos protótipos); nenhuma chamada de rede do navegador para terceiros — IA e
 * provedores de dados são chamados só pelo servidor.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https: data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // Microfone só no próprio app (áudio do chat); câmera e localização continuam bloqueadas
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=()" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Dev: abrir também por 127.0.0.1 (útil para testar duas contas lado a lado, cookies separados)
  allowedDevOrigins: ["127.0.0.1"],
  serverExternalPackages: ["pg", "@prisma/adapter-pg", "sharp"],
  // Uploads de imagem (avatar, fotos dos sites) chegam por server action; o cliente já reduz antes de enviar.
  // Vídeo/áudio do chat vão por rota (até 16 MB); o proxy precisa deixar o corpo passar inteiro.
  experimental: { serverActions: { bodySizeLimit: "7mb" }, proxyClientMaxBodySize: "20mb" },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
