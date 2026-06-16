// ===========================================================
// RENTARD — Mi Cuenta (modal with tabs for renter/owner views)
// Loads AFTER main.js; uses localStorage for session sync.
// ===========================================================
(() => {
    const $ = (id) => document.getElementById(id);
    const API = window.RENTARD_API_BASE || '/api';
    const token = () => localStorage.getItem('rentard_token');
    const user = () => JSON.parse(localStorage.getItem('rentard_user') || 'null');

    const fmtCurrency = (v) => new Intl.NumberFormat('es-DO', {
        style: 'currency', currency: 'DOP', maximumFractionDigits: 0
    }).format(v);

    const fmtDate = (d) => new Date(d).toLocaleDateString('es-DO', {
        day: '2-digit', month: 'short', year: 'numeric'
    });

    const statusBadge = (status) => {
        const map = {
            CONFIRMED: { c: 'ok', t: 'Confirmada' },
            PENDING: { c: 'warn', t: 'Pendiente' },
            COMPLETED: { c: 'ok', t: 'Completada' },
            CANCELLED: { c: 'warn', t: 'Cancelada' }
        };
        const s = map[status] || { c: '', t: status };
        return `<span class="badge2 ${s.c}">${s.t}</span>`;
    };

    const apiCall = async (path, options = {}) => {
        const res = await fetch(`${API}${path}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token()}`,
                ...(options.headers || {})
            }
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
            // Stale/expired token — clear session and ask to re-login
            localStorage.removeItem('rentard_token');
            localStorage.removeItem('rentard_user');
            const backdrop = $('accountBackdrop');
            if (backdrop) backdrop.style.display = 'none';
            showToastSafe('Tu sesión expiró. Inicia sesión de nuevo.');
            throw new Error('Sesión expirada');
        }
        if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
        return data;
    };

    // ============================================
    // Open modal + tab switching
    // ============================================
    window.openAccount = () => {
        if (!token()) { showToastSafe('Inicia sesión primero.'); return; }
        const backdrop = $('accountBackdrop');
        if (!backdrop) return;
        // Show admin tab only for ADMIN users
        const adminTab = $('adminTabBtn');
        if (adminTab) adminTab.style.display = (user()?.role === 'ADMIN') ? '' : 'none';
        backdrop.style.display = 'flex';
        switchAccountTab('bookings');
    };

    window.switchAccountTab = (tab) => {
        document.querySelectorAll('#accountBackdrop .tab-btn').forEach(b => {
            b.classList.toggle('primary', b.dataset.tab === tab);
        });
        const content = $('accountContent');
        content.innerHTML = '<div style="padding:20px; text-align:center; color: var(--muted, #888);">Cargando...</div>';

        if (tab === 'bookings') loadMyBookings();
        else if (tab === 'cars') loadMyCars();
        else if (tab === 'owner-bookings') loadOwnerBookings();
        else if (tab === 'admin') loadAdminPending();
    };

    // ============================================
    // Mis Reservas (as renter)
    // ============================================
    const loadMyBookings = async () => {
        try {
            const bookings = await apiCall('/bookings/me');
            const content = $('accountContent');
            if (!bookings.length) {
                content.innerHTML = `<div style="padding:30px; text-align:center; color: var(--muted, #888);">
                    Aún no tienes reservas. Explora el catálogo y reserva tu primer vehículo.
                </div>`;
                return;
            }
            content.innerHTML = bookings.map(b => `
                <div class="card" style="padding:14px; margin-bottom:12px;">
                    <div style="display:flex; gap:14px; align-items:center; flex-wrap:wrap;">
                        <div style="width:100px; height:70px; background:url('${b.car.image || ''}') center/cover; border-radius:8px; flex-shrink:0; background-color:#222;"></div>
                        <div style="flex:1; min-width:200px;">
                            <h4 style="margin:0 0 4px;">${b.car.brand} ${b.car.model} (${b.car.year})</h4>
                            <div class="small" style="color:var(--muted,#888);">
                                ${b.car.location} · ${b.car.domain}
                            </div>
                            <div class="small" style="margin-top:6px;">
                                <b>${fmtDate(b.startDate)}</b> → <b>${fmtDate(b.endDate)}</b>
                            </div>
                            <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
                                ${statusBadge(b.status)}
                                <span class="badge2">Depósito: ${b.depositStatus}</span>
                                <span class="badge2 ok">${fmtCurrency(b.totalPrice)}</span>
                            </div>
                        </div>
                        <div style="display:flex; gap:6px; flex-direction:column;">
                            ${['PENDING', 'CONFIRMED'].includes(b.status)
                                ? `<button class="btn" onclick="cancelBooking('${b.id}')">Cancelar</button>
                                   <button class="btn primary" onclick="completeBooking('${b.id}')">Marcar completada</button>`
                                : ''}
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            $('accountContent').innerHTML = `<div style="color:var(--warn,#f80); padding:20px;">Error: ${e.message}</div>`;
        }
    };

    // ============================================
    // Mis Vehículos (as owner)
    // ============================================
    const loadMyCars = async () => {
        try {
            const cars = await apiCall('/cars/mine');
            const content = $('accountContent');
            if (!cars.length) {
                content.innerHTML = `<div style="padding:30px; text-align:center; color: var(--muted, #888);">
                    No has publicado vehículos todavía.
                    <br><br>
                    <button class="btn primary" onclick="$('accountBackdrop').style.display='none'; openPublish();">Publicar mi primer vehículo</button>
                </div>`;
                return;
            }
            content.innerHTML = cars.map(c => `
                <div class="card" style="padding:14px; margin-bottom:12px;">
                    <div style="display:flex; gap:14px; align-items:center; flex-wrap:wrap;">
                        <div style="width:100px; height:70px; background:url('${c.image || ''}') center/cover; border-radius:8px; flex-shrink:0; background-color:#222;"></div>
                        <div style="flex:1; min-width:200px;">
                            <h4 style="margin:0 0 4px;">${c.brand} ${c.model} (${c.year})</h4>
                            <div class="small" style="color:var(--muted,#888);">
                                ${c.location} · ${c.domain} · ${c.category}
                            </div>
                            <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
                                <span class="badge2 ok">${fmtCurrency(c.price)}/día</span>
                                <span class="badge2">${c.trips || 0} viajes</span>
                                <span class="badge2">${c._count?.bookings || 0} reservas históricas</span>
                                ${c.verified ? '<span class="badge2 ok">Verificado</span>' : '<span class="badge2 warn">Sin verificar</span>'}
                            </div>
                        </div>
                        <div style="display:flex; gap:6px;">
                            <button class="btn" onclick="deleteCar('${c.id}')">Eliminar</button>
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            $('accountContent').innerHTML = `<div style="color:var(--warn,#f80); padding:20px;">Error: ${e.message}</div>`;
        }
    };

    // ============================================
    // Reservas Recibidas (bookings on my cars)
    // ============================================
    const loadOwnerBookings = async () => {
        try {
            const bookings = await apiCall('/bookings/owner');
            const content = $('accountContent');
            if (!bookings.length) {
                content.innerHTML = `<div style="padding:30px; text-align:center; color: var(--muted, #888);">
                    Aún no has recibido reservas. Cuando alguien rente uno de tus vehículos, aparecerá aquí.
                </div>`;
                return;
            }
            content.innerHTML = bookings.map(b => `
                <div class="card" style="padding:14px; margin-bottom:12px;">
                    <div style="display:flex; gap:14px; align-items:center; flex-wrap:wrap;">
                        <div style="width:100px; height:70px; background:url('${b.car.image || ''}') center/cover; border-radius:8px; flex-shrink:0; background-color:#222;"></div>
                        <div style="flex:1; min-width:200px;">
                            <h4 style="margin:0 0 4px;">${b.car.brand} ${b.car.model}</h4>
                            <div class="small" style="color:var(--muted,#888);">
                                Rentador: <b>${b.renter.name}</b> (Trust: ${b.renter.trustScore}%)
                                ${b.renter.kycStatus === 'VERIFIED' ? ' · <span style="color:var(--ok,#2c2)">KYC ✓</span>' : ''}
                            </div>
                            <div class="small" style="margin-top:6px;">
                                <b>${fmtDate(b.startDate)}</b> → <b>${fmtDate(b.endDate)}</b>
                            </div>
                            <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
                                ${statusBadge(b.status)}
                                <span class="badge2 ok">${fmtCurrency(b.totalPrice)}</span>
                            </div>
                        </div>
                        <div style="display:flex; gap:6px; flex-direction:column;">
                            ${['PENDING', 'CONFIRMED'].includes(b.status)
                                ? `<button class="btn primary" onclick="completeBooking('${b.id}')">Cerrar/Completar</button>`
                                : ''}
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            $('accountContent').innerHTML = `<div style="color:var(--warn,#f80); padding:20px;">Error: ${e.message}</div>`;
        }
    };

    // ============================================
    // Admin: vehículos pendientes de aprobación
    // ============================================
    const loadAdminPending = async () => {
        try {
            const cars = await apiCall('/cars/admin/pending');
            const content = $('accountContent');
            if (!cars.length) {
                content.innerHTML = `<div style="padding:30px; text-align:center; color: var(--muted, #888);">
                    No hay vehículos pendientes de revisión. Todo al día.
                </div>`;
                return;
            }
            content.innerHTML = `<div class="small" style="margin-bottom:12px; color:var(--muted,#888);">
                ${cars.length} vehículo(s) esperando aprobación:</div>` + cars.map(c => `
                <div class="card" style="padding:14px; margin-bottom:12px;">
                    <div style="display:flex; gap:14px; align-items:center; flex-wrap:wrap;">
                        <div style="width:100px; height:70px; background:url('${c.image || ''}') center/cover; border-radius:8px; flex-shrink:0; background-color:#222;"></div>
                        <div style="flex:1; min-width:200px;">
                            <h4 style="margin:0 0 4px;">${c.brand} ${c.model} (${c.year})</h4>
                            <div class="small" style="color:var(--muted,#888);">
                                ${c.location} · ${c.domain} · ${c.category} · ${fmtCurrency(c.price)}/día
                            </div>
                            <div class="small" style="margin-top:4px;">
                                Publicado por: <b>${c.owner?.name || '—'}</b> (${c.owner?.email || ''})
                            </div>
                            <div class="small" style="margin-top:4px;">${c.note || 'Sin descripción.'}</div>
                            <div class="small" style="margin-top:4px;">
                                ${c.dnaStatus === 'REJECTED' ? '<span class="badge2 warn">Rechazado antes</span>' : ''}
                            </div>
                        </div>
                        <div style="display:flex; gap:6px; flex-direction:column;">
                            <button class="btn primary" onclick="approveCar('${c.id}')">✓ Aprobar</button>
                            <button class="btn" onclick="rejectCar('${c.id}')">✕ Rechazar</button>
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            $('accountContent').innerHTML = `<div style="color:var(--warn,#f80); padding:20px;">Error: ${e.message}</div>`;
        }
    };

    window.approveCar = async (id) => {
        try {
            await apiCall(`/cars/${id}/approve`, { method: 'POST' });
            showToastSafe('Vehículo aprobado y publicado.');
            switchAccountTab('admin');
        } catch (e) { showToastSafe('Error: ' + e.message); }
    };

    window.rejectCar = async (id) => {
        const reason = prompt('Motivo del rechazo (opcional):') || '';
        try {
            await apiCall(`/cars/${id}/reject`, {
                method: 'POST',
                body: JSON.stringify({ reason })
            });
            showToastSafe('Vehículo rechazado.');
            switchAccountTab('admin');
        } catch (e) { showToastSafe('Error: ' + e.message); }
    };

    // ============================================
    // Actions
    // ============================================
    window.cancelBooking = async (id) => {
        if (!confirm('¿Cancelar esta reserva? El depósito se liberará.')) return;
        try {
            await apiCall(`/bookings/${id}/cancel`, { method: 'POST' });
            showToastSafe('Reserva cancelada.');
            switchAccountTab('bookings');
        } catch (e) {
            showToastSafe('Error: ' + e.message);
        }
    };

    window.completeBooking = async (id) => {
        if (!confirm('¿Marcar como completada? Esto liberará el depósito (o aplicará penalidad si hay retraso).')) return;
        try {
            const data = await apiCall(`/bookings/${id}/complete`, { method: 'POST' });
            showToastSafe(data.message || 'Reserva completada.');
            switchAccountTab('bookings');
        } catch (e) {
            showToastSafe('Error: ' + e.message);
        }
    };

    window.deleteCar = async (id) => {
        if (!confirm('¿Eliminar este vehículo del catálogo? No se puede deshacer.')) return;
        try {
            await apiCall(`/cars/${id}`, { method: 'DELETE' });
            showToastSafe('Vehículo eliminado.');
            switchAccountTab('cars');
        } catch (e) {
            showToastSafe('Error: ' + e.message);
        }
    };

    const showToastSafe = (text) => {
        if (typeof showToast === 'function') return showToast(text);
        alert(text);
    };

    // ============================================
    // UI wiring on DOM ready
    // ============================================
    document.addEventListener('DOMContentLoaded', () => {
        const btn = $('myAccountBtn');
        if (btn) btn.addEventListener('click', openAccount);

        const close = $('closeAccount');
        if (close) close.addEventListener('click', () => $('accountBackdrop').style.display = 'none');

        const backdrop = $('accountBackdrop');
        if (backdrop) backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) backdrop.style.display = 'none';
        });

        // Reflect login state for the My Account button
        const refreshBtn = () => {
            if (!btn) return;
            btn.style.display = token() ? '' : 'none';
        };
        refreshBtn();

        // Poll storage so login from another tab/script reflects here
        window.addEventListener('storage', refreshBtn);
        // Also re-check periodically (since main.js writes to localStorage in the same tab)
        setInterval(refreshBtn, 1500);
    });
})();
