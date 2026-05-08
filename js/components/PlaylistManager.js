const PlaylistManager = {
    name: 'PlaylistManager',
    template: `
        <div>
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h4 class="fw-bold mb-0">Playlists</h4>
                <button class="btn btn-primary btn-sm" @click="openCreate"><i class="bi bi-plus-lg me-1"></i>New Playlist</button>
            </div>

            <div v-if="loading" class="text-center py-5">
                <div class="spinner-border text-primary" role="status"></div>
            </div>
            <div v-else-if="playlists.length === 0" class="text-center py-5 text-muted">
                <i class="bi bi-playlist display-1 d-block mb-3" style="opacity:0.3"></i>
                <p>No playlists yet</p>
                <button class="btn btn-primary" @click="openCreate">Create your first playlist</button>
            </div>
            <div v-else class="row g-3">
                <div v-for="p in playlists" :key="p.id" class="col-md-6 col-lg-4">
                    <div class="card border-0 shadow-sm h-100">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <h6 class="fw-bold mb-0">{{ p.name }}</h6>
                                <span :class="'badge bg-' + (p.status === 'active' ? 'success' : 'warning')">{{ p.status }}</span>
                            </div>
                            <small class="text-muted">{{ p.item_count }} items &middot; {{ p.default_duration }}s default &middot; {{ p.transition }}</small>
                        </div>
                        <div class="card-footer bg-white border-0 d-flex gap-2 pt-0">
                            <button class="btn btn-outline-primary btn-sm flex-fill" @click="editPlaylist(p)"><i class="bi bi-pencil me-1"></i>Edit</button>
                            <button class="btn btn-outline-danger btn-sm flex-fill" @click="deletePlaylist(p)"><i class="bi bi-trash me-1"></i>Delete</button>
                        </div>
                    </div>
                </div>
            </div>

            <div v-if="showCreate" class="modal fade show d-block" tabindex="-1" style="background:rgba(0,0,0,0.5)">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"><i class="bi bi-plus-circle me-1"></i>New Playlist</h5>
                            <button class="btn-close" @click="showCreate = false"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label small fw-semibold text-muted">Name</label>
                                <input class="form-control" v-model="newName" placeholder="Sunday Service" autofocus>
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-semibold text-muted">Default Duration (seconds)</label>
                                <input class="form-control" type="number" v-model.number="newDuration" min="3" max="300">
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-semibold text-muted">Transition</label>
                                <select class="form-select" v-model="newTransition">
                                    <option value="fade">Fade</option>
                                    <option value="crossfade">Crossfade</option>
                                    <option value="slide">Slide</option>
                                    <option value="none">None</option>
                                </select>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-outline-secondary" @click="showCreate = false">Cancel</button>
                            <button class="btn btn-primary" @click="createPlaylist" :disabled="!newName.trim()">Create</button>
                        </div>
                    </div>
                </div>
            </div>

            <div v-if="editing" class="modal fade show d-block" tabindex="-1" style="background:rgba(0,0,0,0.5)">
                <div class="modal-dialog modal-xl modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"><i class="bi bi-pencil-square me-1"></i>Edit: {{ editing.name }}</h5>
                            <button class="btn-close" @click="closeEditor"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-5">
                                    <div class="mb-3">
                                        <label class="form-label small fw-semibold text-muted">Name</label>
                                        <input class="form-control" v-model="editForm.name">
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label small fw-semibold text-muted">Default Duration (s)</label>
                                        <input class="form-control" type="number" v-model.number="editForm.default_duration" min="3">
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label small fw-semibold text-muted">Background Color</label>
                                        <input class="form-control form-control-color" type="color" v-model="editForm.bg_color" style="padding:2px;height:38px">
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label small fw-semibold text-muted">Status</label>
                                        <select class="form-select" v-model="editForm.status">
                                            <option value="draft">Draft</option>
                                            <option value="active">Active</option>
                                        </select>
                                    </div>
                                    <button class="btn btn-primary btn-sm" @click="saveSettings" :disabled="saving">
                                        <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
                                        {{ saving ? 'Saving...' : 'Save Settings' }}
                                    </button>
                                </div>
                                <div class="col-md-7">
                                    <h6 class="fw-semibold mb-2">Media Items</h6>
                                    <p v-if="editing.items.length === 0" class="text-muted small">No items. Select media below to add.</p>
                                    <div v-else class="list-group mb-3">
                                        <div v-for="(item, idx) in editing.items" :key="idx"
                                             class="list-group-item list-group-item-action d-flex align-items-center gap-2 p-2"
                                             draggable="true"
                                             @dragstart="dragStartIdx = idx"
                                             @dragover.prevent="dragOverIdx = idx"
                                             @drop="dropItem"
                                             :class="{ 'opacity-50': dragStartIdx === idx }">
                                            <span class="drag-handle"><i class="bi bi-grip-vertical"></i></span>
                                            <img class="rounded" :src="item.url" style="width:48px;height:36px;object-fit:cover" @error="handleImgErr">
                                            <div class="flex-grow-1 min-width-0">
                                                <small class="d-block text-truncate fw-semibold">{{ item.media_name }}</small>
                                                <small class="text-muted">{{ item.media_type }} &middot; {{ item.duration_override || editForm.default_duration }}s</small>
                                            </div>
                                            <input class="form-control form-control-sm" type="number" v-model.number="item.duration_override"
                                                   placeholder="dur" min="1" style="width:60px">
                                            <button class="btn btn-outline-danger btn-sm p-1 lh-1" @click="removeItem(idx)"><i class="bi bi-x"></i></button>
                                        </div>
                                    </div>

                                    <h6 class="fw-semibold mb-2">Add Media</h6>
                                    <div class="row g-2" style="max-height:200px;overflow-y:auto">
                                        <div v-for="m in availableMedia" :key="m.id" class="col-4 col-md-3"
                                             @click="addItem(m)" style="cursor:pointer">
                                            <div class="card border-0 shadow-sm">
                                                <img class="card-img-top" :src="m.thumbnail_url || m.url" style="height:60px;object-fit:cover" @error="handleImgErr">
                                                <div class="p-1">
                                                    <small class="d-block text-truncate">{{ m.name }}</small>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <button class="btn btn-success btn-sm mt-2" @click="saveItems" :disabled="saving">
                                        <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
                                        {{ saving ? 'Saving...' : 'Save Items' }}
                                    </button>
                                </div>
                            </div>

                            <hr>
                            <div class="row">
                                <div class="col-md-6">
                                    <h6 class="fw-semibold mb-2">Assign to Devices</h6>
                                    <div class="mb-2">
                                        <select class="form-select" v-model="assignDeviceId">
                                            <option value="">-- Select Device --</option>
                                            <option value="all">All Devices</option>
                                            <option v-for="d in devices" :key="d.id" :value="d.id">{{ d.name }}</option>
                                        </select>
                                    </div>
                                    <button class="btn btn-primary btn-sm" @click="assignPlaylist" :disabled="!assignDeviceId || saving">
                                        {{ saving ? 'Assigning...' : 'Assign' }}
                                    </button>
                                    <div v-if="editing.assignments && editing.assignments.length > 0" class="mt-2 small text-muted">
                                        <i class="bi bi-check-circle text-success me-1"></i>
                                        Assigned to: {{ editing.assignments.map(a => a.device_name || 'All Devices').join(', ') }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            playlists: [], loading: true,
            showCreate: false, newName: '', newDuration: 10, newTransition: 'fade',
            editing: null, editForm: {}, availableMedia: [], devices: [],
            saving: false, dragStartIdx: -1, dragOverIdx: -1, assignDeviceId: '',
        };
    },
    async created() { await this.loadPlaylists(); },
    methods: {
        handleImgErr(e) {
            e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="36"><rect fill="%23eee" width="48" height="36"/></svg>';
        },
        async loadPlaylists() {
            this.loading = true;
            try { const res = await api.get('/playlists'); this.playlists = res.data; }
            catch (e) { alert('Error: ' + e.message); }
            finally { this.loading = false; }
        },
        openCreate() { this.showCreate = true; this.newName = ''; this.newDuration = 10; this.newTransition = 'fade'; },
        async createPlaylist() {
            try {
                await api.post('/playlists', { name: this.newName.trim(), default_duration: this.newDuration, transition: this.newTransition });
                this.showCreate = false;
                await this.loadPlaylists();
            } catch (e) { alert('Error: ' + e.message); }
        },
        async deletePlaylist(p) {
            if (!confirm('Delete playlist "' + p.name + '"?')) return;
            try { await api.delete('/playlists/' + p.id); await this.loadPlaylists(); }
            catch (e) { alert('Error: ' + e.message); }
        },
        async editPlaylist(p) {
            try {
                const [playlistRes, mediaRes, deviceRes] = await Promise.all([
                    api.get('/playlists/' + p.id),
                    api.get('/media?per_page=100'),
                    api.get('/devices'),
                ]);
                this.editing = playlistRes.data;
                this.editForm = { name: this.editing.name, default_duration: this.editing.default_duration, bg_color: this.editing.bg_color || '#000000', status: this.editing.status };
                this.availableMedia = mediaRes.data.items;
                this.devices = deviceRes.data;
                this.assignDeviceId = '';
            } catch (e) { alert('Error: ' + e.message); }
        },
        closeEditor() { this.editing = null; this.editForm = {}; this.loadPlaylists(); },
        async saveSettings() {
            this.saving = true;
            try { await api.put('/playlists/' + this.editing.id, this.editForm); }
            catch (e) { alert('Error: ' + e.message); }
            finally { this.saving = false; }
        },
        addItem(m) {
            if (this.editing.items.some(i => i.media_id === m.id)) return;
            this.editing.items.push({ media_id: m.id, media_name: m.name, media_type: m.type, url: m.url, duration_override: null });
        },
        removeItem(idx) { this.editing.items.splice(idx, 1); },
        dropItem() {
            if (this.dragStartIdx === this.dragOverIdx) return;
            const items = this.editing.items;
            const [moved] = items.splice(this.dragStartIdx, 1);
            items.splice(this.dragOverIdx, 0, moved);
            this.dragStartIdx = -1; this.dragOverIdx = -1;
        },
        async saveItems() {
            this.saving = true;
            try {
                const items = this.editing.items.map((item, idx) => ({ media_id: item.media_id, duration_override: item.duration_override || null }));
                await api.post('/playlists/' + this.editing.id + '/items', { items });
            } catch (e) { alert('Error: ' + e.message); }
            finally { this.saving = false; }
        },
        async assignPlaylist() {
            this.saving = true;
            try {
                const payload = this.assignDeviceId === 'all' ? { all_devices: true } : { device_ids: [parseInt(this.assignDeviceId)] };
                await api.post('/playlists/' + this.editing.id + '/assign', payload);
                const res = await api.get('/playlists/' + this.editing.id);
                this.editing.assignments = res.data.assignments;
            } catch (e) { alert('Error: ' + e.message); }
            finally { this.saving = false; }
        }
    }
};
