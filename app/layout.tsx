import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Em Construção | TabNews",
  description:
    "Estamos reconstruindo o TabNews, um lugar na internet para quem trabalha com tecnologia e precisa consumir conteúdos com valor concreto.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
