export function log(
  level: 'info' | 'warn' | 'error',
  message: string,
  context: Record<string, unknown> = {},
) {
  const safe = Object.fromEntries(
    Object.entries(context).filter(([key]) => !/password|token|content|authorization/i.test(key)),
  );
  process.stdout.write(
    JSON.stringify({ time: new Date().toISOString(), level, message, ...safe }) + '\n',
  );
}
