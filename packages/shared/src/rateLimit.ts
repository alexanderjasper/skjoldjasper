export type TokenBucket = {
    consume: (key: string) => boolean;
};

export function createTokenBucket({capacity, refillMs}: {
    capacity: number;
    refillMs: number
}): TokenBucket {
    const buckets = new Map<string, { tokens: number; last: number }>();

    function consume(key: string): boolean {
        const now = Date.now();
        let bucket = buckets.get(key);
        if (!bucket) {
            bucket = {tokens: capacity, last: now};
            buckets.set(key, bucket);
        }

        const elapsed = now - bucket.last;
        const refill = Math.floor((elapsed / refillMs) * capacity);
        if (refill > 0) {
            bucket.tokens = Math.min(capacity, bucket.tokens + refill);
            bucket.last = now;
        }
        if (bucket.tokens <= 0) return false;
        bucket.tokens -= 1;
        return true;
    }

    return {consume};
}

