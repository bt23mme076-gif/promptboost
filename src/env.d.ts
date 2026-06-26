/// <reference types="vite/client" />

// CSS imported as a raw string (Vite `?inline`) — used to inject styles into the
// content-script Shadow DOM.
declare module "*.css?inline" {
  const css: string;
  export default css;
}

// Plain CSS side-effect imports (popup/options entry points).
declare module "*.css";
