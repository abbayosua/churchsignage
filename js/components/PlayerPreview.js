const PlayerPreview = {
    name: 'PlayerPreview',
    template: `
        <div>
            <div class="page-header">
                <h2>Player Preview</h2>
            </div>
            <div class="card">
                <div class="form-group">
                    <label>Select Device</label>
                    <select class="form-control" v-model="selectedDevice" @change="updateUrl">
                        <option value="">-- Select a device --</option>
                        <option v-for="d in devices" :key="d.id" :value="d.code">{{ d.name }} ({{ d.code }})</option>
                    </select>
                </div>
                <div v-if="selectedDevice">
                    <p style="font-size:13px;color:var(--text-muted);margin-bottom:8px">
                        Player URL: <code style="background:var(--bg);padding:2px 6px;border-radius:4px">{{ playerUrl }}</code>
                    </p>
                    <iframe class="player-frame" :src="playerUrl" style="width:100%;height:500px;border:1px solid var(--border);border-radius:var(--radius);background:#000"></iframe>
                </div>
                <div v-else class="empty-state" style="padding:40px">
                    <p>Select a device to preview its playlist</p>
                </div>
            </div>
        </div>
    `,
    data() {
        return { devices: [], selectedDevice: '' };
    },
    computed: {
        playerUrl() {
            if (!this.selectedDevice) return '';
            const base = window.location.pathname.replace(/\/+$/, '');
            return base + '/player.html?device=' + this.selectedDevice;
        }
    },
    async created() {
        try { const res = await api.get('/devices'); this.devices = res.data; }
        catch (e) {}
        const params = new URLSearchParams(window.location.search);
        if (params.get('device')) {
            this.selectedDevice = params.get('device');
        }
    },
    methods: {
        updateUrl() {
            if (this.selectedDevice) {
                window.history.replaceState(null, '', '#' + this.selectedDevice);
            }
        }
    }
};
