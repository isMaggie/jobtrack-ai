import { z } from "zod";

// Keep calendar days as strings until the final form is converted to UTC.
export const calendarDateSchema = z.iso.date().refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Enter a valid applied date");
