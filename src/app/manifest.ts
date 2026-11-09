import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Narcóticos Material",
    short_name: "Narco Material",
    description: "Material da Bateria Narcóticos no seu celular.",
    lang: "pt-BR",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f5f3",
    theme_color: "#a92b1f",
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icones/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
