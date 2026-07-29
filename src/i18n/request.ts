import { getRequestConfig } from "next-intl/server";

export const SUPPORTED_LOCALES = ["es", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es";

// Cookie-based locale switching arrives in the i18n stage. For now the app
// serves a single default locale; messages still come from the JSON catalogs.
export default getRequestConfig(async () => {
  const locale = DEFAULT_LOCALE;
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
