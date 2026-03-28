/**
 * @copyright 2026 Andrei
 */

export class ProxyManager {
  private _onChange: (path: string[], value: any) => void;

  /**
   * @params {(path: string[], value: any) => void} listener
   */
  constructor(listener: (path: string[], value: any) => void) {
    this._onChange = listener;
  }

  /**
   * @params {T} source
   * @params {string[]} path
   * @returns {T} Observability Proxy
   */
  public observe<T extends object>(source: T, path: string[] = []): T {
    const self = this;
    return new Proxy(source, {
      set(target: any, prop: string | symbol, value: any): boolean {
        const fullPath = [...path, String(prop)];
        
        // Prevent recursive triggers if same value
        if (target[prop] === value) return true;

        target[prop] = value;
        self._onChange(fullPath, value);
        return true;
      },
      get(target: any, prop: string | symbol): any {
        const value = target[prop];
        if (typeof value === 'object' && value !== null) {
          return self.observe(value, [...path, String(prop)]);
        }
        return value;
      },
      deleteProperty(target: any, prop: string | symbol): boolean {
        delete target[prop];
        self._onChange([...path, String(prop)], undefined);
        return true;
      }
    });
  }

  /**
   * @params {any} root
   * @params {string[]} path
   * @params {any} value
   */
  public patch(root: any, path: string[], value: any): void {
    const last = path.pop();
    if (!last) return;

    let target = root;
    for (const segment of path) {
      if (!target[segment]) target[segment] = {};
      target = target[segment];
    }

    if (value === undefined) {
      delete target[last];
    } else {
      target[last] = value;
    }
  }
}
