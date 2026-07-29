import type { Ctx } from "../bot.js";

export interface SavedTitle {
  id: number;
  imdbId?: string;
  title: string;
  year?: string;
  type: "movie" | "tv";
}

export interface QueryRecord {
  titleText: string;
  year?: string;
  season?: string;
  episode?: string;
}

interface OwnerData {
  watchlist: SavedTitle[];
  queries: QueryRecord[];
}

type WorkerEnvLike = {
  CHAT_DO?: { idFromName(name: string): unknown; get(id: unknown): { fetch(input: string, init?: RequestInit): Promise<Response> } };
};

interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string): Promise<unknown>;
}

let redisClient: Promise<RedisClient> | undefined;

async function redis() {
  if (typeof process === "undefined" || !process.env.REDIS_URL) return undefined;
  redisClient ??= (async () => {
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    const mod = require("ioredis") as { default?: new (url: string) => unknown };
    const Redis = (mod.default ?? mod) as unknown as new (url: string) => RedisClient;
    return new Redis(process.env.REDIS_URL!);
  })();
  return redisClient;
}

function workerEnv(ctx: Ctx): WorkerEnvLike | undefined {
  return (ctx as Ctx & { env?: WorkerEnvLike }).env;
}

async function readRecord<T>(ctx: Ctx, key: string): Promise<T | undefined> {
  const env = workerEnv(ctx);
  if (env?.CHAT_DO) {
    const stub = env.CHAT_DO.get(env.CHAT_DO.idFromName("movie-records"));
    const response = await stub.fetch(`https://do/record?key=${encodeURIComponent(key)}`);
    return response.status === 204 ? undefined : await response.json() as T;
  }
  const client = await redis();
  if (!client) return undefined;
  const raw = await client.get(`movie:${key}`);
  return raw ? JSON.parse(raw) as T : undefined;
}

async function writeRecord(ctx: Ctx, key: string, value: unknown): Promise<boolean> {
  const env = workerEnv(ctx);
  if (env?.CHAT_DO) {
    const stub = env.CHAT_DO.get(env.CHAT_DO.idFromName("movie-records"));
    await stub.fetch(`https://do/record?key=${encodeURIComponent(key)}`, {
      method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(value),
    });
    return true;
  }
  const client = await redis();
  if (!client) return false;
  await client.set(`movie:${key}`, JSON.stringify(value));
  return true;
}

export async function claimOrCheckOwner(ctx: Ctx, claim = false): Promise<"owner" | "other" | "unavailable"> {
  const userId = ctx.from?.id;
  if (!userId) return "other";
  const owner = await readRecord<number>(ctx, "owner");
  if (owner === undefined) {
    if (!claim || !(await writeRecord(ctx, "owner", userId))) return "unavailable";
    return "owner";
  }
  return owner === userId ? "owner" : "other";
}

async function ownerData(ctx: Ctx): Promise<OwnerData | undefined> {
  const owner = await claimOrCheckOwner(ctx);
  if (owner !== "owner") return undefined;
  return (await readRecord<OwnerData>(ctx, `data:${ctx.from!.id}`)) ?? { watchlist: [], queries: [] };
}

async function saveOwnerData(ctx: Ctx, data: OwnerData): Promise<boolean> {
  return writeRecord(ctx, `data:${ctx.from!.id}`, data);
}

export async function addQuery(ctx: Ctx, query: QueryRecord): Promise<boolean> {
  const data = await ownerData(ctx);
  if (!data) return false;
  data.queries = [query, ...data.queries].slice(0, 100);
  return saveOwnerData(ctx, data);
}

export async function recentQueries(ctx: Ctx): Promise<QueryRecord[] | undefined> {
  return (await ownerData(ctx))?.queries;
}

export async function watchlist(ctx: Ctx): Promise<SavedTitle[] | undefined> {
  return (await ownerData(ctx))?.watchlist;
}

export async function addWatchlist(ctx: Ctx, title: SavedTitle): Promise<"added" | "exists" | "unavailable"> {
  const data = await ownerData(ctx);
  if (!data) return "unavailable";
  if (data.watchlist.some((item) => item.id === title.id && item.type === title.type)) return "exists";
  data.watchlist.push(title);
  return (await saveOwnerData(ctx, data)) ? "added" : "unavailable";
}

export async function removeWatchlist(ctx: Ctx, index: number): Promise<SavedTitle | undefined> {
  const data = await ownerData(ctx);
  if (!data || index < 0 || index >= data.watchlist.length) return undefined;
  const [removed] = data.watchlist.splice(index, 1);
  return (await saveOwnerData(ctx, data)) ? removed : undefined;
}
