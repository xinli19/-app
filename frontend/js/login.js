// 登录页面主逻辑
class LoginPage {
    constructor() {
        this.form = document.getElementById('loginForm');
        this.loginBtn = document.getElementById('loginBtn');
        this.init();
    }
    
    init() {
        // 检查是否已登录
        if (Auth.isAuthenticated()) {
            this.redirectToDashboard();
            return;
        }
        
        // 绑定事件
        this.bindEvents();
        
        // 恢复记住的用户名
        this.restoreRememberedData();
    }
    
    bindEvents() {
        // 表单提交事件
        this.form.addEventListener('submit', this.handleSubmit.bind(this));
        
        // 实时验证
        const inputs = this.form.querySelectorAll('input[type="text"], input[type="password"]');
        inputs.forEach(input => {
            input.addEventListener('blur', this.validateField.bind(this));
            input.addEventListener('input', this.clearFieldError.bind(this));
        });
        
        // 角色切换事件
        const roleInputs = this.form.querySelectorAll('input[name="role"]');
        roleInputs.forEach(input => {
            input.addEventListener('change', this.handleRoleChange.bind(this));
        });
    }
    
    async handleSubmit(event) {
        event.preventDefault();
        
        // 获取表单数据
        const formData = new FormData(this.form);
        const credentials = {
            username: formData.get('username').trim(),
            password: formData.get('password'),
            role: formData.get('role'),
            rememberMe: formData.get('rememberMe') === 'on'
        };
        
        // 验证表单
        const errors = this.validateForm(credentials);
        if (Object.keys(errors).length > 0) {
            this.showValidationErrors(errors);
            return;
        }
        
        // 清除之前的错误信息
        this.clearAllErrors();
        
        // 显示加载状态
        this.setLoading(true);
        
        try {
            // 执行登录
            const response = await Auth.login(credentials);
            
            // 保存记住我的设置
            if (credentials.rememberMe) {
                Utils.setStorage('remembered_username', credentials.username, true);
            } else {
                Utils.removeStorage('remembered_username');
            }
            
            // 登录成功，跳转到对应的仪表板
            this.redirectToDashboard(credentials.role);
            
        } catch (error) {
            // 显示错误信息
            this.showGeneralError(error.message || '登录失败，请检查用户名和密码');
        } finally {
            // 隐藏加载状态
            this.setLoading(false);
        }
    }
    
    validateForm(credentials) {
        const rules = {
            username: {
                required: true,
                minLength: 2,
                message: '用户名不能少于2位'
            },
            password: {
                required: true,
                minLength: 1,
                message: '密码不能为空'
            }
        };
        
        return Utils.validateForm(credentials, rules);
    }
    
    validateField(event) {
        const field = event.target;
        const value = field.value.trim();
        const fieldName = field.name;
        
        let error = '';
        
        switch (fieldName) {
            case 'username':
                if (!value) {
                    error = '请输入用户名';
                } else if (value.length < 2) {
                    error = '用户名不能少于2位';
                }
                break;
                
            case 'password':
                if (!value) {
                    error = '请输入密码';
                } else if (value.length < 1) {
                    error = '密码不能为空';
                }
                break;
        }
        
        Utils.showError(`${fieldName}Error`, error);
    }
    
    clearFieldError(event) {
        const fieldName = event.target.name;
        Utils.showError(`${fieldName}Error`, '');
    }
    
    showValidationErrors(errors) {
        Object.entries(errors).forEach(([field, message]) => {
            Utils.showError(`${field}Error`, message);
        });
    }
    
    clearAllErrors() {
        Utils.clearErrors(['usernameError', 'passwordError', 'generalError']);
        const generalError = document.getElementById('generalError');
        if (generalError) {
            generalError.classList.remove('show');
        }
    }
    
    showGeneralError(message) {
        const errorElement = document.getElementById('generalError');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.add('show');
        }
    }
    
    setLoading(loading) {
        if (loading) {
            this.loginBtn.classList.add('loading');
            this.loginBtn.disabled = true;
        } else {
            this.loginBtn.classList.remove('loading');
            this.loginBtn.disabled = false;
        }
    }
    
    handleRoleChange(event) {
        const role = event.target.value;
        console.log('选择角色:', role);
        // 可以根据角色显示不同的提示信息
    }
    
    restoreRememberedData() {
        const rememberedUsername = Utils.getStorage('remembered_username');
        if (rememberedUsername) {
            const usernameInput = document.getElementById('username');
            const rememberCheckbox = document.getElementById('rememberMe');
            
            if (usernameInput) {
                usernameInput.value = rememberedUsername;
            }
            if (rememberCheckbox) {
                rememberCheckbox.checked = true;
            }
        }
    }
    
    redirectToDashboard(role = null) {
        const userRole = role || Auth.getCurrentRole();
        const dashboardUrl = Utils.getRoleRoute(userRole);
        
        // 添加一个短暂的延迟，让用户看到登录成功的状态
        setTimeout(() => {
            Utils.redirect(dashboardUrl);
        }, 500);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    new LoginPage();
});