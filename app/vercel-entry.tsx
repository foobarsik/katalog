import { createRoot } from "react-dom/client";
import { CatalogClient } from "./CatalogClient";
import "./globals.css";
import { specialists } from "./specialists-data";

createRoot(document.getElementById("root")!).render(
  <CatalogClient specialists={specialists} />,
);
