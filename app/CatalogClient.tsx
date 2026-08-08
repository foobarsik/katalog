"use client";

import { useMemo, useState } from "react";
import type { Specialist } from "./specialists-data";

type CatalogClientProps = {
  specialists: Specialist[];
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
    item.instagramTitle,
    item.instagramBio,
    item.phone,
  ]
    .join(" ")
    .toLocaleLowerCase("uk-UA");
}

function getInstagramUrl(item: Specialist) {
  if (item.social) return item.social;
  if (item.instagram) return `https://www.instagram.com/${item.instagram}`;
  return "";
}

function getRank(item: Specialist) {
  return (
    Number(Boolean(item.avatar)) +
    Number(Boolean(item.instagramBio)) +
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
  const hasInstagramDetails = Boolean(item.instagramTitle || item.instagramBio);
  const hasCatalogText = Boolean(item.review || item.comment);

  return (
    <article className="specialist-card">
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

      {!hasCatalogText && !hasInstagramDetails ? <p className="description">Опис буде доповнено.</p> : null}

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
        {item.phone ? (
          <ContactLink href={`tel:${item.phone.replace(/\s+/g, "")}`} external={false}>
            <span className="visually-hidden">Телефон</span>
            <PhoneIcon />
          </ContactLink>
        ) : null}
        <button className="details-button" type="button" onClick={() => onOpen(item)}>
          Детальніше
        </button>
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

  return (
    <div className="modal-backdrop">
      <button aria-label="Закрити деталі" className="modal-dismiss" type="button" onClick={onClose} />
      <article
        aria-labelledby="specialist-dialog-title"
        aria-modal="true"
        className="detail-modal"
        role="dialog"
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
          {item.instagramTitle || item.instagramBio ? (
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
      .filter((item) => (withWebsite ? Boolean(item.website) : true))
      .filter((item) => (withReviews ? Boolean(item.review) : true))
      .filter((item) => (needle ? makeSearchText(item).includes(needle) : true));

    return result.sort((a, b) => getRank(b) - getRank(a) || a.title.localeCompare(b.title, "uk-UA"));
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
            <p>Катовіце та околиці · {specialists.length} записів</p>
            <h1>Каталог спеціалістів</h1>
          </div>
        </div>
      </header>

      <section className="search-panel" aria-label="Пошук">
        <label className="search-field">
          <span>Пошук</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Послуга, імʼя, Instagram, район або опис"
          />
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
                type="button"
                onClick={() => setCategory(item)}
            >
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
