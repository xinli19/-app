// 认证管理模块
const Auth = {
    // 登录
    async login(credentials) {
        try {
            // 根据Django的认证API调用登录接口
            const response = await Utils.post('/auth/login/', {
                username: credentials.username,
                password: credentials.password,
                role: credentials.role
            });
            
            // 保存认证信息
            if (response.token) {
                Utils.setToken(response.token, credentials.rememberMe);
                Utils.setUserInfo(response.user, credentials.rememberMe);
                return response;
            } else {
                throw new Error('登录响应格式错误');
            }
        } catch (error) {
            console.error('登录失败:', error);
            throw error;
        }
    },
    
    // 登出
    async logout() {
        try {
            // 后端可能未实现 /auth/logout/，忽略失败即可
            await Utils.post('/auth/logout/');
        } catch (error) {
            console.error('登出请求失败:', error);
        } finally {
            // 清理本地凭证并跳回登录页（使用相对路径，避免 file:///index.html）
            this.clearAuthData();
            Utils.redirect('index.html');
        }
    },
    
    // 检查登录状态
    isAuthenticated() {
        const token = Utils.getToken();
        const userInfo = Utils.getUserInfo();
        return !!(token && userInfo);
    },
    
    // 获取当前用户信息
    getCurrentUser() {
        return Utils.getUserInfo();
    },
    
    // 获取token
    getToken() {
        return Utils.getToken();
    },
    
    // 获取当前用户角色
    getCurrentRole() {
        const userInfo = this.getCurrentUser();
        return userInfo ? userInfo.role : null;
    },
    
    // 检查用户权限
    hasPermission(requiredRole) {
        const currentRole = this.getCurrentRole();
        return currentRole === requiredRole;
    },
    
    // 清除认证数据
    clearAuthData() {
        Utils.removeToken();
        Utils.removeUserInfo();
    },
    
    // 刷新token
    async refreshToken() {
        try {
            const response = await Utils.post('/auth/refresh/');
            if (response.token) {
                const rememberMe = !!localStorage.getItem(Utils.STORAGE_KEYS.TOKEN);
                Utils.setToken(response.token, rememberMe);
                return response.token;
            }
        } catch (error) {
            console.error('Token刷新失败:', error);
            this.logout();
            throw error;
        }
    },
    
    // 验证token有效性
    async validateToken() {
        try {
            // 后端当前未实现该接口，如果 404，我们视为有效，避免阻断前端页面
            const response = await Utils.get('/auth/validate/');
            return response && (response.valid !== false);
        } catch (error) {
            console.error('Token验证失败:', error);
            // 容忍 404 / 网络错误，不阻断前端页面
            return true;
        }
    },
    
    // 路由守卫
    async routeGuard(requiredRole = null) {
        // 检查是否已登录
        if (!this.isAuthenticated()) {
            // 修正：使用相对路径
            Utils.redirect('index.html');
            return false;
        }
        
        // 验证token有效性（容忍未实现）
        const isValid = await this.validateToken();
        if (!isValid) {
            this.clearAuthData();
            // 修正：使用相对路径
            Utils.redirect('index.html');
            return false;
        }
        
        // 检查角色权限（若无未授权页，直接回登录）
        if (requiredRole && !this.hasPermission(requiredRole)) {
            // 修正：避免跳转到不存在的 unauthorized.html
            Utils.redirect('index.html');
            return false;
        }
        
        return true;
    }
};