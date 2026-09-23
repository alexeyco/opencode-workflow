// Command template renderer: substitutes the single {{REVDIFF_LAUNCHER}}
// placeholder with the resolved launcher path, and appends user arguments.

const PLACEHOLDER = "{{REVDIFF_LAUNCHER}}";

/**
 * POSIX shell-quote a path: always wrap in single quotes, escaping any
 * embedded single quotes as `'\''` (close quote, escaped quote, reopen).
 * Mirrors the sq() helper in tools/launch-revdiff.sh.
 */
function shellQuote(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

export function renderCommand(
  template: string,
  launcherPath: string,
  userText: string,
): string {
  if (!template.includes(PLACEHOLDER)) {
    throw new Error(
      `renderCommand: template is missing placeholder ${PLACEHOLDER}`,
    );
  }
  const quoted = shellQuote(launcherPath);
  // Use split/join instead of String.replace to avoid $&/$`/$' interpolation.
  const rendered = template.split(PLACEHOLDER).join(quoted);
  const trimmed = userText.trim();
  if (trimmed.length > 0) {
    return `${rendered}\n\nArguments: ${trimmed}`;
  }
  return rendered;
}
