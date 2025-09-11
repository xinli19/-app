// 工具函数集合
const Utils = {
    // API基础配置
    API_BASE_URL: 'http://127.0.0.1:8000',
    
    // 本地存储键名
    STORAGE_KEYS: {
        TOKEN: 'auth_token',
        USER_INFO: 'user_info',
        REMEMBER_ME: 'remember_me'
    },
    
    // HTTP请求方法
    async request(url, options = {}) {
        const method = (options.method || 'GET').toUpperCase();
        const hasBody = options.body !== undefined && options.body !== null;
        const isFormData = typeof FormData !== 'undefined' && hasBody && options.body instanceof FormData;

        // 基础头：声明接受 JSON，避免后端返回 HTML 浏览器渲染器
        const baseHeaders = {
            'Accept': 'application/json',
        };

        const headers = {
            ...baseHeaders,
            ...(options.headers || {})
        };

        // 仅在非 GET 且 body 不是 FormData 时设置 JSON Content-Type
        if (method !== 'GET' && hasBody && !isFormData) {
            headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        }

        // 附带 Token
        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Token ${token}`;
        }

        const config = {
            ...options,
            method,
            headers,
            redirect: 'follow',
            credentials: 'same-origin',
        };

        let response;
        try {
            response = await fetch(`${this.API_BASE_URL}${url}`, config);
        } catch (networkErr) {
            console.error('API请求错误:', networkErr);
            throw new Error(`无法连接服务器: ${networkErr.message}`);
        }

        const contentType = response.headers.get('content-type') || '';
        let data;
        let text;

        // 优先解析 JSON
        if (contentType.includes('application/json')) {
            try {
                data = await response.json();
            } catch (e) {
                // JSON 解析失败，回退读取文本
            }
        }
        if (data === undefined) {
            try {
                text = await response.text();
            } catch {
                text = '';
            }
        }

        // 非 2xx 时构造更清晰的错误
        if (!response.ok) {
            const detail =
                (data && (data.message || data.detail)) ||
                (data && typeof data === 'object' ? JSON.stringify(data) : null) ||
                (text ? text.slice(0, 200) : '') ||
                `请求失败 (HTTP ${response.status})`;

            if (response.status === 401 || response.status === 403) {
                // 可选：清理本地凭证，提示重新登录
                // this.removeToken(); this.removeUserInfo();
            }

            throw new Error(`请求失败 (HTTP ${response.status}) - ${detail} - URL: ${response.url || url}`);
        }

        // 2xx：返回 JSON 或提示非 JSON 响应
        if (data !== undefined) {
            return data;
        }

        // 成功但不是 JSON（大概率是被重定向到 HTML 页）
        if (text && text.trim().startsWith('<!DOCTYPE')) {
            throw new Error(`服务器返回了HTML而非JSON，可能被重定向到登录页或访问了静态页面。URL: ${response.url || url}`);
        }

        throw new Error('服务器返回了非JSON响应');
    },
    
    // GET请求
    async get(url, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const fullUrl = queryString ? `${url}?${queryString}` : url;
        return this.request(fullUrl);
    },
    
    // POST请求
    async post(url, data = {}) {
        return this.request(url, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    
    // PUT请求
    async put(url, data = {}) {
        return this.request(url, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },
    
    // DELETE请求
    async delete(url) {
        return this.request(url, {
            method: 'DELETE'
        });
    },
    
    // 本地存储操作
    setStorage(key, value, remember = false) {
        const storage = remember ? localStorage : sessionStorage;
        storage.setItem(key, JSON.stringify(value));
    },
    
    getStorage(key) {
        try {
            return JSON.parse(localStorage.getItem(key)) || 
                   JSON.parse(sessionStorage.getItem(key));
        } catch {
            return null;
        }
    },
    
    removeStorage(key) {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
    },
    
    // Token操作
    setToken(token, remember = false) {
        this.setStorage(this.STORAGE_KEYS.TOKEN, token, remember);
    },
    
    getToken() {
        return this.getStorage(this.STORAGE_KEYS.TOKEN);
    },
    
    removeToken() {
        this.removeStorage(this.STORAGE_KEYS.TOKEN);
    },
    
    // 用户信息操作
    setUserInfo(userInfo, remember = false) {
        this.setStorage(this.STORAGE_KEYS.USER_INFO, userInfo, remember);
    },
    
    getUserInfo() {
        return this.getStorage(this.STORAGE_KEYS.USER_INFO);
    },
    
    removeUserInfo() {
        this.removeStorage(this.STORAGE_KEYS.USER_INFO);
    },
    
    // 表单验证
    validateForm(formData, rules) {
        const errors = {};
        
        for (const [field, rule] of Object.entries(rules)) {
            const value = formData[field];
            
            if (rule.required && (!value || value.trim() === '')) {
                errors[field] = rule.message || `${field}不能为空`;
                continue;
            }
            
            if (value && rule.pattern && !rule.pattern.test(value)) {
                errors[field] = rule.message || `${field}格式不正确`;
                continue;
            }
            
            if (value && rule.minLength && value.length < rule.minLength) {
                errors[field] = rule.message || `${field}长度不能少于${rule.minLength}位`;
                continue;
            }
        }
        
        return errors;
    },
    
    // 显示错误信息
    showError(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = message;
            element.style.display = message ? 'block' : 'none';
        }
    },
    
    // 清除错误信息
    clearErrors(errorIds) {
        errorIds.forEach(id => this.showError(id, ''));
    },
    
    // 页面跳转
    redirect(url) {
        window.location.href = url;
    },
    
    // 角色路由映射
    getRoleRoute(role) {
        const routes = {
            'teacher': 'teacher.html',
            'researcher': 'researcher.html',
            'operator': 'operator.html'
        };
        return routes[role] || 'index.html';
    },
    
    // 防抖函数
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};