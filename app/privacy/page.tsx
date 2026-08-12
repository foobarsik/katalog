import type { Metadata } from "next";
import { PrivacyPolicy } from "../PrivacyPolicy";

export const metadata: Metadata = {
  title: "Політика конфіденційності та RODO · Свої люди рекомендують",
  description: "Правила обробки персональних даних у каталозі «Свої люди рекомендують».",
};

export default function PrivacyPage() {
  return <PrivacyPolicy />;
}

