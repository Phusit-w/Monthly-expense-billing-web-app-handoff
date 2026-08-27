import type { HTMLAttributes } from "react";

// The white rounded surface the redesign puts almost everything on
// (mockup: border-radius 20, shadow 0 6px 20px rgb(0 0 0 / .05)).
export default function Card({
  className = "",
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-surface rounded-card shadow-card ${className}`}
      {...rest}
    />
  );
}
