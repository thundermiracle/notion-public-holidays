import { fetchNagerPublicHolidays } from './holidays/nager';
import type { HolidayItem } from './types';
import { createHolidayPages, type PropertyNames } from './notion/create-pages';

export type ImportParams = {
  source: {
    countryCode: string;
    year?: number;
  };
  notion: {
    dataSourceId: string;
    token: string;
    propertyNames?: PropertyNames;
    skipDuplicates?: boolean;
  };
};

export async function importPublicHolidaysToNotion({
  source,
  notion,
}: ImportParams): Promise<HolidayItem[]> {
  const year = source.year ?? new Date().getFullYear();
  const holidays = await fetchNagerPublicHolidays(source.countryCode, year);
  const propertyNames = notion.propertyNames || {};
  const skipDuplicates = notion.skipDuplicates ?? true;

  await createHolidayPages({
    dataSourceId: notion.dataSourceId,
    holidays,
    propertyNames,
    notionToken: notion.token,
    skipDuplicates,
    year,
  });
  return holidays;
}
