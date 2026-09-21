import IORedis from "ioredis";

// Single shared Redis connection for every BullMQ queue/worker in this
// process. BullMQ requires maxRetriesPerRequest: null on the connection it
// manages itself.
export function createRedisConnection() {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  return new IORedis(url, { maxRetriesPerRequest: null });
}
