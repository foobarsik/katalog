import type { Metadata } from "next";
import { Golos_Text, Fira_Sans_Extra_Condensed, Caveat } from "next/font/google";
import "./globals.css";

const golosText = Golos_Text({
  variable: "--font-golos",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const signage = Fira_Sans_Extra_Condensed({
  variable: "--font-shoulders",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  weight: ["700", "800", "900"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  weight: ["500", "600", "700"],
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
        className={`${golosText.variable} ${signage.variable} ${caveat.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
