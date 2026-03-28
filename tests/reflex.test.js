import { test, describe } from 'node:test';
import assert from 'node:assert';
import { Reflex } from '../dist/index.js';

describe('REFLEX Sync Engine', () => {
  test('Should synchronize state from master to client', async () => {
    const port = 8081;
    const key = 'test-key';

    const master = new Reflex({ 
      mode: 'master', 
      port, 
      key 
    }, { count: 0 });

    await master.boot();

    const client = new Reflex({ 
      mode: 'client', 
      port, 
      key 
    });

    await client.boot();

    // Trigger update on master
    master.state.count = 42;

    // Small delay for network propagation
    await new Promise(r => setTimeout(r, 100));

    assert.strictEqual(client.state.count, 42);

    master.shutdown();
    client.shutdown();
  });

  test('Should synchronize state from client to master', async () => {
    const port = 8082;
    const key = 'test-key';

    const master = new Reflex({ 
      mode: 'master', 
      port, 
      key 
    }, { settings: { enabled: false } });

    await master.boot();

    const client = new Reflex({ 
      mode: 'client', 
      port, 
      key 
    });

    await client.boot();

    // Trigger update on client
    client.state.settings.enabled = true;

    // Small delay for network propagation
    await new Promise(r => setTimeout(r, 100));

    assert.strictEqual(master.state.settings.enabled, true);

    master.shutdown();
    client.shutdown();
  });

  test('Should resolve conflicts using LWW', async () => {
    const port = 8083;
    const key = 'test-key';

    const master = new Reflex({ 
      mode: 'master', 
      port, 
      key 
    }, { val: 'base' });

    await master.boot();

    const client = new Reflex({ 
      mode: 'client', 
      port, 
      key 
    });

    await client.boot();

    master.state.val = 'newest';
    
    await new Promise(r => setTimeout(r, 100));
    assert.strictEqual(client.state.val, 'newest');

    master.shutdown();
    client.shutdown();
  });
});

