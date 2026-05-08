const PlayerPreview = {
    name: 'PlayerPreview',
    template: `
        <div>
            <h4 class="fw-bold mb-4">Player Preview</h4>
            <div class="card border-0 shadow-sm">
                <div class="card-body">
                    <div class="mb-3">
                        <label class="form-label small fw-semibold text-muted">Select Device</label>
                        <select class="form-select" v-model="selectedDevice" @change="updateUrl">
                            <option value="">-- Select a device --</option>
                            <option v-for="d in devices" :key="d.id" :value="d.code">{{ d.name }} ({{ d.code }})</option>
                        </select>
                    </div>
                    <div v-if="selectedDevice">
                        <p class="small text-muted mb-2">
                            Player URL: <code class="bg-light px-2 py-1 rounded">{{ playerUrl }}</code>
                        </p>
                        <iframe class="player-frame" :src="playerUrl" title="Player Preview"></iframe>
                    </div>
                    <div v-else class="text-center py-5 text-muted">
                        <i class="bi bi-play-circle display-4 d-block mb-3" style="opacity:0.3"></i>
                        <p>Select a device to preview its playlist</p>
                    </div>
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
        try { const res = await api.get('/devices'); this.devices = res.data; } catch (e) {}
        const params = new URLSearchParams(window.location.search);
        if (params.get('device')) this.selectedDevice = params.get('device');
    },
    methods: {
        updateUrl() {
            if (this.selectedDevice) window.history.replaceState(null, '', '#' + this.selectedDevice);
        }
    }
};
