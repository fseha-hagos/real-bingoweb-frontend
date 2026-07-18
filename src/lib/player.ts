import { UserSafeType } from "../types/game";

/** Prefer human name over raw phone / temp auth names */
export function getDisplayName(user: Partial<UserSafeType> | null | undefined): string {
  if (!user) return "ተጫዋች";

  const candidates = [user.firstName, user.username, user.name].filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0
  );

  for (const c of candidates) {
    const trimmed = c.trim();
    // Skip phone-like / temp auth names
    if (/^\+?\d{8,}$/.test(trimmed)) continue;
    if (trimmed.includes("@bingo.local")) continue;
    return trimmed;
  }

  if (user.phoneNumber) {
    return formatPhoneDisplay(user.phoneNumber);
  }

  return "ተጫዋች";
}

export function needsDisplayName(user: Partial<UserSafeType> | null | undefined): boolean {
  if (!user) return true;
  const candidates = [user.firstName, user.username, user.name].filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0
  );
  return !candidates.some((c) => {
    const trimmed = c.trim();
    return !/^\+?\d{8,}$/.test(trimmed) && !trimmed.includes("@bingo.local");
  });
}

export function getInitials(user: Partial<UserSafeType> | null | undefined): string {
  const name = getDisplayName(user);
  if (/^[+\d]/.test(name) || name.startsWith("+")) return "#";
  return name.charAt(0).toUpperCase();
}

export function formatPhoneDisplay(phone?: string | null): string {
  if (!phone) return "—";
  if (phone.startsWith("+251") && phone.length >= 13) {
    const rest = phone.slice(4);
    return `+251 ${rest.slice(0, 2)} ${rest.slice(2, 5)} ${rest.slice(5)}`;
  }
  return phone;
}
