"use server";

import { revalidatePath } from "next/cache";
import { atorAtual } from "@/lib/sessao";
import { sistema } from "@/lib/sistema";

export async function marcarLidos() {
  const ator = await atorAtual();
  await sistema.avisos.marcarTodosLidos(ator.id);
  revalidatePath("/", "layout");
}
