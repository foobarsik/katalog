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
  assert.match(data, /email: string/);
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
  assert.doesNotMatch(data, /Знайдено автоматично за номером телефону/);
  assert.doesNotMatch(data, /Знайдено за номером телефону, але це оголошення у групі/);
  assert.match(client, /item\.sourceInfo/);
  assert.match(client, /item\.sourceInfo \|\| item\.instagramBio/);
  assert.doesNotMatch(client, /item\.sourceInfo \|\| item\.instagramBio \|\| item\.instagramTitle/);
  assert.match(client, /\(\?:https\?:\\\/\\\/\)\?/);
  assert.doesNotMatch(client, /foundAutomatically|confidenceReason/);
  assert.match(client, /З профілю Booksy/);
  assert.match(client, /Інформація із сайту/);
  assert.match(importer, /normalizeComparableText\(importedComment\) === normalizeComparableText\(sourceInfo\)/);
  assert.equal(
    data.match(/OSAMA Sushi, ul\. Gliwicka 113, Katowice\. Актуальна сторінка замовлення веде на філію Gliwicka\./g)
      ?.length,
    1,
  );
});

test("normalizes imported phone numbers to digits with an optional leading plus", async () => {
  const [importer, data] = await Promise.all([
    readFile(new URL("../scripts/import-data.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/specialists-data.ts", import.meta.url), "utf8"),
  ]);

  assert.match(importer, /function normalizePhone\(value\)/);
  assert.match(importer, /phone: normalizePhone\(pick\(row, \["Телефон"\]\)\)/);
  assert.doesNotMatch(data, /"phone": "[^"\r\n]*[ ()-][^"\r\n]*"/);
});

test("marks contacts that still need review", async () => {
  const [importer, data, client] = await Promise.all([
    readFile(new URL("../scripts/import-data.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/specialists-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/CatalogClient.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(importer, /needsReview:/);
  assert.match(importer, /function isDuplicateCatalogRow\(row\)/);
  assert.match(importer, /function isCatalogProblem\(row\)/);
  assert.doesNotMatch(importer, /getSourceQualityWarning|getSourceReviewWarning/);
  assert.doesNotMatch(importer, /confidenceScore < 70/);
  assert.match(importer, /aNameMatch - bNameMatch/);
  assert.match(importer, /activeCatalogRows/);
  assert.match(data, /needsReview: boolean/);
  assert.match(data, /"needsReview": true/);
  assert.match(data, /"id": 118,[\s\S]*?"title": "Приватний дитячий садок"[\s\S]*?"needsReview": true/);
  assert.match(data, /"id": 190,[\s\S]*?"title": "Harmoniya Balans"[\s\S]*?"needsReview": true/);
  assert.match(data, /"id": 19,[\s\S]*"title": "Massage Studio by Iryna Metokhir"/);
  assert.doesNotMatch(data, /"id": 31,[\s\S]*Massage Studio by Iryna Metokhir/);
  assert.doesNotMatch(data, /"id": 77,[\s\S]*Massage Studio by Iryna Metokhir/);
  assert.doesNotMatch(data, /Та сама сторінка Facebook, що й у id 30 та id 91/);
  assert.match(client, /Очікує перевірки/);
  assert.match(client, /needs-review/);
  assert.match(client, /Number\(a\.needsReview\) - Number\(b\.needsReview\)/);
  assert.match(client, /Number\(hasUnconfirmedLocation\(a\)\) - Number\(hasUnconfirmedLocation\(b\)\)/);
  assert.match(client, /Number\(Boolean\(b\.review\)\) - Number\(Boolean\(a\.review\)\)/);
  assert.match(client, /Number\(hasSocialContact\(b\)\) - Number\(hasSocialContact\(a\)\)/);
  assert.match(client, /Number\(hasAvatarImage\(b\)\) - Number\(hasAvatarImage\(a\)\)/);
  assert.match(client, /Number\(Boolean\(b\.website\)\) - Number\(Boolean\(a\.website\)\)/);
  assert.match(client, /Number\(hasConfirmedLocation\(b\)\) - Number\(hasConfirmedLocation\(a\)\)/);
  assert.match(client, /Number\(isInstagramUnavailable\(a\)\) - Number\(isInstagramUnavailable\(b\)\)/);
  assert.match(client, /getLocationRank\(b\) - getLocationRank\(a\)/);
  assert.match(client, /getContactCount\(b\) - getContactCount\(a\)/);
  assert.match(client, /getRank\(b\) - getRank\(a\) \|\|\s+b\.confidenceScore - a\.confidenceScore \|\|\s+getDisplayName/);
});

test("keeps phone lookup results separate from the manual review state", async () => {
  const importer = await readFile(new URL("../scripts/import-data.mjs", import.meta.url), "utf8");
  const client = await readFile(new URL("../app/CatalogClient.tsx", import.meta.url), "utf8");
  const data = await readFile(new URL("../app/specialists-data.ts", import.meta.url), "utf8");

  assert.match(importer, /phoneSearchSource/);
  assert.match(importer, /row\.source_type !== "phonesearch"/);
  assert.match(data, /phoneSearchStatus: string/);
  assert.doesNotMatch(client, /За номером нічого не знайдено/);
  assert.doesNotMatch(client, /PhoneSearchStatus/);
  assert.match(client, /item\.phoneSearchInfo/);
});

test("exposes quick filters from the search bar", async () => {
  const client = await readFile(new URL("../app/CatalogClient.tsx", import.meta.url), "utf8");

  assert.match(client, /aria-label="Відкрити фільтри"/);
  assert.match(client, /Будь-яка вибрана умова/);
  assert.match(client, /Є відгук/);
  assert.match(client, /Є соцмережі/);
  assert.match(client, /function hasSocialContact\(item: Specialist\)/);
  assert.match(client, /isFacebookSocialValue\(item\.social\)/);
  assert.doesNotMatch(client, /hasSocialContact\(item: Specialist\)[\s\S]*getSocialContacts\(item\)\.length/);
  assert.match(client, /availabilityFiltersActive/);
  assert.match(client, /onlySocial && hasSocialContact\(item\)/);
  assert.match(client, /Є сайт/);
  assert.match(client, /onlyWebsite && Boolean\(item\.website\)/);
  assert.match(client, /Є телефон/);
  assert.match(client, /Є контакт/);
  assert.doesNotMatch(client, /Очікують перевірки/);
});

test("uses messenger-specific contact icons", async () => {
  const client = await readFile(new URL("../app/CatalogClient.tsx", import.meta.url), "utf8");
  const importer = await readFile(new URL("../scripts/import-data.mjs", import.meta.url), "utf8");

  assert.match(client, /function getSocialContacts\(item: Specialist\)/);
  assert.match(client, /function ViberIcon\(\)/);
  assert.match(client, /function WhatsAppIcon\(\)/);
  assert.match(client, /function EmailIcon\(\)/);
  assert.match(client, /item\.email/);
  assert.match(client, /mailto:\$\{item\.email\}/);
  assert.match(client, /type === "viber"/);
  assert.match(client, /type === "whatsapp"/);
  assert.match(client, /https:\/\/wa\.me/);
  assert.match(client, /viber:\/\/chat\?number=/);
  assert.match(client, /\(\?:\^\|\[\/\\s\]\)facebook\\s\*:/);
  assert.match(client, /https:\/\/www\.facebook\.com\/\$\{handle\}/);
  assert.match(importer, /return "";/);
  assert.doesNotMatch(importer, /\?:https\?:\\\/\\\/\|mailto:/);
  assert.doesNotMatch(client, /!social \|\| getInstagramUrl\(item\)/);
  assert.match(client, /if \(\/instagram\\\.com\/i\.test\(social\)\) return \[\];/);
});

test("keeps punctuation out of generated avatar initials", async () => {
  const client = await readFile(new URL("../app/CatalogClient.tsx", import.meta.url), "utf8");
  const data = await readFile(new URL("../app/specialists-data.ts", import.meta.url), "utf8");

  assert.match(client, /\.split\(\/\[\^\\p\{L\}\\p\{N\}\]\+\/u\)/);
  assert.match(data, /"title": "Хірург \(Сосновець\)"/);
});

test("uses the corrected Instagram profile for Olena Lahutina", async () => {
  const data = await readFile(new URL("../app/specialists-data.ts", import.meta.url), "utf8");

  assert.match(data, /"id": 132,[\s\S]*?"social": "Instagram: @olena_travel\.pl"/);
  assert.match(data, /"id": 132,[\s\S]*?"sourceUrl": "https:\/\/www\.instagram\.com\/olena_travel\.pl\/"/);
  assert.doesNotMatch(data, /"id": 132,[\s\S]*?instagram\.com\/olenalahutina/);
});

test("uses the updated electrician contacts and details", async () => {
  const data = await readFile(new URL("../app/specialists-data.ts", import.meta.url), "utf8");

  assert.match(data, /"id": 271,[\s\S]*?"phone": "\+48539423524"/);
  assert.match(data, /"id": 271,[\s\S]*?"social": "Viber: \+48539423524"/);
  assert.match(data, /"id": 271,[\s\S]*?Telegram: \+48668567920/);
  assert.match(data, /"id": 271,[\s\S]*?"needsReview": false/);
});

test("uses Angela's provided Instagram profile", async () => {
  const data = await readFile(new URL("../app/specialists-data.ts", import.meta.url), "utf8");

  assert.match(data, /"id": 270,[\s\S]*?"social": "Instagram: @angelayatsenko"/);
  assert.match(data, /"id": 270,[\s\S]*?"sourceUrl": "https:\/\/www\.instagram\.com\/angelayatsenko\/"/);
  assert.match(data, /"id": 270,[\s\S]*?"needsReview": false/);
});

test("collapses only long details on catalog previews", async () => {
  const [client, styles] = await Promise.all([
    readFile(new URL("../app/CatalogClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(client, /const hasLongDetails = item\.comment\.length > 280/);
  assert.match(client, /detailsExpanded \? "Згорнути" : "Показати більше"/);
  assert.match(client, /aria-expanded=\{detailsExpanded\}/);
  assert.match(styles, /\.card-details \.details-text\.collapsed/);
  assert.match(styles, /-webkit-line-clamp: 5/);
  assert.doesNotMatch(client, /className="panel-body"[\s\S]{0,500}details-text collapsed/);
});
