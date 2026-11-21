import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fmtKg = (kg: number) =>
  kg >= 10000 ? `${(kg / 1000).toLocaleString("en-GB", { maximumFractionDigits: 1 })} t` : `${Math.round(kg).toLocaleString("en-GB")} kg`;

export const fmtNum = (n: number, d = 0) => n.toLocaleString("en-GB", { maximumFractionDigits: d, minimumFractionDigits: d });

export const pct = (n: number, d = 0) => `${fmtNum(n, d)}%`;

export function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}
