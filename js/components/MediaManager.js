const MediaManager = {
    name: 'MediaManager',
    template: `
        <div>
            <div class="page-header">
                <h2>Media Library</h2>
                <div style="display:flex;gap:8px;align-items:center">
                    <select class="form-control" v-model="filterType" @change="loadMedia" style="width:auto">
                        <option value="">All Types</option>
                        <option value="image">Images</option>
                        <option value="video">Videos</option>
                        <option value="gif">GIFs</option>
                    </select>
                    <input class="form-control" v-model="searchQuery" @input="debounceSearch" placeholder="Search..." style="width:200px">
                    <button class="btn btn-primary" @click="showUpload = true">+ Upload</button>
                </div>
            </div>

            <div v-if="loading" class="empty-state">Loading media...</div>
            <div v-else-if="media.length === 0" class="empty-state">
                <div class="icon">&#128247;</div>
                <p>No media files yet</p>
                <button class="btn btn-primary" @click="showUpload = true">Upload your first file</button>
            </div>
            <div v-else class="media-grid">
                <div class="media-item" v-for="m in media" :key="m.id" @click="preview(m)">
                    <span class="type-badge">{{ m.type }}</span>
                    <div class="actions">
                        <button class="btn" @click.stop="preview(m)" title="Preview">&#128065;</button>
                        <button class="btn" @click.stop="deleteMedia(m)" title="Delete">&times;</button>
                    </div>
                    <img class="thumb" :src="m.thumbnail_url || m.url" :alt="m.name"
                         @error="handleImgErr">
                    <div class="info">
                        <div class="name">{{ m.name }}</div>
                        <div class="meta">{{ (m.size / 1024).toFixed(0) }} KB &middot; {{ m.width }}x{{ m.height }}</div>
                    </div>
                </div>
            </div>

            <div v-if="totalPages > 1" style="display:flex;justify-content:center;gap:8px;margin-top:20px">
                <button class="btn btn-outline btn-sm" :disabled="page <= 1" @click="goPage(page - 1)">Previous</button>
                <span style="padding:6px 12px;font-size:13px">Page {{ page }} of {{ totalPages }}</span>
                <button class="btn btn-outline btn-sm" :disabled="page >= totalPages" @click="goPage(page + 1)">Next</button>
            </div>

            <div v-if="showUpload" class="modal-overlay" @click.self="closeUpload">
                <div class="modal">
                    <div class="modal-header">
                        <h3>Upload Media</h3>
                        <button class="close-btn" @click="closeUpload">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="upload-zone" @click="$refs.fileInput.click()"
                             @dragover.prevent="$event.target.classList.add('dragover')"
                             @dragleave.prevent="$event.target.classList.remove('dragover')"
                             @drop.prevent="handleDrop">
                            <p v-if="!uploadFile">Click or drag & drop files here</p>
                            <p v-else><strong>{{ uploadFile.name }}</strong> ({{ (uploadFile.size / 1024).toFixed(0) }} KB)</p>
                            <input type="file" ref="fileInput" @change="handleFile" accept="image/*,video/*">
                        </div>
                        <div class="form-group" style="margin-top:16px">
                            <label>Name (optional)</label>
                            <input class="form-control" v-model="uploadName" placeholder="Auto from filename">
                        </div>
                        <div class="form-group">
                            <label>Category</label>
                            <select class="form-control" v-model="uploadCategory">
                                <option value="">None</option>
                                <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" @click="closeUpload">Cancel</button>
                        <button class="btn btn-primary" @click="doUpload" :disabled="!uploadFile || uploading">
                            {{ uploading ? 'Uploading...' : 'Upload' }}
                        </button>
                    </div>
                </div>
            </div>

            <div v-if="previewItem" class="modal-overlay" @click.self="closePreview">
                <div class="modal" style="max-width:800px">
                    <div class="modal-header">
                        <h3>{{ previewItem.name }}</h3>
                        <button class="close-btn" @click="closePreview">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="preview-box">
                            <img v-if="previewItem.type === 'image' || previewItem.type === 'gif'" :src="previewItem.url" style="max-width:100%;max-height:70vh">
                            <video v-else :src="previewItem.url" controls style="max-width:100%;max-height:70vh"></video>
                        </div>
                        <div style="margin-top:12px;font-size:13px;color:var(--text-muted)">
                            {{ previewItem.width }}x{{ previewItem.height }} &middot;
                            {{ (previewItem.size / 1024 / 1024).toFixed(2) }} MB &middot;
                            {{ previewItem.mime }}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            media: [], categories: [], loading: true,
            page: 1, totalPages: 1,
            filterType: '', searchQuery: '',
            showUpload: false, uploadFile: null, uploadName: '', uploadCategory: '',
            uploading: false, previewItem: null, searchTimer: null,
        };
    },
    async created() {
        await Promise.all([this.loadMedia(), this.loadCategories()]);
    },
    methods: {
        handleImgErr(e) {
            e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150"><rect fill="%23eee" width="200" height="150"/></svg>';
        },
        async loadMedia() {
            this.loading = true;
            try {
                let endpoint = '/media?page=' + this.page + '&per_page=20';
                if (this.filterType) endpoint += '&type=' + this.filterType;
                if (this.searchQuery) endpoint += '&search=' + encodeURIComponent(this.searchQuery);
                const res = await api.get(endpoint);
                this.media = res.data.items;
                this.totalPages = res.data.total_pages;
            } catch (e) {
                alert('Error loading media: ' + e.message);
            } finally {
                this.loading = false;
            }
        },
        async loadCategories() {
            try { const res = await api.get('/media-categories'); this.categories = res.data; } catch (e) {}
        },
        debounceSearch() {
            clearTimeout(this.searchTimer);
            this.searchTimer = setTimeout(() => { this.page = 1; this.loadMedia(); }, 300);
        },
        goPage(p) { this.page = p; this.loadMedia(); },
        handleFile(e) {
            const file = e.target.files[0];
            if (file) { this.uploadFile = file; if (!this.uploadName) this.uploadName = file.name.replace(/\.[^.]+$/, ''); }
        },
        handleDrop(e) {
            e.target.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) { this.uploadFile = file; if (!this.uploadName) this.uploadName = file.name.replace(/\.[^.]+$/, ''); }
        },
        closeUpload() {
            this.showUpload = false; this.uploadFile = null; this.uploadName = ''; this.uploadCategory = '';
        },
        async doUpload() {
            if (!this.uploadFile) return;
            this.uploading = true;
            try {
                const fd = new FormData();
                fd.append('file', this.uploadFile);
                fd.append('name', this.uploadName || '');
                if (this.uploadCategory) fd.append('category_id', this.uploadCategory);
                await api.upload('/media/upload', fd);
                this.closeUpload();
                this.page = 1;
                await this.loadMedia();
            } catch (e) {
                alert('Upload failed: ' + e.message);
            } finally {
                this.uploading = false;
            }
        },
        preview(m) { this.previewItem = m; },
        closePreview() { this.previewItem = null; },
        async deleteMedia(m) {
            if (!confirm('Delete "' + m.name + '"?')) return;
            try { await api.delete('/media/' + m.id); await this.loadMedia(); }
            catch (e) { alert('Delete failed: ' + e.message); }
        }
    }
};
