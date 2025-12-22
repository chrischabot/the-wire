/**
 * Snowflake ID Generator
 * 
 * Structure (64 bits total):
 * - 41 bits: Timestamp (milliseconds since epoch)
 * - 10 bits: Worker ID (0-1023)
 * - 12 bits: Sequence number (0-4095)
 * 
 * Epoch: 2024-01-01 00:00:00 UTC
 */

// Custom epoch: 2024-01-01 00:00:00 UTC
const EPOCH = 1704067200000n;

// Bit lengths
const WORKER_BITS = 10n;
const SEQUENCE_BITS = 12n;

// Max values
const MAX_WORKER_ID = (1n << WORKER_BITS) - 1n;
const MAX_SEQUENCE = (1n << SEQUENCE_BITS) - 1n;

// Bit shifts
const TIMESTAMP_SHIFT = WORKER_BITS + SEQUENCE_BITS;
const WORKER_SHIFT = SEQUENCE_BITS;

/**
 * Snowflake ID Generator class
 */
export class SnowflakeGenerator {
  private workerId: bigint;
  private sequence: bigint = 0n;
  private lastTimestamp: bigint = -1n;

  constructor(workerId: number = 0) {
    const workerIdBig = BigInt(workerId);
    if (workerIdBig < 0n || workerIdBig > MAX_WORKER_ID) {
      throw new Error(`Worker ID must be between 0 and ${MAX_WORKER_ID}`);
    }
    this.workerId = workerIdBig;
  }

  /**
   * Generate a new Snowflake ID
   */
  generate(): string {
    let timestamp = BigInt(Date.now()) - EPOCH;

    if (timestamp < this.lastTimestamp) {
      throw new Error('Clock moved backwards. Refusing to generate ID.');
    }

    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1n) & MAX_SEQUENCE;
      if (this.sequence === 0n) {
        // Sequence exhausted, wait for next millisecond
        timestamp = this.waitNextMillis(this.lastTimestamp);
      }
    } else {
      this.sequence = 0n;
    }

    this.lastTimestamp = timestamp;

    const id = (timestamp << TIMESTAMP_SHIFT) |
               (this.workerId << WORKER_SHIFT) |
               this.sequence;

    return id.toString();
  }

  /**
   * Wait until next millisecond
   */
  private waitNextMillis(lastTimestamp: bigint): bigint {
    let timestamp = BigInt(Date.now()) - EPOCH;
    while (timestamp <= lastTimestamp) {
      timestamp = BigInt(Date.now()) - EPOCH;
    }
    return timestamp;
  }

  /**
   * Parse a Snowflake ID to extract its components
   */
  static parse(id: string): { timestamp: Date; workerId: number; sequence: number } {
    const idBig = BigInt(id);
    
    const timestamp = (idBig >> TIMESTAMP_SHIFT) + EPOCH;
    const workerId = (idBig >> WORKER_SHIFT) & MAX_WORKER_ID;
    const sequence = idBig & MAX_SEQUENCE;

    return {
      timestamp: new Date(Number(timestamp)),
      workerId: Number(workerId),
      sequence: Number(sequence),
    };
  }

  /**
   * Check if a string is a valid Snowflake ID
   */
  static isValid(id: string): boolean {
    try {
      const idBig = BigInt(id);
      return idBig > 0n;
    } catch {
      return false;
    }
  }

  /**
   * Compare two Snowflake IDs (for sorting)
   * Returns negative if a < b, positive if a > b, 0 if equal
   */
  static compare(a: string, b: string): number {
    const aBig = BigInt(a);
    const bBig = BigInt(b);
    if (aBig < bBig) return -1;
    if (aBig > bBig) return 1;
    return 0;
  }
}

// Default generator instance (worker ID 0)
let defaultGenerator: SnowflakeGenerator | null = null;

/**
 * Generate a Snowflake ID using the default generator
 */
export function generateId(workerId: number = 0): string {
  if (!defaultGenerator || defaultGenerator['workerId'] !== BigInt(workerId)) {
    defaultGenerator = new SnowflakeGenerator(workerId);
  }
  return defaultGenerator.generate();
}