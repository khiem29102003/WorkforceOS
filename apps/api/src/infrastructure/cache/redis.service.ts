import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { createStructuredLogger } from "../observability/logger";

interface LocalCacheEntry {
  value: string;
  expiresAt: number;
}

interface LocalRateLimitEntry {
  count: number;
  expiresAt: number;
}

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;
  private readonly localCache = new Map<string, LocalCacheEntry>();
  private readonly localRateLimits = new Map<string, LocalRateLimitEntry>();
  private readonly logger = createStructuredLogger();

  constructor(config: ConfigService) {
    this.client = new Redis(config.get<string>("REDIS_URL", "redis://localhost:6379"), {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true
    });
    this.client.on("error", (error: Error) => {
      this.logger.warn("cache.redis_error", { message: error.message });
    });
  }

  get connection(): Redis {
    return this.client;
  }

  async getJson<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      return value ? (JSON.parse(value) as T) : this.getLocalJson<T>(key);
    } catch (error: unknown) {
      this.logger.warn("cache.redis_failed", { operation: "get", key, error: this.errorMessage(error) });
      return this.getLocalJson<T>(key);
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const serialized = JSON.stringify(value);
    this.localCache.set(key, {
      value: serialized,
      expiresAt: Date.now() + ttlSeconds * 1_000
    });
    try {
      await this.client.set(key, serialized, "EX", ttlSeconds);
    } catch (error: unknown) {
      this.logger.warn("cache.redis_failed", { operation: "set", key, error: this.errorMessage(error) });
    }
  }

  async rateLimit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number }> {
    try {
      const count = await this.client.incr(key);
      if (count === 1) {
        await this.client.expire(key, windowSeconds);
      }
      return {
        allowed: count <= limit,
        remaining: Math.max(limit - count, 0)
      };
    } catch (error: unknown) {
      this.logger.warn("cache.redis_failed", { operation: "rateLimit", key, error: this.errorMessage(error) });
      return this.localRateLimit(key, limit, windowSeconds);
    }
  }

  private getLocalJson<T>(key: string): T | null {
    const entry = this.localCache.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt < Date.now()) {
      this.localCache.delete(key);
      return null;
    }
    return JSON.parse(entry.value) as T;
  }

  private localRateLimit(key: string, limit: number, windowSeconds: number): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const current = this.localRateLimits.get(key);
    const entry = current && current.expiresAt > now ? current : { count: 0, expiresAt: now + windowSeconds * 1_000 };
    entry.count += 1;
    this.localRateLimits.set(key, entry);
    return {
      allowed: entry.count <= limit,
      remaining: Math.max(limit - entry.count, 0)
    };
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Unknown Redis error";
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch (error: unknown) {
      this.logger.warn("cache.redis_quit_failed", { error: this.errorMessage(error) });
    }
  }
}
