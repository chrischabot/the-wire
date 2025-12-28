export function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function extractFirstUrl(text: string): string | null {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : null;
}

export function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  return match ? match[1] : null;
}

export function linkifyContent(text: string): string {
  if (!text) return "";

  let result = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  result = result.replace(
    /@([a-zA-Z0-9_]{3,15})/gi,
    '<a href="/u/$1" class="mention" onclick="event.stopPropagation()">@$1</a>',
  );

  result = result.replace(
    /#([a-zA-Z0-9_]+)/g,
    '<a href="/search?q=%23$1" class="mention" onclick="event.stopPropagation()">#$1</a>',
  );

  result = result.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" class="link" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">$1</a>',
  );

  return result;
}
