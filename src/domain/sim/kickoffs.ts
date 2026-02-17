import { SIM_TUNING } from './config';

const randomInt = (min: number, max: number) => {
  const range = Math.max(0, max - min);
  return min + Math.floor(Math.random() * (range + 1));
};

export const kickoffStartFieldPosition = () => {
  const touchback = Math.random() < SIM_TUNING.kickoffs.touchbackRate;
  if (touchback) return SIM_TUNING.kickoffs.touchbackSpot;
  return randomInt(SIM_TUNING.kickoffs.returnMin, SIM_TUNING.kickoffs.returnMax);
};
