import { CatalogClient } from "./CatalogClient";
import { specialists } from "./specialists-data";

export default function Home() {
  return <CatalogClient specialists={specialists} />;
}
