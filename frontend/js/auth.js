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
            // 调用后端登出接口
            await Utils.post('/auth/logout/');
        } catch (error) {
            console.error('登出请求失败:', error);
        } finally {
            // 清除本地存储
            this.clearAuthData();
            // 跳转到登录页
            Utils.redirect('/index.html');
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
            const response = await Utils.get('/auth/validate/');
            return response.valid;
        } catch (error) {
            console.error('Token验证失败:', error);
            return false;
        }
    },
    
    // 路由守卫
    async routeGuard(requiredRole = null) {
        // 检查是否已登录
        if (!this.isAuthenticated()) {
            Utils.redirect('/index.html');
            return false;
        }
        
        // 验证token有效性
        const isValid = await this.validateToken();
        if (!isValid) {
            this.clearAuthData();
            Utils.redirect('/index.html');
            return false;
        }
        
        // 检查角色权限
        if (requiredRole && !this.hasPermission(requiredRole)) {
            Utils.redirect('/unauthorized.html');
            return false;
        }
        
        return true;
    }
};