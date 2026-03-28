/**
 * @copyright 2026 Andrei
 */

import net from 'node:net';
import tls from 'node:tls';
import { EventEmitter } from 'node:events';
import { ReflexOptions, Packet } from '../types/index.js';
import { Authenticator } from '../security/Authenticator.js';
import { ProxyManager } from '../state/ProxyManager.js';

export class Reflex<T extends object> extends EventEmitter {
  private _state: T;
  private _proxy: ProxyManager;
  private _server: net.Server | tls.Server | null = null;
  private _socket: net.Socket | tls.TLSSocket | null = null;
  private _clients: Set<net.Socket | tls.TLSSocket> = new Set();
  private readonly _auth: Authenticator;
  private _timestamps: Map<string, number> = new Map();
  private _heartbeats: Set<NodeJS.Timeout> = new Set();

  constructor(private opts: ReflexOptions, initial: T = {} as T) {
    super();
    this._auth = new Authenticator();
    this._proxy = new ProxyManager((p, v) => this._propagate(p, v));
    this._state = this._proxy.observe(initial);
  }

  public get state(): T {
    return this._state;
  }

  public async boot(): Promise<void> {
    if (this.opts.mode === 'master') {
      return this._serve();
    } else {
      return this._join();
    }
  }

  private async _serve(): Promise<void> {
    const handler = (s: net.Socket | tls.TLSSocket) => this._handleInbound(s);
    
    if (this.opts.secure && this.opts.tls) {
      this._server = tls.createServer(this.opts.tls, handler);
    } else {
      this._server = net.createServer(handler);
    }
    
    return new Promise((r) => {
      this._server?.listen(this.opts.port, this.opts.host || '0.0.0.0', () => {
        this.emit('ready', `REFLEX Master initialized on ${this.opts.port}`);
        r();
      });
    });
  }

  private async _join(): Promise<void> {
    return new Promise((resolve) => {
      const connect = () => {
        const port = this.opts.port;
        const host = this.opts.host || 'localhost';

        if (this.opts.secure) {
          this._socket = tls.connect({ port, host, ...this.opts.tls }, () => {
             this._transmit({ t: 'AUTH', k: this.opts.key });
             resolve();
          });
        } else {
          this._socket = net.connect({ port, host }, () => {
            this._transmit({ t: 'AUTH', k: this.opts.key });
            resolve();
          });
        }

        this._socket.on('data', (d: Buffer) => this._process(d));
        this._socket.on('error', (e: Error) => {
          this.emit('error', e);
          setTimeout(connect, 5000);
        });
      };
      connect();
    });
  }

  private _handleInbound(s: net.Socket | tls.TLSSocket): void {
    let verified = false;
    const remote = s.remoteAddress || 'unknown';

    const heartbeat = setInterval(() => {
      if (s.writable) s.write(JSON.stringify({ t: 'PING' }));
    }, 30000);
    this._heartbeats.add(heartbeat);

    s.on('data', (d: Buffer) => {
      if (d.length > (this.opts.limits?.maxPayloadSize || 1024 * 1024)) {
        this.emit('warn', `Payload too large from ${remote}`);
        return s.destroy();
      }

      try {
        const pkg: Packet = JSON.parse(d.toString());
        
        if (pkg.t === 'AUTH' && pkg.k === this.opts.key) {
          verified = true;
          this._clients.add(s);
          s.write(JSON.stringify({ t: 'SYNC', v: this.state, m: Object.fromEntries(this._timestamps) }));
          this.emit('clientConnect', remote);
        } else if (verified) {
          if (pkg.t === 'PONG') return;
          if (!this._auth.rateLimit(remote, this.opts.limits?.opsPerSecond || 500)) return;
          this._process(d, s);
        } else {
          s.destroy();
        }
      } catch (e) { s.destroy(); }
    });

    s.on('close', () => {
      clearInterval(heartbeat);
      this._heartbeats.delete(heartbeat);
      this._clients.delete(s);
    });
  }

  private _process(d: Buffer, source?: net.Socket | tls.TLSSocket): void {
    try {
      const pkg: Packet = JSON.parse(d.toString());
      if (pkg.t === 'PING') return this._transmit({ t: 'PONG' });
      
      if (pkg.t === 'SYNC' && this.opts.mode === 'client') {
        Object.assign(this.state, pkg.v);
        if (pkg.m) this._timestamps = new Map(Object.entries(pkg.m));
        this.emit('synced');
      } else if (pkg.t === 'SET') {
        const key = pkg.p!.join('.');
        const last = this._timestamps.get(key) || 0;
        
        if (pkg.ts && pkg.ts < last) return; // Conflict resolution: LWW
        
        this._timestamps.set(key, pkg.ts || Date.now());
        this._proxy.patch(this.state, pkg.p!, pkg.v);

        if (this.opts.mode === 'master') {
          const raw = d.toString();
          this._clients.forEach(c => { if (c !== source) c.write(raw); });
        }
        this.emit('update', pkg);
      }
    } catch (e) {}
  }

  private _propagate(p: string[], v: any): void {
    const ts = Date.now();
    this._timestamps.set(p.join('.'), ts);
    this._transmit({ t: 'SET', p, v, ts });
  }

  private _transmit(pkg: Packet): void {
    const raw = JSON.stringify(pkg);
    if (this.opts.mode === 'master') {
      this._clients.forEach(c => c.write(raw));
    } else if (this._socket && !this._socket.destroyed) {
      this._socket.write(raw);
    }
  }

  public shutdown(): void {
    if (this._server) this._server.close();
    if (this._socket) this._socket.destroy();
    this._clients.forEach(c => c.destroy());
    this._clients.clear();
    this._heartbeats.forEach(h => clearInterval(h));
    this._heartbeats.clear();
  }
}


