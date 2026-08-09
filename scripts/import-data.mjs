import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const sourceRoot = resolve(projectRoot, "..");

const catalogPath = resolve(process.env.CATALOG_CSV || join(sourceRoot, "каталог_специалистов.csv"));
const sourcesPath = resolve(process.env.ALL_SOURCES_CSV || join(sourceRoot, "all_sources_results_ua.csv"));
const publicAvatarsDir = resolve(projectRoot, "public", "avatars");
const outputPath = resolve(projectRoot, "app", "specialists-data.ts");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (char === "\"" && next === "\"") {
        value += "\"";
        i += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  const [headers = [], ...records] = rows;
  return records
    .filter((record) => record.some((cell) => cell.trim()))
    .map((record) =>
      Object.fromEntries(headers.map((header, index) => [header.replace(/^\uFEFF/, ""), record[index] || ""])),
    );
}

function readCsv(path, required = true) {
  if (!existsSync(path)) {
    if (required) throw new Error(`CSV file not found: ${path}`);
    return [];
  }
  return parseCsv(readFileSync(path, "utf8"));
}

function instagramUsername(value) {
  const text = (value || "").trim();
  const urlMatch = text.match(/instagram\.com\/([^/?#\s]+)/i);
  if (urlMatch) return urlMatch[1].replace(/\/$/, "").toLowerCase();

  const labeledMatch = text.match(/instagram(?:\/facebook)?\s*:\s*@?([a-z0-9._]+)/i);
  return labeledMatch?.[1]?.toLowerCase() || "";
}

function telegramUsername(value) {
  const text = (value || "").trim();
  const urlMatch = text.match(/t\.me\/([a-z0-9_]+)/i);
  if (urlMatch) return urlMatch[1].toLowerCase();

  const labeledMatch = text.match(/telegram\s*:\s*@?([a-z0-9_]+)/i);
  return labeledMatch?.[1]?.toLowerCase() || "";
}

function normalizeUrl(url) {
  const cleaned = (url || "").trim();
  if (!cleaned) return "";
  return /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
}

const acceptedLocations = [
  ["Katowice", /katowic|катов[іи]ц/u],
  ["Kraków", /krakow|крак[іо]в/u],
  ["Sosnowiec", /sosnowiec|сосновец|сосновець/u],
  ["Gliwice", /gliwic|гл[іи]в[іи]ц/u],
  ["Tychy", /\btychy\b|тихи/u],
  ["Mikołów", /mikolow|м[іи]кол[ув]в/u],
  ["Bytom", /\bbytom\b|битом/u],
  ["Ruda Śląska", /ruda slaska|руда сл[еє]нска/u],
  ["Chorzów", /chorzow|хожув|хоржув/u],
  ["Zabrze", /\bzabrze\b|забже/u],
  ["Mysłowice", /myslowic|мисловиц/u],
  ["Siemianowice Śląskie", /siemianowic|семяновиц/u],
  ["Dąbrowa Górnicza", /dabrowa gornicza|домброва гурнича/u],
  ["Czeladź", /czeladz|челядз/u],
  ["Będzin", /bedzin|бендзин/u],
  ["Piekary Śląskie", /piekary slaskie|пекари сл[еє]нске/u],
  ["Świętochłowice", /swietochlowic|свентохловиц/u],
  ["Jaworzno", /jaworzno|явожно/u],
  ["Tarnowskie Góry", /tarnowskie gory|тарновске гуры/u],
];

const distantLocations = [
  ["Warszawa", /warszaw|warsaw|варшав/u],
  ["Łódź", /\blodz\b|лодз/u],
  ["Wrocław", /wroclaw|вроцлав/u],
  ["Poznań", /poznan|познан/u],
  ["Gdańsk", /gdansk|гданьск/u],
  ["Lublin", /\blublin\b|люблін|люблин/u],
  ["Rzeszów", /rzeszow|жешув/u],
  ["Opole", /\bopole\b|ополе/u],
  ["Bielsko-Biała", /bielsko[ -]biala|бельско[ -]бяла/u],
  ["Lviv", /\blviv\b|\blwow\b|льв[іи]в|львов/u],
  ["Kyiv", /\bkyiv\b|\bkiev\b|ки[їе]в/u],
  ["Odesa", /odesa|odessa|одес[аы]/u],
  ["Kharkiv", /kharkiv|kharkov|харк[іи]в|харьков/u],
  ["Dnipro", /\bdnipro\b|дн[іи]про/u],
  ["Chernihiv", /chernihiv|chernigov|черн[іи]г[іо]в/u],
  ["Kryvyi Rih", /kryvyi rih|кривий р[іи]г|кривой рог/u],
  ["Manila", /manila|ман[іи]ла/u],
];

function normalizeLocationText(parts) {
  return parts
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("uk-UA");
}

function inferLocation(parts) {
  const text = normalizeLocationText(parts);
  const accepted = acceptedLocations.find(([, pattern]) => pattern.test(text));
  if (accepted) return { locationStatus: "confirmed", locationEvidence: accepted[0] };

  const distant = distantLocations.find(([, pattern]) => pattern.test(text));
  if (distant) return { locationStatus: "unconfirmed", locationEvidence: distant[0] };

  return { locationStatus: "unknown", locationEvidence: "" };
}

function comparableUrl(value) {
  const normalized = normalizeUrl(value);
  if (!normalized) return "";

  try {
    const url = new URL(normalized);
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    return `${url.origin}${url.pathname}`.toLowerCase();
  } catch {
    return normalized.replace(/\/+$/, "").toLowerCase();
  }
}

function normalizeSourceName(value) {
  return (value || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("uk-UA")
    .replace(/[^a-zа-яіїєґ0-9]+/giu, " ")
    .trim();
}

function sourceMatchesCatalog(row, { instagram, social, website }) {
  const sourceType = (row.source_type || "").trim().toLowerCase();
  if (sourceType === "instagram") {
    return Boolean(instagram && instagramUsername(row.identifier) === instagram);
  }
  if (sourceType === "telegram") {
    const catalogUsername = telegramUsername(social);
    return Boolean(catalogUsername && telegramUsername(row.identifier) === catalogUsername);
  }

  const identifier = comparableUrl(row.identifier);
  return Boolean(
    identifier && [comparableUrl(social), comparableUrl(website)].filter(Boolean).includes(identifier),
  );
}

const sourcePriority = ["instagram", "booksy", "website", "facebook", "telegram"];
const automaticDiscoveryPattern =
  /\s*\[?Знайдено автоматично через веб-пошук(?:\s*\([^)]+\))?\s*[—-]\s*рекомендується перевірити відповідність\.?\]?/iu;

function getSourcePriority(row) {
  const priority = sourcePriority.indexOf((row.source_type || "").trim().toLowerCase());
  return priority === -1 ? sourcePriority.length : priority;
}

function selectSource(rows, contacts) {
  const matching = rows.filter((row) => sourceMatchesCatalog(row, contacts));
  const catalogNames = new Set(
    contacts.names
      .map(normalizeSourceName)
      .filter((name) => name.length >= 8 && name.split(" ").length >= 2),
  );
  const nameMatches = rows.filter((row) => catalogNames.has(normalizeSourceName(row.name)));
  const candidates = matching.length ? matching : nameMatches.length === 1 ? nameMatches : [];

  return [...candidates].sort((a, b) => {
    const aOk = a.status === "ok" || a.status === "no_public_data" ? 0 : 1;
    const bOk = b.status === "ok" || b.status === "no_public_data" ? 0 : 1;
    return (
      aOk - bOk ||
      getSourcePriority(a) - getSourcePriority(b)
    );
  })[0];
}

function cleanSourceInfo(row) {
  if (!row || row.status !== "ok") return "";
  const info = (row.info || "").trim();
  return info
    .replace(
      /^(?:Подписчики|Підписники|Followers|Obserwujący)\s*:[^|]*\|\s*(?:Подписки|Підписки|Following|Obserwowani)\s*:[^|]*\|\s*/iu,
      "",
    )
    .replace(/\s*\(\s*[\d.,\s]+\s+(?:followers|subscribers|підписників|подписчиков|obserwujących)\s*\)/giu, "")
    .replace(/\s*\[(?:ПОДОЗРИТЕЛЬНО|SUSPICIOUS)[^\]]*\]/giu, "")
    .replace(automaticDiscoveryPattern, "")
    .trim();
}

function getSourceReviewWarning(row) {
  const match = (row?.info || "").match(/\[(?:ПОДОЗРИТЕЛЬНО|SUSPICIOUS)\s*:?\s*([^\]]*)\]/iu);
  return match?.[1]?.trim() || "";
}

function copySourcePhoto(row) {
  const photoFile = (row?.photo_file || "").trim();
  if (!photoFile) return "";

  const sourcePath = resolve(sourceRoot, photoFile);
  const relativePath = relative(sourceRoot, sourcePath);
  const extension = extname(sourcePath).toLowerCase();
  if (relativePath.startsWith("..") || ![".jpg", ".jpeg", ".png", ".webp"].includes(extension)) {
    return "";
  }
  if (!existsSync(sourcePath)) return "";

  mkdirSync(publicAvatarsDir, { recursive: true });
  const file = basename(sourcePath);
  copyFileSync(sourcePath, join(publicAvatarsDir, file));
  return `/avatars/${file}`;
}

function renderDataFile(items) {
  return `export type Specialist = {
  id: number;
  name: string;
  title: string;
  category: string;
  subcategory: string;
  phone: string;
  website: string;
  social: string;
  instagram: string;
  description: string;
  review: string;
  comment: string;
  communityMatch: boolean;
  avatar: string;
  instagramTitle: string;
  instagramBio: string;
  instagramStatus: string;
  sourceType: string;
  sourceUrl: string;
  sourceInfo: string;
  sourceStatus: string;
  foundAutomatically: boolean;
  needsReview: boolean;
  reviewReason: string;
  locationStatus: "confirmed" | "unknown" | "unconfirmed";
  locationEvidence: string;
};

export const specialists: Specialist[] = ${JSON.stringify(items, null, 2)};
`;
}

function pick(row, keys) {
  for (const key of keys) {
    const value = row[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function stripAutomaticDiscoveryNotice(value) {
  return value
    .replace(automaticDiscoveryPattern, "")
    .replace(/\s*\|\s*$/u, "")
    .trim();
}

const catalogRows = readCsv(catalogPath);
const sourceRows = readCsv(sourcesPath, false);

const specialists = catalogRows.map((row, index) => {
  const social = pick(row, ["Соцмережі", "Соц сети"]);
  const username = instagramUsername(social);
  const id = Number.parseInt(pick(row, ["№", "id"]), 10);
  const website = normalizeUrl(pick(row, ["Сайт"]));
  const name = pick(row, ["Ім'я", "Ім’я", "Имя"]);
  const title = pick(row, ["Назва", "Название", "Ім'я", "Ім’я", "Имя"]);
  const source = selectSource(sourceRows, { instagram: username, social, website, names: [title, name] });
  const instagramSource = sourceRows.find(
    (candidate) =>
      candidate.source_type === "instagram" &&
      sourceMatchesCatalog(candidate, { instagram: username, social, website }),
  );
  const sourceInfo = cleanSourceInfo(source);
  const instagramBio = cleanSourceInfo(instagramSource);
  const category = pick(row, ["Категорія", "Категория"]);
  const subcategory = pick(row, ["Підкатегорія", "Подкатегория"]);
  const rawReview = pick(row, ["Відгук", "Отзыв"]);
  const rawComment = pick(row, ["Коментар", "Кометар", "Комментарий"]);
  const foundAutomatically =
    /^(?:true|так|yes|1)$/i.test(pick(row, ["Знайдено автоматично", "Found automatically"])) ||
    /^(?:true|так|yes|1)$/i.test(source?.found_automatically || "") ||
    automaticDiscoveryPattern.test(source?.info || "") ||
    automaticDiscoveryPattern.test(`${rawReview} ${rawComment}`);
  const review = stripAutomaticDiscoveryNotice(rawReview);
  const comment = stripAutomaticDiscoveryNotice(rawComment);
  const sourceReviewWarning = getSourceReviewWarning(source);
  const catalogReviewReason = pick(row, ["Причина проблеми", "Причина проблемы", "Problem reason"]);
  const location = inferLocation([source?.name, sourceInfo]);

  return {
    id: Number.isFinite(id) ? id : index + 1,
    name,
    title: title || "Без назви",
    category: category || "Інше",
    subcategory: subcategory || "Не вказано",
    phone: pick(row, ["Телефон"]),
    website,
    social,
    instagram: username,
    description: [...new Set([review, comment].filter(Boolean))].join("\n\n"),
    review,
    comment,
    communityMatch: Boolean(pick(row, ["Національність (для сумнівних випадків)", "Национальность (для сомнительных случаев)"])),
    avatar: copySourcePhoto(source),
    instagramTitle: instagramSource?.name || "",
    instagramBio,
    instagramStatus: instagramSource?.status || "",
    sourceType: source?.source_type || "",
    sourceUrl: normalizeUrl(source?.identifier || ""),
    sourceInfo,
    sourceStatus: source?.status || "",
    foundAutomatically,
    needsReview:
      /^так|yes|true|1$/i.test(pick(row, ["Проблемна", "Проблемная", "Problem"])) ||
      Boolean(sourceReviewWarning),
    reviewReason: catalogReviewReason || sourceReviewWarning,
    ...location,
  };
});

writeFileSync(outputPath, renderDataFile(specialists), "utf8");

const enrichedCount = specialists.filter((item) => item.sourceInfo).length;
const avatarCount = specialists.filter((item) => item.avatar).length;
const locationCounts = Object.groupBy(specialists, (item) => item.locationStatus);

console.log(`Imported ${specialists.length} specialists.`);
console.log(`Source-enriched profiles: ${enrichedCount}.`);
console.log(`Matched avatars: ${avatarCount}.`);
console.log(
  `Locations: ${locationCounts.confirmed?.length || 0} confirmed, ${locationCounts.unknown?.length || 0} unknown, ${locationCounts.unconfirmed?.length || 0} unconfirmed.`,
);
