import { cn } from "@/lib/utils";

/**
 * Placeholder brand mark.
 *
 * The supplied Builders Paradise Hardware logo was not in the repository, so
 * this is an original geometric mark in the brand blue — deliberately simple,
 * meant to be replaced. Set `logo_url` in Settings → Company and this
 * component renders that file instead, no code change needed.
 */
export function BrandMark({
  logoUrl,
  companyName,
  className,
}: {
  logoUrl?: string | null | undefined;
  companyName?: string | undefined;
  className?: string | undefined;
}) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={companyName ? `${companyName} logo` : "Company logo"}
        className={cn("size-9 shrink-0 rounded-lg object-contain", className)}
      />
    );
  }

  return (
    <svg
      viewBox="0 0 36 36"
      role="img"
      aria-label={companyName ? `${companyName} logo` : "Builders Paradise"}
      className={cn("size-9 shrink-0", className)}
    >
      <rect width="36" height="36" rx="10" fill="var(--color-primary)" />
      {/* Two stacked courses of brickwork, set in the negative space. */}
      <rect x="8" y="10.5" width="9" height="6" rx="1.5" fill="white" opacity="0.95" />
      <rect x="19" y="10.5" width="9" height="6" rx="1.5" fill="white" opacity="0.6" />
      <rect x="8" y="19.5" width="20" height="6" rx="1.5" fill="white" opacity="0.8" />
    </svg>
  );
}
