// Frontend-only config — all vars must be prefixed with NEXT_PUBLIC_ to be available in the browser.
// NEXT_PUBLIC_MOCK=true       → use client-side mock data (no backend required)
// NEXT_PUBLIC_MOCK=false      → call Spring Boot at NEXT_PUBLIC_API_BASE_URL
// NEXT_PUBLIC_API_BASE_URL    → Spring Boot base URL, e.g. http://localhost:8080

export const isMock = process.env.NEXT_PUBLIC_MOCK === "true";
export const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
