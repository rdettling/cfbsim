export const getHistoryEraLabel = (
  year: number,
  previousYear: number | undefined,
  startYear: number,
) => {
  if (previousYear === undefined && year >= startYear) return 'Dynasty Era';
  if (year < startYear && (previousYear === undefined || previousYear >= startYear)) {
    return 'Historical Archive — season results only';
  }
  return null;
};
