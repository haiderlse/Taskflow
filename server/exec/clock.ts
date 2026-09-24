/** The server's only source of "now"; routes take it as a parameter so tests can fix it. */
export const nowIso = (): string => new Date().toISOString();
