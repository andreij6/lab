// Templates and daily notes: `Templates/<name>.md` files with `{{date}}`, `{{time}}`, `{{title}}`
// and `{{date:YYYY-MM-DD}}`-style tokens, the way Obsidian's core Templates plugin fills them.

const pad = (n: number) => String(n).padStart(2, "0");

/** Format a date with Moment-like tokens: YYYY MM DD HH mm ss ddd dddd MMM MMMM. */
export function formatDate(d: Date, fmt: string): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return fmt.replace(/YYYY|MMMM|MMM|MM|DD|HH|mm|ss|dddd|ddd/g, (t) => {
    switch (t) {
      case "YYYY": return String(d.getFullYear());
      case "MMMM": return months[d.getMonth()];
      case "MMM": return months[d.getMonth()].slice(0, 3);
      case "MM": return pad(d.getMonth() + 1);
      case "DD": return pad(d.getDate());
      case "HH": return pad(d.getHours());
      case "mm": return pad(d.getMinutes());
      case "ss": return pad(d.getSeconds());
      case "dddd": return days[d.getDay()];
      case "ddd": return days[d.getDay()].slice(0, 3);
    }
    return t;
  });
}

/** Replace template tokens; unknown tokens are left as they are. */
export function fillTemplate(template: string, vars: { title: string; now?: Date }): string {
  const now = vars.now ?? new Date();
  return template.replace(/\{\{\s*(date|time|title)(?::([^}]+))?\s*\}\}/g, (_, key: string, fmt?: string) => {
    if (key === "title") return vars.title;
    if (key === "date") return formatDate(now, fmt ?? "YYYY-MM-DD");
    return formatDate(now, fmt ?? "HH:mm");
  });
}

export const dailyPath = (now = new Date(), folder = "Daily") => `${folder}/${formatDate(now, "YYYY-MM-DD")}.md`;
