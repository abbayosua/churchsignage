const Login = {
    name: 'Login',
    template: `
        <div class="login-page">
            <div class="login-card">
                <h2>Church Signage</h2>
                <p>Sign in to manage your signage</p>
                <div v-if="error" class="card" style="background:#FDF2F0;color:var(--danger);margin-bottom:16px;font-size:13px;">
                    {{ error }}
                </div>
                <form @submit.prevent="doLogin">
                    <div class="form-group">
                        <label>Username</label>
                        <input class="form-control" v-model="username" placeholder="admin" required autofocus>
                    </div>
                    <div class="form-group">
                        <label>Password</label>
                        <input class="form-control" type="password" v-model="password" placeholder="admin" required>
                    </div>
                    <button type="submit" class="btn btn-primary btn-lg" style="width:100%;justify-content:center;" :disabled="loading">
                        {{ loading ? 'Signing in...' : 'Sign In' }}
                    </button>
                </form>
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
