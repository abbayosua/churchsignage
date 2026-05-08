const Dashboard = {
    name: 'Dashboard',
    template: `
        <div>
            <div class="page-header">
                <h2>Dashboard</h2>
            </div>
            <div v-if="loading" class="empty-state">Loading...</div>
            <div v-else>
                <div class="grid grid-4">
                    <div class="card stat-card">
                        <div class="value">{{ stats.total_media || 0 }}</div>
                        <div class="label">Total Media</div>
                    </div>
                    <div class="card stat-card">
                        <div class="value">{{ stats.active_playlists || 0 }}</div>
                        <div class="label">Active Playlists</div>
                    </div>
                    <div class="card stat-card">
                        <div class="value">{{ stats.online_devices || 0 }}</div>
                        <div class="label">Online Devices</div>
                    </div>
                    <div class="card stat-card">
                        <div class="value">{{ stats.total_devices || 0 }}</div>
                        <div class="label">Total Devices</div>
                    </div>
                </div>

                <div class="two-col">
                    <div class="card">
                        <div class="card-header"><h3>Recent Media</h3></div>
                        <div v-if="recentMedia.length === 0" class="empty-state" style="padding:20px">
                            No media uploaded yet
                        </div>
                        <div class="media-grid" v-else>
                            <div class="media-item" v-for="m in recentMedia" :key="m.id"
                                 @click="previewUrl = m.url">
                                <span class="type-badge">{{ m.type }}</span>
                                <img class="thumb" :src="m.thumbnail_url || m.url" :alt="m.name"
                                     @error="handleImgErr">
                                <div class="info">
                                    <div class="name">{{ m.name }}</div>
                                    <div class="meta">{{ (m.size / 1024 / 1024).toFixed(1) }} MB</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-header"><h3>Device Status</h3></div>
                        <div v-if="devices.length === 0" class="empty-state" style="padding:20px">
                            No devices registered
                        </div>
                        <table v-else>
                            <thead>
                                <tr><th>Device</th><th>Status</th><th>Last Seen</th></tr>
                            </thead>
                            <tbody>
                                <tr v-for="d in devices" :key="d.id">
                                    <td>{{ d.name }}</td>
                                    <td>
                                        <span :class="'status-dot ' + (d.is_online ? 'online' : 'offline')"></span>
                                        {{ d.is_online ? 'Online' : 'Offline' }}
                                    </td>
                                    <td>{{ d.last_heartbeat ? timeAgo(d.last_heartbeat) : 'Never' }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div v-if="previewUrl" class="modal-overlay" @click.self="previewUrl = null">
                    <div class="modal" style="max-width:800px">
                        <div class="modal-header">
                            <h3>Preview</h3>
                            <button class="close-btn" @click="previewUrl = null">&times;</button>
                        </div>
                        <div class="modal-body">
                            <div class="preview-box">
                                <img v-if="isImage(previewUrl)" :src="previewUrl" style="max-width:100%;max-height:70vh">
                                <video v-else :src="previewUrl" controls style="max-width:100%;max-height:70vh"></video>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return { loading: true, stats: {}, recentMedia: [], devices: [], previewUrl: null };
    },
    async created() {
        try {
            const [mediaRes, playlistRes, deviceRes] = await Promise.all([
                api.get('/media?per_page=6'),
                api.get('/playlists'),
                api.get('/devices'),
            ]);
            this.recentMedia = mediaRes.data.items;
            const playlists = playlistRes.data;
            this.devices = deviceRes.data;
            const activePlaylists = playlists.filter(p => p.status === 'active');
            const onlineDevices = this.devices.filter(d => d.is_online);
            this.stats = {
                total_media: mediaRes.data.total,
                active_playlists: activePlaylists.length,
                online_devices: onlineDevices.length,
                total_devices: this.devices.length,
            };
        } catch (e) {
            console.error('Dashboard error:', e);
        } finally {
            this.loading = false;
        }
    },
    methods: {
        handleImgErr(e) {
            e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150"><rect fill="%23eee" width="200" height="150"/></svg>';
        },
        isImage(url) {
            return url.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i) || url.match(/image/);
        },
        timeAgo(ts) {
            const diff = Date.now() - new Date(ts).getTime();
            const mins = Math.floor(diff / 60000);
            if (mins < 1) return 'Just now';
            if (mins < 60) return mins + 'm ago';
            const hrs = Math.floor(mins / 60);
            return hrs + 'h ago';
        }
    }
};
