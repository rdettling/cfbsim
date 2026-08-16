export class SchedulePlanningError extends Error {}
export class ScheduleValidationError extends Error {}

export const isScheduleFailure = (error: unknown) =>
  error instanceof SchedulePlanningError ||
  error instanceof ScheduleValidationError;
