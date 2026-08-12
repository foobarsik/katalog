import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps OLX books out of the main catalog view", async () => {
  const client = await readFile(new URL("../app/CatalogClient.tsx", import.meta.url), "utf8");

  assert.match(client, /category === ALL\s*\? !isBookItem\(item\)/);
  assert.match(client, /specialists\.filter\(\(item\) => !isBookItem\(item\)\)\.length/);
  assert.match(client, /category === ALL && isBookItem\(item\)/);
  assert.match(client, /name === ALL \? mainCatalogCount/);
});
