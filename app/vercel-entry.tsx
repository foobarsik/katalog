import { createRoot } from "react-dom/client";
import { CatalogClient } from "./CatalogClient";
import "./globals.css";
import { PrivacyPolicy } from "./PrivacyPolicy";
import { specialists } from "./specialists-data";

const isPrivacyPage = window.location.pathname.replace(/\/$/, "") === "/privacy";

if (isPrivacyPage) {
  document.title = "Політика конфіденційності та RODO · Свої люди рекомендують";
}

createRoot(document.getElementById("root")!).render(
  isPrivacyPage ? <PrivacyPolicy /> : <CatalogClient specialists={specialists} />,
);
