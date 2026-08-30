/// <reference types="vite/client" />

// Augment Vite's ImportMetaEnv with the vars Trustwright reads. Optional because
// persistence degrades gracefully when the Worker origin is unset.
interface ImportMetaEnv {
  readonly VITE_WORKER_ORIGIN?: string;
}
