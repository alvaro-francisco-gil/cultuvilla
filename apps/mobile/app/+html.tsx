import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';
import { APP_STORE_ID, APP_STORES } from '../lib/appStores';

// Root HTML document for the web build. Expo's default template hardcodes
// `lang="en"`, which makes Chrome misdetect our Spanish content and pop the
// "translate this page?" bar. Everything user-facing is Spanish, so pin the
// document language here.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta httpEquiv="Content-Language" content="es" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        {/* Lets Safari on iOS draw its own native install bar. Tied to the
            same APP_STORES.ios that gates our own banner, so the two can never
            disagree about whether there is a listing to offer. */}
        {APP_STORES.ios ? (
          <meta name="apple-itunes-app" content={`app-id=${APP_STORE_ID}`} />
        ) : null}
        {/* Defaults for every route that ogRenderer does NOT rewrite — the home
            feed, /discover, /descarga and the village sub-surfaces. Without
            these the SPA shell ships no <title> and no description at all, so
            those pages were entering Google's index untitled. ogRenderer strips
            and replaces all of them on share-link routes, so the two can never
            both apply. */}
        <title>Cultuvilla — la vida de tu pueblo</title>
        <meta
          name="description"
          content="Fiestas, eventos, noticias y vida de los pueblos de España. Descubre lo que pasa en tu pueblo y apúntate."
        />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Cultuvilla" />
        <meta property="og:title" content="Cultuvilla — la vida de tu pueblo" />
        <meta
          property="og:description"
          content="Fiestas, eventos, noticias y vida de los pueblos de España."
        />
        <meta name="twitter:card" content="summary_large_image" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
