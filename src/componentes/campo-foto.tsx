"use client";

import { Camera } from "lucide-react";
import { useState } from "react";

const LADO_MAXIMO = 1280;
const QUALIDADE = 0.75;

/** Reduz a foto no próprio celular, para o envio ser rápido e o espaço gratuito durar. */
async function comprimir(original: File): Promise<File> {
  const imagem = await createImageBitmap(original, { imageOrientation: "from-image" });
  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagem.width, imagem.height));
  const tela = document.createElement("canvas");
  tela.width = Math.round(imagem.width * escala);
  tela.height = Math.round(imagem.height * escala);
  const contexto = tela.getContext("2d");
  if (!contexto) throw new Error("Não foi possível comprimir");
  // JPEG não tem transparência: sem o fundo branco, ela vira preto.
  contexto.fillStyle = "#ffffff";
  contexto.fillRect(0, 0, tela.width, tela.height);
  contexto.drawImage(imagem, 0, 0, tela.width, tela.height);
  imagem.close();
  const blob = await new Promise<Blob | null>((ok) => tela.toBlob(ok, "image/jpeg", QUALIDADE));
  if (!blob) throw new Error("Não foi possível comprimir");
  return new File([blob], "foto.jpg", { type: "image/jpeg" });
}

export function CampoFoto({ name = "foto", rotulo = "Foto", obrigatorio = true }: { name?: string; rotulo?: string; obrigatorio?: boolean }) {
  const [previa, setPrevia] = useState<string | null>(null);
  const [situacao, setSituacao] = useState("");

  async function aoEscolher(evento: React.ChangeEvent<HTMLInputElement>) {
    const campo = evento.currentTarget;
    const escolhido = campo.files?.[0];
    if (!escolhido) return;
    setSituacao("Preparando a foto…");
    try {
      const pronta = await comprimir(escolhido);
      const transferencia = new DataTransfer();
      transferencia.items.add(pronta);
      campo.files = transferencia.files;
      setPrevia((anterior) => {
        if (anterior) URL.revokeObjectURL(anterior);
        return URL.createObjectURL(pronta);
      });
      setSituacao("");
    } catch {
      // Formato que o navegador não abre: o servidor aceita ou recusa o original.
      setSituacao("Não consegui preparar essa foto. Se o envio falhar, tente outra.");
    }
  }

  return (
    <div>
      <p className="rotulo text-base font-semibold">{rotulo}</p>
      <label htmlFor={name} className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-borda bg-superficie p-3 text-center has-[input:focus-visible]:border-marca">
        {previa ? (
          // eslint-disable-next-line @next/next/no-img-element -- prévia local, sem otimização
          <img src={previa} alt="Prévia da foto escolhida" className="h-32 w-32 rounded-lg object-cover" />
        ) : (
          <Camera aria-hidden size={28} className="text-marca" />
        )}
        <span className="text-sm font-semibold text-marca">{previa ? "Trocar foto" : "Tirar ou escolher foto"}</span>
        <input id={name} name={name} type="file" accept="image/*" required={obrigatorio} onChange={aoEscolher} className="sr-only" />
      </label>
      {situacao && <p role="status" className="mt-1 text-xs text-suave">{situacao}</p>}
    </div>
  );
}
