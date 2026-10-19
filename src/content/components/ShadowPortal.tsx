import { ReactNode, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

import styles from "../content.css?inline";

/**
 * Renders children into their own shadow root appended to <body>.
 *
 * Floating UI (panel, callouts) has to escape the composer's overflow:hidden,
 * so it can't live inside the main shadow host. Portalling straight into
 * <body> would drop it into the page's cascade: the host site's resets and
 * utility classes (or the absence of Tailwind on e.g. Gemini) would restyle it.
 * A dedicated shadow root keeps it isolated from every site's CSS.
 */
export function ShadowPortal({ children }: { children: ReactNode }) {
  const [mount, setMount] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const host = document.createElement("div");
    host.setAttribute("data-promptboost-portal", "");
    host.style.cssText = "all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;";
    const shadow = host.attachShadow({ mode: "open" });

    const styleEl = document.createElement("style");
    styleEl.textContent = styles;
    shadow.appendChild(styleEl);

    const el = document.createElement("div");
    shadow.appendChild(el);

    document.body.appendChild(host);
    setMount(el);
    return () => { host.remove(); };
  }, []);

  return mount ? createPortal(children, mount) : null;
}
