import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortHash(hash: string, size = 10) {
  if (!hash) return "—";
  if (hash.length <= size * 2) return hash;
  return `${hash.slice(0, size)}…${hash.slice(-6)}`;
}
