// Entry point. The interface language (DEC-29) loads first — only the chosen language's
// strings are downloaded — and only then the app, so every screen module, including
// module-level label lists, is evaluated with translations in place.
import { i18nReady } from './lib/i18n'

void i18nReady.then(() => import('./app-root'))
