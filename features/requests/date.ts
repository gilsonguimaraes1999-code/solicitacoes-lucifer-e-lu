export const REQUEST_TIME_ZONE = "America/Sao_Paulo";

export interface RequestLocalDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const requestDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: REQUEST_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const localDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatterParts(value: Date) {
  return Object.fromEntries(requestDateFormatter.formatToParts(value).map((part) => [part.type, part.value]));
}

export function splitRequestLocalDateTime(value: string): RequestLocalDateTimeParts | null {
  const match = localDateTimePattern.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  if (year < 1 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return null;

  const calendarDate = new Date(0);
  calendarDate.setUTCHours(0, 0, 0, 0);
  calendarDate.setUTCFullYear(year, month - 1, day);
  if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day) return null;

  return { year, month, day, hour, minute, second };
}

export function isValidRequestLocalDateTime(value: string) {
  return splitRequestLocalDateTime(value) !== null;
}

export function requestInstantToLocalValue(value: string) {
  const parts = formatterParts(new Date(value));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

export function currentRequestLocalValue(now = new Date()) {
  return requestInstantToLocalValue(now.toISOString());
}

export function joinRequestLocalDateTime(parts: RequestLocalDateTimeParts) {
  return `${String(parts.year).padStart(4, "0")}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

export function formatRequestCreatedAt(value: string) {
  const parts = formatterParts(new Date(value));
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
}
