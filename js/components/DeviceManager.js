const DeviceManager = {
    name: 'DeviceManager',
    template: `
        <div>
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h4 class="fw-bold mb-0">Devices</h4>
                <button class="btn btn-primary btn-sm" @click="openCreate"><i class="bi bi-plus-lg me-1"></i>Add Device</button>
            </div>

            <div v-if="loading" class="text-center py-5">
                <div class="spinner-border text-primary" role="status"></div>
            </div>
            <div v-else-if="devices.length === 0" class="text-center py-5 text-muted">
                <i class="bi bi-tv display-1 d-block mb-3" style="opacity:0.3"></i>
                <p>No devices registered yet</p>
                <button class="btn btn-primary" @click="openCreate">Register a device</button>
            </div>
            <div v-else class="card border-0 shadow-sm">
                <div class="table-responsive">
                    <table class="table table-hover mb-0">
                        <thead class="table-light">
                            <tr>
                                <th>Name</th>
                                <th>Code</th>
                                <th>Group</th>
                                <th>Status</th>
                                <th>Last Heartbeat</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="d in devices" :key="d.id">
                                <td class="fw-semibold">{{ d.name }}</td>
                                <td><code class="bg-light px-2 py-1 rounded small">{{ d.code }}</code></td>
                                <td>{{ d.group_name || '-' }}</td>
                                <td>
                                    <span :class="'badge bg-' + (d.is_online ? 'success' : 'danger')">
                                        {{ d.is_online ? 'Online' : 'Offline' }}
                                    </span>
                                </td>
                                <td class="small text-muted">{{ d.last_heartbeat ? new Date(d.last_heartbeat).toLocaleString() : 'Never' }}</td>
                                <td>
                                    <div class="d-flex gap-1">
                                        <button class="btn btn-outline-primary btn-sm" @click="editDevice(d)"><i class="bi bi-pencil"></i></button>
                                        <button class="btn btn-outline-danger btn-sm" @click="deleteDevice(d)"><i class="bi bi-trash"></i></button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div v-if="formVisible" class="modal fade show d-block" tabindex="-1" style="background:rgba(0,0,0,0.5)">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"><i :class="editingDevice ? 'bi bi-pencil-square' : 'bi bi-plus-circle' + ' me-1'"></i>{{ editingDevice ? 'Edit Device' : 'New Device' }}</h5>
                            <button class="btn-close" @click="closeForm"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label small fw-semibold text-muted">Device Name</label>
                                <input class="form-control" v-model="form.name" placeholder="Main Hall TV" autofocus>
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-semibold text-muted">Device Code</label>
                                <div class="input-group">
                                    <input class="form-control font-monospace" v-model="form.code">
                                    <button class="btn btn-outline-secondary" @click="form.code = generateCode()"><i class="bi bi-arrow-repeat"></i></button>
                                </div>
                                <small class="text-muted">Used in player URL: <code>player.html?device=CODE</code></small>
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-semibold text-muted">Group</label>
                                <select class="form-select" v-model="form.group_id">
                                    <option :value="null">No Group</option>
                                    <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
                                </select>
                            </div>
                            <div class="row">
                                <div class="col">
                                    <label class="form-label small fw-semibold text-muted">Orientation</label>
                                    <select class="form-select" v-model="form.orientation">
                                        <option value="landscape">Landscape</option>
                                        <option value="portrait">Portrait</option>
                                    </select>
                                </div>
                                <div class="col">
                                    <label class="form-label small fw-semibold text-muted">Resolution</label>
                                    <select class="form-select" v-model="form.resolution">
                                        <option value="1920x1080">1920x1080</option>
                                        <option value="1280x720">1280x720</option>
                                        <option value="3840x2160">3840x2160</option>
                                        <option value="1080x1920">1080x1920</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-outline-secondary" @click="closeForm">Cancel</button>
                            <button class="btn btn-primary" @click="saveDevice" :disabled="saving || !form.name.trim()">
                                <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
                                {{ saving ? 'Saving...' : editingDevice ? 'Update' : 'Create' }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            devices: [], groups: [], loading: true,
            formVisible: false, editingDevice: null,
            form: { name: '', code: '', group_id: null, orientation: 'landscape', resolution: '1920x1080' },
            saving: false,
        };
    },
    async created() { await Promise.all([this.loadDevices(), this.loadGroups()]); },
    methods: {
        async loadDevices() {
            this.loading = true;
            try { const res = await api.get('/devices'); this.devices = res.data; }
            catch (e) { alert('Error: ' + e.message); }
            finally { this.loading = false; }
        },
        async loadGroups() { try { const res = await api.get('/device-groups'); this.groups = res.data; } catch (e) {} },
        generateCode() { return Math.random().toString(36).substring(2, 8).toUpperCase(); },
        openCreate() {
            this.editingDevice = null;
            this.form = { name: '', code: this.generateCode(), group_id: null, orientation: 'landscape', resolution: '1920x1080' };
            this.formVisible = true;
        },
        editDevice(d) {
            this.editingDevice = d;
            this.form = { name: d.name, code: d.code, group_id: d.group_id, orientation: d.orientation, resolution: d.resolution };
            this.formVisible = true;
        },
        closeForm() { this.formVisible = false; this.editingDevice = null; },
        async saveDevice() {
            this.saving = true;
            try {
                if (this.editingDevice) { await api.put('/devices/' + this.editingDevice.id, this.form); }
                else { await api.post('/devices', this.form); }
                this.closeForm();
                await this.loadDevices();
            } catch (e) { alert('Error: ' + e.message); }
            finally { this.saving = false; }
        },
        async deleteDevice(d) {
            if (!confirm('Delete device "' + d.name + '"?')) return;
            try { await api.delete('/devices/' + d.id); await this.loadDevices(); }
            catch (e) { alert('Error: ' + e.message); }
        }
    }
};
