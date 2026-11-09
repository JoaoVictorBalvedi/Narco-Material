import { NextResponse, type NextRequest } from "next/server";
import { criarClienteSupabase } from "@/lib/supabase/servidor";

/** Retorno do login com Google e dos links enviados por e-mail. */
export async function GET(request: NextRequest) {
  const codigo = request.nextUrl.searchParams.get("code");
  if (codigo) {
    const supabase = await criarClienteSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (!error) return NextResponse.redirect(new URL("/inicio", request.url));
  }
  return NextResponse.redirect(new URL("/entrar?erro=login", request.url));
}
