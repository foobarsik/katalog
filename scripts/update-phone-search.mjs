import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(scriptDir, "..", "..");
const catalogPath = join(sourceRoot, "каталог_специалистов.csv");
const sourcesPath = join(sourceRoot, "all_sources_results_ua.csv");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
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

  const [rawHeaders = [], ...records] = rows;
  const headers = rawHeaders.map((header) => header.replace(/^\uFEFF/, ""));
  return {
    headers,
    records: records
      .filter((record) => record.some((cell) => cell.trim()))
      .map((record) => Object.fromEntries(headers.map((header, index) => [header, record[index] || ""]))),
  };
}

function escapeCsv(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(path, headers, records) {
  const lines = [headers, ...records.map((record) => headers.map((header) => record[header] || ""))];
  writeFileSync(path, `${lines.map((row) => row.map(escapeCsv).join(",")).join("\n")}\n`, "utf8");
}

const confirmedByPhone = new Map([
  ["+380679178483", { url: "https://tender.uub.com.ua/tender/UA-2025-03-18-013857-a/", info: "Номер знайдено у відкритих даних закупівлі для адвокатського бюро «Карпов та Партнери»; збігається юридична спеціалізація.", confidence: "80", reason: "Збіг номера, назви адвокатського бюро та юридичної послуги." }],
  ["+48516612635", { url: "https://belliata.pl/v/juz-czas-katowice-l12122-d92426", info: "Номер належить барбершопу Już Czas за адресою Złota 5 у Катовіце.", confidence: "95", reason: "Точний збіг номера, назви, послуги та міста.", cities: "Katowice" }],
  ["+48731351690", { url: "https://motointegrator.com/pl/pl/warsztaty/usluga-447-diagnoza/miasto-krasowy", info: "Номер знайдено у профілі автосервісу MAKSI SERWIS у Мисловіце.", confidence: "95", reason: "Точний збіг номера, назви сервісу та послуги.", cities: "Mysłowice" }],
  ["+48452641652", { url: "https://www.google.com/search?q=%22%2B48452641652%22", info: "Google індексує допис у Facebook-групі «Українці в м. Жори / Ukrainians in Żory» з цим номером та ім'ям Олександра. Локація збігається; стоматологічна послуга у фрагменті видачі не вказана.", confidence: "70", reason: "Точний збіг номера, імені Олександра та міста Żory; спеціалізація потребує окремого підтвердження.", cities: "Żory" }],
  ["+380664799898", { url: "https://moreukraine.pl/", info: "Номер вказаний у турагенцій MoreUkraine/Дрімтур; на сторінці інструкції контакт підписаний як Ігор.", confidence: "95", reason: "Точний збіг номера, імені Ігор та туристичної послуги." }],
  ["+48666979969", { url: "https://www.rentalinsilesia.pl/ua/%D0%BA%D0%B2%D0%B0%D1%80%D1%82%D0%B8%D1%80%D0%B8-%D0%BD%D0%B0%D0%BE%D1%80%D0%B5%D0%BD%D0%B4%D0%B0-2000zl-32m2-katowice/6773895", info: "Номер знайдено в оголошеннях Rental in Silesia; у видачі контакт підписаний як Людмила.", confidence: "95", reason: "Точний збіг номера, імені та рієлторської послуги.", cities: "Katowice" }],
  ["+48322632484", { url: "https://nasza-przychodnia.pl/poradnia-chorob-metabolicznych-i-leczeniu-otylosci-online/", info: "Номер належить реєстратурі медичного центру Nasza Przychodnia у Сосновці; особу лікаря номер окремо не підтверджує.", confidence: "70", reason: "Збіг номера клініки та медичної послуги, без прямого збігу імені.", cities: "Sosnowiec" }],
  ["+48815032278", { url: "https://zdorovo.pl/", info: "Номер підтверджений як україномовна інфолінія мережі Zdorovo; це загальний номер запису, а не особистий номер лікаря.", confidence: "85", reason: "Точний збіг номера клініки та медичних послуг." }],
  ["+48322431115", { url: "https://www.bip.spzozmakuszynskiego.pl/index.php?id=52%2C326%2C0", info: "Номер належить медичному закладу SP ZOZ у Руді-Шльонській; особу лікаря номер окремо не підтверджує.", confidence: "65", reason: "Збіг номера медичного закладу та типу послуги, без прямого збігу імені.", cities: "Ruda Śląska" }],
  ["+380973079293", { url: "https://sovet.kidstaff.com.ua/question-3238318", info: "Номер згадується у відгуках як перевізник посилок між Польщею та Україною.", confidence: "75", reason: "Точний збіг номера та послуги перевезення, ім'я не підтверджене." }],
  ["+48733686486", { url: "https://apnt.app/studiobykaminski", info: "Номер належить Studio by Kamiński у Катовіце; серед послуг є педикюр.", confidence: "95", reason: "Точний збіг номера, назви студії, послуги та міста.", cities: "Katowice" }],
  ["+48519147003", { url: "https://www.odebractelefon.pl/numer-telefonu/519147003", info: "У відгуках про номер його позначено як AVIMED Katowice; це неофіційне підтвердження клініки.", confidence: "60", reason: "Збіг номера і клініки у користувацьких відгуках, без прямого збігу імені.", cities: "Katowice" }],
  ["+380665320690", { url: "https://tglist.com.ua/en/chanel/Eposylka_PL", info: "Номер вказаний серед контактів служби доставки Eposylka для перевезень між Польщею та Україною.", confidence: "95", reason: "Точний збіг номера, назви та послуги доставки." }],
  ["+48797831576", { url: "https://belliata.pl/v/asma-barber-katowice-l12122-d92406", info: "Номер належить Asma Barber у Катовіце, ul. 1 Maja 38.", confidence: "95", reason: "Точний збіг номера, назви, послуги та міста.", cities: "Katowice" }],
  ["+380677640227", { url: "https://infoza.top/posts/37860", info: "У відкритому обговоренні номер підписаний як Андрій-перевізник, який заїжджає до Катовіце й Тихів.", confidence: "85", reason: "Точний збіг номера, імені, послуги та географії.", cities: "Katowice, Tychy" }],
  ["+48783715058", { url: "https://ukrbg.com/listings/4700", info: "Номер знайдено в оголошенні бюро легалізації Dokument UA13; контакт підписаний як Oleksandr Voronin.", confidence: "95", reason: "Точний збіг номера, назви й послуги легалізації документів." }],
  ["+380969646086", { url: "https://autolifepl.com/", info: "Номер належить сервісу «Авто-лайф», який перевозить пасажирів і посилки між Україною та Сілезією.", confidence: "95", reason: "Точний збіг номера та послуги перевезення.", cities: "Katowice" }],
  ["+48800190590", { url: "https://www.nfz.gov.pl/aktualnosci/aktualnosci-centrali/ukrainski-i-rosyjski-to-kolejne-jezyki-w-jakich-porozumiesz-sie-dzwoniac-pod-numer-telefonicznej-informacji-pacjenta,7751.html", info: "Номер підтверджений як загальнопольська Телефонна інформація пацієнта NFZ, доступна українською мовою.", confidence: "100", reason: "Точний збіг номера та послуги в офіційному джерелі." }],
  ["+380505627054", { url: "https://apostille.kiev.ua/kontakt-apostille.htm", info: "Номер належить компанії «Апостиль», яка займається апостилюванням, легалізацією та перекладом документів.", confidence: "100", reason: "Точний збіг номера та послуги на офіційному сайті." }],
  ["+380982854501", { url: "https://kapitoly.com/ua/khmelnytskyi/chat?p=1", info: "Номер знайдено в актуальних оголошеннях Сергія про перегон автомобілів між Україною та країнами ЄС.", confidence: "90", reason: "Точний збіг номера, імені та послуги перегону авто." }],
]);

const websiteUpdates = new Map([
  ["84", "https://moreukraine.pl/"],
  ["161", "https://apnt.app/studiobykaminski"],
  ["225", "https://asmabarber.booksy.com"],
  ["231", "https://ukrbg.com/listings/4700"],
  ["234", "https://autolifepl.com/"],
  ["244", "https://apostille.kiev.ua/"],
]);

const { headers: catalogHeaders, records: catalogRows } = parseCsv(readFileSync(catalogPath, "utf8"));
const activeRows = catalogRows.filter((row) => !/^дублікат(?:\s|$)/iu.test(row["Дія після перевірки"] || ""));
const eligibleRows = activeRows.filter((row) => {
  const social = (row["Соцмережі"] || "").toLowerCase();
  const hasInstagramOrFacebook =
    /instagram\.com|facebook\.com|(?:^|[/\s])(?:instagram|facebook)\s*:/.test(social);
  return Boolean((row["Телефон"] || "").trim()) && !hasInstagramOrFacebook;
});

for (const row of catalogRows) {
  row["Коментар"] = (row["Коментар"] || "")
    .replace(/(?:^|\s*)Пошук за номером телефону не дав результатів \(перевірено автоматично\)\.?/giu, "")
    .replace(/\s*\|\s*$/u, "")
    .trim();
  const website = websiteUpdates.get(row["№"]);
  if (website && !row["Сайт"]) row["Сайт"] = website;
  if (row["№"] === "225" && /booksy\.com/i.test(row["Соцмережі"] || "")) row["Соцмережі"] = "";
  if (row["№"] === "74") row["Міста з опису джерела"] = "Żory";
  if (row["№"] === "84" && !row["Назва"]) row["Назва"] = "MoreUkraine / Дрімтур";
  if (row["№"] === "234" && !row["Назва"]) row["Назва"] = "Авто-лайф";
}

const { headers: sourceHeaders, records: sourceRows } = parseCsv(readFileSync(sourcesPath, "utf8"));
const retainedSources = sourceRows.filter((row) => row.source_type !== "phonesearch");
const phoneSources = eligibleRows.map((row) => {
  const phone = (row["Телефон"] || "").trim();
  const found = confirmedByPhone.get(phone);
  return {
    id: row["№"],
    name: row["Назва"] || row["Ім'я"] || row["Підкатегорія"],
    source_type: "phonesearch",
    identifier: found?.url || "",
    status: found ? "ok" : "not_found",
    info: found?.info || "Пошук за номером телефону не дав релевантних результатів за ім'ям, компанією або послугою.",
    photo_file: "",
    found_automatically: "true",
    confidence_score: found?.confidence || "0",
    confidence_reason: found?.reason || "Точний номер перевірено у веб-пошуку; релевантного збігу не знайдено.",
    cities: found?.cities || "",
  };
});

writeCsv(catalogPath, catalogHeaders, catalogRows);
writeCsv(sourcesPath, sourceHeaders, [...retainedSources, ...phoneSources]);

console.log(`Phone lookup updated for ${eligibleRows.length} catalog rows.`);
console.log(`${phoneSources.filter((row) => row.status === "ok").length} matched; ${phoneSources.filter((row) => row.status === "not_found").length} not found.`);
