<p align="center">
  <img src="logo/logo.png" width="200px" align="center" alt="Reflex logo" />
  <h1 align="center">Reflex</h1>
  <p align="center">
    TypeScript-first reactive state synchronization for distributed Node.js nodes
  </p>
</p>
<br/>
<p align="center">
  <a href="https://github.com/AndrewMack1/reflex-sync/actions"><img src="https://github.com/AndrewMack1/reflex-sync/actions/workflows/test.yml/badge.svg" alt="test" /></a>
  <a href="https://github.com/AndrewMack1/reflex-sync/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/reflex-sync.svg" alt="license" /></a>
  <a href="https://www.npmjs.com/package/reflex-sync"><img src="https://img.shields.io/npm/dw/reflex-sync.svg" alt="downloads" /></a>
  <a href="https://github.com/AndrewMack1/reflex-sync/stargazers"><img src="https://img.shields.io/github/stars/AndrewMack1/reflex-sync.svg?style=social" alt="stars" /></a>
</p>
<br/>

## Table of contents
- [Installation](#installation)
- [Basic usage](#basic-usage)
- [Configuration](#configuration)
- [Security](#security)

## Installation

### Package managers

```bash
npm install reflex-sync
```

```bash
yarn add reflex-sync
```

```bash
pnpm add reflex-sync
```

## Basic usage

### Application node (Client)

A client node binds to a master node and participates in state synchronization using a recursive proxy model.

```typescript
import { Reflex } from 'reflex-sync';

const reflex = new Reflex({
  mode: 'client',
  host: '127.0.0.1',
  port: 8080,
  key: 'handshake-key'
});

await reflex.boot();

// Updates locally and broadcasts efficiently
reflex.state.settings = { theme: 'dark' };
```

### Authoritative node (Master)

The master node handles request rate limiting, initial state hydration, and broadcasting delta changes using Last Write Wins (LWW).

```typescript
import { Reflex } from 'reflex-sync';

const reflex = new Reflex({
  mode: 'master',
  port: 8080,
  key: 'handshake-key'
}, { system: { uptime: 0 } });

await reflex.boot();
```

## Configuration

The core `Reflex` constructor accepts a strict typing schema:

```typescript
type ReflexOptions = {
  mode: 'master' | 'client';
  host?: string;
  port: number;
  key: string;
  secure?: boolean;
  tls?: {
    cert?: string;
    key?: string;
  };
  limits?: {
    maxPayloadSize?: number;
    opsPerSecond?: number; 
  };
}
```

## Security

Reflex leverages native Node structures for production deployments:
- **Transport**: Supports raw TCP or TLS 1.3 encryption (via `secure: true`).
- **Handshake validation**: Rejects unknown clients using SHA-256 HMAC pre-shared key validation immediately at the socket layer.
- **DDoS mitigation**: Per-IP sliding-window rate limiting.
