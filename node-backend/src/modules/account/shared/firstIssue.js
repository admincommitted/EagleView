/** Runs a Zod schema and gives the message of its first problem, or null when the value passes. */
export function firstIssueMessage(schema, value) {
  const result = schema.safeParse(value);
  return result.success ? null : result.error.issues[0]?.message || 'Some fields are not valid';
}
