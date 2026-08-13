import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const sourceRoot = resolve(projectRoot, "..");

/** Source CSVs keep the raw material. The site only receives photos and text through these
 * explicit publication policies, so re-importing cannot restore raw profile content. */
const PUBLISH_INSTAGRAM_PHOTOS = false;
const PUBLISH_FACTUAL_INSTAGRAM_SUMMARIES = true;

const catalogPath = resolve(process.env.CATALOG_CSV || join(sourceRoot, "каталог_специалистов.csv"));
const booksPath = resolve(process.env.BOOKS_CSV || join(sourceRoot, "книги_olx.csv"));
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
  if (/^(?:mailto:)?[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(cleaned)) return "";
  return /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
}

function normalizePhone(value) {
  const text = (value || "").trim();
  if (!text) return "";

  const digits = text.replace(/\D/g, "");
  return digits ? `${text.startsWith("+") ? "+" : ""}${digits}` : "";
}

function parseOptionalNumber(value) {
  const normalized = (value || "").replace(",", ".").trim();
  if (!normalized) return null;
  const number = Number.parseFloat(normalized);
  return Number.isFinite(number) ? number : null;
}

function normalizeComparableText(value) {
  return (value || "").replace(/\s+/gu, " ").trim().toLocaleLowerCase("uk-UA");
}

const acceptedLocations = [
  ["Онлайн", /\bonline\b|онлайн/u],
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
  ["Żory", /\bzory\b|жор[ыи]/u],
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
  ["Сміла", /\bsmila\b|см[іе]ла/u],
  ["Kryvyi Rih", /kryvyi rih|кривий р[іи]г|кривой рог/u],
  ["Manila", /manila|ман[іи]ла/u],
];

const acceptedLocationNames = new Set(acceptedLocations.map(([name]) => name));
const distantLocationNames = new Set(distantLocations.map(([name]) => name));

function inferLocationFromCities(value) {
  const cities = [...new Set((value || "").split(/[,;]+/u).map((city) => city.trim()).filter(Boolean))];
  if (!cities.length) return { locationStatus: "unknown", locationEvidence: "" };

  if (cities.some((city) => acceptedLocationNames.has(city))) {
    return { locationStatus: "confirmed", locationEvidence: cities.join(", ") };
  }

  if (cities.some((city) => distantLocationNames.has(city))) {
    return { locationStatus: "unconfirmed", locationEvidence: cities.join(", ") };
  }

  return { locationStatus: "unknown", locationEvidence: "" };
}

function comparableUrl(value) {
  const normalized = normalizeUrl(value);
  if (!normalized) return "";

  try {
    const url = new URL(normalized);
    /** facebook.com/profile.php carries the whole identity in ?id=, so dropping the query would equate every such profile. */
    const profileId = url.searchParams.get("id");
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    const base = `${url.origin}${url.pathname}`.toLowerCase();
    return profileId ? `${base}?id=${profileId}` : base;
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
  /\s*(?:\|\s*)?\[?Знайдено (?:(?:автоматично (?:через веб-пошук|за номером телефону)(?:\s*\([^)]+\))?\s*[—-]\s*рекомендується перевірити відповідність\.?)|(?:за номером телефону(?:\s*\([^)]+\))?,?\s*але це оголошення у групі,?\s*не бізнес-сторінка\s*[—-]\s*слабке підтвердження,?\s*(?:обов[ʼ']язково )?перевірити вручну\.?))\]?/iu;

function getSourcePriority(row) {
  const priority = sourcePriority.indexOf((row.source_type || "").trim().toLowerCase());
  return priority === -1 ? sourcePriority.length : priority;
}

function selectSource(rows, contacts) {
  const profileRows = rows.filter(
    (row) => !["phonesearch", "facebook_recommendation"].includes(row.source_type),
  );
  const matching = profileRows.filter((row) => sourceMatchesCatalog(row, contacts));
  const catalogNames = new Set(
    contacts.names
      .map(normalizeSourceName)
      .filter((name) => name.length >= 8 && name.split(" ").length >= 2),
  );
  const nameMatches = profileRows.filter((row) => catalogNames.has(normalizeSourceName(row.name)));
  const candidates = matching.length ? matching : nameMatches.length === 1 ? nameMatches : [];
  const normalizedContactNames = contacts.names.map(normalizeSourceName).filter((name) => name.length >= 4);

  return [...candidates].sort((a, b) => {
    const aOk = a.status === "ok" || a.status === "no_public_data" ? 0 : 1;
    const bOk = b.status === "ok" || b.status === "no_public_data" ? 0 : 1;
    const aName = normalizeSourceName(a.name);
    const bName = normalizeSourceName(b.name);
    const aNameMatch = normalizedContactNames.some((name) => aName.includes(name)) ? 0 : 1;
    const bNameMatch = normalizedContactNames.some((name) => bName.includes(name)) ? 0 : 1;
    return (
      aOk - bOk ||
      aNameMatch - bNameMatch ||
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

const instagramSpecialtyFacts = [
  { source: /(?:дитяч(?:ий|а) стоматолог|стоматолог(?:ія)? для дітей|pediatric dent)/iu, value: "дитяча стоматологія", duplicate: /дитяч.*стоматолог|стоматолог.*дит/u },
  { source: /(?:дитяч(?:ий|а) та доросл(?:ий|а) дерматолог)/iu, value: "дитяча й доросла дерматологія", duplicate: /дитяч.*доросл.*дерматолог/u },
  { source: /(?:трихолог|trycholog)/iu, value: "трихологія", duplicate: /трихолог/u },
  { source: /(?:колорист|koloryst)/iu, value: "колористика", duplicate: /колорист/u },
  { source: /(?:перукар|fryzjer|hairdresser)/iu, value: "перукарські послуги", duplicate: /перукар|волос/u },
  { source: /(?:манікюр|manicure|paznok)/iu, value: "манікюр", duplicate: /манікюр|нігт/u },
  { source: /(?:педикюр|pedicure)/iu, value: "педикюр", duplicate: /педикюр/u },
  { source: /(?:подолог|podolog)/iu, value: "подологія", duplicate: /подолог/u },
  { source: /(?:бров|brow|brwi)/iu, value: "оформлення брів", duplicate: /бров/u },
  { source: /(?:візаж|макіяж|makeup|makijaż)/iu, value: "макіяж", duplicate: /візаж|макіяж/u },
  { source: /(?:нарощування вій|ламінування вій|lashes|rzęs)/iu, value: "оформлення вій", duplicate: /ві[йї]|lash/u },
  { source: /(?:масаж|masaż)/iu, value: "масаж", duplicate: /масаж/u },
  { source: /(?:косметолог|kosmetolog)/iu, value: "косметологія", duplicate: /косметолог/u },
  { source: /(?:депіляц|епіляц|depilac|epilac)/iu, value: "депіляція", duplicate: /депіляц|епіляц/u },
  { source: /(?:барбер|barber)/iu, value: "барберські послуги", duplicate: /барбер/u },
  { source: /(?:татуювання|тату(?!р)|tattoo|tatuaż)/iu, value: "тату", duplicate: /тату/u },
  { source: /(?:пірсинг|piercing)/iu, value: "пірсинг", duplicate: /пірсинг/u },
  { source: /(?:стоматолог|dentyst)/iu, value: "стоматологія", duplicate: /стоматолог/u },
  { source: /(?:педіатр|pediatr)/iu, value: "педіатрія", duplicate: /педіатр/u },
  { source: /(?:гінеколог|ginekolog)/iu, value: "гінекологія", duplicate: /гінеколог/u },
  { source: /(?:дерматолог|dermatolog)/iu, value: "дерматологія", duplicate: /дерматолог/u },
  { source: /(?:психолог|psycholog)/iu, value: "психологічні консультації", duplicate: /психолог/u },
  { source: /(?:нутриціолог|dietetyk)/iu, value: "нутриціологія", duplicate: /нутриціолог/u },
  { source: /(?:фітнес|fitness)/iu, value: "фітнес", duplicate: /фітнес/u },
  { source: /(?:фотограф|fotograf)/iu, value: "фотографія", duplicate: /фотограф/u },
  { source: /(?:відеограф|videograf)/iu, value: "відеозйомка", duplicate: /відеограф|відеозйом/u },
  { source: /(?:адвокат|юрист|lawyer|prawnik)/iu, value: "юридичні послуги", duplicate: /адвокат|юрист|юридич/u },
  { source: /(?:бухгалтер|księg)/iu, value: "бухгалтерські послуги", duplicate: /бухгалтер/u },
  { source: /(?:переклад|tłumacz)/iu, value: "переклад", duplicate: /переклад/u },
  { source: /(?:флорист|floryst|букет)/iu, value: "флористика", duplicate: /флорист/u },
  { source: /(?:ремонт взуття|naprawa obuw)/iu, value: "ремонт взуття", duplicate: /ремонт взуття/u },
  { source: /(?:страхуван|ubezpiecze)/iu, value: "страхування", duplicate: /страхуван/u },
  { source: /(?:нерухом|nieruchomo)/iu, value: "нерухомість", duplicate: /нерухом|ріелтор/u },
  { source: /(?:турагент|туристичн(?:і|ий) послуг|travel agent|biuro podróży)/iu, value: "туристичні послуги", duplicate: /туроператор|турагент|туристич/u },
];

const instagramServiceFacts = [
  [/(?:лікування зубів уві сні|лікування зубів під наркозом|leczenie zębów we śnie)/iu, "лікування зубів уві сні"],
  [/(?:гібридн(?:ий|ого) манікюр|manicure hybrydowy)/iu, "гібридний манікюр"],
  [/(?:гелев(?:ий|ого) манікюр|manicure żelowy)/iu, "гелевий манікюр"],
  [/(?:тотальн(?:ий|ого) блонд|total blond)/iu, "тотальний блонд"],
  [/(?:хімічн(?:а|ої) завивк|trwała ondulacja)/iu, "хімічна завивка"],
  [/(?:відновлення волосся|rekonstrukcja włosów)/iu, "відновлення волосся"],
  [/(?:лазерн(?:а|ої) епіляц)/iu, "лазерна епіляція"],
  [/(?:електроепіляц|електроліз|elektroepilac)/iu, "електроепіляція"],
  [/(?:кріоліполіз|kriolipoliz)/iu, "кріоліполіз"],
  [/(?:ультразвуков(?:а|ої) кавітац|kawitacj)/iu, "ультразвукова кавітація"],
  [/(?:онлайн-консультац|консультац(?:ії|ія) онлайн|online consult)/iu, "онлайн-консультації"],
  [/(?:бізнес-план|business plan)/iu, "підготовка бізнес-планів"],
  [/(?:поданн(?:я|і) на грант|grant)/iu, "допомога з грантовими заявками"],
  [/(?:ціноутворення|pricing)/iu, "консультації з ціноутворення"],
  [/(?:букет(?:и)? з доставкою|bukiety z dostawą)/iu, "доставка букетів"],
  [/(?:весілля|śluby).*?(?:декорац|dekorac)/iu, "весільна та подієва флористика"],
];

const instagramLanguageFacts = [
  [/(?:українськ|ukraińsk|ukrainian)/iu, "українська"],
  [/(?:польськ|polsk|polish)/iu, "польська"],
  [/(?:англійськ|english|angielsk)/iu, "англійська"],
  [/(?:російськ|русск|russian|rosyjsk)/iu, "російська"],
];

/** No \b before the Cyrillic stems: JS word boundaries key off [A-Za-z0-9_], so one placed in front
 * of "Україна" never matches. It is still needed to keep the two-letter codes from hitting words. */
const routeCountries = [
  ["Україна", /україн|украин|\bua\b/iu],
  ["Польща", /польщ|польш|polsk|\bpl\b/iu],
  ["Німеччина", /німеччин|германи|\bde\b/iu],
  ["Чехія", /чехі|чехи|\bcz\b/iu],
];

/**
 * A route baked into the subcategory splits one service across several filters: the catalogue held
 * "Доставка посилок" three times over, differing only by dash character and direction. Keeping the
 * pair in its own field also means a new country is a new value here, not a new taxonomy entry.
 */
function splitRoute(rawSubcategory, explicitRoute) {
  const subcategory = (rawSubcategory || "").trim();
  const explicit = (explicitRoute || "").trim();
  if (explicit) return { subcategory, route: normalizeRoute(explicit) || explicit };

  const parenthetical = subcategory.match(/^(.*?)\s*\(([^)]*)\)\s*$/u);
  if (!parenthetical) return { subcategory, route: "" };

  const route = normalizeRoute(parenthetical[2]);
  return route ? { subcategory: parenthetical[1].trim(), route } : { subcategory, route: "" };
}

/** Both directions describe the same corridor, so they collapse to one canonical pair. */
function normalizeRoute(value) {
  const found = routeCountries.filter(([, pattern]) => pattern.test(value)).map(([name]) => name);
  const unique = [...new Set(found)];
  if (unique.length < 2) return "";

  const ordered = unique.includes("Україна")
    ? ["Україна", ...unique.filter((name) => name !== "Україна")]
    : unique;
  return ordered.join("–");
}

function buildFactualInstagramSummary(row, { category, subcategory }) {
  if (!PUBLISH_FACTUAL_INSTAGRAM_SUMMARIES || row?.source_type !== "instagram") return "";

  const info = cleanSourceInfo(row);
  if (!info) return "";
  const professionalText = `${row.name || ""} ${info}`;
  const catalogText = normalizeComparableText(`${category} ${subcategory}`);

  const specialties = instagramSpecialtyFacts
    .filter(({ source, duplicate }) => source.test(professionalText) && !duplicate.test(catalogText))
    .map(({ value }) => value)
    .slice(0, 4);
  const services = instagramServiceFacts
    .filter(([pattern]) => pattern.test(info))
    .map(([, label]) => label)
    .slice(0, 4);
  const hasLanguageList = /(?:мов(?:а|и|ами)|languages?|język(?:i|ami)?|говорю|розмовляю)/iu.test(info);
  const languages = hasLanguageList
    ? instagramLanguageFacts.filter(([pattern]) => pattern.test(info)).map(([, label]) => label)
    : [];
  const facts = [];
  const experience = info.match(/(?:\b(\d{1,2}\+?)\s*(?:рок(?:ів|и)|lat)\s*(?:досвіду|doświadczenia)|(?:досвід|doświadczenie)\s*(\d{1,2}\+?)\s*(?:рок(?:ів|и)|lat))/iu);
  const workplace = info.match(/(?:головн(?:ий|а) лікар(?:ка)? (?:клініки|у клініці)|head doctor (?:at|of))\s+([\p{L}\p{N}][\p{L}\p{N}&'’ .-]{1,35}?)(?=\s*(?:[-|•]|$))/iu);

  if (specialties.length) facts.push(`Спеціалізація: ${specialties.join(", ")}.`);
  if (services.length) facts.push(`Послуги: ${services.join(", ")}.`);
  if (experience) facts.push(`Досвід: ${experience[1] || experience[2]} років.`);
  if (workplace) facts.push(`Місце роботи: ${workplace[1].trim()} (головний лікар).`);
  if (languages.length) facts.push(`Мови: ${languages.join(", ")}.`);

  return facts.join(" ");
}

function copySourcePhoto(row) {
  if (!PUBLISH_INSTAGRAM_PHOTOS) return "";

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
  route: string;
  bookLanguage: string;
  bookListingDate: string;
  bookPrice: string;
  bookPricePln: number | null;
  bookQualityScore: number;
  bookCondition: string;
  phone: string;
  email: string;
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
  sourceCheckedAt: string;
  sourceUpdatedAt: string;
  foundAutomatically: boolean;
  confidenceScore: number;
  confidenceReason: string;
  hasNegativeReview: boolean;
  needsReview: boolean;
  reviewReason: string;
  registryVerified: boolean;
  registryName: string;
  registryOfficialName: string;
  registryLedgerNumber: string;
  registryPwz: string;
  registryUrl: string;
  registryCheckedAt: string;
  registryScope: string;
  subjectType: string;
  subjectTypeConfidence: number;
  subjectTypeBasis: string;
  subjectTypeRegistry: string;
  subjectTypeIdentifier: string;
  subjectTypeVerificationUrl: string;
  subjectTypeCheckedAt: string;
  individualNoticeRequired: "yes" | "no" | "review";
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

function isDuplicateCatalogRow(row) {
  return /^\s*(?:дублікат|дубликат|duplicate)(?:\s|$)/iu.test(
    pick(row, ["Дія після перевірки", "Action after review"]),
  );
}

function isCatalogProblem(row) {
  return /^так|yes|true|1$/i.test(
    pick(row, ["Проблемна", "Проблемная", "Problem"]),
  );
}

const catalogRows = [...readCsv(catalogPath), ...readCsv(booksPath, false)];
const sourceRows = readCsv(sourcesPath, false);
const sourceDataUpdatedAt = existsSync(sourcesPath) ? statSync(sourcesPath).mtime.toISOString().slice(0, 10) : "";

const activeCatalogRows = catalogRows.filter((row) => !isDuplicateCatalogRow(row));

const specialists = activeCatalogRows.map((row, index) => {
  const social = pick(row, ["Соцмережі", "Соц сети"]);
  const username = instagramUsername(social);
  const id = Number.parseInt(pick(row, ["№", "id"]), 10);
  const email = pick(row, ["Email", "Емейл", "Електронна пошта"]);
  const website = normalizeUrl(pick(row, ["Сайт"]));
  const name = pick(row, ["Ім'я", "Ім’я", "Имя"]);
  const title = pick(row, ["Назва", "Название", "Ім'я", "Ім’я", "Имя"]);
  const source = selectSource(sourceRows, { instagram: username, social, website, names: [title, name] });
  const phoneSearchSource = sourceRows.find(
    (candidate) => candidate.source_type === "phonesearch" && String(candidate.id) === String(id),
  );
  const instagramSource = sourceRows.find(
    (candidate) =>
      candidate.source_type === "instagram" &&
      sourceMatchesCatalog(candidate, { instagram: username, social, website }),
  );
  const category = pick(row, ["Категорія", "Категория"]);
  const { subcategory, route } = splitRoute(
    pick(row, ["Підкатегорія", "Подкатегория"]),
    pick(row, ["Маршрут", "Напрямок", "Route"]),
  );
  const sourceInfo = buildFactualInstagramSummary(source, { category, subcategory });
  const instagramBio = "";
  const bookLanguage = pick(row, ["Мова книги", "Язык книги", "Book language"]);
  const bookListingDate = pick(row, ["Дата оголошення", "Дата объявления", "Listing date"]);
  const bookPrice = pick(row, ["Ціна", "Цена", "Price"]);
  const bookPricePln = parseOptionalNumber(pick(row, ["Ціна PLN", "Цена PLN", "Price PLN"]));
  const bookQualityScore = Number.parseInt(pick(row, ["Score книги", "Book score"]) || "0", 10);
  const bookCondition = pick(row, ["Стан книги", "Состояние книги", "Book condition"]);
  const rawReview = pick(row, ["Відгук", "Отзыв"]);
  const rawComment = pick(row, ["Коментар", "Кометар", "Комментарий"]);
  const foundAutomatically =
    /^(?:true|так|yes|1)$/i.test(pick(row, ["Знайдено автоматично", "Found automatically"])) ||
    /^(?:true|так|yes|1)$/i.test(source?.found_automatically || "") ||
    automaticDiscoveryPattern.test(source?.info || "") ||
    automaticDiscoveryPattern.test(`${rawReview} ${rawComment}`);
  const confidenceScore = Number.parseInt(
    pick(row, ["Впевненість знайденої інформації", "Confidence score"]) ||
      source?.confidence_score ||
      "0",
    10,
  );
  const review = stripAutomaticDiscoveryNotice(rawReview);
  const importedComment = stripAutomaticDiscoveryNotice(rawComment);
  const comment =
    normalizeComparableText(importedComment) === normalizeComparableText(sourceInfo) ? "" : importedComment;
  const catalogReviewReason = pick(row, ["Причина проблеми", "Причина проблемы", "Problem reason"]);
  const catalogNeedsReview = isCatalogProblem(row);
  const registryVerified = /^(?:так|yes|true|1)$/i.test(
    pick(row, ["Перевірено в офіційному реєстрі", "Verified in official register"]),
  );
  const subjectTypeConfidence = Number.parseInt(pick(row, ["Впевненість типу"]), 10);
  const individualNoticeValue = pick(row, ["Потрібне індивідуальне повідомлення"]);
  const catalogSourceNames = new Set(
    [title, name].map(normalizeSourceName).filter(Boolean),
  );
  const hasNegativeReview = /негатив|поган|суперечлив/iu.test(catalogReviewReason) ||
    sourceRows.some(
      (candidate) =>
        (candidate === source ||
          candidate === instagramSource ||
          (String(candidate.id) === String(id) &&
            catalogSourceNames.has(normalizeSourceName(candidate.name)))) &&
        /негатив|поган|суперечлив/iu.test(`${candidate.info || ""} ${candidate.confidence_reason || ""}`),
    );
  const sourceCities =
    pick(row, ["Міста з опису джерела", "Source cities"]) ||
    (source?.cities || "").trim() ||
    (phoneSearchSource?.cities || "").trim();
  const location = inferLocationFromCities(sourceCities);

  return {
    id: Number.isFinite(id) ? id : index + 1,
    name,
    title: title || "Без назви",
    category: category || "Інше",
    subcategory: subcategory || "Не вказано",
    route,
    bookLanguage,
    bookListingDate,
    bookPrice,
    bookPricePln,
    bookQualityScore: Number.isFinite(bookQualityScore) ? bookQualityScore : 0,
    bookCondition,
    phone: normalizePhone(pick(row, ["Телефон"])),
    email,
    website,
    social,
    instagram: username,
    description: [...new Set([review, comment].filter(Boolean))].join("\n\n"),
    review,
    comment,
    communityMatch: Boolean(pick(row, ["Національність (для сумнівних випадків)", "Национальность (для сомнительных случаев)"])),
    avatar: copySourcePhoto(source),
    instagramTitle: "",
    instagramBio,
    instagramStatus: instagramSource?.status || "",
    sourceType: source?.source_type || "",
    sourceUrl: normalizeUrl(source?.identifier || ""),
    sourceInfo,
    sourceStatus: source?.status || "",
    sourceCheckedAt: source?.source_type === "instagram"
      ? pick(source, ["checked_at", "verified_at", "scraped_at", "Дата перевірки"])
      : "",
    sourceUpdatedAt: sourceInfo ? sourceDataUpdatedAt : "",
    foundAutomatically,
    confidenceScore: hasNegativeReview
      ? Math.min(Number.isFinite(confidenceScore) ? confidenceScore : 0, 40)
      : Number.isFinite(confidenceScore) ? confidenceScore : 0,
    confidenceReason: (source?.confidence_reason || "").trim(),
    hasNegativeReview,
    needsReview: catalogNeedsReview,
    reviewReason: catalogNeedsReview ? catalogReviewReason : "",
    registryVerified,
    registryName: registryVerified ? pick(row, ["Офіційний реєстр", "Official register"]) : "",
    registryOfficialName: registryVerified
      ? pick(row, ["Офіційне ім'я в реєстрі", "Official registry name"])
      : "",
    registryLedgerNumber: registryVerified
      ? pick(row, ["Номер реєстрової книги", "Registry ledger number"])
      : "",
    registryPwz: registryVerified ? pick(row, ["Номер PWZ", "PWZ number"]) : "",
    registryUrl: registryVerified
      ? normalizeUrl(pick(row, ["Посилання на запис у реєстрі", "Official registry URL"]))
      : "",
    registryCheckedAt: registryVerified
      ? pick(row, ["Дата перевірки реєстру", "Registry checked at"])
      : "",
    registryScope: registryVerified
      ? pick(row, ["Що підтверджено реєстром", "Registry verification scope"])
      : "",
    subjectType: pick(row, ["Тип суб’єкта"]),
    subjectTypeConfidence: Number.isFinite(subjectTypeConfidence) ? subjectTypeConfidence : 0,
    subjectTypeBasis: pick(row, ["Підстава класифікації"]),
    subjectTypeRegistry: pick(row, ["Реєстр типу суб’єкта"]),
    subjectTypeIdentifier: pick(row, ["Ідентифікатор суб’єкта"]),
    subjectTypeVerificationUrl: normalizeUrl(pick(row, ["Посилання на перевірку типу"])),
    subjectTypeCheckedAt: pick(row, ["Дата перевірки типу"]),
    individualNoticeRequired: /^(?:ні|no)$/iu.test(individualNoticeValue)
      ? "no"
      : /^(?:так|yes)$/iu.test(individualNoticeValue)
        ? "yes"
        : "review",
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
