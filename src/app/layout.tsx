import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bbodong",
  description: "A shared weekly buffer app for newly married dual-income couples.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
