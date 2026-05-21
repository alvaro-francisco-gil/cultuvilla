import { createContext, useContext, type ReactNode } from 'react';
import * as Localization from 'expo-localization';
import { getMessages } from '@cultuvilla/i18n';

export type Locale = string;
// Nested catalog: values can be strings or nested objects
export type MessageBundle = Record<Locale, Record<string, unknown>>;

export type I18n = {
  locale: Locale;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

/** Walk a nested object using a dot-separated key path. */
function getNestedValue(obj: Record<string, unknown>, key: string): string | undefined {
  const segments = key.split('.');
  let current: unknown = obj;
  for (const seg of segments) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return typeof current === 'string' ? current : undefined;
}

export function createI18n(
  bundle: MessageBundle,
  locale: Locale,
  fallback: Locale = 'es',
): I18n {
  function resolve(key: string): string | undefined {
    const localeCatalog = bundle[locale];
    const fallbackCatalog = bundle[fallback];
    const fromLocale = localeCatalog ? getNestedValue(localeCatalog, key) : undefined;
    if (fromLocale !== undefined) return fromLocale;
    return fallbackCatalog ? getNestedValue(fallbackCatalog, key) : undefined;
  }

  return {
    locale,
    t(key, vars) {
      const tpl = resolve(key);
      if (tpl === undefined) return key;
      if (!vars) return tpl;
      return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
    },
  };
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const device = Localization.getLocales()[0]?.languageCode ?? 'es';
  const bundled: MessageBundle = { es: getMessages('es') };
  const value = createI18n(bundled, device, 'es');
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useT(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error('useT must be inside <I18nProvider>');
  return v;
}
