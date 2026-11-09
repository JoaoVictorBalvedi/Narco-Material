import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { RegistrarPwa } from "@/componentes/registrar-pwa";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Narcóticos Material",
  description: "Inventário, empréstimos, eventos e movimentações do material da Bateria Narcóticos.",
  appleWebApp: { capable: true, title: "Narco Material", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5f3" },
    { media: "(prefers-color-scheme: dark)", color: "#141211" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full">
        <RegistrarPwa />
        {children}
      </body>
    </html>
  );
}
