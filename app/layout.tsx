import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solicitações | Lucifer e Lu",
  description: "Gerenciamento simples de solicitações em Kanban",
  icons: { icon: [{ url: "/favicon.ico" }, { url: "/angel-a.png", type: "image/png" }] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
