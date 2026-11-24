// Turns a browser user-agent string into a friendly device label.
// Deliberately small: it only needs to tell a person which device is which.

export type DeviceInfo = { browser: string; os: string; mobile: boolean };

const BROWSERS: [RegExp, string][] = [
  [/Edg(A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser/, "Samsung Internet"],
  [/Firefox|FxiOS/, "Firefox"],
  [/Chrome|CriOS/, "Chrome"],
  [/Safari/, "Safari"],
];

const SYSTEMS: [RegExp, string][] = [
  [/iPhone/, "iPhone"],
  [/iPad/, "iPad"],
  [/Android/, "Android"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "Mac"],
  [/CrOS/, "ChromeOS"],
  [/Linux/, "Linux"],
];

export function parseUserAgent(ua: string | null | undefined): DeviceInfo {
  if (!ua) return { browser: "Unknown browser", os: "Unknown device", mobile: false };
  const browser = BROWSERS.find(([re]) => re.test(ua))?.[1] ?? "Browser";
  const os = SYSTEMS.find(([re]) => re.test(ua))?.[1] ?? "Unknown device";
  return { browser, os, mobile: /Mobile|iPhone|Android/.test(ua) && !/iPad/.test(ua) };
}

/** "5 min ago", "Yesterday", "12 Nov". */
export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 172800) return "Yesterday";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(iso));
}
