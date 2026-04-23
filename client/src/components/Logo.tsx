export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Бот СБшник"
    >
      {/* Щит */}
      <path
        d="M16 2 L28 6 V15 C28 22 22 27 16 30 C10 27 4 22 4 15 V6 Z"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      {/* Увеличительное стекло внутри */}
      <circle cx="14" cy="14" r="4" stroke="hsl(var(--primary))" strokeWidth="2" />
      <line
        x1="17"
        y1="17"
        x2="21"
        y2="21"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
