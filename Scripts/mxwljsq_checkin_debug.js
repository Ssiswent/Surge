// Debug 版：只抓 Cookie + 打日志 + 发通知
const COOKIE_KEY = "MXWLJSQ_Cookie";
const TITLE = "猫熊签到DEBUG";

if (typeof $request !== "undefined") {
  const url = $request.url || "";
  const headers = $request.headers || {};
  const cookieHeader = headers["Cookie"] || headers["cookie"] || "";

  console.log("[猫熊DEBUG] url = " + url);
  console.log("[猫熊DEBUG] headers = " + JSON.stringify(headers));
  console.log("[猫熊DEBUG] cookie = " + cookieHeader);

  if (!cookieHeader) {
    $notification.post(TITLE, "获取失败", "未找到 Cookie，请确认已登录状态");
    $done({});
  } else {
    const ok = $persistentStore.write(cookieHeader, COOKIE_KEY);
    if (ok) {
      $notification.post(TITLE, "✅ Cookie 已保存", cookieHeader.substring(0, 80) + "...");
    } else {
      $notification.post(TITLE, "保存失败", "写入持久化存储失败");
    }
    $done({});
  }
} else {
  const c = $persistentStore.read(COOKIE_KEY) || "无";
  $notification.post(TITLE, "当前已存 Cookie", c.substring(0, 80) + "...");
  $done();
}