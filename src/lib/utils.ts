import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The typography roles declared as `--text-*` tokens in styles.css.
 *
 * tailwind-merge has to be told about these. It knows Tailwind's own size
 * scale (text-sm, text-lg …), but an unfamiliar `text-something` is assumed
 * to be a colour. So merging `text-helper` onto a component that already
 * set `text-secondary-foreground` looked like two colours competing, and
 * the real one was dropped — which is how a badge ended up with dark text
 * on a black background.
 *
 * Keep this list in step with the `--text-*` tokens in styles.css.
 */
export const TYPOGRAPHY_ROLES = [
  "page-title",
  "module-title",
  "section",
  "kpi",
  "card-title",
  "nav",
  "button",
  "th",
  "td",
  "label",
  "field",
  "placeholder",
  "helper",
  "badge",
  "notification",
  "modal-title",
  "modal-body",
  "tooltip",
  "footer",
  "eyebrow",
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [...TYPOGRAPHY_ROLES] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
