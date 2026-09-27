"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { action, idSchema } from "@/lib/action";
import { deleteFile, renameFile } from "@/lib/media/files";

export const renameFileAction = action({ name: "renameFile", schema: z.object({ id: idSchema, name: z.string().max(120) }) }, async ({ id, name }, user) => {
  await renameFile(user.id, id, name);
  refresh();
  return { ok: true };
});

/** Apagar de vez (foto usada num protótipo some de lá também). */
export const deleteFileAction = action({ name: "deleteFile", schema: z.object({ id: idSchema }) }, async ({ id }, user) => {
  await deleteFile(user.id, id);
  refresh();
  return { ok: true };
});
