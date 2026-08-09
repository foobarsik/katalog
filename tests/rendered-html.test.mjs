import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Ukrainian catalog shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="uk">/i);
  assert.match(html, /<title>Каталог спеціалістів у Катовіце<\/title>/i);
  assert.match(html, /CatalogClient-/);
  assert.match(html, /Український каталог рекомендованих спеціалістів/);
  assert.doesNotMatch(html, /codex-preview|Building your site|react-loading-skeleton/i);
});

test("keeps location classification in the importer, data, and UI", async () => {
  const [importer, data, client, packageJson] = await Promise.all([
    readFile(new URL("../scripts/import-data.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/specialists-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/CatalogClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(packageJson, /"import-data": "node scripts\/import-data\.mjs"/);
  assert.match(importer, /function inferLocationFromCities\(value\)/);
  assert.match(importer, /Міста з опису джерела/);
  assert.doesNotMatch(importer, /inferLocation\(\[source\?\.name, sourceInfo\]\)/);
  assert.match(importer, /locationStatus: "confirmed"/);
  assert.match(importer, /locationStatus: "unconfirmed"/);
  assert.match(importer, /locationStatus: "unknown"/);
  assert.match(data, /locationStatus: "confirmed" \| "unknown" \| "unconfirmed"/);
  assert.match(data, /"locationStatus": "confirmed"/);
  assert.match(data, /"locationStatus": "unknown"/);
  assert.match(data, /"locationStatus": "unconfirmed"/);
  assert.match(client, /item\.locationEvidence/);
  assert.doesNotMatch(client, /Локація: /);
  assert.doesNotMatch(client, /Локація підтверджена/);
  assert.doesNotMatch(client, /Локація не підтверджена/);
  assert.doesNotMatch(client, /Локація не вказана/);
});

test("imports profile details from the combined sources file", async () => {
  const [importer, data, client] = await Promise.all([
    readFile(new URL("../scripts/import-data.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/specialists-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/CatalogClient.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(importer, /all_sources_results_ua\.csv/);
  assert.match(importer, /function selectSource\(rows, contacts\)/);
  assert.match(importer, /function sourceMatchesCatalog\(row/);
  assert.match(data, /sourceType: string/);
  assert.match(data, /sourceInfo: string/);
  assert.match(data, /foundAutomatically: boolean/);
  assert.match(data, /confidenceScore: number/);
  assert.match(data, /confidenceReason: string/);
  assert.match(data, /"foundAutomatically": true/);
  assert.match(data, /"confidenceScore": 100/);
  assert.match(data, /"confidenceReason": "Точний/);
  assert.match(data, /"sourceType": "(?:instagram|booksy|website|facebook|telegram)"/);
  assert.doesNotMatch(data, /Подписчики\s*:/i);
  assert.doesNotMatch(data, /Знайдено автоматично через веб-пошук/);
  assert.match(client, /item\.sourceInfo/);
  assert.doesNotMatch(client, /foundAutomatically/);
  assert.doesNotMatch(client, /confidenceScore|confidenceReason/);
  assert.match(client, /З профілю Booksy/);
  assert.match(client, /Інформація із сайту/);
});

test("marks contacts that still need review", async () => {
  const [importer, data, client] = await Promise.all([
    readFile(new URL("../scripts/import-data.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/specialists-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/CatalogClient.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(importer, /needsReview:/);
  assert.match(data, /needsReview: boolean/);
  assert.match(data, /"needsReview": true/);
  assert.match(client, /Очікує нашої перевірки/);
  assert.match(client, /needs-review/);
  assert.match(client, /Number\(a\.needsReview\) - Number\(b\.needsReview\)/);
  assert.match(client, /Number\(isInstagramUnavailable\(a\)\) - Number\(isInstagramUnavailable\(b\)\)/);
  assert.match(client, /Number\(hasUnconfirmedLocation\(a\)\) - Number\(hasUnconfirmedLocation\(b\)\)/);
  assert.match(client, /Number\(Boolean\(item\.review\)\) \* 32/);
  assert.match(client, /Number\(Boolean\(getInstagramUrl\(item\)\)\) \* 16/);
  assert.match(client, /getLocationRank\(b\) - getLocationRank\(a\)/);
});

test("exposes quick filters from the search bar", async () => {
  const client = await readFile(new URL("../app/CatalogClient.tsx", import.meta.url), "utf8");

  assert.match(client, /aria-label="Відкрити фільтри"/);
  assert.match(client, /Є відгук/);
  assert.match(client, /Є Instagram/);
  assert.match(client, /Є телефон/);
  assert.match(client, /Є контакт/);
  assert.doesNotMatch(client, /Очікують перевірки/);
});

test("uses messenger-specific contact icons", async () => {
  const client = await readFile(new URL("../app/CatalogClient.tsx", import.meta.url), "utf8");

  assert.match(client, /function getSocialContacts\(item: Specialist\)/);
  assert.match(client, /function ViberIcon\(\)/);
  assert.match(client, /function WhatsAppIcon\(\)/);
  assert.match(client, /type === "viber"/);
  assert.match(client, /type === "whatsapp"/);
  assert.match(client, /https:\/\/wa\.me/);
  assert.match(client, /viber:\/\/chat\?number=/);
});
