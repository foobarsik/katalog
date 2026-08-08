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
  communityMatch: boolean;
  avatar: string;
  instagramTitle: string;
  instagramBio: string;
  instagramStatus: string;
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
    description: pick(row, ["Опис", "Описание"]),
    communityMatch: Boolean(pick(row, ["Національність (для сумнівних випадків)", "Национальность (для сомнительных случаев)"])),
    avatar: avatarFile ? `/avatars/${avatarFile}` : "",
    instagramTitle: extra.instagramTitle || "",
    instagramBio: extra.instagramBio || "",
    instagramStatus: extra.instagramStatus || "",
  };
});

writeFileSync(outputPath, renderDataFile(specialists), "utf8");

const enrichedCount = specialists.filter(
  (item) => item.instagramBio || item.instagramTitle,
).length;
const avatarCount = specialists.filter((item) => item.avatar).length;

console.log(`Imported ${specialists.length} specialists.`);
console.log(`Instagram-enriched profiles: ${enrichedCount}.`);
console.log(`Matched avatars: ${avatarCount}.`);
