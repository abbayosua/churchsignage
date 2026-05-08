const Sidebar = {
    name: 'Sidebar',
    template: `
        <aside class="sidebar">
            <div class="sidebar-header">
                <h1>⛪ Church Signage</h1>
                <small>CMS v1.0</small>
            </div>
            <nav class="sidebar-nav">
                <button v-for="item in navItems" :key="item.path"
                        class="nav-item" :class="{ active: current === item.path }"
                        @click="navigate(item.path)">
                    <span>{{ item.icon }}</span>
                    <span>{{ item.label }}</span>
                </button>
            </nav>
            <div class="sidebar-footer">
                <div style="display:flex;align-items:center;justify-content:space-between">
                    <span>{{ user ? user.display_name || user.username : 'Not logged in' }}</span>
                    <button v-if="user" @click="doLogout" style="background:none;border:none;color:rgba(255,255,255,0.5);cursor:pointer;font-size:12px">Logout</button>
                </div>
            </div>
        </aside>
    `,
    props: {
        current: String,
        user: Object,
    },
    emits: ['navigate', 'logout'],
    data() {
        return {
            navItems: [
                { path: '/', icon: '📊', label: 'Dashboard' },
                { path: '/media', icon: '🖼️', label: 'Media' },
                { path: '/playlists', icon: '📋', label: 'Playlists' },
                { path: '/devices', icon: '💻', label: 'Devices' },
                { path: '/player', icon: '▶️', label: 'Player Preview' },
            ]
        };
    },
    methods: {
        navigate(path) { this.$emit('navigate', path); },
        async doLogout() {
            try { await api.post('/auth/logout'); } catch (e) {}
            this.$emit('logout');
        }
    }
};
