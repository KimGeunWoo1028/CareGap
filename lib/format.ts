export function formatSeoulDate(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [y, m, d] = isoDate.split("-");
  return `${y}. ${m}. ${d}.`;
}

export function formatSeoulDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function channelLabel(channel: string): string {
  switch (channel) {
    case "phone":
      return "전화";
    case "visit":
      return "방문";
    case "other":
      return "기타";
    default:
      return channel;
  }
}

export function analysisStatusLabel(status: string): string {
  switch (status) {
    case "processing":
      return "처리 중";
    case "succeeded":
      return "성공";
    case "failed":
      return "실패";
    default:
      return status;
  }
}

export function codePointLength(value: string): number {
  return Array.from(value).length;
}

export function seoulTodayIsoDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
