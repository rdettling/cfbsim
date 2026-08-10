import type { SeasonMemory } from '../../../../types/memory';

export const resolveStatisticsSeason = (
  currentYear: number,
  memories: SeasonMemory[],
  requestedYear?: number,
) => {
  const archived = memories.filter(memory => memory.year !== currentYear);
  const years = [currentYear, ...archived.map(memory => memory.year)]
    .filter((year, index, all) => all.indexOf(year) === index)
    .sort((left, right) => right - left);
  const selectedYear =
    Number.isInteger(requestedYear) && years.includes(requestedYear!)
      ? requestedYear!
      : currentYear;
  return {
    years,
    selectedYear,
    memory:
      selectedYear === currentYear
        ? null
        : archived.find(memory => memory.year === selectedYear) ?? null,
  };
};
