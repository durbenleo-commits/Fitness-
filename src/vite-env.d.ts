/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** CI run number of the APK build (= versionCode). Missing in dev. */
  readonly VITE_BUILD_NUMBER?: string;
}
