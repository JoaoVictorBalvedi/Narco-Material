import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function criarClienteSupabase() {
  const loja = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => loja.getAll(),
        setAll(novos) {
          try {
            novos.forEach(({ name, value, options }) => loja.set(name, value, options));
          } catch {
            // Páginas não gravam cookies; a sessão é renovada no proxy.
          }
        },
      },
    },
  );
}
