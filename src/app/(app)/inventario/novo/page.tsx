import { exigirAcao } from "@/lib/sessao";
import { sistema } from "@/lib/sistema";
import { FormularioCadastro } from "./formulario-cadastro";

export const metadata = { title: "Cadastrar | Narcóticos Material" };

export default async function Page() {
  const ator = await exigirAcao("editar_inventario");
  const categorias = await sistema.inventario.categorias.listar(ator.id);
  return (
<FormularioCadastro categorias={categorias} />
  );
}
