// mxwljsq_checkin.js for Surge
// 猫熊网络加速器每日签到（SSPanel 面板）

const COOKIE_KEY = "MXWLJSQ_Cookie";
const TITLE = "猫熊签到";
const BASE_URL = "https://mxwljsq.com";

// Phase 1: http-request 拦截，抓取 Cookie
if (typeof $request !== "undefined") {
  const cookieHeader =
    $request.headers["Cookie"] ||
    $request.headers["cookie"] ||
    "";

  if (!cookieHeader) {
    $notification.post(TITLE, "获取失败", "未找到 Cookie，请确保已登录后访问首页");
    return $done({});
  }

  if ($persistentStore.write(cookieHeader, COOKIE_KEY)) {
    $notification.post(TITLE, "✅ Cookie 已保存", "自动签到已就绪，明天起每天自动执行");
    console.log("[猫熊] Cookie saved: " + cookieHeader.substring(0, 80) + "...");
  } else {
    $notification.post(TITLE, "保存失败", "写入持久化存储失败，请检查 Surge 配置");
  }
  $done({});
} else {
  // Phase 2: Cron 定时签到
  const cookie = $persistentStore.read(COOKIE_KEY);
  if (!cookie) {
    $notification.post(TITLE, "❌ 无法签到", "本地没有保存的 Cookie，请先访问猫熊首页触发抓取");
    return $done();
  }

  $httpClient.post(
    {
      url: `${BASE_URL}/user/checkin`,
      headers: {
        Cookie: cookie,
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        Referer: `${BASE_URL}/user/`,
        Origin: BASE_URL,
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
      body: "",
    },
    (error, response, body) => {
      if (error) {
        $notification.post(TITLE, "❌ 请求失败", String(error));
        return $done();
      }

      const status = response.status || response.statusCode;
      let msg = body || "无返回内容";
      let traffic = "";

      try {
        const json = JSON.parse(body);
        msg = json.msg || json.message || msg;
        if (json.traffic_info) traffic = "\n" + json.traffic_info;
        if (json.trafficInfo) traffic = "\n" + json.trafficInfo;
      } catch (e) { }

      console.log(`[猫熊签到] 状态码: ${status} | 响应: ${msg}`);

      if (status >= 200 && status < 300) {
        if (
          msg.includes("已签到") ||
          msg.includes("重复") ||
          msg.toLowerCase().includes("already")
        ) {
          $notification.post(TITLE, "📅 今日已签到", msg + traffic);
        } else {
          $notification.post(TITLE, "🎉 签到成功", msg + traffic);
        }
      } else if (status === 302 || status === 401 || status === 403) {
        $notification.post(TITLE, "⚠️ Cookie 已过期", "请重新访问猫熊首页以更新 Cookie");
      } else {
        $notification.post(TITLE, `❌ 异常 ${status}`, msg);
      }

      $done();
    }
  );
}