type BrandMarkProps = {
  className?: string;
  size?: number;
};

/** Interchange mark: two route lines meeting at a station circle. */
export function BrandMark({ className, size = 28 }: BrandMarkProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M4 8.5h8.5L18 19.5H24"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 19.5h8.5L18 8.5H24"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
      <circle cx="14" cy="14" r="3.25" fill="currentColor" />
      <circle cx="14" cy="14" r="1.35" fill="var(--surface, #fff)" />
    </svg>
  );
}
