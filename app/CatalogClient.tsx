"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Specialist } from "./specialists-data";

type CatalogClientProps = {
  specialists: Specialist[];
};

type SocialContact = {
  href: string;
  label: string;
  type: "facebook" | "telegram" | "viber" | "whatsapp" | "link";
};

const ALL = "Усі";
const PAGE_SIZE = 36;

const priorityCategories = [ALL, "Здоров'я", "Краса", "Послуги", "Юридичні послуги", "Заклади"];

const categoryColors: Record<string, string> = {
  "Здоров'я": "var(--cat-health)",
  Краса: "var(--cat-beauty)",
  Послуги: "var(--cat-services)",
  "Юридичні послуги": "var(--cat-legal)",
  Заклади: "var(--cat-venues)",
  Освіта: "var(--cat-education)",
  Транспорт: "var(--cat-transport)",
  Фінанси: "var(--cat-finance)",
  Нерухомість: "var(--cat-realestate)",
  Їжа: "var(--cat-food)",
  Інше: "var(--cat-other)",
};

function normalizeCategory(value: string) {
  return value.replace(/[ʼ’]/g, "'");
}

function getCategoryColor(category: string) {
  return categoryColors[normalizeCategory(category)] || "var(--cat-other)";
}

/** Scraper status markers leak into the bio fields and must never reach a reader. */
function cleanBio(text: string) {
  return text
    .replace(/\[[^\]]*(?:PRIVATE|private|FAILED|not visible|not_found|no posts)[^\]]*\]/g, "")
    .replace(/\s*\.\.\.\s*$/, "…")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function looksLikeHandle(item: Specialist) {
  const title = item.title.trim();
  if (!title) return true;
  if (item.instagram && title.toLowerCase() === item.instagram.toLowerCase()) return true;
  return /^[a-z0-9._@-]+$/i.test(title) && !/\s/.test(title);
}

/** A raw Instagram handle reads as a database dump; recover a human name where the data holds one. */
function getDisplayName(item: Specialist) {
  if (!looksLikeHandle(item)) return item.title;
  if (item.name) return item.name;

  const lead = cleanBio(item.instagramTitle).split(/[•|·]/)[0].trim();
  const words = lead.split(/\s+/).filter(Boolean);
  const isShouting = lead === lead.toLocaleUpperCase("uk-UA") && words.length > 2;
  if (lead && lead.length <= 40 && words.length <= 4 && !isShouting) return lead;

  // No human name in the record, so present the handle as one rather than as a broken name.
  const handle = item.instagram || item.title;
  return item.instagram && item.title.toLowerCase() === item.instagram.toLowerCase()
    ? `@${handle}`
    : item.title || `@${handle}`;
}

function getSecondaryName(item: Specialist) {
  const display = getDisplayName(item);
  return item.name && item.name !== display ? item.name : "";
}

function getInitials(item: Specialist) {
  return (getDisplayName(item) || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("uk-UA");
}

function makeSearchText(item: Specialist) {
  return [
    item.title,
    item.name,
    item.category,
    item.subcategory,
    item.description,
    item.review,
    item.comment,
    item.instagram,
    item.social,
    item.instagramTitle,
    item.instagramBio,
    item.phone,
  ]
    .join(" ")
    .toLocaleLowerCase("uk-UA");
}

function hasInstagramFailureText(item: Specialist) {
  return /\[FAILED:\s*not_found\]/i.test(`${item.instagramTitle} ${item.instagramBio}`);
}

function isInstagramUnavailable(item: Specialist) {
  return item.instagramStatus === "failed" || hasInstagramFailureText(item);
}

function isInstagramSocialValue(value: string) {
  return /instagram\.com|^instagram\s*:/i.test(value.trim());
}

function getInstagramUrl(item: Specialist) {
  if (isInstagramUnavailable(item)) return "";

  const social = item.social.trim();
  const instagramLink = social.match(/https?:\/\/(?:www\.)?instagram\.com\/([^/?#\s]+)/i);
  if (instagramLink) return instagramLink[0];

  const labeledHandle = social.match(/(?:^|[/\s])instagram\s*:\s*@?([a-z0-9._]+)/i);
  if (labeledHandle?.[1]) return `https://www.instagram.com/${labeledHandle[1]}`;

  if (item.instagram) return `https://www.instagram.com/${item.instagram}`;
  return "";
}

function getSocialContact(item: Specialist): SocialContact | null {
  const social = item.social.trim();
  if (!social || getInstagramUrl(item)) return null;
  if (isInstagramSocialValue(social)) return null;

  if (/^https?:\/\//i.test(social)) {
    if (/facebook\.com/i.test(social)) return { href: social, label: "Facebook", type: "facebook" };
    if (/t\.me\//i.test(social)) return { href: social, label: "Telegram", type: "telegram" };
    return { href: social, label: "Посилання", type: "link" };
  }

  const telegram = social.match(/^telegram\s*:\s*@?([a-z0-9_]+)/i);
  if (telegram?.[1]) return { href: `https://t.me/${telegram[1]}`, label: "Telegram", type: "telegram" };

  const telegramUrl = social.match(/(?:^|\s)(?:https?:\/\/)?t\.me\/([a-z0-9_]+)/i);
  if (telegramUrl?.[1]) return { href: `https://t.me/${telegramUrl[1]}`, label: "Telegram", type: "telegram" };

  const facebook = social.match(/^facebook\s*:\s*(.+)$/i);
  if (facebook?.[1]) {
    return {
      href: `https://www.facebook.com/search/top?q=${encodeURIComponent(facebook[1].trim())}`,
      label: "Facebook",
      type: "facebook",
    };
  }

  const viber = social.match(/^viber\s*:?\s*(\+?\d[\d\s()-]{6,})?$/i);
  if (viber) {
    const phone = (viber[1] || item.phone).replace(/[^\d+]/g, "");
    if (phone) return { href: `viber://chat?number=${encodeURIComponent(phone)}`, label: "Viber", type: "viber" };
  }

  const whatsapp = social.match(/^whatsapp\s*:?\s*(\+?\d[\d\s()-]{6,})?$/i);
  if (whatsapp) {
    const phone = (whatsapp[1] || item.phone).replace(/[^\d]/g, "");
    if (phone) return { href: `https://wa.me/${phone}`, label: "WhatsApp", type: "whatsapp" };
  }

  return null;
}

function hasAnyContact(item: Specialist) {
  return Boolean(getInstagramUrl(item) || item.phone || item.website || getSocialContact(item));
}

/** Every entry is a community contact; a written review is the extra signal worth surfacing first. */
function getRank(item: Specialist) {
  return (
    Number(Boolean(item.review)) * 16 +
    Number(Boolean(item.comment)) * 8 +
    Number(hasAnyContact(item)) * 4 +
    Number(Boolean(item.avatar)) * 2 +
    Number(!isInstagramUnavailable(item))
  );
}

function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function getGoogleSearchUrl(item: Specialist) {
  const terms = [getDisplayName(item), item.subcategory || item.category, "Katowice"];
  const query = terms.filter((term, index) => term && terms.indexOf(term) === index).join(" ");
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function InstagramIcon() {
  return (
    <svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1.2" />
    </svg>
  );
}

function WebsiteIcon() {
  return (
    <svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path d="M3.6 9h16.8" />
      <path d="M3.6 15h16.8" />
      <path d="M12 3c2.2 2.5 3.4 5.5 3.4 9s-1.2 6.5-3.4 9" />
      <path d="M12 3c-2.2 2.5-3.4 5.5-3.4 9s1.2 6.5 3.4 9" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
      <path d="M6.6 4.4 9 3.7l2.1 4.7-1.5 1.1c.9 1.9 2.3 3.3 4.2 4.2l1.1-1.5 4.7 2.1-.7 2.4c-.3 1-1.2 1.7-2.2 1.6C10.5 18 6 13.5 5.7 7.3c-.1-1 .6-1.9 1.6-2.2Z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
      <path d="M4 11.4 20 4.8l-3 14.4-4.8-3.7-2.8 2.7.4-4.3 7.9-7.1-10 6.1L4 11.4Z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
      <path d="M14 8.1h2.1V4.6c-.4-.1-1.7-.2-3.2-.2-3.2 0-5.3 1.9-5.3 5.4v3H4.1v3.9h3.5v8h4.3v-8h3.4l.5-3.9h-3.9v-2.6c0-1.1.3-2.1 2.1-2.1Z" />
    </svg>
  );
}

function SocialIcon({ type }: { type: SocialContact["type"] }) {
  if (type === "telegram") return <TelegramIcon />;
  if (type === "facebook") return <FacebookIcon />;
  return <WebsiteIcon />;
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="7" />
      <path d="m20.5 20.5-3.9-3.9" />
    </svg>
  );
}

function ContactLink({
  href,
  children,
  variant = "ghost",
  tone,
  iconOnly = false,
  ariaLabel,
  external = true,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "solid" | "ghost";
  tone?: "instagram";
  iconOnly?: boolean;
  ariaLabel?: string;
  external?: boolean;
}) {
  return (
    <a
      aria-label={ariaLabel}
      className={`action ${variant}${tone ? ` ${tone}` : ""}${iconOnly ? " icon-only" : ""}`}
      href={href}
      rel={external ? "noreferrer" : undefined}
      target={external ? "_blank" : undefined}
      title={iconOnly ? ariaLabel : undefined}
    >
      {children}
    </a>
  );
}

function ContactRow({ item, verbose }: { item: Specialist; verbose: boolean }) {
  const instagramUrl = getInstagramUrl(item);
  const social = getSocialContact(item);
  const hasContacts = Boolean(instagramUrl || item.phone || social || item.website);

  return (
    <>
      {instagramUrl ? (
        <ContactLink
          ariaLabel={verbose ? undefined : "Відкрити Instagram"}
          href={instagramUrl}
          iconOnly={!verbose}
          tone="instagram"
        >
          <InstagramIcon />
          {verbose ? "Написати в Instagram" : null}
        </ContactLink>
      ) : null}
      {item.phone ? (
        <ContactLink
          ariaLabel={verbose ? undefined : "Подзвонити"}
          external={false}
          href={telHref(item.phone)}
          iconOnly={!verbose}
        >
          <PhoneIcon />
          {verbose ? item.phone : null}
        </ContactLink>
      ) : null}
      {social ? (
        <ContactLink
          ariaLabel={verbose ? undefined : `Відкрити ${social.label}`}
          href={social.href}
          iconOnly={!verbose}
        >
          <SocialIcon type={social.type} />
          {verbose ? social.label : null}
        </ContactLink>
      ) : null}
      {item.website ? (
        <ContactLink
          ariaLabel={verbose ? undefined : "Відкрити сайт"}
          href={item.website}
          iconOnly={!verbose}
        >
          <WebsiteIcon />
          {verbose ? "Сайт" : null}
        </ContactLink>
      ) : null}
      {!hasContacts ? (
        <ContactLink
          ariaLabel={verbose ? undefined : "Знайти в Google"}
          href={getGoogleSearchUrl(item)}
          iconOnly={!verbose}
        >
          <SearchIcon />
          {verbose ? "Знайти в Google" : null}
        </ContactLink>
      ) : null}
    </>
  );
}

function Avatar({ item, size }: { item: Specialist; size: "sm" | "lg" }) {
  return (
    <span className={`avatar ${size}`} aria-hidden="true">
      {item.avatar ? (
        <img src={item.avatar} alt="" loading="lazy" decoding="async" />
      ) : (
        <span>{getInitials(item)}</span>
      )}
    </span>
  );
}

function SpecialistCard({ item, onOpen }: { item: Specialist; onOpen: (item: Specialist) => void }) {
  const unavailable = isInstagramUnavailable(item);
  const secondaryName = getSecondaryName(item);
  const bio = unavailable ? "" : cleanBio(item.instagramBio || item.instagramTitle);
  const className = ["card", item.review ? "has-review" : "", unavailable ? "dimmed" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={className} style={{ "--cat": getCategoryColor(item.category) } as React.CSSProperties}>
      <p className="profession">{item.subcategory || item.category}</p>

      <div className="card-identity">
        <Avatar item={item} size="sm" />
        <div className="card-names">
          <h3>
            <button className="card-open" type="button" onClick={() => onOpen(item)}>
              {getDisplayName(item)}
            </button>
          </h3>
          {secondaryName ? <p className="person">{secondaryName}</p> : null}
        </div>
      </div>

      {item.review ? (
        <blockquote className="review-note">
          <p>{item.review}</p>
        </blockquote>
      ) : bio ? (
        <p className="card-bio">{bio}</p>
      ) : null}

      {item.comment ? (
        <section className="card-details">
          <h4>Деталі</h4>
          <p>{item.comment}</p>
        </section>
      ) : null}

      {unavailable ? <p className="flag">Контакти застарілі або неперевірені</p> : null}

      <div className="card-actions">
        <ContactRow item={item} verbose={false} />
      </div>
    </article>
  );
}

function DetailDialog({ item, onClose }: { item: Specialist | null; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!item) return;

    const restoreTo = document.activeElement as HTMLElement | null;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>("[data-autofocus]")?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;

      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      body.style.overflow = previousOverflow;
      restoreTo?.focus();
    };
  }, [item, onClose]);

  if (!item) return null;

  const unavailable = isInstagramUnavailable(item);
  const secondaryName = getSecondaryName(item);
  const bio = unavailable ? "" : cleanBio(item.instagramBio);
  const bioTitle = unavailable ? "" : cleanBio(item.instagramTitle);

  return (
    <div className="overlay">
      <button aria-label="Закрити" className="overlay-dismiss" type="button" onClick={onClose} />
      <div
        aria-labelledby="detail-title"
        aria-modal="true"
        className="panel"
        ref={panelRef}
        role="dialog"
        style={{ "--cat": getCategoryColor(item.category) } as React.CSSProperties}
      >
        <button aria-label="Закрити" className="panel-close" data-autofocus type="button" onClick={onClose}>
          <svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>

        <div className="panel-head">
          <Avatar item={item} size="lg" />
          <div className="panel-titles">
            <p className="profession">{item.subcategory || item.category}</p>
            <h2 id="detail-title">{getDisplayName(item)}</h2>
            {secondaryName ? <p className="person">{secondaryName}</p> : null}
            <p className="panel-category">
              <span className="cat-dot" aria-hidden="true" />
              {item.category}
            </p>
          </div>
        </div>

        <div className="panel-actions">
          <ContactRow item={item} verbose />
        </div>

        {item.review ? (
          <blockquote className="review-note">
            <p>{item.review}</p>
            <cite>Відгук спільноти</cite>
          </blockquote>
        ) : null}

        {item.comment || bioTitle || bio || unavailable ? (
          <div className="panel-body">
            {item.comment ? (
              <section>
                <h4>Деталі</h4>
                <p>{item.comment}</p>
              </section>
            ) : null}

            {bioTitle || bio ? (
              <section>
                <h4>З профілю Instagram</h4>
                {bioTitle ? <p className="bio-title">{bioTitle}</p> : null}
                {bio ? <p>{bio}</p> : null}
              </section>
            ) : null}

            {unavailable ? (
              <section>
                <h4>Instagram</h4>
                <p className="muted">Профіль не вдалося перевірити. Скористайтеся іншими контактами.</p>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function CatalogClient({ specialists }: CatalogClientProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL);
  const [profession, setProfession] = useState("");
  const [reviewedOnly, setReviewedOnly] = useState(false);
  const [selected, setSelected] = useState<Specialist | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const reviewCount = useMemo(() => specialists.filter((item) => item.review).length, [specialists]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of specialists) {
      const key = normalizeCategory(item.category);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const known = new Set(priorityCategories.map(normalizeCategory));
    const rest = Array.from(counts.keys())
      .filter((name) => !known.has(name))
      .sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0));

    return [...priorityCategories, ...rest].map((name) => ({
      name,
      count: name === ALL ? specialists.length : counts.get(normalizeCategory(name)) || 0,
    }));
  }, [specialists]);

  /** Professions narrow the chosen category rather than competing with it: subcategory ⊂ category. */
  const topProfessions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of specialists) {
      if (!item.subcategory) continue;
      if (category !== ALL && normalizeCategory(item.category) !== normalizeCategory(category)) continue;
      counts.set(item.subcategory, (counts.get(item.subcategory) || 0) + 1);
    }
    return Array.from(counts.entries())
      .filter(([, count]) => count >= (category === ALL ? 3 : 2))
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "uk-UA"))
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
  }, [category, specialists]);

  function chooseCategory(name: string) {
    setCategory(name);
    setProfession("");
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("uk-UA");
    return specialists
      .filter((item) =>
        category === ALL ? true : normalizeCategory(item.category) === normalizeCategory(category),
      )
      .filter((item) => (profession ? item.subcategory === profession : true))
      .filter((item) => (reviewedOnly ? Boolean(item.review) : true))
      .filter((item) => (needle ? makeSearchText(item).includes(needle) : true))
      .sort(
        (a, b) => getRank(b) - getRank(a) || getDisplayName(a).localeCompare(getDisplayName(b), "uk-UA"),
      );
  }, [category, profession, query, specialists, reviewedOnly]);

  const filterKey = `${category} ${profession} ${query} ${reviewedOnly}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (lastFilterKey !== filterKey) {
    setLastFilterKey(filterKey);
    setVisible(PAGE_SIZE);
  }

  /**
   * Auto-loads as the sentinel nears the viewport, but the button stays a real control so the
   * list is still reachable by keyboard. `visible` is deliberately not a dependency: re-observing
   * an already-visible sentinel would fire immediately and drain every page at once.
   */
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setVisible((current) => current + PAGE_SIZE);
      },
      { rootMargin: "800px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [filtered.length]);

  const hasFilters = Boolean(query || category !== ALL || profession || reviewedOnly);

  const reset = useCallback(() => {
    setQuery("");
    setCategory(ALL);
    setProfession("");
    setReviewedOnly(false);
    searchRef.current?.focus();
  }, []);

  const shown = filtered.slice(0, visible);

  return (
    <main className="shell">
      <header className="masthead">
        <p className="wordmark">Каталог · Катовіце</p>
        <h1>Свої люди поруч</h1>
        <p className="lede">{specialists.length} контактів, зібраних українською спільнотою.</p>
      </header>

      <section className="finder" aria-label="Пошук спеціаліста">
        <div className="search">
          <SearchIcon />
          <input
            aria-label="Пошук спеціаліста"
            autoComplete="off"
            enterKeyHint="search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Кого шукаєте? Стоматолог, юрист, манікюр…"
            ref={searchRef}
            type="search"
            value={query}
          />
          {query ? (
            <button className="search-clear" type="button" onClick={() => setQuery("")}>
              Очистити
            </button>
          ) : null}
        </div>
      </section>

      <div className="filters">
        <ul className="categories">
          {categories.map((entry) => (
            <li key={entry.name}>
              <button
                aria-pressed={category === entry.name}
                className={category === entry.name ? "tab on" : "tab"}
                style={
                  entry.name === ALL
                    ? undefined
                    : ({ "--cat": getCategoryColor(entry.name) } as React.CSSProperties)
                }
                type="button"
                onClick={() => chooseCategory(entry.name)}
              >
                <span className="cat-dot" aria-hidden="true" />
                {entry.name}
                <em>{entry.count}</em>
              </button>
            </li>
          ))}
        </ul>

        <button
          aria-pressed={reviewedOnly}
          className={reviewedOnly ? "review-filter on" : "review-filter"}
          type="button"
          onClick={() => setReviewedOnly(!reviewedOnly)}
        >
          Лише з відгуком
          <em>{reviewCount}</em>
        </button>
      </div>

      {topProfessions.length > 0 ? (
        <div className="refine">
          <span className="refine-label">Уточнити</span>
          <ul>
            {topProfessions.map((entry) => (
              <li key={entry.name}>
                <button
                  aria-pressed={profession === entry.name}
                  className={profession === entry.name ? "chip on" : "chip"}
                  type="button"
                  onClick={() => setProfession(profession === entry.name ? "" : entry.name)}
                >
                  {entry.name}
                  <em>{entry.count}</em>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="results-bar" aria-live="polite">
        <p>
          <strong>{filtered.length}</strong> {filtered.length === 1 ? "спеціаліст" : "спеціалістів"}
        </p>
        {profession ? (
          <button className="applied" type="button" onClick={() => setProfession("")}>
            {profession}
            <span aria-hidden="true">×</span>
            <span className="visually-hidden">Прибрати фільтр</span>
          </button>
        ) : null}
        {hasFilters ? (
          <button className="reset" type="button" onClick={reset}>
            Скинути все
          </button>
        ) : null}
      </div>

      {filtered.length > 0 ? (
        <>
          <div className="grid">
            {shown.map((item) => (
              <SpecialistCard item={item} key={item.id} onOpen={setSelected} />
            ))}
          </div>

          {visible < filtered.length ? (
            <div className="more" ref={sentinelRef}>
              <button type="button" onClick={() => setVisible(visible + PAGE_SIZE)}>
                Показати ще {Math.min(PAGE_SIZE, filtered.length - visible)}
              </button>
              <p>
                Показано {shown.length} з {filtered.length}
              </p>
            </div>
          ) : null}
        </>
      ) : (
        <div className="empty">
          <h2>Нікого не знайшли</h2>
          <p>Спробуйте інше слово або зніміть частину фільтрів.</p>
          <button type="button" onClick={reset}>
            Скинути фільтри
          </button>
        </div>
      )}

      <DetailDialog item={selected} onClose={() => setSelected(null)} />
    </main>
  );
}
