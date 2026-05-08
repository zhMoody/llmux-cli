import { checkAuthBasic, checkAuthModel } from "./routes/keys.js";
import type { RouteContext, Guard } from "./router.js";

export function sendError(
  req: Request,
  message: string,
  type: string = "invalid_request_error",
  status: number = 400,
): Response {
  const isAnthropic = !!req.headers.get("x-api-key");
  if (isAnthropic) {
    return Response.json(
      { type: "error", error: { type: status === 401 ? "authentication_error" : type, message } },
      { status },
    );
  }
  return Response.json(
    { error: { message, type, code: status.toString() } },
    { status },
  );
}

// Guard: /v1/ 路由鉴权（gateway key + 可选模型权限）
export const v1AuthGuard: Guard = async ({ req }) => {
  const basicAuth = checkAuthBasic(req);
  if (!basicAuth.authorized) {
    return sendError(req, basicAuth.error || "Unauthorized", "authentication_error", 401);
  }

  const method = req.method;
  const path = new URL(req.url).pathname.replace(/^\/v1\/v1\//, "/v1/");
  const needsModelCheck =
    method === "POST" && (path === "/v1/chat/completions" || path === "/v1/messages");

  if (needsModelCheck) {
    try {
      const body = (await req.clone().json()) as any;
      if (body.model) {
        const modelAuth = checkAuthModel(basicAuth.keyRecord, body.model);
        if (!modelAuth.authorized) {
          return sendError(req, modelAuth.error || "Unauthorized", "authentication_error", 401);
        }
      }
    } catch {}
  }

  return null;
};

// Guard: /api/ 管理接口鉴权（预留：后续加 web session / 登录注册时在此扩展）
export const apiAuthGuard: Guard = async (_ctx: RouteContext) => {
  // TODO: web session 鉴权逻辑在此添加
  return null;
};
