const { createApp, ref, computed } = Vue;

const routes = {
    '/': Dashboard,
    '/media': MediaManager,
    '/playlists': PlaylistManager,
    '/devices': DeviceManager,
    '/player': PlayerPreview,
};

const app = createApp({
    setup() {
        const authenticated = ref(false);
        const user = ref(null);
        const currentRoute = ref('/');
        const loading = ref(true);

        const pageComponent = computed(() => {
            return routes[currentRoute.value] || Dashboard;
        });

        function navigate(path) {
            currentRoute.value = path;
            window.location.hash = path;
        }

        function handleLogin(userData) {
            authenticated.value = true;
            user.value = userData;
            currentRoute.value = window.location.hash.slice(1) || '/';
        }

        function handleLogout() {
            authenticated.value = false;
            user.value = null;
            window.authUser = null;
            window.location.hash = '';
        }

        async function checkAuth() {
            loading.value = true;
            try {
                const res = await api.get('/auth/check');
                if (res.success) {
                    authenticated.value = true;
                    user.value = res.data;
                    currentRoute.value = window.location.hash.slice(1) || '/';
                }
            } catch (e) {
                // Not authenticated - show login
            } finally {
                loading.value = false;
            }
        }

        window.addEventListener('hashchange', () => {
            currentRoute.value = window.location.hash.slice(1) || '/';
        });

        checkAuth();

        return { authenticated, user, currentRoute, pageComponent, loading, navigate, handleLogin, handleLogout };
    }
});

app.component('login', Login);
app.component('sidebar', Sidebar);

app.mount('#app');
