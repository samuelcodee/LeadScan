/** Tipo real pelo conteúdo (assinatura do arquivo), nunca pelo nome ou pelo que o navegador diz. */
export function sniffAv(buf: Buffer, want: "audio" | "video"): string | null {
  const ascii = (a: number, b: number) => buf.subarray(a, b).toString("latin1");
  if (buf.length < 12) return null;
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return `${want}/webm`;
  if (ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12);
    if (brand.startsWith("qt")) return want === "video" ? "video/quicktime" : null;
    if (brand.startsWith("3g")) return `${want}/3gpp`;
    return `${want}/mp4`;
  }
  if (want === "audio") {
    if (ascii(0, 4) === "OggS") return "audio/ogg";
    if (ascii(0, 3) === "ID3" || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return "audio/mpeg";
    if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") return "audio/wav";
  }
  return null;
}
