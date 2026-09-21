import "dotenv/config";
import { Worker } from "bullmq";
import { prisma } from "@/lib/prisma";
import { syncAllAdAccountsForOrganization } from "@/services/meta/sync";
import { evaluateRulesForOrganization } from "@/services/automation/evaluator";
import { generateAlertsForOrganization } from "@/services/alerts/generate";
import { generateDailyReport } from "@/services/reports/daily";
import { createRedisConnection } from "./connection";
import {
  QUEUE_NAMES,
  getSyncQueue,
  getEvaluateRulesQueue,
  getGenerateAlertsQueue,
  getDailyReportQueue,
} from "./queues";

// Background workers (spec section 32). Everything that mutates ads or
// evaluates automation rules runs here — server-side, on a schedule — never
// in the browser. Configure cadence with env vars so ops can tune it
// without a code change.
const SYNC_INTERVAL_MS = Number(process.env.SYNC_INTERVAL_MS ?? 5 * 60_000);
const EVALUATE_INTERVAL_MS = Number(process.env.EVALUATE_INTERVAL_MS ?? 5 * 60_000);
const ALERTS_INTERVAL_MS = Number(process.env.ALERTS_INTERVAL_MS ?? 5 * 60_000);
const DAILY_REPORT_CRON = process.env.DAILY_REPORT_CRON ?? "5 0 * * *"; // 00:05 every day

async function allOrganizationIds(): Promise<string[]> {
  const orgs = await prisma.organization.findMany({ select: { id: true } });
  return orgs.map((o) => o.id);
}

async function scheduleRepeatableJobs() {
  const syncQueue = getSyncQueue();
  const evaluateQueue = getEvaluateRulesQueue();
  const alertsQueue = getGenerateAlertsQueue();
  const reportQueue = getDailyReportQueue();

  await syncQueue.upsertJobScheduler("sync-all-orgs", { every: SYNC_INTERVAL_MS }, { name: "sync-all-orgs" });
  await evaluateQueue.upsertJobScheduler(
    "evaluate-all-orgs",
    { every: EVALUATE_INTERVAL_MS },
    { name: "evaluate-all-orgs" },
  );
  await alertsQueue.upsertJobScheduler(
    "alerts-all-orgs",
    { every: ALERTS_INTERVAL_MS },
    { name: "alerts-all-orgs" },
  );
  await reportQueue.upsertJobScheduler(
    "daily-report-all-orgs",
    { pattern: DAILY_REPORT_CRON },
    { name: "daily-report-all-orgs" },
  );
}

function startWorkers() {
  const connection = createRedisConnection();

  new Worker(
    QUEUE_NAMES.SYNC,
    async () => {
      for (const orgId of await allOrganizationIds()) {
        await syncAllAdAccountsForOrganization(orgId);
      }
    },
    { connection },
  );

  new Worker(
    QUEUE_NAMES.EVALUATE_RULES,
    async () => {
      for (const orgId of await allOrganizationIds()) {
        await evaluateRulesForOrganization(orgId);
      }
    },
    { connection },
  );

  new Worker(
    QUEUE_NAMES.GENERATE_ALERTS,
    async () => {
      for (const orgId of await allOrganizationIds()) {
        await generateAlertsForOrganization(orgId);
      }
    },
    { connection },
  );

  new Worker(
    QUEUE_NAMES.DAILY_REPORT,
    async () => {
      for (const orgId of await allOrganizationIds()) {
        await generateDailyReport(orgId);
      }
    },
    { connection },
  );

  console.log("SI Ads Autopilot workers running:", Object.values(QUEUE_NAMES).join(", "));
}

async function main() {
  await scheduleRepeatableJobs();
  startWorkers();
}

main().catch((err) => {
  console.error("Worker process failed to start:", err);
  process.exit(1);
});
