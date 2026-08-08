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

const CATEGORY_MAP = {
  "": "Інше",
  "Еда": "Їжа",
  "Заведения": "Заклади",
  "Здоровье": "Здоровʼя",
  "Красота": "Краса",
  "Недвижимость": "Нерухомість",
  "Образование": "Освіта",
  "Транспорт": "Транспорт",
  "Услуги": "Послуги",
  "Финансы": "Фінанси",
  "Юридические услуги": "Юридичні послуги",
};

const SUBCATEGORY_MAP = {
  "": "Не вказано",
  "Автомеханик": "Автомеханік",
  "Автосервис": "Автосервіс",
  "Брови": "Брови",
  "Бухгалтер": "Бухгалтер",
  "Визаж (макияж)": "Візаж (макіяж)",
  "Волосы": "Волосся",
  "Врач": "Лікар",
  "Врач общей практики": "Лікар загальної практики",
  "Гинеколог": "Гінеколог",
  "Детский сад": "Дитячий садок",
  "Кафе": "Кафе",
  "Кондитер": "Кондитер",
  "Косметолог": "Косметолог",
  "Легализация / карта побыту": "Легалізація / карта побиту",
  "Массаж": "Масаж",
  "Не указана": "Не вказано",
  "Ногти": "Нігті",
  "Нотариус": "Нотаріус",
  "Онлайн-рецепты": "Онлайн-рецепти",
  "Педиатр": "Педіатр",
  "Переводчик": "Перекладач",
  "Пирсинг / тату": "Пірсинг / тату",
  "Подолог": "Подолог",
  "Психиатр": "Психіатр",
  "Психолог": "Психолог",
  "Ремонт кофемашин": "Ремонт кавомашин",
  "Репетитор английского": "Репетитор англійської",
  "Репетитор английского языка": "Репетитор англійської мови",
  "Репетитор польского языка": "Репетитор польської мови",
  "Ресницы": "Вії",
  "Риелтор": "Рієлтор",
  "Салон красоты": "Салон краси",
  "Стоматолог": "Стоматолог",
  "Танцевальная студия": "Танцювальна студія",
  "Тату": "Тату",
  "Турагент": "Турагент",
  "Туроператор": "Туроператор",
  "УЗИ (диагностика)": "УЗД (діагностика)",
  "Увеличение губ": "Збільшення губ",
  "Украинская школа": "Українська школа",
  "Физиотерапевт": "Фізіотерапевт",
  "Швея": "Швачка",
  "Эвакуатор": "Евакуатор",
  "Электрик": "Електрик",
  "Эпиляция": "Епіляція",
  "Юрист": "Юрист",
};

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

function loadExistingSpecialists() {
  if (!existsSync(outputPath)) return [];
  const text = readFileSync(outputPath, "utf8");
  const match = text.match(/export const specialists: Specialist\[\] = (\[[\s\S]*\]);\s*$/);
  if (!match) return [];
  try {
    return JSON.parse(match[1]);
  } catch {
    return [];
  }
}

function buildLearnedTranslationMaps(catalogRows, existingRows) {
  const categories = new Map(Object.entries(CATEGORY_MAP));
  const subcategories = new Map(Object.entries(SUBCATEGORY_MAP));

  for (const source of catalogRows) {
    const existing = existingRows.find((item) => String(item.id) === String(source["№"]));
    if (!existing) continue;

    const rawCategory = (source["Категория"] || "").trim();
    const rawSubcategory = (source["Подкатегория"] || "").trim();

    if (rawCategory && existing.category) categories.set(rawCategory, existing.category);
    if (rawSubcategory && existing.subcategory) subcategories.set(rawSubcategory, existing.subcategory);
  }

  return { categories, subcategories };
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
      instagramFollowers: (row.followers || "").trim(),
      instagramFollowing: (row.following || "").trim(),
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
  instagramFollowers: string;
  instagramFollowing: string;
  instagramBio: string;
  instagramStatus: string;
};

export const specialists: Specialist[] = ${JSON.stringify(items, null, 2)};
`;
}

const catalogRows = readCsv(catalogPath);
const instagramRows = readCsv(instagramPath, false);
const existingRows = loadExistingSpecialists();
const { categories, subcategories } = buildLearnedTranslationMaps(catalogRows, existingRows);
const avatars = copyAvatars();
const instagram = buildInstagramMap(instagramRows);

const specialists = catalogRows.map((row, index) => {
  const social = (row["Соц сети"] || "").trim();
  const username = instagramUsername(social);
  const extra = instagram.get(username) || {};
  const avatarFile = avatars.get(username);
  const id = Number.parseInt(row["№"], 10);

  return {
    id: Number.isFinite(id) ? id : index + 1,
    name: (row["Имя"] || "").trim(),
    title: (row["Название"] || row["Имя"] || "Без назви").trim(),
    category: categories.get((row["Категория"] || "").trim()) || (row["Категория"] || "Інше").trim(),
    subcategory:
      subcategories.get((row["Подкатегория"] || "").trim()) || (row["Подкатегория"] || "Не вказано").trim(),
    phone: (row["Телефон"] || "").trim(),
    website: normalizeUrl(row["Сайт"]),
    social,
    instagram: username,
    description: (row["Описание"] || "").trim(),
    communityMatch: Boolean((row["Национальность (для сомнительных случаев)"] || "").trim()),
    avatar: avatarFile ? `/avatars/${avatarFile}` : "",
    instagramTitle: extra.instagramTitle || "",
    instagramFollowers: extra.instagramFollowers || "",
    instagramFollowing: extra.instagramFollowing || "",
    instagramBio: extra.instagramBio || "",
    instagramStatus: extra.instagramStatus || "",
  };
});

writeFileSync(outputPath, renderDataFile(specialists), "utf8");

const enrichedCount = specialists.filter(
  (item) => item.instagramBio || item.instagramFollowers || item.instagramTitle,
).length;
const avatarCount = specialists.filter((item) => item.avatar).length;

console.log(`Imported ${specialists.length} specialists.`);
console.log(`Instagram-enriched profiles: ${enrichedCount}.`);
console.log(`Matched avatars: ${avatarCount}.`);
