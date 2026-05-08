const Sidebar = {
    name: 'Sidebar',
    template: `
        <aside class="sidebar">
            <div class="p-3 border-bottom border-secondary border-opacity-25">
                <h5 class="mb-0 text-white"><i class="bi bi-building me-2"></i>Church Signage</h5>
                <small class="text-secondary" style="opacity:0.6">CMS v1.0</small>
            </div>
            <nav class="nav nav-pills flex-column pt-2">
                <a v-for="item in navItems" :key="item.path"
                   class="nav-link d-flex align-items-center" :class="{ active: current === item.path }"
                   href="#" @click.prevent="navigate(item.path)">
                    <i :class="'bi bi-' + item.icon + ' me-2'"></i>
                    <span>{{ item.label }}</span>
                </a>
            </nav>
            <div class="mt-auto p-3 border-top border-secondary border-opacity-25">
                <div class="d-flex justify-content-between align-items-center small" style="color:rgba(255,255,255,0.45)">
                    <span><i class="bi bi-person-circle me-1"></i>{{ user ? user.display_name || user.username : '' }}</span>
                    <button v-if="user" @click="doLogout" class="btn btn-sm btn-link text-white-50 p-0 text-decoration-none">Logout</button>
                </div>
            </div>
        </aside>
    `,
    props: { current: String, user: Object },
    emits: ['navigate', 'logout'],
    data() {
        return {
            navItems: [
                { path: '/', icon: 'speedometer2', label: 'Dashboard' },
                { path: '/media', icon: 'images', label: 'Media' },
                { path: '/playlists', icon: 'playlist', label: 'Playlists' },
                { path: '/devices', icon: 'tv', label: 'Devices' },
                { path: '/player', icon: 'play-circle', label: 'Player Preview' },
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
