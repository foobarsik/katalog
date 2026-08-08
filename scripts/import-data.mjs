import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const sourceRoot = resolve(projectRoot, "..");

const catalogPath = resolve(process.env.CATALOG_CSV || join(sourceRoot, "каталог_специалистов.csv"));
const instagramPath = resolve(process.env.INSTAGRAM_CSV || join(sourceRoot, "instagram_results.csv"));
const sourceAvatarsDir = resolve(process.env.INSTAGRAM_AVATARS_DIR || join(sourceRoot, "instagram_avatars"));
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

function instagramUsername(url) {
  const match = (url || "").match(/instagram\.com\/([^/?#\s]+)/i);
  return match ? match[1].replace(/\/$/, "").toLowerCase() : "";
}

function normalizeUrl(url) {
  const cleaned = (url || "").trim();
  if (!cleaned) return "";
  return /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
}

function stripInstagramTitle(title) {
  return (title || "")
    .trim()
    .replace(/\s*\([^()]+\)\s*•\s*Instagram photos and videos\s*$/u, "")
    .trim();
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

function copyAvatars() {
  mkdirSync(publicAvatarsDir, { recursive: true });
  if (!existsSync(sourceAvatarsDir)) return new Map();

  const avatars = new Map();
  for (const file of readdirSync(sourceAvatarsDir)) {
    if (![".jpg", ".jpeg", ".png", ".webp"].includes(extname(file).toLowerCase())) continue;
    copyFileSync(join(sourceAvatarsDir, file), join(publicAvatarsDir, file));
    avatars.set(basename(file, extname(file)).toLowerCase(), file);
  }
  return avatars;
}

function buildInstagramMap(rows) {
  const map = new Map();
  for (const row of rows) {
    const username = (row.username || "").trim().toLowerCase();
    if (!username) continue;
    map.set(username, {
      instagramTitle: stripInstagramTitle(row.title),
      instagramBio: (row.bio || "").trim(),
      instagramStatus: (row.status || "").trim(),
    });
  }
  return map;
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

function combineText(row, keyGroups) {
  const values = keyGroups.map((keys) => pick(row, keys)).filter(Boolean);
  return [...new Set(values)].join("\n\n");
}

const catalogRows = readCsv(catalogPath);
const instagramRows = readCsv(instagramPath, false);
const avatars = copyAvatars();
const instagram = buildInstagramMap(instagramRows);

const specialists = catalogRows.map((row, index) => {
  const social = pick(row, ["Соцмережі", "Соц сети"]);
  const username = instagramUsername(social);
  const extra = instagram.get(username) || {};
  const avatarFile = avatars.get(username);
  const id = Number.parseInt(pick(row, ["№", "id"]), 10);
  const name = pick(row, ["Ім'я", "Ім’я", "Имя"]);
  const title = pick(row, ["Назва", "Название", "Ім'я", "Ім’я", "Имя"]);
  const category = pick(row, ["Категорія", "Категория"]);
  const subcategory = pick(row, ["Підкатегорія", "Подкатегория"]);
  const review = pick(row, ["Відгук", "Отзыв"]);
  const comment = pick(row, ["Коментар", "Кометар", "Комментарий"]);
  const location = inferLocation([
    title,
    name,
    comment,
    social,
    username,
    extra.instagramTitle,
    extra.instagramBio,
  ]);

  return {
    id: Number.isFinite(id) ? id : index + 1,
    name,
    title: title || "Без назви",
    category: category || "Інше",
    subcategory: subcategory || "Не вказано",
    phone: pick(row, ["Телефон"]),
    website: normalizeUrl(pick(row, ["Сайт"])),
    social,
    instagram: username,
    description: combineText(row, [
      ["Відгук", "Отзыв"],
      ["Коментар", "Кометар", "Комментарий"],
    ]),
    review,
    comment,
    communityMatch: Boolean(pick(row, ["Національність (для сумнівних випадків)", "Национальность (для сомнительных случаев)"])),
    avatar: avatarFile ? `/avatars/${avatarFile}` : "",
    instagramTitle: extra.instagramTitle || "",
    instagramBio: extra.instagramBio || "",
    instagramStatus: extra.instagramStatus || "",
    ...location,
  };
});

writeFileSync(outputPath, renderDataFile(specialists), "utf8");

const enrichedCount = specialists.filter(
  (item) => item.instagramBio || item.instagramTitle,
).length;
const avatarCount = specialists.filter((item) => item.avatar).length;
const locationCounts = Object.groupBy(specialists, (item) => item.locationStatus);

console.log(`Imported ${specialists.length} specialists.`);
console.log(`Instagram-enriched profiles: ${enrichedCount}.`);
console.log(`Matched avatars: ${avatarCount}.`);
console.log(
  `Locations: ${locationCounts.confirmed?.length || 0} confirmed, ${locationCounts.unknown?.length || 0} unknown, ${locationCounts.unconfirmed?.length || 0} unconfirmed.`,
);
