/**
 * @copyright 2026 Andrei
 * @license MIT
 * @package REFLEX
 */

export type Operation = 'SET' | 'DELETE' | 'AUTH' | 'SYNC' | 'PONG' | 'PING';

export interface Packet {
  t: Operation;
  p?: string[]; // Path
  v?: any;      // Value
  ts?: number;  // Timestamp (Conflict Resolution)
  m?: Record<string, number>; // Full Metadata Sync
  k?: string;   // Key/Handshake
  s?: string;   // Salt/Signature
}

export interface ReflexOptions {
  host?: string;
  port: number;
  key: string;
  mode: 'master' | 'client';
  secure?: boolean;
  tls?: {
    cert?: string;
    key?: string;
    ca?: string;
    rejectUnauthorized?: boolean;
  };
  limits?: {
    maxClients?: number;
    maxPayloadSize?: number; // In bytes
    opsPerSecond?: number; 
  };
}
