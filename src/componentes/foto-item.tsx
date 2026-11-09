import { ImageOff } from "lucide-react";
import Image from "next/image";

/** Foto já comprimida no envio: sem otimização, para não gastar a cota da hospedagem. */
export function FotoItem({ url, tamanho = 64 }: { url: string | null; tamanho?: number }) {
  if (!url) {
    return (
      <span style={{ width: tamanho, height: tamanho }} className="flex shrink-0 items-center justify-center rounded-lg bg-fundo text-suave">
        <ImageOff aria-hidden size={20} />
      </span>
    );
  }
  return <Image src={url} alt="" width={tamanho} height={tamanho} unoptimized className="shrink-0 rounded-lg object-cover" style={{ width: tamanho, height: tamanho }} />;
}
