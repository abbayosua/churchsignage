const Login = {
    name: 'Login',
    template: `
        <div class="login-page">
            <div class="card shadow-lg" style="width:100%;max-width:400px">
                <div class="card-body p-4">
                    <h3 class="text-center mb-1">Church Signage</h3>
                    <p class="text-center text-muted mb-4">Sign in to manage your signage</p>
                    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
                    <form @submit.prevent="doLogin">
                        <div class="mb-3">
                            <label class="form-label small fw-semibold text-muted">Username</label>
                            <input class="form-control" v-model="username" placeholder="admin" required autofocus>
                        </div>
                        <div class="mb-4">
                            <label class="form-label small fw-semibold text-muted">Password</label>
                            <input class="form-control" type="password" v-model="password" placeholder="admin" required>
                        </div>
                        <button type="submit" class="btn btn-primary w-100 btn-lg" :disabled="loading">
                            <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
                            {{ loading ? 'Signing in...' : 'Sign In' }}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    `,
    data() {
        return { username: '', password: '', error: '', loading: false };
    },
    methods: {
        async doLogin() {
            this.error = '';
            this.loading = true;
            try {
                const res = await api.post('/auth/login', {
                    username: this.username,
                    password: this.password,
                });
                if (res.success) {
                    window.authUser = res.data;
                    this.$emit('login', res.data);
                }
            } catch (e) {
                this.error = e.message;
            } finally {
                this.loading = false;
            }
        }
    }
};
