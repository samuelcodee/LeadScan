"use server";

import { z } from "zod";
import { action } from "@/lib/action";
import { fileToBuffer, mediaUrl, saveImage } from "@/lib/media/store";

/** Foto enviada pelo usuário para um protótipo (fachada, equipe, produtos do cliente). */
export const uploadSiteImage = action({ schema: z.instanceof(FormData), limit: "upload", name: "uploadSiteImage" }, async (form, user) => {
  const input = await fileToBuffer(form.get("file"));
  const media = await saveImage({ userId: user.id, kind: "SITE_IMAGE", input });
  return { url: mediaUrl(media.id), unverified: media.moderation === "UNVERIFIED" };
});
