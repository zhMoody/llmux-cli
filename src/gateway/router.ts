export type RouteParams = Record<string, string>;
export type RouteContext = { req: Request; params: RouteParams; url: URL };
export type RouteHandler = (ctx: RouteContext) => Response | Promise<Response>;
export type Guard = (ctx: RouteContext) => Response | null | Promise<Response | null>;

interface RouteEntry {
  method: string;
  pattern: URLPattern;
  handler: RouteHandler;
  guard?: Guard;
}

export class Router {
  private routes: RouteEntry[] = [];

  private add(method: string, path: string, handler: RouteHandler, guard?: Guard) {
    this.routes.push({ method, pattern: new URLPattern({ pathname: path }), handler, guard });
  }

  get(path: string, handler: RouteHandler, guard?: Guard) { this.add("GET", path, handler, guard); }
  post(path: string, handler: RouteHandler, guard?: Guard) { this.add("POST", path, handler, guard); }
  put(path: string, handler: RouteHandler, guard?: Guard) { this.add("PUT", path, handler, guard); }
  delete(path: string, handler: RouteHandler, guard?: Guard) { this.add("DELETE", path, handler, guard); }

  group(prefix: string, guard: Guard, register: (r: GroupRouter) => void) {
    const group = new GroupRouter(prefix, guard, this);
    register(group);
  }

  async handle(req: Request): Promise<Response | null> {
    const url = new URL(req.url);

    for (const route of this.routes) {
      if (route.method !== req.method) continue;
      const match = route.pattern.exec({ pathname: url.pathname });
      if (!match) continue;

      const params = (match.pathname.groups ?? {}) as RouteParams;
      const ctx: RouteContext = { req, params, url };

      if (route.guard) {
        const blocked = await route.guard(ctx);
        if (blocked) return blocked;
      }

      return route.handler(ctx);
    }

    return null;
  }
}

class GroupRouter {
  constructor(
    private prefix: string,
    private guard: Guard,
    private parent: Router,
  ) {}

  get(path: string, handler: RouteHandler) { this.parent.get(this.prefix + path, handler, this.guard); }
  post(path: string, handler: RouteHandler) { this.parent.post(this.prefix + path, handler, this.guard); }
  put(path: string, handler: RouteHandler) { this.parent.put(this.prefix + path, handler, this.guard); }
  delete(path: string, handler: RouteHandler) { this.parent.delete(this.prefix + path, handler, this.guard); }
}
