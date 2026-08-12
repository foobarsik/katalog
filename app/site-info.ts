export const CONTACT_EMAIL = "olgaraat@gmail.com";

export const CATALOG_NAME = "Свої люди рекомендують";

export function getDataRequestHref() {
  const subject = "Оновлення або видалення даних у каталозі";
  const body = [
    "Оберіть потрібну дію: ОНОВИТИ / ВИДАЛИТИ",
    "",
    "Імʼя або назва картки:",
    "Посилання на картку чи профіль:",
    "",
    "Якщо дані потрібно оновити, вкажіть правильну інформацію:",
    "Телефон:",
    "Email:",
    "Сайт або соцмережа:",
    "Місто:",
    "Інші зміни:",
    "",
    "Додатковий коментар:",
  ].join("\n");

  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
