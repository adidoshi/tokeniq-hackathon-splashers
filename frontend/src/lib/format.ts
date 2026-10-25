/** Display formatters. All times shown in UTC: the bot's trading day and candles are UTC. */

const MINUS = "−"; // typographic minus lines up with + in tabular figures

/** Backend datetimes may lack a timezone (SQLite) - those are UTC. */
export function parseTime(value: string): Date {
  const iso = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
}

const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC",
});
const timeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "UTC",
});

export const fmtDateTime = (value: string) => dateTimeFmt.format(parseTime(value));
export const fmtClock = (value: string) => timeFmt.format(parseTime(value));

function withSign(n: number, body: string, signed: boolean): string {
  if (n < 0) return `${MINUS}${body}`;
  return signed && n > 0 ? `+${body}` : body;
}

export function fmtNumber(n: number, digits = 1): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtPrice(n: number | null | undefined, digits = 1): string {
  return n == null ? "-" : withSign(n, fmtNumber(Math.abs(n), digits), false);
}

export function fmtUsd(n: number | null | undefined, { digits = 2, signed = false } = {}): string {
  return n == null ? "-" : withSign(n, `$${fmtNumber(Math.abs(n), digits)}`, signed);
}

export function fmtPct(n: number | null | undefined, { digits = 2, signed = false } = {}): string {
  return n == null ? "-" : withSign(n, `${Math.abs(n).toFixed(digits)}%`, signed);
}

export const fmtPercent = fmtPct;

export function fmtR(n: number): string {
  return withSign(n, `${Math.abs(n).toFixed(2)}R`, true);
}

/** "trailing_stop" -> "trailing stop" */
export const humanize = (s: string) => s.replace(/_/g, " ");
