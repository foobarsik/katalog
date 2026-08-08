"use client";

import { useMemo, useState } from "react";
import type { Specialist } from "./specialists-data";

type CatalogClientProps = {
  specialists: Specialist[];
};

type SocialContact = {
  href: string;
  label: string;
  type: "facebook" | "telegram" | "viber" | "whatsapp" | "link";
};

const priorityCategories = [
  "Усі",
  "Здоров'я",
  "Краса",
  "Послуги",
  "Юридичні послуги",
  "Заклади",
];

function normalizeCategory(value: string) {
  return value.replace(/[ʼ’]/g, "'");
}

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

function getCategoryColor(category: string) {
  return categoryColors[normalizeCategory(category)] || "var(--cat-other)";
}

function getInitials(item: Specialist) {
  const source = item.name || item.title || item.instagram || "S";
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
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

  const labeledHandle = social.match(/(?:^|[\/\s])instagram\s*:\s*@?([a-z0-9._]+)/i);
  if (labeledHandle?.[1]) return `https://www.instagram.com/${labeledHandle[1]}`;

  if (item.instagram) return `https://www.instagram.com/${item.instagram}`;
  return "";
}

function getExternalSocialUrl(item: Specialist) {
  return getSocialContact(item)?.href || "";
}

function getSocialContact(item: Specialist): SocialContact | null {
  const social = item.social.trim();
  if (!social || getInstagramUrl(item)) return null;
  if (isInstagramSocialValue(social)) return null;

  if (/^https?:\/\//i.test(social)) {
    if (/facebook\.com/i.test(social)) return { href: social, label: "Facebook", type: "facebook" };
    if (/(?:^https?:\/\/)?t\.me\//i.test(social)) return { href: social, label: "Telegram", type: "telegram" };
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

function getRank(item: Specialist) {
  return (
    Number(Boolean(item.avatar)) +
    Number(!isInstagramUnavailable(item) && Boolean(item.instagramBio)) +
    Number(Boolean(item.phone)) +
    Number(Boolean(item.website))
  );
}

function InstagramIcon() {
  return (
    <svg aria-hidden="true" className="instagram-icon" viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1.2" />
    </svg>
  );
}

function WebsiteIcon() {
  return (
    <svg aria-hidden="true" className="website-icon" viewBox="0 0 24 24">
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
    <svg aria-hidden="true" className="phone-icon" viewBox="0 0 24 24">
      <path d="M6.6 4.4 9 3.7l2.1 4.7-1.5 1.1c.9 1.9 2.3 3.3 4.2 4.2l1.1-1.5 4.7 2.1-.7 2.4c-.3 1-1.2 1.7-2.2 1.6C10.5 18 6 13.5 5.7 7.3c-.1-1 .6-1.9 1.6-2.2Z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg aria-hidden="true" className="telegram-icon" viewBox="0 0 24 24">
      <path d="M4 11.4 20 4.8l-3 14.4-4.8-3.7-2.8 2.7.4-4.3 7.9-7.1-10 6.1L4 11.4Z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg aria-hidden="true" className="facebook-icon" viewBox="0 0 24 24">
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
    <svg aria-hidden="true" className="search-icon" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="7" />
      <path d="m20.5 20.5-3.9-3.9" />
    </svg>
  );
}

function ContactLink({
  href,
  children,
  variant = "secondary",
  external = true,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  external?: boolean;
}) {
  return (
    <a
      className={`contact-link ${variant}`}
      href={href}
      onClick={(event) => event.stopPropagation()}
      rel={external ? "noreferrer" : undefined}
      target={external ? "_blank" : undefined}
    >
      {children}
    </a>
  );
}

function SpecialistCard({
  item,
  onOpen,
}: {
  item: Specialist;
  onOpen: (item: Specialist) => void;
}) {
  const instagramUrl = getInstagramUrl(item);
  const socialContact = getSocialContact(item);
  const instagramUnavailable = isInstagramUnavailable(item);
  const hasInstagramDetails = !instagramUnavailable && Boolean(item.instagramTitle || item.instagramBio);

  function openFromKeyboard(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onOpen(item);
  }

  return (
    <article
      aria-label={`Відкрити деталі: ${item.title}`}
      className={instagramUnavailable ? "specialist-card instagram-unavailable" : "specialist-card"}
      onClick={() => onOpen(item)}
      onKeyDown={openFromKeyboard}
      role="button"
      style={{ "--cat-color": getCategoryColor(item.category) } as React.CSSProperties}
      tabIndex={0}
    >
      {instagramUnavailable ? <span className="inactive-badge">Контакти застарілі або неперевірені</span> : null}

      <div className="card-topline">
        <div className="avatar" aria-hidden="true">
          {item.avatar ? <img src={item.avatar} alt="" loading="lazy" /> : <span>{getInitials(item)}</span>}
        </div>
        <div className="identity">
          <p className="category">{item.category}</p>
          <h2>{item.title}</h2>
        </div>
      </div>

      <div className="card-meta">
        {item.subcategory ? <span>{item.subcategory}</span> : null}
      </div>

      {item.name && item.name !== item.title ? <p className="person">{item.name}</p> : null}

      {hasInstagramDetails ? (
        <div className="instagram-preview">
          <span className="content-label">Instagram</span>
          <p>{item.instagramBio || item.instagramTitle}</p>
        </div>
      ) : null}

      {item.review ? (
        <div className="review-block">
          <span className="content-label">Відгук</span>
          <blockquote className="review-quote">{item.review}</blockquote>
        </div>
      ) : null}

      {item.comment ? (
        <div className="comment-block">
          <span className="content-label">Коментар</span>
          <p className="catalog-comment">{item.comment}</p>
        </div>
      ) : null}

      <div className="card-actions">
        {instagramUrl ? (
          <ContactLink href={instagramUrl} variant="primary">
            <span className="visually-hidden">Instagram</span>
            <InstagramIcon />
          </ContactLink>
        ) : null}
        {item.website ? (
          <ContactLink href={item.website}>
            <span className="visually-hidden">Сайт</span>
            <WebsiteIcon />
          </ContactLink>
        ) : null}
        {socialContact ? (
          <ContactLink href={socialContact.href}>
            <span className="visually-hidden">{socialContact.label}</span>
            <SocialIcon type={socialContact.type} />
          </ContactLink>
        ) : null}
        {item.phone ? (
          <ContactLink href={`tel:${item.phone.replace(/\s+/g, "")}`} external={false}>
            <span className="visually-hidden">Телефон</span>
            <PhoneIcon />
          </ContactLink>
        ) : null}
      </div>
    </article>
  );
}

function DetailModal({
  item,
  onClose,
}: {
  item: Specialist | null;
  onClose: () => void;
}) {
  if (!item) return null;

  const instagramUrl = getInstagramUrl(item);
  const socialContact = getSocialContact(item);
  const instagramUnavailable = isInstagramUnavailable(item);

  return (
    <div className="modal-backdrop">
      <button aria-label="Закрити деталі" className="modal-dismiss" type="button" onClick={onClose} />
      <article
        aria-labelledby="specialist-dialog-title"
        aria-modal="true"
        className="detail-modal"
        role="dialog"
        style={{ "--cat-color": getCategoryColor(item.category) } as React.CSSProperties}
      >
        <button aria-label="Закрити" className="modal-close" type="button" onClick={onClose}>
          ×
        </button>

        <div className="modal-header">
          <div className="avatar large" aria-hidden="true">
            {item.avatar ? <img src={item.avatar} alt="" /> : <span>{getInitials(item)}</span>}
          </div>
          <div>
            <p className="category">{item.category}</p>
            <h2 id="specialist-dialog-title">{item.title}</h2>
            <p className="subcategory">{item.subcategory}</p>
          </div>
        </div>

        <div className="modal-content">
          {item.name && item.name !== item.title ? (
            <section>
              <h3>Контакт</h3>
              <p>{item.name}</p>
            </section>
          ) : null}
          {item.review ? (
            <section>
              <h3>Відгук</h3>
              <blockquote className="review-quote modal-review">{item.review}</blockquote>
            </section>
          ) : null}
          {item.comment ? (
            <section>
              <h3>Коментар</h3>
              <p className="catalog-comment full">{item.comment}</p>
            </section>
          ) : null}
          {!instagramUnavailable && (item.instagramTitle || item.instagramBio) ? (
            <section>
              <h3>Instagram</h3>
              {item.instagramTitle ? <p className="modal-strong">{item.instagramTitle}</p> : null}
              {item.instagramBio ? <p>{item.instagramBio}</p> : null}
            </section>
          ) : null}
          {item.phone ? (
            <section>
              <h3>Телефон</h3>
              <p>{item.phone}</p>
            </section>
          ) : null}
        </div>

        <div className="modal-actions">
          {instagramUrl ? (
            <ContactLink href={instagramUrl} variant="primary">
              Відкрити Instagram
            </ContactLink>
          ) : null}
          {item.website ? <ContactLink href={item.website}>Відкрити сайт</ContactLink> : null}
          {socialContact ? <ContactLink href={socialContact.href}>Відкрити {socialContact.label}</ContactLink> : null}
          {item.phone ? (
            <ContactLink href={`tel:${item.phone.replace(/\s+/g, "")}`} external={false}>
              Подзвонити
            </ContactLink>
          ) : null}
        </div>
      </article>
    </div>
  );
}

export function CatalogClient({ specialists }: CatalogClientProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Усі");
  const [withInstagram, setWithInstagram] = useState(false);
  const [withWebsite, setWithWebsite] = useState(false);
  const [withReviews, setWithReviews] = useState(false);
  const [selected, setSelected] = useState<Specialist | null>(null);

  const categories = useMemo(() => {
    const byNormalizedName = new Map<string, string>();
    for (const item of specialists) {
      byNormalizedName.set(normalizeCategory(item.category), item.category);
    }
    const unique = Array.from(byNormalizedName.values()).sort((a, b) => a.localeCompare(b, "uk-UA"));
    const priorityKeys = new Set(priorityCategories.map(normalizeCategory));
    return priorityCategories.concat(unique.filter((item) => !priorityKeys.has(normalizeCategory(item))));
  }, [specialists]);

  const categoryCounts = useMemo(() => {
    return specialists.reduce<Record<string, number>>(
      (acc, item) => {
        acc["Усі"] += 1;
        const normalized = normalizeCategory(item.category);
        acc[normalized] = (acc[normalized] || 0) + 1;
        return acc;
      },
      { Усі: 0 },
    );
  }, [specialists]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("uk-UA");
    const result = specialists
      .filter((item) => (category === "Усі" ? true : normalizeCategory(item.category) === normalizeCategory(category)))
      .filter((item) => (withInstagram ? Boolean(getInstagramUrl(item)) : true))
      .filter((item) => (withWebsite ? Boolean(item.website || getExternalSocialUrl(item)) : true))
      .filter((item) => (withReviews ? Boolean(item.review) : true))
      .filter((item) => (needle ? makeSearchText(item).includes(needle) : true));

    return result.sort(
      (a, b) =>
        Number(isInstagramUnavailable(a)) - Number(isInstagramUnavailable(b)) ||
        getRank(b) - getRank(a) ||
        a.title.localeCompare(b.title, "uk-UA"),
    );
  }, [category, query, specialists, withInstagram, withReviews, withWebsite]);

  const hasActiveFilters = query || category !== "Усі" || withInstagram || withWebsite || withReviews;

  function clearFilters() {
    setQuery("");
    setCategory("Усі");
    setWithInstagram(false);
    setWithWebsite(false);
    setWithReviews(false);
  }

  return (
    <main className="site-shell">
      <header className="app-header">
        <div className="brand">
          <div>
            <span className="eyebrow">
              <em>{specialists.length}</em>Катовіце та околиці
            </span>
            <h1>Каталог спеціалістів</h1>
            <ul className="category-legend">
              {categories
                .filter((item) => item !== "Усі")
                .map((item) => (
                  <li key={item}>
                    <span className="dot" style={{ background: getCategoryColor(item) }} aria-hidden="true" />
                    {item}
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </header>

      <section className="search-panel" aria-label="Пошук">
        <label className="search-field">
          <span>Пошук</span>
          <span className="search-input-wrap">
            <SearchIcon />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Послуга, імʼя, Instagram, район або опис"
            />
          </span>
        </label>

        <div className="top-controls">
          <label className="select-field mobile-category">
            <span>Категорія</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item} ({categoryCounts[normalizeCategory(item)] || 0})
                </option>
              ))}
            </select>
          </label>

          <label className="toggle">
            <input
              type="checkbox"
              checked={withInstagram}
              onChange={(event) => setWithInstagram(event.target.checked)}
            />
            <span>Instagram</span>
          </label>

          <label className="toggle">
            <input type="checkbox" checked={withWebsite} onChange={(event) => setWithWebsite(event.target.checked)} />
            <span>Сайт</span>
          </label>

          <label className="toggle">
            <input type="checkbox" checked={withReviews} onChange={(event) => setWithReviews(event.target.checked)} />
            <span>Відгуки</span>
          </label>
        </div>
      </section>

      <div className="catalog-layout">
        <aside className="sidebar" aria-label="Категорії">
          <div className="sidebar-heading">
            <h2>Категорії</h2>
            <span>{categories.length - 1}</span>
          </div>
          <div className="category-list">
            {categories.map((item) => (
              <button
                className={item === category ? "category-button active" : "category-button"}
                key={item}
                style={item === "Усі" ? undefined : ({ "--cat-color": getCategoryColor(item) } as React.CSSProperties)}
                type="button"
                onClick={() => setCategory(item)}
              >
                <span className="dot" aria-hidden="true" />
                <span>{item}</span>
                <em>{categoryCounts[normalizeCategory(item)] || 0}</em>
              </button>
            ))}
          </div>
        </aside>

        <section className="results-area">
          <div className="results-toolbar" aria-live="polite">
            <div>
              <p>Результати</p>
              <h2>{filtered.length} спеціалістів</h2>
            </div>
            {hasActiveFilters ? (
              <button className="clear-button" type="button" onClick={clearFilters}>
                Скинути
              </button>
            ) : null}
          </div>

          <section className="catalog-grid" aria-label="Список спеціалістів">
            {filtered.map((item) => (
              <SpecialistCard item={item} key={item.id} onOpen={setSelected} />
            ))}
          </section>

          {filtered.length === 0 ? (
            <section className="empty-state">
              <h2>Нічого не знайдено</h2>
              <p>Спробуйте змінити запит, вимкнути Instagram-фільтр або вибрати іншу категорію.</p>
            </section>
          ) : null}
        </section>
      </div>

      <DetailModal item={selected} onClose={() => setSelected(null)} />
    </main>
  );
}
