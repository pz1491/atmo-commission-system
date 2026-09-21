import { Queue } from "bullmq";
import { createRedisConnection } from "./connection";

// Named queues (spec section 32). Each has one job type; payload always
// carries an organizationId (or adAccountId) so a worker instance can be
// scaled horizontally without shared state.
export const QUEUE_NAMES = {
  SYNC: "meta-sync",
  EVALUATE_RULES: "evaluate-rules",
  GENERATE_ALERTS: "generate-alerts",
  DAILY_REPORT: "daily-report",
} as const;

let connection: ReturnType<typeof createRedisConnection> | null = null;
function getConnection() {
  connection ??= createRedisConnection();
  return connection;
}

export function getSyncQueue() {
  return new Queue(QUEUE_NAMES.SYNC, { connection: getConnection() });
}
export function getEvaluateRulesQueue() {
  return new Queue(QUEUE_NAMES.EVALUATE_RULES, { connection: getConnection() });
}
export function getGenerateAlertsQueue() {
  return new Queue(QUEUE_NAMES.GENERATE_ALERTS, { connection: getConnection() });
}
export function getDailyReportQueue() {
  return new Queue(QUEUE_NAMES.DAILY_REPORT, { connection: getConnection() });
}
