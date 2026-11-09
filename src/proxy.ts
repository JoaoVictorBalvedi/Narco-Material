import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Só renova a sessão. Quem pode acessar o quê é decidido nas páginas e operações. */
export async function proxy(request: NextRequest) {
  let resposta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(novos, cabecalhos) {
          novos.forEach(({ name, value }) => request.cookies.set(name, value));
          resposta = NextResponse.next({ request });
          novos.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options));
          Object.entries(cabecalhos ?? {}).forEach(([nome, valor]) =>
            resposta.headers.set(nome, valor),
          );
        },
      },
    },
  );

  await supabase.auth.getUser();
  return resposta;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icones|logo|icon.png|apple-icon.png|manifest|sw.js).*)"],
};
