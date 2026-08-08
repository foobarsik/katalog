import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Каталог спеціалістів у Катовіце",
  description:
    "Український каталог рекомендованих спеціалістів, сервісів і закладів у Катовіце.",
  openGraph: {
    title: "Каталог спеціалістів у Катовіце",
    description:
      "Локальний каталог спеціалістів, сервісів і закладів, доповнений Instagram-даними для швидкого пошуку.",
    locale: "uk_UA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Каталог спеціалістів у Катовіце",
    description:
      "Український каталог спеціалістів, сервісів і закладів у Катовіце.",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
