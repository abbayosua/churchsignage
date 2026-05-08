const PlaylistManager = {
    name: 'PlaylistManager',
    template: `
        <div>
            <div class="page-header">
                <h2>Playlists</h2>
                <button class="btn btn-primary" @click="showCreate = true">+ New Playlist</button>
            </div>

            <div v-if="loading" class="empty-state">Loading...</div>
            <div v-else-if="playlists.length === 0" class="empty-state">
                <div class="icon">&#127916;</div>
                <p>No playlists yet</p>
                <button class="btn btn-primary" @click="showCreate = true">Create your first playlist</button>
            </div>
            <div v-else>
                <div class="card" v-for="p in playlists" :key="p.id">
                    <div class="card-header">
                        <div>
                            <h3>{{ p.name }}</h3>
                            <span style="font-size:12px;color:var(--text-muted)">
                                {{ p.item_count }} items &middot;
                                <span :class="'badge badge-' + (p.status === 'active' ? 'success' : 'warning')">{{ p.status }}</span>
                            </span>
                        </div>
                        <div style="display:flex;gap:6px">
                            <button class="btn btn-outline btn-sm" @click="editPlaylist(p)">Edit</button>
                            <button class="btn btn-danger btn-sm" @click="deletePlaylist(p)">Delete</button>
                        </div>
                    </div>
                    <div v-if="p.item_count > 0" style="font-size:13px;color:var(--text-muted)">
                        {{ p.default_duration }}s default duration &middot; {{ p.transition }} transition
                    </div>
                </div>
            </div>

            <div v-if="showCreate" class="modal-overlay" @click.self="showCreate = false">
                <div class="modal" style="max-width:450px">
                    <div class="modal-header">
                        <h3>New Playlist</h3>
                        <button class="close-btn" @click="showCreate = false">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Name</label>
                            <input class="form-control" v-model="newName" placeholder="Sunday Service" autofocus>
                        </div>
                        <div class="form-group">
                            <label>Default Duration (seconds)</label>
                            <input class="form-control" type="number" v-model.number="newDuration" min="3" max="300">
                        </div>
                        <div class="form-group">
                            <label>Transition</label>
                            <select class="form-control" v-model="newTransition">
                                <option value="fade">Fade</option>
                                <option value="crossfade">Crossfade</option>
                                <option value="slide">Slide</option>
                                <option value="none">None</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" @click="showCreate = false">Cancel</button>
                        <button class="btn btn-primary" @click="createPlaylist" :disabled="!newName.trim()">Create</button>
                    </div>
                </div>
            </div>

            <div v-if="editing" class="modal-overlay" @click.self="closeEditor">
                <div class="modal" style="max-width:800px">
                    <div class="modal-header">
                        <h3>Edit: {{ editing.name }}</h3>
                        <button class="close-btn" @click="closeEditor">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="two-col">
                            <div>
                                <div class="form-group">
                                    <label>Name</label>
                                    <input class="form-control" v-model="editForm.name">
                                </div>
                                <div class="form-group">
                                    <label>Default Duration (s)</label>
                                    <input class="form-control" type="number" v-model.number="editForm.default_duration" min="3">
                                </div>
                                <div class="form-group">
                                    <label>Background Color</label>
                                    <input class="form-control" type="color" v-model="editForm.bg_color">
                                </div>
                                <div class="form-group">
                                    <label>Status</label>
                                    <select class="form-control" v-model="editForm.status">
                                        <option value="draft">Draft</option>
                                        <option value="active">Active</option>
                                    </select>
                                </div>
                                <button class="btn btn-primary btn-sm" @click="saveSettings" :disabled="saving">
                                    {{ saving ? 'Saving...' : 'Save Settings' }}
                                </button>
                            </div>
                            <div>
                                <h4 style="margin-bottom:12px;font-size:14px;">Media Items</h4>
                                <p v-if="editing.items.length === 0" style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">
                                    No items. Select media below to add.
                                </p>
                                <ul class="item-list" v-else>
                                    <li v-for="(item, idx) in editing.items" :key="idx"
                                        draggable="true"
                                        @dragstart="dragStartIdx = idx"
                                        @dragover.prevent="dragOverIdx = idx"
                                        @drop="dropItem"
                                        :class="{ dragging: dragStartIdx === idx }">
                                        <span class="drag-handle">&#9776;</span>
                                        <img class="thumb-sm" :src="item.url" @error="handleImgErr">
                                        <div class="item-info">
                                            <div class="item-name">{{ item.media_name }}</div>
                                            <div class="item-meta">{{ item.media_type }} &middot; {{ item.duration_override || editForm.default_duration }}s</div>
                                        </div>
                                        <input class="form-control" type="number" v-model.number="item.duration_override"
                                               placeholder="dur" min="1" style="width:60px;font-size:12px;padding:4px 6px;">
                                        <button class="btn btn-danger btn-sm" @click="removeItem(idx)">&times;</button>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        <hr style="margin:16px 0;border-color:var(--border)">
                        <div>
                            <h4 style="margin-bottom:12px;font-size:14px;">Add Media</h4>
                            <div class="media-grid" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr))">
                                <div class="media-item" v-for="m in availableMedia" :key="m.id"
                                     @click="addItem(m)" style="cursor:pointer">
                                    <img class="thumb" :src="m.thumbnail_url || m.url" style="height:80px" @error="handleImgErr">
                                    <div class="info" style="padding:4px 6px">
                                        <div class="name" style="font-size:11px">{{ m.name }}</div>
                                    </div>
                                </div>
                            </div>
                            <button class="btn btn-success btn-sm" style="margin-top:12px" @click="saveItems" :disabled="saving">
                                {{ saving ? 'Saving...' : 'Save Items Order' }}
                            </button>
                        </div>

                        <hr style="margin:16px 0;border-color:var(--border)">
                        <div>
                            <h4 style="margin-bottom:12px;font-size:14px;">Assign to Devices</h4>
                            <div class="form-group">
                                <label>Device</label>
                                <select class="form-control" v-model="assignDeviceId">
                                    <option value="">-- Select Device --</option>
                                    <option value="all">All Devices</option>
                                    <option v-for="d in devices" :key="d.id" :value="d.id">{{ d.name }}</option>
                                </select>
                            </div>
                            <button class="btn btn-primary btn-sm" @click="assignPlaylist" :disabled="!assignDeviceId || saving">
                                {{ saving ? 'Assigning...' : 'Assign' }}
                            </button>
                            <div v-if="editing.assignments && editing.assignments.length > 0" style="margin-top:12px;font-size:13px;color:var(--text-muted)">
                                Assigned to: {{ editing.assignments.map(a => a.device_name || 'All Devices').join(', ') }}
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
        async createPlaylist() {
            try {
                await api.post('/playlists', { name: this.newName.trim(), default_duration: this.newDuration, transition: this.newTransition });
                this.showCreate = false; this.newName = '';
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
            try { await api.put('/playlists/' + this.editing.id, this.editForm); alert('Settings saved'); }
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
                alert('Items saved');
            } catch (e) { alert('Error: ' + e.message); }
            finally { this.saving = false; }
        },
        async assignPlaylist() {
            this.saving = true;
            try {
                const payload = this.assignDeviceId === 'all' ? { all_devices: true } : { device_ids: [parseInt(this.assignDeviceId)] };
                await api.post('/playlists/' + this.editing.id + '/assign', payload);
                alert('Playlist assigned');
                const res = await api.get('/playlists/' + this.editing.id);
                this.editing.assignments = res.data.assignments;
            } catch (e) { alert('Error: ' + e.message); }
            finally { this.saving = false; }
        }
    }
};
