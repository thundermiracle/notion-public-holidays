export interface NagerPublicHoliday {
  date: string; // YYYY-MM-DD
  localName: string; // localized holiday name
  name: string; // English name
  countryCode: string; // e.g., JP, CN
  fixed: boolean;
  global: boolean;
  counties: string[] | null;
  launchYear: number | null;
  types: string[]; // e.g., ["Public"]
}

export interface HolidayItem {
  date: string; // ISO date YYYY-MM-DD
  title: string; // prefer localized name
  category: string; // first type or fallback
}

export interface FetchLike {
  (
    input: string,
    init?: { method?: string; headers?: Record<string, string> },
  ): Promise<{
    ok: boolean;
    status: number;
    statusText: string;
    json: () => Promise<unknown>;
  }>;
}
