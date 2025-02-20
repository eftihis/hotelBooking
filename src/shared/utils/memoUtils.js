export function memoize(fn, options = {}) {
    const cache = new Map();
    const ttl = options.ttl || 30000; // Default 30 second TTL

    const memoized = async function (...args) {
        const key = JSON.stringify(args);
        const cached = cache.get(key);
        const now = Date.now();

        // Return cached result if it exists and hasn't expired
        if (cached && (now - cached.timestamp) < ttl) {
            console.log(`Cache hit for ${fn.name}`, { args, key });
            return cached.value;
        }

        // Make the actual API call
        console.log(`Cache miss for ${fn.name}`, { args, key });
        const result = await fn.apply(this, args);
        
        // Store in cache with timestamp
        cache.set(key, {
            value: result,
            timestamp: now
        });

        return result;
    };

    // Method to clear specific cache entry
    memoized.clearCache = (args) => {
        const key = JSON.stringify(args);
        console.log(`Clearing cache for ${fn.name}`, { args, key });
        cache.delete(key);
    };

    return memoized;
} 