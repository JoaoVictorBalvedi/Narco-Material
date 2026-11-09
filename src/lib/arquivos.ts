import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Arquivos, Bucket } from "@/sistema/portas";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;

const cliente = () =>
  createClient(url, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const PUBLICO: Record<Bucket, boolean> = { fotos: true, comprovantes: false };

export const arquivosSupabase: Arquivos = {
  async guardar(bucket, caminho, arquivo) {
    const storage = cliente().storage;
    const enviar = () =>
      storage.from(bucket).upload(caminho, arquivo.bytes, { contentType: arquivo.tipo, cacheControl: "31536000" });
    let { error } = await enviar();
    // O bucket é criado no primeiro envio, assim não há passo manual ao publicar.
    if (error && /bucket not found/i.test(error.message)) {
      await storage.createBucket(bucket, { public: PUBLICO[bucket] });
      ({ error } = await enviar());
    }
    if (error) throw new Error(`Falha ao guardar arquivo: ${error.message}`);
  },

  async remover(bucket, caminhos) {
    const { error } = await cliente().storage.from(bucket).remove(caminhos);
    if (error) throw new Error(`Falha ao remover arquivo: ${error.message}`);
  },

  urlPublica: (caminho) => `${url}/storage/v1/object/public/fotos/${caminho}`,

  async urlAssinada(caminho) {
    const { data, error } = await cliente().storage.from("comprovantes").createSignedUrl(caminho, 300);
    if (error || !data) throw new Error(`Falha ao abrir comprovante: ${error?.message}`);
    return data.signedUrl;
  },
};
