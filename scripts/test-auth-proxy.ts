/**
 * 官方账户反代登录原型测试 (OpenAI 示例)
 */

const TARGET_DOMAIN = "chat.openai.com";
const PORT = 25976;

console.log(`[Proxy] 启动登录拦截代理: http://localhost:${PORT}`);
console.log(`[Proxy] 目标域名: https://${TARGET_DOMAIN}`);

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    
    // 构建转发请求
    const proxyUrl = `https://${TARGET_DOMAIN}${url.pathname}${url.search}`;
    const headers = new Headers(req.headers);
    
    // 修改关键头部以模拟官方请求
    headers.set("Host", TARGET_DOMAIN);
    headers.delete("Origin");
    headers.set("Referer", `https://${TARGET_DOMAIN}/`);

    try {
      const response = await fetch(proxyUrl, {
        method: req.method,
        headers: headers,
        body: req.method !== "GET" && req.method !== "HEAD" ? await req.blob() : undefined,
        redirect: "manual" // 我们手动处理重定向，防止浏览器跳出代理
      });

      // 拦截并记录 Set-Cookie
      const setCookie = response.headers.get("Set-Cookie");
      if (setCookie) {
        console.log(`\n🔔 [COOKIE INTERCEPTED] 发现了 Cookie 设置:\n${setCookie}\n`);
        if (setCookie.includes("session-token") || setCookie.includes("AccessToken")) {
           console.log("🌟 [SUCCESS] 找到了疑似登录令牌 (Session Token)！");
        }
      }

      // 处理重定向：确保 Location 指向本地代理而非远程真实域名
      const newHeaders = new Headers(response.headers);
      const location = newHeaders.get("Location");
      if (location && location.includes(TARGET_DOMAIN)) {
        const newLocation = location.replace(`https://${TARGET_DOMAIN}`, `http://localhost:${PORT}`);
        newHeaders.set("Location", newLocation);
        console.log(`[Proxy] 处理重定向: ${location} -> ${newLocation}`);
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });

    } catch (err: any) {
      console.error(`[Proxy Error] ${err.message}`);
      return new Response(`Proxy Error: ${err.message}`, { status: 502 });
    }
  }
});
