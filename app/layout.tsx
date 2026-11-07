import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mosca Voadora",
  description: "Uma mosca voando pela tela com zumbido sintetizado.",
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
