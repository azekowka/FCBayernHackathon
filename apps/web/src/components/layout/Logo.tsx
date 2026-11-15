/** Original mark: an arena ring in three segments — one per product. Not the club crest. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="13" fill="none" stroke="#2c374d" strokeWidth="4" />
      <path
        d="M16 3a13 13 0 0 1 11.26 6.5"
        fill="none"
        stroke="#dc052d"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M28.6 13.4a13 13 0 0 1-6.1 13.9"
        fill="none"
        stroke="#12a08e"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M18.2 28.8A13 13 0 0 1 4.2 21"
        fill="none"
        stroke="#3d8fe0"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="4.5" fill="#f4f6fb" />
    </svg>
  );
}
