export type Relogio = { agora(): Date };

export const relogioReal: Relogio = { agora: () => new Date() };

export type Aviso = {
  destinatarioId: string;
  tipo: string;
  titulo: string;
  corpo: string;
  link?: string;
};

/** Envio externo do aviso, como o push. O registro no app é feito pelo sistema. */
export type Notificador = { enviar(avisos: Aviso[]): Promise<void> };

/** O push real entra na etapa de publicação. */
export const notificadorInativo: Notificador = { enviar: async () => {} };

export type Bucket = "fotos" | "comprovantes";

export type ArquivoEnviado = { bytes: Uint8Array; tipo: string };

/** Armazenamento de arquivos. Fotos são públicas; comprovantes só saem por link assinado. */
export type Arquivos = {
  guardar(bucket: Bucket, caminho: string, arquivo: ArquivoEnviado): Promise<void>;
  remover(bucket: Bucket, caminhos: string[]): Promise<void>;
  urlPublica(caminho: string): string;
  urlAssinada(caminho: string): Promise<string>;
};
