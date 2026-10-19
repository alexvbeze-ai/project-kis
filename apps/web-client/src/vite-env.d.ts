/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CORE_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
