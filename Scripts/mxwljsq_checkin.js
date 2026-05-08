// mxwljsq_checkin.js for Surge
// 猫熊网络加速器自动签到（状态可查询 + 严格判断版）

const COOKIE_KEY = "MXWLJSQ_Cookie";
const STATUS_KEY = "MXWLJSQ_Checkin_Status";
const TITLE = "猫熊签到";
const BASE_URL = "https://mxwljsq.com";
const STATUS_PATH = "/__surge_mxwljsq_status";

function nowISO() {
  return new Date().toISOString();
}

function safeString(value) {
  if (value === undefined || value === null) return "";
  return String(value);
}

function truncate(value, maxLength) {
  const s = safeString(value);
  if (s.length <= maxLength) return s;
  return s.slice(0, maxLength) + "...";
}

function getHeader(headers, name) {
  if (!headers) return "";
  const lowerName = name.toLowerCase();

  for (const key in headers) {
    if (String(key).toLowerCase() === lowerName) {
      return headers[key];
    }
  }

  return "";
}

function getStatusCode(response) {
  if (!response) return 0;
  return response.status || response.statusCode || 0;
}

function parseJSONMaybe(body) {
  const raw = safeString(body).trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function extractMessage(body) {
  const raw = safeString(body);
  const json = parseJSONMaybe(raw);

  if (!json) {
    return {
      json: null,
      msg: raw || "无返回内容",
      traffic: ""
    };
  }

  const msg =
    json.msg ||
    json.message ||
    json.info ||
    json.data ||
    raw ||
    "无返回内容";

  let traffic = "";
  if (json.traffic_info) traffic += "\n" + json.traffic_info;
  if (json.trafficInfo) traffic += "\n" + json.trafficInfo;

  return {
    json,
    msg: safeString(msg),
    traffic
  };
}

function looksLikeLoginPage(body, headers) {
  const raw = safeString(body);
  const lower = raw.toLowerCase();
  const contentType = safeString(getHeader(headers, "Content-Type")).toLowerCase();

  return (
    contentType.includes("text/html") ||
    lower.includes("<!doctype html") ||
    lower.includes("<html") ||
    raw.includes("<title>登录") ||
    raw.includes("登录 &mdash; 猫熊网络加速器") ||
    raw.includes("猫熊网络加速器") && raw.includes("请输入您的邮箱") ||
    raw.includes("/auth/login") ||
    raw.includes("请输入您的邮箱") ||
    raw.includes("请输入6位验证码") ||
    raw.includes("点击开始安全验证") ||
    raw.includes("记住我")
  );
}

function isAlreadyChecked(text) {
  const s = safeString(text).toLowerCase();

  return (
    s.includes("今日已签到") ||
    s.includes("已签到") ||
    s.includes("重复签到") ||
    s.includes("重复") ||
    s.includes("already")
  );
}

function isSuccess(text, json) {
  const s = safeString(text).toLowerCase();

  if (json) {
    if (json.success === true) return true;
    if (json.ret === 1) return true;
    if (json.code === 0 && !isAlreadyChecked(s)) return true;
  }

  return (
    s.includes("签到成功") ||
    s.includes("获得") ||
    s.includes("流量") ||
    s.includes("success")
  );
}

function hasAuthFailure(text, json) {
  const s = safeString(text).toLowerCase();

  if (json) {
    const msg = safeString(json.msg || json.message || json.error).toLowerCase();
    if (
      msg.includes("未登录") ||
      msg.includes("登录") ||
      msg.includes("cookie") ||
      msg.includes("auth") ||
      msg.includes("unauthorized") ||
      msg.includes("unauthenticated")
    ) {
      return true;
    }
  }

  return (
    s.includes("未登录") ||
    s.includes("请登录") ||
    s.includes("登录已失效") ||
    s.includes("cookie") && s.includes("过期") ||
    s.includes("unauthorized") ||
    s.includes("unauthenticated")
  );
}

function cookieNameList(cookie) {
  return safeString(cookie)
    .split(";")
    .map((part) => part.trim().split("=")[0])
    .filter(Boolean);
}

function saveStatus(status) {
  const payload = Object.assign(
    {
      updated_at: nowISO(),
      version: "2026-05-08-status-query"
    },
    status || {}
  );

  $persistentStore.write(JSON.stringify(payload), STATUS_KEY);

  // 有些 Surge 执行环境会收集 console.log，有些不会。
  // 保留这个日志，方便能读取 stdout 的环境解析。
  console.log("[MXWLJSQ_RESULT] " + JSON.stringify(payload));

  return payload;
}

function notifyAndSave(kind, subtitle, message, extra) {
  const payload = saveStatus(
    Object.assign(
      {
        kind,
        subtitle,
        message: safeString(message)
      },
      extra || {}
    )
  );

  $notification.post(TITLE, subtitle, safeString(message));
  return payload;
}

function respondStatus() {
  const saved = $persistentStore.read(STATUS_KEY);
  const cookie = $persistentStore.read(COOKIE_KEY) || "";

  let status;
  if (saved) {
    try {
      status = JSON.parse(saved);
    } catch (e) {
      status = {
        kind: "status_parse_error",
        subtitle: "状态读取失败",
        message: saved,
        updated_at: nowISO()
      };
    }
  } else {
    status = {
      kind: "no_status",
      subtitle: "暂无签到状态",
      message: "还没有执行过 MX_Checkin",
      updated_at: nowISO()
    };
  }

  status.cookie_saved = !!cookie;
  status.cookie_names = cookieNameList(cookie);

  $done({
    response: {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify(status, null, 2)
    }
  });
}

function captureCookie() {
  const headers = $request.headers || {};
  const cookieHeader = headers["Cookie"] || headers["cookie"] || "";

  if (!cookieHeader) {
    saveStatus({
      kind: "cookie_capture_empty",
      subtitle: "未捕获到 Cookie",
      message: "访问 /user 时请求头里没有 Cookie"
    });
    $done({});
    return;
  }

  const oldCookie = $persistentStore.read(COOKIE_KEY) || "";

  if (oldCookie !== cookieHeader) {
    $persistentStore.write(cookieHeader, COOKIE_KEY);
    notifyAndSave("cookie_updated", "Cookie 已更新", "已保存最新登录态", {
      cookie_saved: true,
      cookie_names: cookieNameList(cookieHeader)
    });
  } else {
    saveStatus({
      kind: "cookie_unchanged",
      subtitle: "Cookie 未变化",
      message: "当前登录态已保存",
      cookie_saved: true,
      cookie_names: cookieNameList(cookieHeader)
    });
  }

  $done({});
}

function runCheckin() {
  const cookie = $persistentStore.read(COOKIE_KEY);

  if (!cookie) {
    notifyAndSave("no_cookie", "无法签到", "本地没有 Cookie，请先打开一次猫熊用户页", {
      cookie_saved: false
    });
    $done();
    return;
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
        "Accept-Language": "zh-CN,zh;q=0.9"
      },
      body: ""
    },
    (error, response, body) => {
      if (error) {
        notifyAndSave("request_failed", "请求失败", String(error), {
          cookie_saved: true,
          cookie_names: cookieNameList(cookie)
        });
        $done();
        return;
      }

      const status = getStatusCode(response);
      const headers = (response && response.headers) || {};
      const contentType = getHeader(headers, "Content-Type");
      const location = getHeader(headers, "Location");
      const raw = safeString(body);
      const parsed = extractMessage(raw);
      const msg = parsed.msg;
      const traffic = parsed.traffic;
      const json = parsed.json;
      const responseSummary = truncate(raw, 500);

      const common = {
        http_status: status,
        content_type: contentType,
        location: location,
        response_summary: responseSummary,
        cookie_saved: true,
        cookie_names: cookieNameList(cookie)
      };

      if (status === 302 || status === 401 || status === 403) {
        notifyAndSave(
          "cookie_expired",
          "Cookie 已过期",
          `HTTP ${status}，请重新登录并打开猫熊用户页刷新 Cookie`,
          common
        );
        $done();
        return;
      }

      if (looksLikeLoginPage(raw, headers)) {
        notifyAndSave(
          "cookie_expired",
          "Cookie 已过期",
          "接口返回登录页 HTML，请重新登录并打开用户页刷新 Cookie",
          common
        );
        $done();
        return;
      }

      if (hasAuthFailure(msg, json) || hasAuthFailure(raw, json)) {
        notifyAndSave(
          "cookie_expired",
          "Cookie 已过期",
          msg || "接口提示未登录或登录态失效",
          common
        );
        $done();
        return;
      }

      if (status >= 200 && status < 300) {
        if (isAlreadyChecked(msg) || isAlreadyChecked(raw)) {
          notifyAndSave("already", "今日已签到", msg + traffic, common);
          $done();
          return;
        }

        if (isSuccess(msg, json) || isSuccess(raw, json)) {
          notifyAndSave("success", "签到成功", msg + traffic, common);
          $done();
          return;
        }

        notifyAndSave(
          "uncertain",
          "签到结果无法确认",
          `HTTP ${status}\n${responseSummary}`,
          common
        );
        $done();
        return;
      }

      notifyAndSave(
        "checkin_error",
        `签到异常 ${status}`,
        msg || responseSummary || "无返回内容",
        common
      );
      $done();
    }
  );
}

if (typeof $request !== "undefined") {
  const url = $request.url || "";

  if (url.includes(STATUS_PATH)) {
    respondStatus();
  } else {
    captureCookie();
  }
} else {
  runCheckin();
}
