import type { Metadata } from "next";
import { Golos_Text } from "next/font/google";
import "./globals.css";

const golosText = Golos_Text({
  variable: "--font-golos",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  weight: ["400", "500", "600", "700", "800", "900"],
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
        className={`${golosText.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
