const Dashboard = {
    name: 'Dashboard',
    template: `
        <div>
            <h4 class="mb-4 fw-bold">Dashboard</h4>
            <div v-if="loading" class="text-center py-5">
                <div class="spinner-border text-primary" role="status"></div>
            </div>
            <div v-else>
                <div class="row g-3 mb-4">
                    <div class="col-md-3 col-6">
                        <div class="card border-0 shadow-sm text-center p-3">
                            <div class="stat-value">{{ stats.total_media || 0 }}</div>
                            <div class="text-muted small">Total Media</div>
                        </div>
                    </div>
                    <div class="col-md-3 col-6">
                        <div class="card border-0 shadow-sm text-center p-3">
                            <div class="stat-value">{{ stats.active_playlists || 0 }}</div>
                            <div class="text-muted small">Active Playlists</div>
                        </div>
                    </div>
                    <div class="col-md-3 col-6">
                        <div class="card border-0 shadow-sm text-center p-3">
                            <div class="stat-value">{{ stats.online_devices || 0 }}</div>
                            <div class="text-muted small">Online Devices</div>
                        </div>
                    </div>
                    <div class="col-md-3 col-6">
                        <div class="card border-0 shadow-sm text-center p-3">
                            <div class="stat-value">{{ stats.total_devices || 0 }}</div>
                            <div class="text-muted small">Total Devices</div>
                        </div>
                    </div>
                </div>

                <div class="row g-3">
                    <div class="col-md-6">
                        <div class="card border-0 shadow-sm">
                            <div class="card-header bg-white fw-semibold">Recent Media</div>
                            <div class="card-body">
                                <div v-if="recentMedia.length === 0" class="text-muted small py-3 text-center">No media uploaded yet</div>
                                <div v-else class="row g-2">
                                    <div class="col-4 col-md-3" v-for="m in recentMedia" :key="m.id" style="cursor:pointer"
                                         @click="previewUrl = m.url" title="Click to preview">
                                        <div class="card border-0 shadow-sm media-item">
                                            <img class="media-thumb rounded" :src="m.thumbnail_url || m.url" :alt="m.name"
                                                 @error="handleImgErr">
                                            <div class="p-1">
                                                <small class="d-block text-truncate fw-semibold">{{ m.name }}</small>
                                                <small class="text-muted">{{ (m.size / 1024 / 1024).toFixed(1) }} MB</small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card border-0 shadow-sm">
                            <div class="card-header bg-white fw-semibold">Device Status</div>
                            <div class="card-body p-0">
                                <div v-if="devices.length === 0" class="text-muted small py-3 text-center">No devices registered</div>
                                <table v-else class="table table-hover mb-0">
                                    <thead class="table-light">
                                        <tr><th>Device</th><th>Status</th><th>Last Seen</th></tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="d in devices" :key="d.id">
                                            <td class="fw-semibold">{{ d.name }}</td>
                                            <td>
                                                <span :class="'badge bg-' + (d.is_online ? 'success' : 'danger')">
                                                    {{ d.is_online ? 'Online' : 'Offline' }}
                                                </span>
                                            </td>
                                            <td class="text-muted small">{{ d.last_heartbeat ? timeAgo(d.last_heartbeat) : 'Never' }}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                <div v-if="previewUrl" class="modal fade show d-block" tabindex="-1" style="background:rgba(0,0,0,0.5)">
                    <div class="modal-dialog modal-lg modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Preview</h5>
                                <button class="btn-close" @click="previewUrl = null"></button>
                            </div>
                            <div class="modal-body p-0">
                                <div class="preview-box rounded-0" style="aspect-ratio:16/9">
                                    <img v-if="isImage(previewUrl)" :src="previewUrl" class="mw-100 mh-100">
                                    <video v-else :src="previewUrl" controls class="mw-100 mh-100"></video>
                                </div>
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
