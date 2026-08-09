import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const catalogPath = resolve(root, "каталог_специалистов.csv");
const sourcesPath = resolve(root, "all_sources_results_ua.csv");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") value += char;
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
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(path, headers, records, bom = false) {
  const content = [headers, ...records.map((record) => headers.map((header) => record[header] || ""))]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\n");
  writeFileSync(path, `${bom ? "\uFEFF" : ""}${content}\n`, "utf8");
}

function appendUnique(current, additions) {
  const values = (current || "").split(/\n{2,}/u).map((value) => value.trim()).filter(Boolean);
  for (const addition of additions) {
    if (addition && !values.includes(addition.trim())) values.push(addition.trim());
  }
  return values.join("\n\n");
}

function removeExact(current, removals) {
  const removalSet = new Set(removals.map((value) => value.trim()));
  return (current || "")
    .split(/\n{2,}/u)
    .map((value) => value.trim())
    .filter((value) => value && !removalSet.has(value))
    .join("\n\n");
}

const fb = (post, comment, reply = "") =>
  `https://www.facebook.com/groups/Nashi.v.Katowice/posts/${post}/?comment_id=${comment}${reply ? `&reply_comment_id=${reply}` : ""}`;

const facebookProfiles = new Map([
  ["53", "https://www.facebook.com/profile.php?id=61564225257487"],
  ["289", "https://www.facebook.com/profile.php?id=61578440733109"],
  ["291", "https://www.facebook.com/profile.php?id=61574615980220"],
  ["292", "https://www.facebook.com/profile.php?id=61588959071645"],
  ["293", "https://www.facebook.com/profile.php?id=61583779524232"],
  ["296", "https://www.facebook.com/profile.php?id=100009125586735"],
  ["297", "https://www.facebook.com/profile.php?id=100003044215680"],
  ["298", "https://www.facebook.com/profile.php?id=100001795932063"],
  ["299", "https://www.facebook.com/profile.php?id=100001663086942"],
  ["300", "https://www.facebook.com/profile.php?id=100001980136154"],
  ["302", "https://www.facebook.com/profile.php?id=100017935546657"],
  ["303", "https://www.facebook.com/profile.php?id=100042691300541"],
  ["305", "https://www.facebook.com/profile.php?id=100006053344450"],
  ["308", "https://www.facebook.com/profile.php?id=1460349002"],
  ["309", "https://www.facebook.com/profile.php?id=100005260515288"],
  ["310", "https://www.facebook.com/profile.php?id=100017198021841"],
  ["311", "https://www.facebook.com/profile.php?id=100002063332321"],
  ["316", "https://www.facebook.com/tetyana.shlikhutka"],
  ["317", "https://www.facebook.com/Iryna.Zavorotna"],
  ["262", "https://www.facebook.com/profile.php?id=100001199805462"],
  ["322", "https://www.facebook.com/profile.php?id=100015773268389"],
  ["323", "https://www.facebook.com/profile.php?id=100001552217997"],
  ["324", "https://www.facebook.com/profile.php?id=100001876398783"],
  ["326", "https://www.facebook.com/profile.php?id=100036130687998"],
  ["327", "https://www.facebook.com/profile.php?id=61586103961918"],
  ["328", "https://www.facebook.com/evgen.skripnik.497085"],
  ["329", "https://www.facebook.com/anna.andreeva.936419"],
]);

function mergeSocial(current, addition) {
  const values = (current || "").split(/\s+/u).filter(Boolean);
  if (addition && !values.includes(addition)) values.push(addition);
  return values.join("\n");
}

const existing = [
  {
    id: "264",
    category: "Послуги",
  },
  {
    id: "183",
    subcategory: "Юрист і психолог (безкоштовно)",
    comments: ["У Центрі допомоги мігрантам і біженцям Caritas у центрі Катовіце можна безкоштовно звернутися до психолога."],
    mentions: [["Centrum Pomocy Migrantom i Uchodźcom Caritas Archidiecezji Katowickiej — безкоштовні психологи в центрі Катовіце.", "2760256704354767", "2761000697613701"]],
  },
  {
    id: "145",
    title: "Zdorovo",
    subcategory: "Дерматолог, дитячий дерматолог, трихолог, косметолог",
    phone: "+48815032278",
    website: "https://zdorovo.pl/u-zdorovo-katowice-rozpochala-konsultacziyi-dermatolog-olga-lipkevych",
    confidence: "90",
    cities: "Katowice",
    problem: "ні",
    reason: "",
    comments: ["Приймає дорослих і дітей у Zdorovo Katowice; консультує щодо висипів, сухості шкіри, родимок, випадіння волосся та проблем шкіри обличчя. Запис: 815 032 278."],
    mentions: [["Ольгу Ліпкевич у Катовіце позначили у свіжій гілці про дитячого дерматолога.", "2796621854051585", "2796971130683324"]],
  },
  {
    id: "253",
    comments: ["Приймає у клініці Zdorovo. Запис: 815 032 278."],
    mentions: [["Денис Дьячук, уролог у клініці Zdorovo. Запис: 815 032 278.", "2791410624572708", "2794650587582045"]],
  },
  {
    id: "262",
    reviews: [["Рекомендую Олександра Волошина.", "2779117882468649", "2780215739025530"]],
    comments: ["У групі також вказано номер телефону: +48 574 657 668."],
    mentions: [["Олександр Волошин, телефон +48 574 657 668.", "2755946361452468", "2756573274723110"]],
  },
  {
    id: "115",
    cities: "Katowice, Sosnowiec",
    mentions: [["Olena Lypovska, ЛОР у Sosnowiec.", "2739483366432101", "2740326766347761"]],
  },
  {
    id: "251",
    mentions: [["Лідія Рибак, ЛОР у клініці Zdorovo в Катовіце. Запис: 815 032 278.", "2771709596542811", "2771770849870019"]],
  },
  {
    id: "23",
    comments: ["У Bliss Studio в центрі Катовіце рекомендують записатися до Вікторії: відзначають професійний підхід та уважність до деталей."],
    evidence: [["У Bliss Studio в центрі Катовіце рекомендують записатися до Вікторії: професійний підхід, уважність до деталей і любов до своєї справи.", "2791229567924147", "2793791544334616"]],
  },
  {
    id: "49",
    removeReviews: ["Рекомендую перукарку Yuliia — @hairdresser.000."],
    reviews: [["Рекомендую перукарку Yuliia, @hairdresser.000.", "2791229567924147", "2804739716573132"]],
  },
  {
    id: "162",
    subcategory: "Лікарка POZ, педіатрія",
    confidence: "85",
    cities: "Katowice, Mikołów",
    problem: "ні",
    reason: "",
    reviews: [["У клініці Avimed приймає українська педіатриня Оксана Камінська. Номер реєстратури: 519 147 004.", "2510597225987384", "2510861782627595"]],
  },
  {
    id: "214",
    mentions: [["У Sana Medical Care є український педіатр.", "2510597225987384", "2510782165968890"]],
  },
  {
    id: "53",
    reviews: [
      ["Українська стоматологія", "2763580207355750", "2764724180574686"],
      ["Українська стоматологія в Тихи\nБєльська, 33", "2763580207355750", "2763973070649797"],
    ],
  },
  {
    id: "92",
    removeReviews: [
      "Роман Нарепеха рекомендую",
      "Так пан Роман найкращій)",
      "У Катовіце приймає хороший ортопед, Роман Нарепеха. Медичний центр Medteam",
    ],
    reviews: [
      ["Рекомендую Романа Нарепеху.", "2771787006535070", "2778792729167831"],
      ["Так, пан Роман найкращий.", "2771787006535070", "2774243099622794"],
      ["У Катовіце приймає хороший ортопед Роман Нарепеха у медичному центрі Medteam.", "2771787006535070", "2774172192963218"],
    ],
  },
  {
    id: "148",
    reviews: [["Рекомендую, Паляныця.", "2411149452598829", "2412473082466466"]],
  },
  {
    id: "55",
    reviews: [["Гарний лікар, і ціни адекватні, але в Siemianowice. Hermana Wróbla 10A, 41-100. +48 660 755 538 Катерина", "2811471445899959", "2812345492479221"]],
  },
  {
    id: "96",
    reviews: [["Анжеліка Дячук у Zdorovo.pl — чудова спеціалістка і чудова людина.", "2768640713516366", "2769129240134180"]],
  },
  {
    id: "18",
    reviews: [["Рекомендую Яніну Шиманську!", "2517772771936496", "2518316598548780"]],
  },
];

const candidates = [
  {
    id: "289", name: "Svitlana Trofymenko", title: "Craft Dental", category: "Здоров'я", subcategory: "Стоматолог",
    website: "https://craftdental.eu/", social: "https://www.facebook.com/profile.php?id=100006649236757", problem: "ні", confidence: "85",
    reviews: [
      ["Я лікую, дуже задоволена. Дуже уважна, компетентна. Рекомендую", "2832555037124933", "2832837320430038"],
      ["Дуже гарний лікар стоматолог,задоволена її роботою,робила у неї каналове лікування зубів,прості пломби і коронки", "2832555037124933", "2832852753761828"],
      ["craftdental.eu раджу", "2763580207355750", "2763944017319369"],
      ["Svitlana Trofymenko рекомендую на 100%.", "2683029058744199", "2685339181846520"],
      ["Рекомендую Svitlana Trofymenko, Craft Dental.", "2683029058744199", "2685016131878825"],
    ],
  },
  { id: "290", name: "Tetiana Oleksiienko", title: "Stomatologia WAMED", category: "Здоров'я", subcategory: "Стоматолог", phone: "+48322099002", website: "https://wamed.katowice.pl/lekarze/", problem: "ні", confidence: "85", cities: "Katowice", comments: ["Лікарка-стоматологиня у WAMED. Напрями: терапевтична стоматологія, лікування під наркозом і протезування. Клініка: ul. Pogodna 2a, Katowice."], mentions: [["Stomatologia WAMED Katowice, Mariusz Kowalczyk.", "2763580207355750", "2765981003782337"], ["У WAMED Katowice приймає стоматологиня Tetiana Oleksiienko.", "2683029058744199", "2685003955213376"]] },
  { id: "291", title: "Centrum Stomatologii Periodent", category: "Здоров'я", subcategory: "Стоматологія", problem: "ні", confidence: "45", mentions: [["Centrum Stomatologii Periodent", "2763580207355750", "2765387390508365"]] },
  { id: "292", title: "Stomatologia DS Sosnowiec", category: "Здоров'я", subcategory: "Стоматологія", phone: "+48573424440", social: "https://www.instagram.com/ds_clinic12", problem: "ні", confidence: "90", cities: "Sosnowiec", removeReviews: ["+48573424440 В Сосновцю", "Стоматологія в Сосновці: +48 573 424 440."], reviews: [["У Сосновці працюють українські лікарі, дуже рекомендую Stomatologia DS Sosnowiec.", "2738006863246418", "2747925902254514"], ["Рекомендую Stomatologia DS Sosnowiec: у клініці працюють українські лікарі.", "2683029058744199", "2745140399199731"]], mentions: [["Стоматологія в Сосновці: +48 573 424 440.", "2763580207355750", "2764349123945525"]] },
  { id: "293", title: "Stomatolog Bytom", category: "Здоров'я", subcategory: "Стоматолог", phone: "+48790444150", problem: "ні", action: "об'єднано дублікат id 295", reviews: [["Stomatolog Bytom рекомендую)", "2763580207355750", "2764339273946510"]], mentions: [["Stomatolog Bytom", "2738006863246418", "2738325936547844"], ["Стоматологія в Битомі, телефон +48 790 444 150.", "2763580207355750", "2763995463980891"]] },
  { id: "294", title: "Мануфактура успіху", category: "Здоров'я", subcategory: "Стоматологія", problem: "так", confidence: "35", reason: "Потрібно уточнити офіційну назву та контакти.", mentions: [["Мануфактура успіху в сосновцю", "2763580207355750", "2764320657281705"]] },
  { id: "296", name: "Anastasiia Kravchenko", category: "Здоров'я", subcategory: "Стоматолог", problem: "ні", confidence: "35", comments: ["Лікарка-стоматологиня з Харкова, досвід понад 10 років; запрошує на консультацію."], evidence: [["Я лікар-стоматолог з Харкова зі стажем бульше ніж 10 років.\nЗапрошую до себе на консультацію. Катовіце", "2763580207355750", "2763908000656304"]] },
  { id: "297", name: "Aleksandra Kruk", category: "Здоров'я", subcategory: "Дитячий психолог", problem: "ні", reviews: [["Aleksandra Kruk щиро рекомендую)))", "2720204265026678", "2720575558322882"]], mentions: [["Aleksandra Kruk", "2742663736114064", "2743699396010498"], ["Aleksandra Kruk", "2742663736114064", "2742982422748862"]] },
  { id: "298", name: "Serhii Drozdov", category: "Здоров'я", subcategory: "Психолог онлайн", phone: "+380673505372", problem: "ні", confidence: "35", comments: ["Психолог, працює онлайн; доступний у WhatsApp, Telegram і Viber."], evidence: [["Добрий день. Я психолог, працюю онлайн, звертайтесь +380673505372\n( WhatsApp, я жеTelegram,Viber) або особисті повідомлення", "2720204265026678", "2720362518344186"]] },
  { id: "299", name: "Tatiana Doronina", category: "Здоров'я", subcategory: "Дитячий психолог", problem: "ні", confidence: "35", comments: ["Працює з дітьми від трьох років до повноліття, зокрема офлайн із дітьми з РДУГ."], evidence: [["Запрошую до співпраці. Працюю з дітками від трьох років до повного дорослішання:)", "2720204265026678", "2720299235017181"], ["Працюю офлайн із такими дітьми в місті Jastrzębie-Zdrój.", "2742663736114064", "2742734346107003"]] },
  { id: "300", name: "Татьяна Ващенко", category: "Здоров'я", subcategory: "Дитячий психолог", social: "https://www.instagram.com/psiholog.t.vashchenko", problem: "ні", confidence: "35", comments: ["На сторінці психологині є відгуки, безкоштовні матеріали та відповіді на запитання."], evidence: [["Запрошую\nНа моїй сторінці ви знайдете відгуки та безкоштовні матеріали і відповіді на деякі питання", "2720204265026678", "2720284391685332"]] },
  { id: "301", title: "Strefa Zmiany", category: "Здоров'я", subcategory: "Психотерапія", website: "https://strefazmianykatowice.pl", phone: "+48536050680", problem: "ні", confidence: "35", mentions: [["Poradnia psychoterapii I rozwoju \"Strefa Zmiany\" для дітей і молоді, а також батьків", "2720204265026678", "2720268291686942"]] },
  { id: "302", name: "Roman Pawel Montecki", category: "Здоров'я", subcategory: "Психолог для підлітків", problem: "так", confidence: "35", reason: "Самопрезентація без незалежного відгуку.", comments: ["Працює з підлітками."], evidence: [["Запрошую до співпраці. Працюю з підлітками", "2720204265026678", "2720266971687074"]] },
  { id: "303", name: "Наталя Македон", category: "Здоров'я", subcategory: "Фізіотерапія та масаж", phone: "+48881364828", problem: "ні", comments: ["Зі слів фахівчині: вища медична освіта та 15 років досвіду в масажі й реабілітації."], reviews: [["Наталя Македон рекомендую, физиотерапевт", "2771787006535070", "2773585033021934"]], evidence: [["Запрошую до себе на масаж та реабілітацію, вища медична освіта, стаж в роботі 15 років.881364828", "2771787006535070", "2778694399177664"]] },
  { id: "304", name: "Олександр Сорока", category: "Здоров'я", subcategory: "Ортопед", phone: "+48815032278", problem: "так", confidence: "35", reason: "Суперечливі відгуки; є негативний відгук. Телефон може бути спільним номером клініки. Потрібна ручна перевірка.", removeReviews: ["кого ви радите? Про нього 10 із 10 людей відгукнулися дуже погано."], reviews: [["Рекомендую, ортопед. Олександр Сорока 815 032 278", "2771787006535070", "2773584743021963"]], warnings: [["Кого ви радите? Про нього 10 із 10 людей відгукнулися дуже погано.", "2771787006535070", "2773584743021963", "2773718499675254"]] },
  { id: "305", name: "Oleg Lipkevych", category: "Здоров'я", subcategory: "Масаж", problem: "ні", confidence: "35", mentions: [["Masaż Oleg Lipkevych", "2771787006535070", "2773300266383744"]] },
  { id: "307", title: "Tbilisuri Katowice", category: "Заклади", subcategory: "Ресторан, зал для святкувань", phone: "+48799078977", website: "https://tbilisuri.eatbu.com/?lang=uk", social: "", replaceSocial: true, replaceReviews: true, adminNote: "", problem: "ні", confidence: "90", cities: "Katowice", reviews: [["Щиро рекомендую Tbilisuri Katowice: є окремий зал, де можна провести церемонію і весело відсвяткувати.", "2411149452598829", "2412458662467908"]], comments: ["Грузинський ресторан проводить дні народження, хрестини, причастя, корпоративні та інші приватні заходи. Адреса: ul. Szarych Szeregów 42, Katowice. Телефон: +48 799 078 977."] },
  { id: "308", name: "Bogdan Sorokhman", category: "Послуги", subcategory: "Ведучий та DJ", phone: "+48794172433", problem: "ні", confidence: "35", comments: ["Ведучий і DJ; працює українською та польською мовами."], evidence: [["Ведучий і Діджей\nТелефон 794172433", "2411149452598829", "2412173689163072"], ["Wodzirej+ Dj\nMówimy nie tylko w języku ukraińskim:-).\nTel. 794172433", "2411149452598829", "2412077952505979"]] },
  { id: "309", name: "Юлія Чернова", category: "Послуги", subcategory: "Ведуча заходів", social: "https://www.instagram.com/prazdnik.v.kaif", problem: "ні", confidence: "35", comments: ["Ведуча для свят і приватних заходів."], evidence: [["Вітаю\nЯкщо буде потрібна ведуча запрошую до співпраці", "2411149452598829", "2412168782496896"]] },
  { id: "310", name: "Стадник Наталия", category: "Послуги", subcategory: "Ведуча та музика", phone: "+48881632887", problem: "ні", confidence: "35", comments: ["Пропонує послуги ведучої та музичний супровід весіль."], evidence: [["Якщо вам буде потрібна ведуча і музика на весілля звертайтесь 881632887", "2411149452598829", "2412131152500659"]] },
  { id: "311", name: "Roman Petryshak", category: "Послуги", subcategory: "Фото та відеозйомка", problem: "ні", confidence: "35", comments: ["Пропонує фото- та відеозйомку; приклади робіт надсилає приватно."], evidence: [["Якщо б цікавила фото чи відео зйомка - пишіть в ПП. Скину роботи", "2411149452598829", "2412122675834840"]] },
  { id: "312", name: "Ольга", title: "Przychodnia Weterynaryjna Centrum", category: "Здоров'я", subcategory: "Ветеринар", website: "https://weterynarz.pl/Glowna.is.przychodnia-weterynaryjna-centrum-anna-swadzba-swietochlowice-pocztowa.html", problem: "ні", confidence: "60", cities: "Świętochłowice", reviews: [["Є наша лікарка Ольга на Pocztowa 3, Świętochłowice. Понеділок, середа, п'ятниця з 12:00. Вівторок і четвер — зранку. Але там жива черга, і можна довго просидіти. Їжджу до неї з Руди.", "2811471445899959", "2811808882532882"]] },
  { id: "313", name: "Galina Derevianko", category: "Здоров'я", subcategory: "Дерматолог, косметолог, трихолог", phone: "+48530091658", social: "https://www.facebook.com/kosmetolog.trycholog.dermatolog\nhttps://www.facebook.com/GalynaDerevianko\nhttps://www.instagram.com/doktor.derevianko", problem: "ні", confidence: "90", cities: "Kraków", removeReviews: ["Galina Derevianko рекомендую, відмінний лікар, має онлайн консультації та очний прийом в Кракові"], reviews: [["Galina Derevianko рекомендую, відмінний лікар, має онлайн-консультації та очний прийом у Кракові.", "2796621854051585", "2796810674032703"], ["Рекомендую дерматологиню, косметологиню-ін'єкціоністку та трихологиню Galina Derevianko. З власного досвіду — найкраща. Довіряю себе тільки їй уже багато років.", "2676727149374390", "2687735268273578"]], comments: ["Працює у Польщі та має польську ліцензію. Телефон: +48 530 091 658."], mentions: [["У свіжій рекомендації вказано професійні сторінки Galina Derevianko в Instagram і Facebook.", "2676727149374390", "2687735268273578"]] },
  { id: "314", name: "Вікторія Загородня", title: "Top Clinic / Centrum Medyczne GAVITA", category: "Здоров'я", subcategory: "Гінеколог", website: "https://www.znanylekarz.pl/viktoriia-zagorodnia/ginekolog/bedzin", social: "https://www.facebook.com/viktoriia.zagorodnia", problem: "ні", confidence: "90", cities: "Będzin, Mysłowice", reason: "", reviews: [["З власного досвіду рекомендую Вікторію Загородню.", "2768640713516366", "2769085630138541"]], comments: ["Приватний прийом у Top Clinic, ul. 11 Listopada 18b/1, Będzin, та Centrum Medyczne GAVITA, ul. Mikołowska 38, Mysłowice."] },
  { id: "315", name: "Maria Jegorowa", category: "Здоров'я", subcategory: "Доула та медична перекладачка", social: "https://www.facebook.com/maria.egorova.923", problem: "ні", confidence: "80", cities: "Katowice, Mysłowice", comments: ["Може супроводити до польського гінеколога за NFZ як перекладачка та підтримати як доула."], evidence: [["Дівчата, якщо ви хочете піти до польського гінеколога за NFZ, але трохи хвилюєтеся, я можу піти з вами як перекладачка та підтримати вас як доула.", "2517772771936496", "2518345171879256"]] },
  { id: "316", name: "Tetiana Lutsenko-Shlikhutka", title: "Stopą w chmurach", category: "Здоров'я", subcategory: "Подолог, фізіотерапевт", social: "https://www.instagram.com/podolog_stopa_w_chmurach", problem: "ні", confidence: "90", cities: "Chełmek", reviews: [["Рекомендую подологиню Тетяну Луценко-Шліхутку.", "2667492470297858", "2668646036849168"]] },
  { id: "317", name: "Iryna Zavorotna", category: "Здоров'я", subcategory: "Психолог, психотерапевт, сексолог", social: "https://www.instagram.com/iryna_zavorotna", problem: "так", confidence: "75", reason: "Самопрезентація без незалежного відгуку; місто прийому не вказане у профілі.", comments: ["Психотерапевтка та сексологиня; пропонує звертатися на консультацію."], evidence: [["Психотерапевтка. Сексологиня. Звертайтеся.", "2667492470297858", "2668349466878825"]] },
  { id: "318", name: "Bartosz Macionczyk", title: "LiftMed", category: "Здоров'я", subcategory: "ЛОР, хірург голови та шиї", phone: "+48324408899", website: "https://www.liftmed.pl/specjalista/lek-bartosz-macionczyk", problem: "ні", confidence: "90", cities: "Rybnik", reviews: [["Чоловікові видаляли мигдалики та робили пластику м'якого піднебіння у LiftMed. Лікар Bartosz Macionczyk. Усе пройшло чудово, наступного дня він уже був удома.", "2827002227680214", "2828982250815545"]] },
  { id: "320", name: "Władimir Malarenko", title: "Polis Clinic", category: "Здоров'я", subcategory: "Невролог", website: "https://www.znanylekarz.pl/wladimir-malarenko/neurolog/lazy", problem: "ні", confidence: "90", cities: "Katowice", reviews: [["Władimir Malarenko, дуже хороший лікар.", "2755946361452468", "2756025174777920"]], comments: ["Український невролог у Polis Clinic, Mickiewicza 26/2, Katowice."], mentions: [["Władimir Malarenko, український невролог у Polis Clinic, Mickiewicza 26/2, Katowice.", "2755946361452468", "2756781131368991"]] },
  { id: "321", title: "Górnośląskie Centrum Zdrowia Dziecka", category: "Здоров'я", subcategory: "Дитяча ендокринологія", phone: "+48322071654", website: "https://gczd.katowice.pl/index.php/home/jednostki-szpitala/oddzialy/oddzial-pediatrii-endokrynologii-dzieciecej-z-pododdzialem-zaburzen-rozwoju-plci/", problem: "так", confidence: "85", cities: "Katowice", reason: "Відділення та контакти підтверджено, але у рекомендаціях не названо конкретного лікаря і немає оцінки якості прийому.", comments: ["Відділення педіатрії та дитячої ендокринології GCZD, ul. Medyków 16, Katowice. Телефон секретаріату: 32 207 16 54."], mentions: [["Учасниця групи порадила відділення педіатрії та дитячої ендокринології GCZD у Катовіце.", "2830393764007727", "2830493583997745"], ["У групі вказали, що дитячий ендокринолог приймає у лікарні на ul. Medyków у Катовіце.", "2830393764007727", "2830463400667430"]] },
  { id: "322", name: "Tetiana Kryvenko", category: "Здоров'я", subcategory: "Алерголог, гастроентеролог", website: "https://telemedi.com/pl/lekarze/tetiana-kryvenko", problem: "так", confidence: "70", cities: "Tychy", reason: "У свіжій рекомендації лікарку названо алергологинею у Tychy, але актуальний польський профіль Telemedi вказує загальну медицину, а Facebook — місце проживання Kyiv. Потрібно підтвердити адресу та поточну спеціалізацію.", comments: ["Прийом у Tychy; українські медичні профілі вказують спеціалізації з алергології та гастроентерології."], mentions: [["У Tychy порадили лікарку Tetiana Kryvenko у відповідь на запит про алерголога.", "2781652822215155", "2782584672121970"]] },
  { id: "323", name: "Kateryna Stankevych", title: "Caritas", category: "Здоров'я", subcategory: "Психолог", problem: "ні", confidence: "85", cities: "Katowice", reviews: [["Рекомендую Kateryna Stankevych із власного досвіду.", "2760256704354767", "2763910943989343"]], comments: ["Психологиня в Caritas; у Facebook-профілі вказано місце проживання Katowice."], mentions: [["У рекомендації позначено особистий Facebook-профіль Kateryna Stankevych.", "2760256704354767", "2763910943989343"]] },
  { id: "324", name: "Inna Loitra", category: "Здоров'я", subcategory: "Психолог-консультант", problem: "ні", confidence: "55", cities: "Katowice", comments: ["Facebook-профіль підтверджує роботу психологинею-консультанткою та проживання в Katowice."], mentions: [["Inna Loitra", "2760256704354767", "2761682434212194"], ["Inna Loitra", "2726639941049777", "2726694561044315"]] },
  { id: "325", name: "Інна Москалюк", category: "Здоров'я", subcategory: "Дитячий психіатр", website: "https://innamoskaliuk.pp.ua/", social: "https://www.instagram.com/doc_moskaliuk", problem: "ні", confidence: "90", reviews: [["Приймає в Лодзі й онлайн. Рекомендую.", "2509673646079742", "2509896412724132"]], comments: ["Консультує дітей і підлітків з аутизмом, РДУГ та іншими розладами; доступні онлайн- й офлайн-консультації."], mentions: [["У рекомендації збережено пряме посилання на Instagram дитячої психіатрині.", "2509673646079742", "2509896412724132"]] },
  { id: "326", name: "Наталія Кудінова", category: "Здоров'я", subcategory: "Дитячий психолог", problem: "так", confidence: "55", reason: "Є рекомендація з власного досвіду у відповідь на запит про україномовного або російськомовного психолога для дитини з РДУГ, але професію та актуальне місто прийому не вказано у профілі.", reviews: [["Глівіце, Наталія Кудінова. Ми ходимо з сином. Рекомендую.", "2742663736114064", "2743651276015310"]] },
  { id: "327", title: "Planeta Terapii Katowice", category: "Здоров'я", subcategory: "Центр дитячої терапії", problem: "ні", confidence: "65", cities: "Katowice", comments: ["Допомагають дітям розвиватися за сучасними доказовими методами терапії та індивідуально підбирають програму. У профілі вказані українська, російська, польська й англійська мови."], mentions: [["Planeta Terapii Katowice", "2742663736114064", "2745796705800767"], ["Planeta Terapii Katowice", "2742663736114064", "2742749302772174"]], evidence: [["Запрошуємо.", "2742663736114064", "2742776832769421"]] },
  { id: "328", name: "Євген Скрипник", category: "Здоров'я", subcategory: "Психіатр, невролог онлайн", phone: "+380665691677", website: "https://therapy-website.vercel.app/main-page", social: "https://www.instagram.com/dr_skripnik_Evgen_", problem: "ні", confidence: "90", reviews: [["Також рекомендую Євгена Скрипника. Є можливість онлайн-консультації.", "2726639941049777", "2726803874366717"]], comments: ["Доказовий лікар-психіатр і невролог вищої категорії. Запис на онлайн-консультацію через Telegram за номером +380 66 569 16 77." ] },
  { id: "329", name: "Anna Andreeva", category: "Здоров'я", subcategory: "Сімейний психотерапевт онлайн", problem: "ні", confidence: "55", cities: "Kyiv", comments: ["Працює онлайн із дітьми, підлітками та дорослими; заявлені напрямки: панічні атаки, апатія, безсоння, депресія та взаємини у парі й сім'ї."], evidence: [["Я сімейний психотерапевт. Працюю з дітьми, підлітками та дорослими; проводжу онлайн-прийом.", "2726639941049777", "2726757177704720"]] },
];

const supportingSources = [
  {
    id: "307",
    name: "Tbilisuri Katowice",
    source_type: "website",
    identifier: "https://tbilisuri.eatbu.com/?lang=uk",
    status: "ok",
    info: "Грузинський ресторан у Katowice з можливістю організації приватних заходів. Адреса: ul. Szarych Szeregów 42. Телефон: +48 799 078 977; email: tbilisuriktw@gmail.com.",
    photo_file: "",
    found_automatically: "false",
    confidence_score: "90",
    confidence_reason: "Назву, адресу, контакти та організацію приватних заходів підтверджено на офіційному сайті; у групі є незалежна рекомендація.",
    cities: "Katowice",
  },
  {
    id: "290",
    name: "Tetiana Oleksiienko",
    source_type: "website",
    identifier: "https://wamed.katowice.pl/lekarze/",
    status: "ok",
    info: "Лікарка-стоматологиня у Stomatologia WAMED. Проводить терапевтичне стоматологічне лікування, лікування під наркозом і протезування. Клініка WAMED у Katowice: ul. Pogodna 2a, телефон +48 32 209 90 02.",
    photo_file: "",
    found_automatically: "false",
    confidence_score: "85",
    confidence_reason: "Ім'я, місце роботи, спеціалізацію, адресу та телефон підтверджено на офіційному сайті WAMED.",
    cities: "Katowice",
  },
  {
    id: "328",
    name: "Євген Скрипник",
    source_type: "facebook",
    identifier: "https://www.facebook.com/evgen.skripnik.497085",
    status: "ok",
    info: "Український лікар-психіатр і невролог вищої категорії. Профіль містить телефон для запису на онлайн-консультацію та посилання на Instagram.",
    photo_file: "",
    found_automatically: "false",
    confidence_score: "90",
    confidence_reason: "Спеціалізацію, мову, онлайн-формат і контакти підтверджено в професійному Facebook-профілі; у групі є незалежна рекомендація.",
    cities: "Kyiv",
  },
  {
    id: "329",
    name: "Anna Andreeva",
    source_type: "facebook",
    identifier: "https://www.facebook.com/anna.andreeva.936419",
    status: "ok",
    info: "Психотерапевтка, проводить індивідуальну й сімейну психотерапію та працює з дітьми й підлітками. У профілі вказано Kyiv.",
    photo_file: "other_sources_photos/329_anna_andreeva_facebook.jpg",
    found_automatically: "false",
    confidence_score: "55",
    confidence_reason: "Спеціалізацію та місто підтверджено у Facebook-профілі, але незалежний відгук відсутній.",
    cities: "Kyiv",
  },
  {
    id: "326",
    name: "Наталія Кудінова",
    source_type: "facebook",
    identifier: "https://www.facebook.com/profile.php?id=100036130687998",
    status: "ok",
    info: "Особистий Facebook-профіль Наталії Кудінової. Профіль підтверджує українське походження, але не містить актуальної професії або міста прийому.",
    photo_file: "",
    found_automatically: "false",
    confidence_score: "55",
    confidence_reason: "Профіль відповідає позначеній у рекомендації людині; професію та актуальне місто потрібно підтвердити.",
    cities: "",
  },
  {
    id: "327",
    name: "Planeta Terapii Katowice",
    source_type: "facebook",
    identifier: "https://www.facebook.com/profile.php?id=61586103961918",
    status: "ok",
    info: "Центр дитячої терапії в Katowice. Профіль вказує українську, російську, польську й англійську мови та роботу з дітьми за сучасними доказовими методами.",
    photo_file: "other_sources_photos/327_planeta_terapii_katowice_facebook.jpg",
    found_automatically: "false",
    confidence_score: "65",
    confidence_reason: "Місто, мови та напрям роботи підтверджено у Facebook-профілі; незалежні згадування не містять оцінки якості.",
    cities: "Katowice",
  },
  {
    id: "325",
    name: "Інна Москалюк",
    source_type: "website",
    identifier: "https://innamoskaliuk.pp.ua/",
    status: "ok",
    info: "Дитяча психіатриня Інна Москалюк. Консультує дітей і підлітків з аутизмом, РДУГ, депресією, тривожними розладами та іншими станами; проводить онлайн- й офлайн-консультації та MOXO-діагностику.",
    photo_file: "",
    found_automatically: "false",
    confidence_score: "90",
    confidence_reason: "Ім'я, спеціалізацію, напрямки роботи та формат консультацій підтверджено на офіційному сайті.",
    cities: "",
  },
  {
    id: "323",
    name: "Kateryna Stankevych",
    source_type: "facebook",
    identifier: "https://www.facebook.com/profile.php?id=100001552217997",
    status: "ok",
    info: "Facebook-профіль Kateryna Stankevych вказує роботу психологинею в Caritas із 2022 року та місце проживання Katowice.",
    photo_file: "",
    found_automatically: "false",
    confidence_score: "85",
    confidence_reason: "Профіль підтверджує ім'я, професію, організацію та місто; у групі є незалежна рекомендація з власного досвіду.",
    cities: "Katowice",
  },
  {
    id: "324",
    name: "Inna Loitra",
    source_type: "facebook",
    identifier: "https://www.facebook.com/profile.php?id=100001876398783",
    status: "ok",
    info: "Facebook-профіль Inna Loitra вказує роботу психологинею-консультанткою та місце проживання Katowice.",
    photo_file: "other_sources_photos/324_inna_loitra_facebook.jpg",
    found_automatically: "false",
    confidence_score: "55",
    confidence_reason: "Профіль підтверджує професію й місто, але у групі є лише коротке згадування без оцінки досвіду.",
    cities: "Katowice",
  },
  {
    id: "145",
    name: "Ольга Ліпкевич",
    source_type: "website",
    identifier: "https://zdorovo.pl/u-zdorovo-katowice-rozpochala-konsultacziyi-dermatolog-olga-lipkevych",
    status: "ok",
    info: "Дерматологиня та лікарка естетичної косметології у Zdorovo Katowice. Консультує дорослих і дітей щодо висипів, сухості шкіри, родимок, випадіння волосся та проблем шкіри обличчя. Запис: +48 815 032 278.",
    photo_file: "",
    found_automatically: "false",
    confidence_score: "90",
    confidence_reason: "Спеціалізацію, місто прийому, клініку та телефон підтверджено на офіційному сайті Zdorovo.",
    cities: "Katowice",
  },
  {
    id: "322",
    name: "Tetiana Kryvenko",
    source_type: "website",
    identifier: "https://telemedi.com/pl/lekarze/tetiana-kryvenko",
    status: "ok",
    info: "Польський профіль лікарки Tetiana Kryvenko у Telemedi вказує прийом у Tychy та спеціальність загальної медицини.",
    photo_file: "",
    found_automatically: "false",
    confidence_score: "70",
    confidence_reason: "Ім'я, професію та місто підтверджено у польському медичному профілі; алергологічну спеціалізацію потрібно уточнити.",
    cities: "Tychy",
  },
  {
    id: "322",
    name: "Tetiana Kryvenko",
    source_type: "facebook",
    identifier: "https://www.facebook.com/profile.php?id=100015773268389",
    status: "ok",
    info: "Особистий Facebook-профіль із дописами на медичну тематику; у профілі вказано Kyiv, тому актуальне місце прийому потребує підтвердження.",
    photo_file: "",
    found_automatically: "false",
    confidence_score: "60",
    confidence_reason: "Профіль відповідає позначеній у рекомендації особі, але не підтверджує прийом у Tychy.",
    cities: "",
  },
  {
    id: "322",
    name: "Tetiana Kryvenko",
    source_type: "website_profile",
    identifier: "https://doc.ua/ua/doctor/kiev/tatyana-krivenko",
    status: "ok",
    info: "Український профіль Тетяни Кривенко підтверджує спеціалізації з алергології та гастроентерології, прийом дорослих і дітей. Профіль стосується практики у Kyiv, тому не підтверджує актуальний прийом у Польщі.",
    photo_file: "",
    found_automatically: "false",
    confidence_score: "65",
    confidence_reason: "Спеціалізацію підтверджено, але актуальність польського місця прийому потрібно перевірити.",
    cities: "",
  },
  {
    id: "321",
    name: "Górnośląskie Centrum Zdrowia Dziecka",
    source_type: "website",
    identifier: "https://gczd.katowice.pl/index.php/home/jednostki-szpitala/oddzialy/oddzial-pediatrii-endokrynologii-dzieciecej-z-pododdzialem-zaburzen-rozwoju-plci/",
    status: "ok",
    info: "Офіційне відділення педіатрії та дитячої ендокринології GCZD у Katowice, ul. Medyków 16. Керівниця відділення: prof. Aneta Gawlik-Starzyk. Телефон секретаріату: 32 207 16 54.",
    photo_file: "",
    found_automatically: "false",
    confidence_score: "90",
    confidence_reason: "Профіль відділення, адресу та телефон підтверджено на офіційному сайті GCZD.",
    cities: "Katowice",
  },
  {
    id: "320",
    name: "Władimir Malarenko",
    source_type: "website",
    identifier: "https://www.znanylekarz.pl/wladimir-malarenko/neurolog/lazy",
    status: "ok",
    info: "Невролог у Polis Clinic. Приймає за адресами Mickiewicza 26/2 та 1 Maja 88A у Katowice. Консультує українською та російською. У профілі ZnanyLekarz 142 відгуки, середня оцінка 5/5.",
    photo_file: "",
    found_automatically: "false",
    confidence_score: "90",
    confidence_reason: "Спеціалізацію, мови, адреси прийому та рейтинг підтверджено у профілі ZnanyLekarz.",
    cities: "Katowice",
  },
  {
    id: "318",
    name: "Bartosz Macionczyk",
    source_type: "website",
    identifier: "https://www.liftmed.pl/specjalista/lek-bartosz-macionczyk",
    status: "ok",
    info: "ЛОР і хірург голови та шиї у LiftMed. Проводить операції та ендоскопічну діагностику. Адреса: ul. Cegielniana 14, Rybnik. Телефон: +48 32 440 88 99.",
    photo_file: "",
    found_automatically: "false",
    confidence_score: "90",
    confidence_reason: "Спеціалізацію, місце прийому, адресу та телефон підтверджено на офіційному сайті LiftMed.",
    cities: "Rybnik",
  },
  {
    id: "292",
    name: "Stomatologia DS Sosnowiec",
    source_type: "facebook",
    identifier: "https://www.facebook.com/profile.php?id=61588959071645",
    status: "ok",
    info: "Українська стоматологія у Sosnowiec, ul. Warszawska 12. Послуги: пломбування, ендодонтія, протезування, складна хірургія та імплантація. Телефон: +48 573 424 440.",
    photo_file: "",
    found_automatically: "false",
    confidence_score: "90",
    confidence_reason: "Назву, адресу, послуги, телефон та Instagram підтверджено у Facebook-профілі клініки.",
    cities: "Sosnowiec",
  },
  {
    id: "162",
    name: "Avimed (Катовіце)",
    source_type: "websearch_website",
    identifier: "https://avimed.pl/kontakt/avimed-katowice/",
    status: "ok",
    info: "Avimed, ul. Gliwicka 159, Katowice. Офіційний сайт клініки окремо підтверджує Oksana Kaminska як лікарку POZ, яка приймає у Katowice та Mikołów.",
    photo_file: "",
    found_automatically: "false",
    confidence_score: "90",
    confidence_reason: "Клініку, лікарку та міста прийому підтверджено на офіційному сайті Avimed.",
    cities: "Katowice, Mikołów",
  },
  {
    id: "162",
    name: "Оксана Камінська",
    source_type: "website",
    identifier: "https://avimed.pl/specjalizacje/lekarz-poz/",
    status: "ok",
    info: "Офіційний сайт Avimed підтверджує, що Oksana Kaminska працює лікаркою POZ у Katowice та Mikołów. Avimed публікує номери реєстратури 519 147 003 і 519 147 004.",
    photo_file: "",
    found_automatically: "false",
    confidence_score: "90",
    confidence_reason: "Ім'я, спеціалізацію та міста підтверджено на офіційному сайті клініки.",
    cities: "Katowice, Mikołów",
  },
  {
    id: "312",
    name: "Przychodnia Weterynaryjna Centrum",
    source_type: "website",
    identifier: "https://weterynarz.pl/Glowna.is.przychodnia-weterynaryjna-centrum-anna-swadzba-swietochlowice-pocztowa.html",
    status: "ok",
    info: "Przychodnia Weterynaryjna Centrum, Pocztowa 3, 41-600 Świętochłowice.",
    photo_file: "",
    found_automatically: "false",
    confidence_score: "80",
    confidence_reason: "Назву клініки зіставлено з адресою з рекомендації Facebook.",
    cities: "Świętochłowice",
  },
  {
    id: "313",
    name: "Galina Derevianko",
    source_type: "facebook",
    identifier: "https://www.facebook.com/GalynaDerevianko",
    status: "ok",
    info: "Lekarz dermatolog, trycholog, wenerolog, dermatoskopia, medycyna estetyczna. Kraków.",
    photo_file: "",
    found_automatically: "false",
    confidence_score: "90",
    confidence_reason: "Спеціалізацію та місто підтверджено у Facebook-профілі лікарки.",
    cities: "Kraków",
  },
  {
    id: "314",
    name: "Вікторія Загородня",
    source_type: "facebook",
    identifier: "https://www.facebook.com/viktoriia.zagorodnia",
    status: "ok",
    info: "Лікарка, працює у Хмельницькому перинатальному центрі з 2009 року; навчалася у Вінницькому національному медичному університеті.",
    photo_file: "",
    found_automatically: "false",
    confidence_score: "60",
    confidence_reason: "Facebook-профіль підтверджує українську медичну освіту та професійний досвід; актуальні місця прийому підтверджено окремим польським профілем.",
    cities: "",
  },
  {
    id: "314",
    name: "Вікторія Загородня",
    source_type: "website_profile",
    identifier: "https://www.znanylekarz.pl/viktoriia-zagorodnia/ginekolog/bedzin",
    status: "ok",
    info: "Гінекологиня Вікторія Загородня приймає приватно у Top Clinic, ul. 11 Listopada 18b/1, Będzin, та Centrum Medyczne GAVITA, ul. Mikołowska 38, Mysłowice. У профілі доступний актуальний календар запису.",
    photo_file: "",
    found_automatically: "false",
    confidence_score: "90",
    confidence_reason: "Ім'я, спеціалізацію, дві адреси прийому та актуальний запис підтверджено у польському медичному профілі.",
    cities: "Będzin, Mysłowice",
  },
  {
    id: "315",
    name: "Maria Jegorowa",
    source_type: "facebook",
    identifier: "https://www.facebook.com/maria.egorova.923",
    status: "ok",
    info: "Доула у Катовіце та Сілезії, помічниця під час пологів. Живе у Mysłowice.",
    photo_file: "",
    found_automatically: "false",
    confidence_score: "80",
    confidence_reason: "Послуги та регіон роботи підтверджено у Facebook-профілі.",
    cities: "Katowice, Mysłowice",
  },
  {
    id: "316",
    name: "Tetiana Lutsenko-Shlikhutka",
    source_type: "facebook",
    identifier: "https://www.facebook.com/tetyana.shlikhutka",
    status: "ok",
    info: "Подологиня, фізіотерапевтка та інструкторка Arkada's Brace M. Кабінет Stopą w chmurach у Chełmek.",
    photo_file: "",
    found_automatically: "false",
    confidence_score: "90",
    confidence_reason: "Спеціалізацію, кабінет і місто підтверджено у Facebook-профілі.",
    cities: "Chełmek",
  },
  {
    id: "317",
    name: "Iryna Zavorotna",
    source_type: "facebook",
    identifier: "https://www.facebook.com/Iryna.Zavorotna",
    status: "ok",
    info: "Психологиня, приватна психотерапевтична практика. Працює з кризами, самооцінкою та особистими кордонами.",
    photo_file: "",
    found_automatically: "false",
    confidence_score: "75",
    confidence_reason: "Професію підтверджено у Facebook-профілі; місто прийому не вказане.",
    cities: "",
  },
];

const catalog = parseCsv(readFileSync(catalogPath, "utf8"));
const sources = parseCsv(readFileSync(sourcesPath, "utf8"));
const removedIds = new Set(["31", "77", "295", "319"]);
catalog.records = catalog.records.filter((row) => !removedIds.has(row["№"]));
sources.records = sources.records.filter(
  (row) => !removedIds.has(row.id) && !(row.id === "307" && row.source_type === "facebook"),
);
const byId = new Map(catalog.records.map((row) => [row["№"], row]));

for (const update of existing) {
  const row = byId.get(update.id);
  if (!row) throw new Error(`Catalog row ${update.id} not found`);
  row["Відгук"] = appendUnique(
    removeExact(row["Відгук"], update.removeReviews || []),
    (update.reviews || []).map(([review]) => review),
  );
  row["Коментар"] = appendUnique(row["Коментар"], update.comments || []);
  row["Соцмережі"] = mergeSocial(row["Соцмережі"], facebookProfiles.get(update.id));
  if (update.title) row["Назва"] = update.title;
  if (update.category) row["Категорія"] = update.category;
  if (update.subcategory) row["Підкатегорія"] = update.subcategory;
  if (update.phone) row["Телефон"] = update.phone;
  if (update.website) row["Сайт"] = update.website;
  if (update.confidence) row["Впевненість знайденої інформації"] = update.confidence;
  if (update.cities) row["Міста з опису джерела"] = update.cities;
  if (update.problem) row["Проблемна"] = update.problem;
  if (Object.hasOwn(update, "reason")) row["Причина проблеми"] = update.reason;
  if (update.action) row["Дія після перевірки"] = update.action;
}

for (const candidate of candidates) {
  let row = byId.get(candidate.id);
  if (!row) {
    row = Object.fromEntries(catalog.headers.map((header) => [header, ""]));
    row["№"] = candidate.id;
    catalog.records.push(row);
    byId.set(candidate.id, row);
  }
  Object.assign(row, {
    "Ім'я": candidate.name || "",
    "Назва": candidate.title || "",
    "Категорія": candidate.category,
    "Підкатегорія": candidate.subcategory,
    "Телефон": candidate.phone || "",
    "Сайт": candidate.website || "",
    "Соцмережі": mergeSocial(
      candidate.replaceSocial ? candidate.social : candidate.social || row["Соцмережі"],
      facebookProfiles.get(candidate.id),
    ),
    "Заметка для админа": Object.hasOwn(candidate, "adminNote") ? candidate.adminNote : row["Заметка для админа"],
    "Відгук": appendUnique(
      removeExact(candidate.replaceReviews ? "" : row["Відгук"], [
        ...(candidate.mentions || []).map(([mention]) => mention),
        ...(candidate.removeReviews || []),
      ]),
      [...(candidate.reviews || []), ...(candidate.warnings || [])].map(([review]) => review),
    ),
    "Коментар": appendUnique(row["Коментар"], candidate.comments || []),
    "Посилання на повідомлення": fb(
      ...(candidate.reviews?.[0]?.slice(1) || candidate.mentions?.[0]?.slice(1) || candidate.evidence[0].slice(1)),
    ),
    "Проблемна": candidate.problem,
    "Причина проблеми": candidate.reason || "",
    "Дія після перевірки": candidate.action || "",
    "Знайдено автоматично": "false",
    "Впевненість знайденої інформації": candidate.confidence || "70",
    "Міста з опису джерела": candidate.cities || "",
  });
}

const sourceByKey = new Map(
  sources.records.map((row) => [`${row.id}|${row.source_type}|${row.identifier}`, row]),
);
const addEvidence = (id, name, entries, confidence, reason) => {
  for (const [info, post, comment, reply] of entries || []) {
    const identifier = fb(post, comment, reply);
    const key = `${id}|facebook_recommendation|${identifier}`;
    const existingSource = sourceByKey.get(key);
    const sourceRow = {
      id, name, source_type: "facebook_recommendation", identifier, status: "ok", info,
      photo_file: "", found_automatically: "false", confidence_score: confidence,
      confidence_reason: reason, cities: "",
    };
    if (existingSource) Object.assign(existingSource, sourceRow);
    else {
      sources.records.push(sourceRow);
      sourceByKey.set(key, sourceRow);
    }
  }
};

for (const update of existing) {
  const row = byId.get(update.id);
  addEvidence(update.id, row["Назва"] || row["Ім'я"], update.reviews, "70", "Рекомендація учасника Facebook-групи.");
  addEvidence(update.id, row["Назва"] || row["Ім'я"], update.mentions, "35", "Згадка у Facebook-групі без оцінки якості.");
  addEvidence(update.id, row["Назва"] || row["Ім'я"], update.evidence, "35", "Повідомлення представника салону; незалежний відгук відсутній.");
}
for (const candidate of candidates) {
  const displayName = candidate.title || candidate.name;
  addEvidence(candidate.id, displayName, candidate.reviews, "70", "Рекомендація учасника Facebook-групи.");
  addEvidence(candidate.id, displayName, candidate.warnings, "70", "Негативний відгук у відповіді на рекомендацію.");
  addEvidence(candidate.id, displayName, candidate.mentions, "35", "Згадка у Facebook-групі без оцінки якості.");
  addEvidence(candidate.id, displayName, candidate.evidence, "35", "Самопрезентація фахівця; незалежний відгук відсутній.");
}
for (const source of supportingSources) {
  const key = `${source.id}|${source.source_type}|${source.identifier}`;
  const existingSource = sourceByKey.get(key);
  if (existingSource) Object.assign(existingSource, source);
  else {
    sources.records.push(source);
    sourceByKey.set(key, source);
  }
}

catalog.records.sort((a, b) => Number(a["№"]) - Number(b["№"]));
writeCsv(catalogPath, catalog.headers, catalog.records, true);
writeCsv(sourcesPath, sources.headers, sources.records);
console.log(`Imported ${candidates.length} new catalog entries and enriched ${existing.length} existing entries.`);
