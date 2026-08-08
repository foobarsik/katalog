"use client";

import { useMemo, useState } from "react";
import type { Specialist } from "./specialists-data";

type CatalogClientProps = {
  specialists: Specialist[];
};

type SortMode = "recommended" | "contacts" | "title";

const priorityCategories = [
  "Усі",
  "Здоровʼя",
  "Краса",
  "Послуги",
  "Юридичні послуги",
  "Заклади",
];

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

function hasContact(item: Specialist) {
  return Boolean(item.phone || item.website || getInstagramUrl(item));
}

function getRank(item: Specialist) {
  return (
    Number(Boolean(item.avatar)) +
    Number(Boolean(item.instagramBio)) +
    Number(Boolean(item.phone)) +
    Number(Boolean(item.website))
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
  const summary = item.description || item.instagramBio || "Опис буде доповнено.";

  return (
    <article className="specialist-card">
      <div className="card-topline">
        <div className="avatar" aria-hidden="true">
          {item.avatar ? <img src={item.avatar} alt="" loading="lazy" /> : <span>{getInitials(item)}</span>}
        </div>
        <div className="identity">
          <p className="category">{item.category}</p>
          <h2>{item.title}</h2>
          <p className="subcategory">{item.subcategory}</p>
        </div>
      </div>

      {item.name && item.name !== item.title ? <p className="person">Контакт: {item.name}</p> : null}

      <p className="description">{summary}</p>

      {hasInstagramDetails ? (
        <div className="instagram-preview">
          <span>Instagram-опис</span>
          <p>{item.instagramBio || item.instagramTitle}</p>
        </div>
      ) : null}

      <div className="card-actions">
        {instagramUrl ? (
          <ContactLink href={instagramUrl} variant="primary">
            Instagram
          </ContactLink>
        ) : null}
        {item.website ? <ContactLink href={item.website}>Сайт</ContactLink> : null}
        {item.phone ? (
          <ContactLink href={`tel:${item.phone.replace(/\s+/g, "")}`} external={false}>
            Телефон
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
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <article
        aria-labelledby="specialist-dialog-title"
        aria-modal="true"
        className="detail-modal"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
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
          {item.description ? (
            <section>
              <h3>Опис із каталогу</h3>
              <p>{item.description}</p>
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
  const [onlyInstagram, setOnlyInstagram] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("recommended");
  const [selected, setSelected] = useState<Specialist | null>(null);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(specialists.map((item) => item.category))).sort((a, b) =>
      a.localeCompare(b, "uk-UA"),
    );
    return priorityCategories.concat(unique.filter((item) => !priorityCategories.includes(item)));
  }, [specialists]);

  const categoryCounts = useMemo(() => {
    return specialists.reduce<Record<string, number>>(
      (acc, item) => {
        acc["Усі"] += 1;
        acc[item.category] = (acc[item.category] || 0) + 1;
        return acc;
      },
      { Усі: 0 },
    );
  }, [specialists]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("uk-UA");
    const result = specialists
      .filter((item) => (category === "Усі" ? true : item.category === category))
      .filter((item) => (onlyInstagram ? Boolean(item.instagramTitle || item.instagramBio) : true))
      .filter((item) => (needle ? makeSearchText(item).includes(needle) : true));

    return result.sort((a, b) => {
      if (sortMode === "title") return a.title.localeCompare(b.title, "uk-UA");
      if (sortMode === "contacts") {
        return Number(hasContact(b)) - Number(hasContact(a)) || b.id - a.id;
      }
      return getRank(b) - getRank(a) || a.title.localeCompare(b.title, "uk-UA");
    });
  }, [category, onlyInstagram, query, sortMode, specialists]);

  const hasActiveFilters = query || category !== "Усі" || onlyInstagram || sortMode !== "recommended";

  function clearFilters() {
    setQuery("");
    setCategory("Усі");
    setOnlyInstagram(false);
    setSortMode("recommended");
  }

  return (
    <main className="site-shell">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            К
          </div>
          <div>
            <p>Катовіце та околиці</p>
            <h1>Каталог спеціалістів</h1>
          </div>
        </div>
        <div className="header-count">
          <strong>{specialists.length}</strong>
          <span>записів у каталозі</span>
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
                  {item} ({categoryCounts[item] || 0})
                </option>
              ))}
            </select>
          </label>

          <label className="select-field">
            <span>Сортування</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
              <option value="recommended">Спочатку найповніші</option>
              <option value="contacts">Спочатку з контактами</option>
              <option value="title">За назвою</option>
            </select>
          </label>

          <label className="toggle">
            <input
              type="checkbox"
              checked={onlyInstagram}
              onChange={(event) => setOnlyInstagram(event.target.checked)}
            />
            <span>З Instagram-описом</span>
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
                <em>{categoryCounts[item] || 0}</em>
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
