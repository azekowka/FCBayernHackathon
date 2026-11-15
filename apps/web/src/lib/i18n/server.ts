import 'server-only';
import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE, isLocale, localeFromAcceptLanguage, type Locale } from './config';
import { MESSAGES } from './messages';

/** The fan's language: explicit choice (cookie) first, then the browser's preference. */
export async function getLocale(): Promise<Locale> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;
  return localeFromAcceptLanguage((await headers()).get('accept-language'));
}

export async function getMessages() {
  const locale = await getLocale();
  return { locale, t: MESSAGES[locale] };
}
