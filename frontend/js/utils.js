// 全局工具对象
const Utils = {
  // 后端基础地址：可在 HTML 里通过 window.API_BASE 覆盖
  API_BASE: (typeof window !== "undefined" && window.API_BASE) || "http://127.0.0.1:8000",

  STORAGE_KEYS: {
    TOKEN: "auth_token",
    USER: "user_info",
  },

  // Token 存取
  setToken(token, remember = true) {
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(this.STORAGE_KEYS.TOKEN, token);
    // 清理另一种存储，避免双份
    (remember ? sessionStorage : localStorage).removeItem(this.STORAGE_KEYS.TOKEN);
  },
  getToken() {
    return (
      sessionStorage.getItem(this.STORAGE_KEYS.TOKEN) ||
      localStorage.getItem(this.STORAGE_KEYS.TOKEN)
    );
  },
  removeToken() {
    localStorage.removeItem(this.STORAGE_KEYS.TOKEN);
    sessionStorage.removeItem(this.STORAGE_KEYS.TOKEN);
  },

  // 用户信息存取
  setUserInfo(user, remember = true) {
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(this.STORAGE_KEYS.USER, JSON.stringify(user));
    (remember ? sessionStorage : localStorage).removeItem(this.STORAGE_KEYS.USER);
  },
  getUserInfo() {
    const raw =
      sessionStorage.getItem(this.STORAGE_KEYS.USER) ||
      localStorage.getItem(this.STORAGE_KEYS.USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  removeUserInfo() {
    localStorage.removeItem(this.STORAGE_KEYS.USER);
    sessionStorage.removeItem(this.STORAGE_KEYS.USER);
  },

  // 统一请求：支持 file:// 环境 URL 自动前缀
  async request(url, options = {}) {
    const { method = "GET", headers = {}, params, body } = options;

    // 生成可请求的绝对地址
    const isAbsolute = /^https?:\/\//i.test(url);
    let fullUrl = url;
    if (!isAbsolute) {
      const base = (this.API_BASE || "").replace(/\/+$/g, "");
      if (location.protocol === "file:" && base) {
        if (url.startsWith("/")) {
          fullUrl = base + url;
        } else {
          fullUrl = base + "/" + url.replace(/^\/+/, "");
        }
      }
    }

    // 查询参数
    if (params && typeof params === "object") {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") qs.append(k, v);
      });
      const qsStr = qs.toString();
      if (qsStr) fullUrl += (fullUrl.includes("?") ? "&" : "?") + qsStr;
    }

    // 头与 body
    const finalHeaders = { ...headers };
    const token = this.getToken();
    const isForm = typeof FormData !== "undefined" && body instanceof FormData;
    if (!isForm && body !== undefined && !finalHeaders["Content-Type"]) {
      finalHeaders["Content-Type"] = "application/json";
    }
    if (token) {
      const hasPrefix = token.startsWith("Bearer ") || token.startsWith("Token ");
      finalHeaders["Authorization"] = hasPrefix ? token : `Token ${token}`;
    }
    let finalBody = body;
    if (!isForm && body !== undefined && typeof body !== "string") {
      finalBody = JSON.stringify(body);
    }

    const resp = await fetch(fullUrl, { method, headers: finalHeaders, body: finalBody });

    if (resp.status === 401) {
      try {
        if (typeof Auth !== "undefined" && Auth.clearAuthData) Auth.clearAuthData();
      } catch {}
      this.redirect("index.html");
      throw new Error("未授权或登录已过期");
    }

    const ct = resp.headers.get("Content-Type") || "";
    const data =
      ct.includes("application/json") ? await resp.json() : await resp.text();
    if (!resp.ok) {
      const err = new Error(
        (data && (data.detail || data.message)) || `HTTP ${resp.status}`
      );
      err.status = resp.status;
      err.data = data;
      throw err;
    }
    return data;
  },

  // 便捷 HTTP 方法
  async get(url, params = {}, headers = {}) {
    return this.request(url, { method: "GET", params, headers });
  },
  async post(url, data, headers = {}) {
    return this.request(url, { method: "POST", body: data, headers });
  },
  async put(url, data, headers = {}) {
    return this.request(url, { method: "PUT", body: data, headers });
  },
  async patch(url, data, headers = {}) {
    return this.request(url, { method: "PATCH", body: data, headers });
  },
  async delete(url, data, headers = {}) {
    return this.request(url, { method: "DELETE", body: data, headers });
  },

  // Storage 工具（支持记忆折叠状态等）
  setStorage(key, value, persist = true) {
    const storage = persist ? localStorage : sessionStorage;
    try {
      storage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    } catch {}
  },
  getStorage(key) {
    const raw = sessionStorage.getItem(key) ?? localStorage.getItem(key);
    if (raw == null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  },
  removeStorage(key) {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  },

  // 页面跳转（相对路径）
  redirect(path) {
    window.location.href = path;
  },

  // 小工具
  debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  // 表单工具（供 login.js 使用）
  validateForm(values, rules) {
    const errors = {};
    for (const field in rules) {
      const validators = rules[field];
      const value = values[field];

      if (
        validators.required &&
        (value === undefined || value === null || value === "")
      ) {
        errors[field] = validators.requiredMessage || "必填项";
        continue;
      }
      if (
        validators.minLength &&
        typeof value === "string" &&
        value.length < validators.minLength
      ) {
        errors[field] =
          validators.minLengthMessage || `至少 ${validators.minLength} 个字符`;
      }
    }
    return errors;
  },
  showError(elId, message) {
    const el = document.getElementById(elId);
    if (el) el.textContent = message || "";
  },
  clearErrors(ids = []) {
    ids.forEach((id) => this.showError(id, ""));
  },
  getRoleRoute(role) {
    switch (role) {
      case "teacher":
        return "teacher.html";
      case "researcher":
        return "researcher.html";
      case "operator":
        return "operator.html";
      default:
        return "index.html";
    }
  },
};

// 暴露到全局，避免某些环境下的作用域问题
if (typeof window !== 'undefined') window.Utils = Utils;