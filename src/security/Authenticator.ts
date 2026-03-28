/**
 * @copyright 2026 Andrei
 * @license MIT
 */

import crypto from 'node:crypto';

export class Authenticator {
  private static readonly ALGORITHM = 'sha256';
  private clientOps: Map<string, number> = new Map();
  private lastReset = Date.now();

  /**
   * @params {string} key
   * @params {string} salt
   * @returns {string} HMAC signature
   */
  public static sign(key: string, salt: string): string {
    return crypto
      .createHmac(this.ALGORITHM, key)
      .update(salt)
      .digest('hex');
  }

  /**
   * @params {string} challenge
   * @params {string} signature
   * @params {string} key
   * @returns {boolean} Valid/Invalid
   */
  public static verify(challenge: string, signature: string, key: string): boolean {
    const expected = this.sign(key, challenge);
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  /**
   * @params {string} id
   * @params {number} limit
   * @returns {boolean} Within limit/Exceeded
   */
  public rateLimit(id: string, limit: number): boolean {
    const now = Date.now();
    if (now - this.lastReset > 1000) {
      this.clientOps.clear();
      this.lastReset = now;
    }

    const count = (this.clientOps.get(id) || 0) + 1;
    if (count > limit) return false;

    this.clientOps.set(id, count);
    return true;
  }
}
