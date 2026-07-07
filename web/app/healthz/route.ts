// Railway 健康检查端点：仅确认前端进程存活，不依赖后端可用性，
// 因此部署后能快速通过 healthcheck（与 FastAPI 的 /healthz 对齐）。
export async function GET() {
  return new Response("ok", {
    status: 200,
    headers: { "content-type": "text/plain" },
  });
}
