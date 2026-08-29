import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solicitações | Lucifer e Lu",
  description: "Gerenciamento simples de solicitações em Kanban",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
