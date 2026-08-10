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

type ContactAction = {
  href: string;
  label: string;
  icon: React.ReactNode;
  ariaLabel: string;
  tone?: "instagram";
  external?: boolean;
};

const ALL = "Усі";
const PAGE_SIZE = 36;

const priorityCategories = [ALL, "Здоров'я", "Краса", "Послуги", "Юридичні послуги", "Заклади", "Книжки"];

const categoryColors: Record<string, string> = {
  "Здоров'я": "var(--cat-health)",
  Краса: "var(--cat-beauty)",
  Послуги: "var(--cat-services)",
  "Юридичні послуги": "var(--cat-legal)",
  Заклади: "var(--cat-venues)",
  Книжки: "var(--cat-books)",
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
    .split(/[^\p{L}\p{N}]+/u)
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
    item.bookLanguage,
    item.bookListingDate,
    item.bookPrice,
    item.bookPricePln,
    item.bookQualityScore,
    item.bookCondition,
    item.description,
    item.review,
    item.comment,
    item.instagram,
    item.social,
    item.sourceType,
    item.sourceInfo,
    item.instagramTitle,
    item.instagramBio,
    item.phone,
    item.email,
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

function getSourceHeading(sourceType: string) {
  if (sourceType === "instagram") return "З профілю Instagram";
  if (sourceType === "booksy") return "З профілю Booksy";
  if (sourceType === "facebook") return "З профілю Facebook";
  if (sourceType === "telegram") return "З профілю Telegram";
  if (sourceType === "olx") return "Оголошення OLX";
  if (sourceType === "website") return "Інформація із сайту";
  return "Інформація з відкритого джерела";
}

function isFacebookSocialValue(value: string) {
  return /facebook\.com|(?:^|[/\s])facebook\s*:/i.test(value.trim());
}

function getInstagramUrl(item: Specialist) {
  if (isInstagramUnavailable(item)) return "";

  const social = item.social.trim();
  const instagramLink = social.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#\s]+)/i);
  if (instagramLink?.[1]) return `https://www.instagram.com/${instagramLink[1]}`;

  const labeledHandle = social.match(/(?:^|[/\s])instagram\s*:\s*@?([a-z0-9._]+)/i);
  if (labeledHandle?.[1]) return `https://www.instagram.com/${labeledHandle[1]}`;

  if (item.instagram) return `https://www.instagram.com/${item.instagram}`;
  return "";
}

function getSocialContacts(item: Specialist): SocialContact[] {
  const social = item.social.trim();
  if (!social) return [];

  const contacts: SocialContact[] = [];
  const facebookUrl = social.match(/https?:\/\/(?:www\.)?facebook\.com\/[^\s,;]+/i)?.[0];
  if (facebookUrl) {
    contacts.push({ href: facebookUrl, label: "Facebook", type: "facebook" });
  }

  if (/^https?:\/\//i.test(social)) {
    if (/instagram\.com/i.test(social)) return contacts;
    if (/facebook\.com/i.test(social)) return contacts;
    if (/t\.me\//i.test(social)) return [{ href: social, label: "Telegram", type: "telegram" }];
    return [{ href: social, label: "Посилання", type: "link" }];
  }

  const telegram = social.match(
    /\btelegram(?:\/viber)?\s*:\s*(?!https?:|t\.me\/)@?([a-z][a-z0-9_]{3,})/i,
  );
  if (telegram?.[1]) {
    contacts.push({ href: `https://t.me/${telegram[1]}`, label: "Telegram", type: "telegram" });
  }

  const telegramUrl = social.match(/(?:^|\s)(?:https?:\/\/)?t\.me\/([a-z0-9_]+)/i);
  if (telegramUrl?.[1]) {
    contacts.push({ href: `https://t.me/${telegramUrl[1]}`, label: "Telegram", type: "telegram" });
  }

  const facebook = social.match(/(?:^|[/\s])facebook\s*:\s*(.+)$/i);
  if (facebook?.[1]) {
    const value = facebook[1].trim().replace(/^@/, "");
    const handle = /^[a-z0-9._-]+$/i.test(value) ? value : "";
    contacts.push({
      href: handle
        ? `https://www.facebook.com/${handle}`
        : `https://www.facebook.com/search/top?q=${encodeURIComponent(value)}`,
      label: "Facebook",
      type: "facebook",
    });
  }

  const viber = social.match(/\bviber\b(?:\s*:\s*(\+?\d[\d\s()-]{6,}))?/i);
  if (viber) {
    const phone = (viber[1] || item.phone).replace(/[^\d+]/g, "");
    if (phone) {
      contacts.push({
        href: `viber://chat?number=${encodeURIComponent(phone)}`,
        label: "Viber",
        type: "viber",
      });
    }
  }

  const whatsapp = social.match(/\bwhats\s*app\b(?:\s*:\s*(\+?\d[\d\s()-]{6,}))?/i);
  if (whatsapp) {
    const phone = (whatsapp[1] || item.phone).replace(/[^\d]/g, "");
    if (phone) contacts.push({ href: `https://wa.me/${phone}`, label: "WhatsApp", type: "whatsapp" });
  }

  return contacts;
}

function normalizeContactHref(href: string) {
  if (/^tel:/i.test(href)) return href.replace(/[^\d+]/g, "");

  try {
    const url = new URL(href);
    url.hash = "";
    url.search = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString().toLowerCase();
  } catch {
    return href.trim().replace(/\/+$/, "").toLowerCase();
  }
}

function uniqueContactActions(actions: ContactAction[]) {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = normalizeContactHref(action.href);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getContactActions(item: Specialist) {
  const instagramUrl = getInstagramUrl(item);
  const socialContacts = getSocialContacts(item);

  return uniqueContactActions([
    ...(instagramUrl
      ? [
          {
            href: instagramUrl,
            label: "Написати в Instagram",
            ariaLabel: "Відкрити Instagram",
            icon: <InstagramIcon />,
            tone: "instagram" as const,
          },
        ]
      : []),
    ...(item.phone
      ? [{ href: telHref(item.phone), label: item.phone, ariaLabel: "Подзвонити", icon: <PhoneIcon />, external: false }]
      : []),
    ...(item.email
      ? [
          {
            href: `mailto:${item.email}`,
            label: item.email,
            ariaLabel: "Написати email",
            icon: <EmailIcon />,
            external: false,
          },
        ]
      : []),
    ...(item.website
      ? [
          {
            href: item.website,
            label: item.sourceType === "olx" ? "OLX" : "Сайт",
            ariaLabel: item.sourceType === "olx" ? "Відкрити оголошення OLX" : "Відкрити сайт",
            icon: <WebsiteIcon />,
          },
        ]
      : []),
    ...socialContacts.map((social) => ({
      href: social.href,
      label: social.label,
      ariaLabel: `Відкрити ${social.label}`,
      icon: <SocialIcon type={social.type} />,
      external: social.type !== "viber",
    })),
  ]);
}

function hasAnyContact(item: Specialist) {
  return getContactActions(item).length > 0;
}

function getContactCount(item: Specialist) {
  return getContactActions(item).length;
}

function hasSocialContact(item: Specialist) {
  return Boolean(getInstagramUrl(item) || isFacebookSocialValue(item.social));
}

/** Secondary quality cues run only after the main publication/contact priorities have tied. */
function getRank(item: Specialist) {
  return (
    Number(Boolean(item.comment)) * 8 +
    Number(!isInstagramUnavailable(item))
  );
}

function getLocationRank(item: Specialist) {
  if (item.locationStatus === "confirmed") return 2;
  if (item.locationStatus === "unconfirmed") return 0;
  return 1;
}

function hasUnconfirmedLocation(item: Specialist) {
  return item.locationStatus === "unconfirmed";
}

function hasConfirmedLocation(item: Specialist) {
  return item.locationStatus === "confirmed";
}

function isBookItem(item: Specialist) {
  return normalizeCategory(item.category) === "Книжки";
}

function getBookDateRank(item: Specialist) {
  return item.bookListingDate ? Date.parse(item.bookListingDate) || 0 : 0;
}

function compareBookRank(a: Specialist, b: Specialist) {
  if (!isBookItem(a) || !isBookItem(b)) return 0;
  return (
    b.bookQualityScore - a.bookQualityScore ||
    getBookDateRank(b) - getBookDateRank(a) ||
    (b.bookPricePln || 0) - (a.bookPricePln || 0)
  );
}

function getResultNoun(count: number, currentCategory: string) {
  if (normalizeCategory(currentCategory) === "Книжки") {
    return count === 1 ? "оголошення" : "оголошень";
  }
  return count === 1 ? "позиція" : "позицій";
}

function hasAvatarImage(item: Specialist) {
  return Boolean(item.avatar);
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

function EmailIcon() {
  return (
    <svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
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

function ViberIcon() {
  return (
    <svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
      <path d="M5.4 4.7A10 10 0 0 1 19.1 5c2.4 2.5 2.5 8.5.3 11.2-1.2 1.4-3 2.3-5 2.7L10 21v-1.9c-2.7-.4-4.8-1.3-5.8-3-1.6-2.7-1.1-8.8 1.2-11.4Z" />
      <path d="M8.2 7.8c.4-.4 1.1-.3 1.4.2l1 1.8c.2.4.1.9-.2 1.2l-.7.6c.6 1.3 1.6 2.3 2.9 2.9l.6-.7c.3-.4.8-.4 1.2-.2l1.8 1c.5.3.6 1 .2 1.4-.6.7-1.4 1-2.3.8-3.5-.8-6.2-3.5-7-7-.1-.8.3-1.6 1.1-2Z" />
      <path d="M13.4 7.5c1.7.4 2.8 1.6 3.1 3.2M13.5 5.5c2.8.4 4.7 2.4 5 5.2" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
      <path d="M20 11.6a8 8 0 0 1-11.8 7L4 20l1.4-4.1A8 8 0 1 1 20 11.6Z" />
      <path d="M8.3 7.8c.4-.4 1-.3 1.3.2l1 1.8c.2.4.1.8-.2 1.1l-.7.7c.6 1.3 1.6 2.3 2.9 2.9l.7-.7c.3-.3.8-.4 1.1-.2l1.8 1c.5.3.6.9.2 1.3-.6.7-1.5 1-2.4.8-3.4-.8-6.1-3.5-6.9-6.9-.1-.7.3-1.5 1.2-2Z" />
    </svg>
  );
}

function SocialIcon({ type }: { type: SocialContact["type"] }) {
  if (type === "telegram") return <TelegramIcon />;
  if (type === "facebook") return <FacebookIcon />;
  if (type === "viber") return <ViberIcon />;
  if (type === "whatsapp") return <WhatsAppIcon />;
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

function FilterIcon() {
  return (
    <svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
      <path d="M4 7h16" />
      <path d="M4 17h16" />
      <circle cx="9" cy="7" r="2" />
      <circle cx="15" cy="17" r="2" />
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
  const actions = getContactActions(item);
  const hasContacts = actions.length > 0;

  return (
    <>
      {actions.map((action) => (
        <ContactLink
          ariaLabel={verbose ? undefined : action.ariaLabel}
          external={action.external}
          href={action.href}
          iconOnly={!verbose}
          key={`${action.label}:${action.href}`}
          tone={action.tone}
        >
          {action.icon}
          {verbose ? action.label : null}
        </ContactLink>
      ))}
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

function LocationStatus({ item }: { item: Specialist }) {
  const status = item.locationStatus || "unknown";
  if (status === "unknown") return null;
  const label = item.locationEvidence;

  return (
    <span className={`location-status ${status}`}>
      <span>{label}</span>
    </span>
  );
}

function ReviewStatus({ item, verbose = false }: { item: Specialist; verbose?: boolean }) {
  if (!item.needsReview) return null;

  return (
    <span className="review-status" title={verbose ? item.reviewReason || undefined : undefined}>
      Очікує перевірки
    </span>
  );
}

function BookLanguageStatus({ item }: { item: Specialist }) {
  if (!isBookItem(item) || !item.bookLanguage) return null;

  return <span className="book-language-status">{item.bookLanguage}</span>;
}

function BookFacts({ item }: { item: Specialist }) {
  if (!isBookItem(item)) return null;

  const facts = [
    item.bookLanguage ? ["Мова", item.bookLanguage] : null,
    item.bookListingDate ? ["Дата", item.bookListingDate] : null,
    item.bookPrice ? ["Ціна", item.bookPrice] : null,
    item.bookCondition ? ["Стан", item.bookCondition] : null,
    item.bookQualityScore ? ["Score", `${item.bookQualityScore}/100`] : null,
  ].filter(Boolean) as [string, string][];

  if (!facts.length) return null;

  return (
    <dl className="book-facts" aria-label="Параметри книги">
      {facts.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function NegativeReviewStatus({ item }: { item: Specialist }) {
  if (!item.hasNegativeReview) return null;

  return <span className="negative-review-status">Є негативні відгуки</span>;
}

function SpecialistCard({ item, onOpen }: { item: Specialist; onOpen: (item: Specialist) => void }) {
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const unavailable = isInstagramUnavailable(item);
  const secondaryName = getSecondaryName(item);
  const sourceUnavailable = item.sourceType === "instagram" && unavailable;
  const bio = sourceUnavailable ? "" : cleanBio(item.sourceInfo || item.instagramBio);
  const hasLongDetails = item.comment.length > 280;
  const detailsId = `card-details-${item.id}`;
  const className = [
    "card",
    item.review ? "has-review" : "",
    unavailable ? "dimmed" : "",
    item.needsReview ? "needs-review" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={className} style={{ "--cat": getCategoryColor(item.category) } as React.CSSProperties}>
      <div className="card-identity">
        <Avatar item={item} size="sm" />
        <div className="card-names">
          <p className="profession">{item.subcategory || item.category}</p>
          <h3>
            <button className="card-open" type="button" onClick={() => onOpen(item)}>
              {getDisplayName(item)}
            </button>
          </h3>
          {secondaryName ? <p className="person">{secondaryName}</p> : null}
        </div>
      </div>

      <BookFacts item={item} />

      {bio ? <p className="card-bio">{bio}</p> : null}

      {item.review ? (
        <blockquote className="review-note">
          <p>{item.review}</p>
        </blockquote>
      ) : null}

      {item.comment ? (
        <section className="card-details">
          <h4>Деталі</h4>
          <p className={hasLongDetails && !detailsExpanded ? "details-text collapsed" : "details-text"} id={detailsId}>
            {item.comment}
          </p>
          {hasLongDetails ? (
            <button
              aria-controls={detailsId}
              aria-expanded={detailsExpanded}
              className="details-toggle"
              type="button"
              onClick={() => setDetailsExpanded((current) => !current)}
            >
              {detailsExpanded ? "Згорнути" : "Показати більше"}
            </button>
          ) : null}
        </section>
      ) : null}

      {unavailable ? <p className="flag">Контакти застарілі або неперевірені</p> : null}

      <div className="card-actions">
        <ContactRow item={item} verbose={false} />
        <NegativeReviewStatus item={item} />
        <ReviewStatus item={item} />
        <BookLanguageStatus item={item} />
        <LocationStatus item={item} />
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
  const sourceUnavailable = item.sourceType === "instagram" && unavailable;
  const bio = sourceUnavailable ? "" : cleanBio(item.sourceInfo || item.instagramBio);
  const bioTitle = item.sourceInfo || sourceUnavailable ? "" : cleanBio(item.instagramTitle);
  const sourceHeading = getSourceHeading(item.sourceType);

  return (
    <div className="overlay">
      <button aria-label="Закрити" className="overlay-dismiss" type="button" onClick={onClose} />
      <div
        aria-labelledby="detail-title"
        aria-modal="true"
        className={`panel${item.needsReview ? " needs-review" : ""}`}
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
            <NegativeReviewStatus item={item} />
            <ReviewStatus item={item} verbose />
            <BookLanguageStatus item={item} />
            <LocationStatus item={item} />
          </div>
        </div>

        <div className="panel-actions">
          <ContactRow item={item} verbose />
        </div>

        <BookFacts item={item} />

        {bioTitle || bio ? (
          <div className="panel-body">
            <section>
              <h4>{sourceHeading}</h4>
              {bioTitle ? <p className="bio-title">{bioTitle}</p> : null}
              {bio ? <p>{bio}</p> : null}
            </section>
          </div>
        ) : null}

        {item.review ? (
          <blockquote className="review-note">
            <p>{item.review}</p>
            <cite>Відгук спільноти</cite>
          </blockquote>
        ) : null}

        {item.comment || unavailable ? (
          <div className="panel-body">
            {item.comment ? (
              <section>
                <h4>Деталі</h4>
                <p>{item.comment}</p>
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
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [onlyReviewed, setOnlyReviewed] = useState(false);
  const [onlySocial, setOnlySocial] = useState(false);
  const [onlyWebsite, setOnlyWebsite] = useState(false);
  const [onlyPhone, setOnlyPhone] = useState(false);
  const [onlyContacted, setOnlyContacted] = useState(false);
  const [minimumBookScore, setMinimumBookScore] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => specialists.find((item) => item.id === selectedId) || null,
    [selectedId, specialists],
  );

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
    if (normalizeCategory(name) !== "Книжки") setMinimumBookScore(null);
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("uk-UA");
    const availabilityFiltersActive = onlyReviewed || onlySocial || onlyWebsite || onlyPhone || onlyContacted;

    return specialists
      .filter((item) =>
        category === ALL ? true : normalizeCategory(item.category) === normalizeCategory(category),
      )
      .filter((item) => (profession ? item.subcategory === profession : true))
      .filter((item) =>
        availabilityFiltersActive
          ? (onlyReviewed && Boolean(item.review)) ||
            (onlySocial && hasSocialContact(item)) ||
            (onlyWebsite && Boolean(item.website)) ||
            (onlyPhone && Boolean(item.phone)) ||
            (onlyContacted && hasAnyContact(item))
          : true,
      )
      .filter((item) =>
        minimumBookScore === null || normalizeCategory(category) !== "Книжки"
          ? true
          : item.bookQualityScore >= minimumBookScore,
      )
      .filter((item) => (needle ? makeSearchText(item).includes(needle) : true))
      .sort(
        (a, b) =>
          Number(a.needsReview) - Number(b.needsReview) ||
          Number(hasUnconfirmedLocation(a)) - Number(hasUnconfirmedLocation(b)) ||
          compareBookRank(a, b) ||
          Number(Boolean(b.review)) - Number(Boolean(a.review)) ||
          Number(hasSocialContact(b)) - Number(hasSocialContact(a)) ||
          Number(hasAvatarImage(b)) - Number(hasAvatarImage(a)) ||
          Number(Boolean(b.website)) - Number(Boolean(a.website)) ||
          Number(hasConfirmedLocation(b)) - Number(hasConfirmedLocation(a)) ||
          Number(isInstagramUnavailable(a)) - Number(isInstagramUnavailable(b)) ||
          getLocationRank(b) - getLocationRank(a) ||
          getContactCount(b) - getContactCount(a) ||
          getRank(b) - getRank(a) ||
          b.confidenceScore - a.confidenceScore ||
          getDisplayName(a).localeCompare(getDisplayName(b), "uk-UA"),
      );
  }, [
    category,
    minimumBookScore,
    onlyContacted,
    onlyPhone,
    onlyReviewed,
    onlySocial,
    onlyWebsite,
    profession,
    query,
    specialists,
  ]);

  const filterKey = `${category}|${profession}|${query}|${onlyReviewed}|${onlySocial}|${onlyWebsite}|${onlyPhone}|${onlyContacted}|${minimumBookScore}`;
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

  const activeFilterCount =
    Number(category !== ALL) +
    Number(Boolean(profession)) +
    Number(onlyReviewed) +
    Number(onlySocial) +
    Number(onlyWebsite) +
    Number(onlyPhone) +
    Number(onlyContacted) +
    Number(normalizeCategory(category) === "Книжки" && minimumBookScore !== null);
  const hasFilters = Boolean(query || activeFilterCount);

  const reset = useCallback(() => {
    setQuery("");
    setCategory(ALL);
    setProfession("");
    setOnlyReviewed(false);
    setOnlySocial(false);
    setOnlyWebsite(false);
    setOnlyPhone(false);
    setOnlyContacted(false);
    setMinimumBookScore(null);
    searchRef.current?.focus();
  }, []);

  const shown = filtered.slice(0, visible);

  return (
    <main className="shell">
      <header className="masthead">
        <p className="wordmark">Каталог · Катовіце та поруч</p>
        <h1>Свої люди рекомендують</h1>
        <p className="lede">{specialists.length} контактів і знахідок, зібраних українською спільнотою.</p>
      </header>

      <section className="finder" aria-label="Пошук у каталозі">
        <div className="search">
          <SearchIcon />
          <input
            aria-label="Пошук у каталозі"
            autoComplete="off"
            enterKeyHint="search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Кого шукаєте? Стоматолог, юрист, книжки…"
            ref={searchRef}
            type="search"
            value={query}
          />
          {query ? (
            <button className="search-clear" type="button" onClick={() => setQuery("")}>
              Очистити
            </button>
          ) : null}
          <button
            aria-controls="catalog-filter-panel"
            aria-expanded={filterPanelOpen}
            aria-label="Відкрити фільтри"
            className={activeFilterCount ? "filter-toggle on" : "filter-toggle"}
            type="button"
            onClick={() => setFilterPanelOpen((current) => !current)}
          >
            <FilterIcon />
            {activeFilterCount ? <span>{activeFilterCount}</span> : null}
          </button>
        </div>

        {filterPanelOpen ? (
          <div className="filter-panel" id="catalog-filter-panel">
            <div className="filter-panel-head">
              <h2>Фільтри</h2>
              <button type="button" onClick={reset}>
                Скинути
              </button>
            </div>

            <div className="filter-group">
              <p>Будь-яка вибрана умова</p>
              <div className="filter-options">
                <button
                  aria-pressed={onlyReviewed}
                  className={onlyReviewed ? "filter-chip on" : "filter-chip"}
                  type="button"
                  onClick={() => setOnlyReviewed((current) => !current)}
                >
                  Є відгук
                </button>
                <button
                  aria-pressed={onlySocial}
                  className={onlySocial ? "filter-chip on" : "filter-chip"}
                  type="button"
                  onClick={() => setOnlySocial((current) => !current)}
                >
                  Є соцмережі
                </button>
                <button
                  aria-pressed={onlyWebsite}
                  className={onlyWebsite ? "filter-chip on" : "filter-chip"}
                  type="button"
                  onClick={() => setOnlyWebsite((current) => !current)}
                >
                  Є сайт
                </button>
                <button
                  aria-pressed={onlyPhone}
                  className={onlyPhone ? "filter-chip on" : "filter-chip"}
                  type="button"
                  onClick={() => setOnlyPhone((current) => !current)}
                >
                  Є телефон
                </button>
                <button
                  aria-pressed={onlyContacted}
                  className={onlyContacted ? "filter-chip on" : "filter-chip"}
                  type="button"
                  onClick={() => setOnlyContacted((current) => !current)}
                >
                  Є контакт
                </button>
              </div>
            </div>

            {normalizeCategory(category) === "Книжки" ? (
              <div className="filter-group">
                <p>Score книги</p>
                <div className="filter-options">
                  {[null, 60, 80].map((score) => (
                    <button
                      aria-pressed={minimumBookScore === score}
                      className={minimumBookScore === score ? "filter-chip on" : "filter-chip"}
                      key={score ?? "all"}
                      type="button"
                      onClick={() => setMinimumBookScore(score)}
                    >
                      {score === null ? "Усі" : `${score}+`}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
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
          <strong>{filtered.length}</strong> {getResultNoun(filtered.length, category)}
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
              <SpecialistCard item={item} key={item.id} onOpen={(entry) => setSelectedId(entry.id)} />
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

      <DetailDialog item={selected} onClose={() => setSelectedId(null)} />
    </main>
  );
}
