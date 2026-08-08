"use client";

import { useMemo, useState } from "react";
import type { Specialist } from "./specialists-data";

type CatalogClientProps = {
  specialists: Specialist[];
};

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

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function ContactLink({
  href,
  children,
  variant = "secondary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  return (
    <a className={`contact-link ${variant}`} href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

function SpecialistCard({ item }: { item: Specialist }) {
  const instagramUrl = getInstagramUrl(item);
  const hasInstagramDetails = Boolean(item.instagramFollowers || item.instagramBio);

  return (
    <article className="specialist-card">
      <div className="card-topline">
        <div className="avatar" aria-hidden="true">
          {item.avatar ? (
            <img src={item.avatar} alt="" loading="lazy" />
          ) : (
            <span>{getInitials(item)}</span>
          )}
        </div>
        <div className="identity">
          <p className="category">{item.category}</p>
          <h2>{item.title}</h2>
          <p className="subcategory">{item.subcategory}</p>
        </div>
      </div>

      {item.name && item.name !== item.title ? <p className="person">Контакт: {item.name}</p> : null}

      <p className="description">{item.description || item.instagramBio || "Опис буде доповнено."}</p>

      {hasInstagramDetails ? (
        <div className="instagram-panel">
          {item.instagramTitle ? <p className="instagram-title">{item.instagramTitle}</p> : null}
          {item.instagramBio ? <p className="instagram-bio">{item.instagramBio}</p> : null}
          <div className="instagram-stats">
            {item.instagramFollowers ? <span>{item.instagramFollowers} підписників</span> : null}
            {item.instagramFollowing ? <span>{item.instagramFollowing} підписок</span> : null}
          </div>
        </div>
      ) : null}

      <div className="card-actions">
        {instagramUrl ? (
          <ContactLink href={instagramUrl} variant="primary">
            Instagram
          </ContactLink>
        ) : null}
        {item.website ? <ContactLink href={item.website}>Сайт</ContactLink> : null}
        {item.phone ? <a className="contact-link secondary" href={`tel:${item.phone.replace(/\s+/g, "")}`}>Подзвонити</a> : null}
      </div>
    </article>
  );
}

export function CatalogClient({ specialists }: CatalogClientProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Усі");
  const [onlyInstagram, setOnlyInstagram] = useState(false);

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

  const instagramCount = specialists.filter((item) => item.instagramBio || item.instagramFollowers).length;
  const contactCount = specialists.filter((item) => item.phone || item.website || item.social).length;
  const avatarCount = specialists.filter((item) => item.avatar).length;

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("uk-UA");
    return specialists
      .filter((item) => (category === "Усі" ? true : item.category === category))
      .filter((item) => (onlyInstagram ? Boolean(item.instagramBio || item.instagramFollowers) : true))
      .filter((item) => (needle ? makeSearchText(item).includes(needle) : true))
      .sort((a, b) => {
        const aRank = Number(Boolean(a.avatar)) + Number(Boolean(a.instagramBio)) + Number(Boolean(a.phone));
        const bRank = Number(Boolean(b.avatar)) + Number(Boolean(b.instagramBio)) + Number(Boolean(b.phone));
        return bRank - aRank || a.title.localeCompare(b.title, "uk-UA");
      });
  }, [category, onlyInstagram, query, specialists]);

  return (
    <main className="site-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Катовіце та околиці</p>
          <h1>Каталог українських спеціалістів</h1>
          <p className="lead">
            Зібрані контакти майстрів, лікарів, сервісів, юристів, закладів та освітніх
            ініціатив із Telegram-каталогу. Частина карток доповнена даними Instagram.
          </p>
        </div>
        <div className="hero-stats" aria-label="Статистика каталогу">
          <Stat value={specialists.length} label="записів" />
          <Stat value={contactCount} label="із контактами" />
          <Stat value={instagramCount} label="з Instagram-даними" />
          <Stat value={avatarCount} label="з аватарками" />
        </div>
      </section>

      <section className="controls" aria-label="Пошук і фільтри">
        <label className="search-field">
          <span>Пошук</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Послуга, імʼя, нік, район або опис"
          />
        </label>

        <div className="filter-row" aria-label="Категорії">
          {categories.map((item) => (
            <button
              className={item === category ? "filter active" : "filter"}
              key={item}
              type="button"
              onClick={() => setCategory(item)}
            >
              <span>{item}</span>
              <em>{categoryCounts[item] || 0}</em>
            </button>
          ))}
        </div>

        <label className="toggle">
          <input
            type="checkbox"
            checked={onlyInstagram}
            onChange={(event) => setOnlyInstagram(event.target.checked)}
          />
          <span>Лише з розширеними Instagram-даними</span>
        </label>
      </section>

      <section className="results-header" aria-live="polite">
        <div>
          <p className="eyebrow">Результати</p>
          <h2>{filtered.length} карток знайдено</h2>
        </div>
        <p>Дані з каталогу та спарсених Instagram-профілів, доступні для швидкого перегляду.</p>
      </section>

      <section className="catalog-grid" aria-label="Список спеціалістів">
        {filtered.map((item) => (
          <SpecialistCard item={item} key={item.id} />
        ))}
      </section>

      {filtered.length === 0 ? (
        <section className="empty-state">
          <h2>Нічого не знайдено</h2>
          <p>Спробуйте змінити запит, вимкнути Instagram-фільтр або вибрати іншу категорію.</p>
        </section>
      ) : null}
    </main>
  );
}
