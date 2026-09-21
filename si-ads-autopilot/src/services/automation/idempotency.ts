// Duplication protection (spec section 34). The key is deterministic for a
// given rule + entity + time bucket, so a second evaluation pass in the same
// window can never double-fire the same action — the DB's unique constraint
// on AutomationAction.idempotencyKey is the actual enforcement mechanism;
// this just computes the key consistently.

/** Bucket width in minutes — matches the intended worker evaluation cadence. */
const TIME_BUCKET_MINUTES = 5;

export function buildIdempotencyKey(
  ruleId: string,
  entityId: string,
  actionType: string,
  at: Date = new Date(),
): string {
  const bucket = Math.floor(at.getTime() / (TIME_BUCKET_MINUTES * 60_000));
  return `${ruleId}:${entityId}:${actionType}:${bucket}`;
}
