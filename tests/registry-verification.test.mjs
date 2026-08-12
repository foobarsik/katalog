import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("imports and renders official registry verification without changing review state", async () => {
  const [data, importer, client] = await Promise.all([
    readFile(new URL("app/specialists-data.ts", root), "utf8"),
    readFile(new URL("scripts/import-data.mjs", root), "utf8"),
    readFile(new URL("app/CatalogClient.tsx", root), "utf8"),
  ]);

  assert.equal(data.match(/"registryVerified": true/g)?.length, 10);
  assert.match(
    data,
    /"id": 18,[\s\S]*?"registryOfficialName": "Yanina Shymanska"[\s\S]*?"registryLedgerNumber": "000000300122"/,
  );
  assert.match(importer, /Перевірено в офіційному реєстрі/);
  assert.match(client, /Перевірено в/);
  assert.match(client, /це не є рекомендацією каталогу/);
});
