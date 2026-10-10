import type { SVGProps } from "react";

export function BirdIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" {...props}>
      <path d="M16 10 12 3q8-1 10 7l4-5 2 8" fill="currentColor" />
      <path d="m9 22-7-5 2 9 5 2" fill="currentColor" />
      <ellipse cx="22" cy="24" rx="15" ry="14" fill="currentColor" />
      <path d="M15 34q2-12 16-7l1 7q-7 7-17 0" fill="#ffe7c0" />
      <circle cx="27" cy="21" r="4" fill="#fffdf4" />
      <circle cx="28" cy="21" r="1.6" fill="#303b33" />
      <path d="m31 24 9 3-9 4" fill="#eeb54d" />
      <path d="m23 15 9 2" fill="none" stroke="#303b33" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
