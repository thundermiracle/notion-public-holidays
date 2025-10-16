import * as core from '@actions/core';

import { importPublicHolidaysToNotion } from './importer';

const main = async () => {
  // Inputs
  const countryCode = core.getInput('country-code', { required: true });
  const yearStr = core.getInput('year');
  const dataSourceId = core.getInput('data-source-id', { required: true });
  const titleProp = core.getInput('title-prop');
  const dateProp = core.getInput('date-prop');
  const categoryProp = core.getInput('category-prop');
  const skipDuplicates = core.getBooleanInput('skip-duplicates');
  const notionToken = core.getInput('notion-token', { required: true });

  const year = yearStr ? Number(yearStr) : undefined;
  if (yearStr && (!/^[0-9]{4}$/.test(yearStr) || Number.isNaN(year))) {
    throw new Error(`Invalid year: ${yearStr}`);
  }
  core.info(
    `Importing holidays for ${countryCode} ${year ?? '(current year)'} ...`,
  );

  const result = await importPublicHolidaysToNotion({
    source: { countryCode, year },
    notion: {
      dataSourceId,
      token: notionToken,
      propertyNames: {
        title: titleProp,
        date: dateProp,
        category: categoryProp,
      },
      skipDuplicates,
    },
  });

  core.info(`Imported ${result.length} holidays (before dedupe).`);
  core.setOutput('count', result.length);
};

main().catch((error) => {
  if (error instanceof Error) {
    core.setFailed(error.message);
  } else {
    core.setFailed('Unknown error');
  }
});
