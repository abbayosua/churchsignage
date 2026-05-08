const DeviceManager = {
    name: 'DeviceManager',
    template: `
        <div>
            <div class="page-header">
                <h2>Devices</h2>
                <button class="btn btn-primary" @click="openCreate">+ Add Device</button>
            </div>

            <div v-if="loading" class="empty-state">Loading...</div>
            <div v-else-if="devices.length === 0" class="empty-state">
                <div class="icon">&#128187;</div>
                <p>No devices registered yet</p>
                <button class="btn btn-primary" @click="openCreate">Register a device</button>
            </div>
            <div v-else class="card">
                <table>
                    <thead>
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
                            <td><strong>{{ d.name }}</strong></td>
                            <td><code style="background:var(--bg);padding:2px 6px;border-radius:4px;">{{ d.code }}</code></td>
                            <td>{{ d.group_name || '-' }}</td>
                            <td>
                                <span :class="'status-dot ' + (d.is_online ? 'online' : 'offline')"></span>
                                {{ d.is_online ? 'Online' : 'Offline' }}
                            </td>
                            <td>{{ d.last_heartbeat ? new Date(d.last_heartbeat).toLocaleString() : 'Never' }}</td>
                            <td>
                                <div style="display:flex;gap:4px">
                                    <button class="btn btn-outline btn-sm" @click="editDevice(d)">Edit</button>
                                    <button class="btn btn-danger btn-sm" @click="deleteDevice(d)">Delete</button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div v-if="formVisible" class="modal-overlay" @click.self="closeForm">
                <div class="modal" style="max-width:500px">
                    <div class="modal-header">
                        <h3>{{ editingDevice ? 'Edit Device' : 'New Device' }}</h3>
                        <button class="close-btn" @click="closeForm">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Device Name</label>
                            <input class="form-control" v-model="form.name" placeholder="Main Hall TV" autofocus>
                        </div>
                        <div class="form-group">
                            <label>Device Code</label>
                            <div style="display:flex;gap:8px">
                                <input class="form-control" v-model="form.code" style="font-family:monospace">
                                <button class="btn btn-outline btn-sm" @click="form.code = generateCode()">Generate</button>
                            </div>
                            <small style="color:var(--text-muted);font-size:11px">Used in player URL: player.html?device=CODE</small>
                        </div>
                        <div class="form-group">
                            <label>Group</label>
                            <select class="form-control" v-model="form.group_id">
                                <option :value="null">No Group</option>
                                <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Orientation</label>
                            <select class="form-control" v-model="form.orientation">
                                <option value="landscape">Landscape</option>
                                <option value="portrait">Portrait</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Resolution</label>
                            <select class="form-control" v-model="form.resolution">
                                <option value="1920x1080">1920x1080 (Full HD)</option>
                                <option value="1280x720">1280x720 (HD)</option>
                                <option value="3840x2160">3840x2160 (4K)</option>
                                <option value="1080x1920">1080x1920 (Portrait)</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" @click="closeForm">Cancel</button>
                        <button class="btn btn-primary" @click="saveDevice" :disabled="saving || !form.name.trim()">
                            {{ saving ? 'Saving...' : editingDevice ? 'Update' : 'Create' }}
                        </button>
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
