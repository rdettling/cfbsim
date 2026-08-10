import { useId } from 'react';
import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';

interface SeasonSelectProps {
  years: number[];
  selectedYear: number;
  onChange: (year: number) => void;
}

export const SeasonSelect = ({
  years,
  selectedYear,
  onChange,
}: SeasonSelectProps) => {
  const labelId = useId();
  return (
    <FormControl size="small" sx={{ minWidth: 112 }}>
      <InputLabel id={labelId}>Season</InputLabel>
      <Select
        labelId={labelId}
        value={selectedYear}
        label="Season"
        onChange={event => onChange(Number(event.target.value))}
      >
        {years.map(year => (
          <MenuItem key={year} value={year}>
            {year}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};
