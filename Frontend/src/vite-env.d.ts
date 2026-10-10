/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "dummy" runs on the in-browser dummy data; anything else (default) uses the real backend. */
  readonly VITE_API_MODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
