// mxwljsq_checkin.js for Surge
// 猫熊网络加速器自动签到（正式版）

const COOKIE_KEY = "MXWLJSQ_Cookie";
const TITLE = "猫熊签到";
const BASE_URL = "https://mxwljsq.com";

if (typeof $request !== "undefined") {
  const headers = $request.headers || {};
  const cookieHeader = headers["Cookie"] || headers["cookie"] || "";

  if (!cookieHeader) {
    $done({});
  } else {
    const oldCookie = $persistentStore.read(COOKIE_KEY) || "";
    if (oldCookie !== cookieHeader) {
      $persistentStore.write(cookieHeader, COOKIE_KEY);
      $notification.post(TITLE, "Cookie 已更新", "已保存最新登录态");
    }
    $done({});
  }
} else {
  const cookie = $persistentStore.read(COOKIE_KEY);

  if (!cookie) {
    $notification.post(TITLE, "无法签到", "本地没有 Cookie，请先打开一次猫熊用户页");
    $done();
  } else {
    $httpClient.post(
      {
        url: `${BASE_URL}/user/checkin`,
        headers: {
          "Cookie": cookie,
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest",
          "Referer": `${BASE_URL}/user/`,
          "Origin": BASE_URL,
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
          "Accept": "application/json, text/javascript, */*; q=0.01",
          "Accept-Language": "zh-CN,zh;q=0.9"
        },
        body: ""
      },
      (error, response, body) => {
        if (error) {
          $notification.post(TITLE, "请求失败", String(error));
          $done();
        } else {
          const status = response.status || response.statusCode;
          let msg = body || "无返回内容";
          let traffic = "";

          try {
            const json = JSON.parse(body);
            msg = json.msg || json.message || msg;
            if (json.traffic_info) traffic = "\n" + json.traffic_info;
            if (json.trafficInfo) traffic = "\n" + json.trafficInfo;
          } catch (e) {}

          if (status >= 200 && status < 300) {
            if (
              msg.includes("已签到") ||
              msg.includes("重复") ||
              msg.includes("already")
            ) {
              $notification.post(TITLE, "今日已签到", msg + traffic);
            } else {
              $notification.post(TITLE, "签到成功", msg + traffic);
            }
          } else if (status === 302 || status === 401 || status === 403) {
            $notification.post(TITLE, "Cookie 已过期", "请重新打开猫熊用户页刷新登录态");
          } else {
            $notification.post(TITLE, `签到异常 ${status}`, msg);
          }

          $done();
        }
      }
    );
  }
}