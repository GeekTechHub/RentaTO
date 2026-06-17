// ===========================================================
// RentaTO — Mi Cuenta (modal with tabs for renter / owner / admin views)
// Loads AFTER main.js; uses localStorage for session sync.
// ===========================================================
(() => {
    const $ = (id) => document.getElementById(id);
    const API = window.RENTATO_API_BASE || window.RENTARD_API_BASE || '/api';
    const token = () => localStorage.getItem('rentard_token');
    const user = () => JSON.parse(localStorage.getItem('rentard_user') || 'null');

    const fmtCurrency = (v) => new Intl.NumberFormat('es-DO', {
        style: 'currency', currency: 'DOP', maximumFractionDigits: 0
    }).format(v);

    const fmtDate = (d) => new Date(d).toLocaleDateString('es-DO', {
        day: '2-digit', month: 'short', year: 'numeric'
    });

    const fmtTime = (d) => new Date(d).toLocaleTimeString('es-DO', {
        hour: '2-digit', minute: '2-digit'
    });

    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

    const statusBadge = (status) => {
        const map = {
            CONFIRMED: { c: 'ok', t: 'Confirmada' },
            PENDING: { c: 'warn', t: 'Pendiente' },
            COMPLETED: { c: 'ok', t: 'Completada' },
            CANCELLED: { c: 'warn', t: 'Cancelada' }
        };
        const s = map[status] || { c: '', t: status };
        return `<span class="badge2 ${s.c}">${esc(s.t)}</span>`;
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
        const adminTab = $('adminTabBtn');
        if (adminTab) adminTab.style.display = (user()?.role === 'ADMIN') ? '' : 'none';
        backdrop.style.display = 'flex';
        switchAccountTab('bookings');
    };

    window.switchAccountTab = (tab) => {
        stopChatPolling();
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
    const kycBannerHtml = (kyc) => {
        if (!kyc || kyc.kycStatus === 'VERIFIED') return '';
        if (kyc.kycStatus === 'IN_REVIEW') {
            return `<div class="card" style="padding:12px; margin-bottom:14px; background:rgba(255,180,0,0.08);">
                <b>Verificación en revisión</b>
                <div class="small" style="color:var(--muted,#888); margin-top:4px;">
                    Enviaste tus documentos. Te avisaremos cuando un administrador los apruebe.
                </div>
            </div>`;
        }
        const reasonLine = kyc.kycStatus === 'REJECTED' && kyc.kycRejectReason
            ? `<div class="small" style="color:var(--warn,#f80); margin-top:6px;">Motivo: ${esc(kyc.kycRejectReason)}</div>` : '';
        const cta = kyc.kycStatus === 'REJECTED' ? 'Volver a enviar' : 'Verificar mi identidad';
        return `<div class="card" style="padding:12px; margin-bottom:14px; background:rgba(80,160,255,0.08);">
            <b>${kyc.kycStatus === 'REJECTED' ? 'Verificación rechazada' : 'Verifica tu identidad'}</b>
            <div class="small" style="color:var(--muted,#888); margin-top:4px;">
                Sube tu cédula y una selfie para generar confianza. Los dueños prefieren rentar a usuarios verificados.
            </div>
            ${reasonLine}
            <button class="btn primary" style="margin-top:10px;" onclick="window._openKycForm()">${cta}</button>
        </div>`;
    };

    const loadMyBookings = async () => {
        try {
            // Fetch KYC + bookings in parallel
            const [kyc, bookings] = await Promise.all([
                apiCall('/kyc/me').catch(() => null),
                apiCall('/bookings/me')
            ]);
            const content = $('accountContent');
            const banner = kycBannerHtml(kyc);

            if (!bookings.length) {
                content.innerHTML = banner + `<div style="padding:30px; text-align:center; color: var(--muted, #888);">
                    Aún no tienes reservas. Explora el catálogo y reserva tu primer vehículo.
                </div>`;
                return;
            }
            content.innerHTML = banner + bookings.map(b => `
                <div class="card" style="padding:14px; margin-bottom:12px;">
                    <div style="display:flex; gap:14px; align-items:center; flex-wrap:wrap;">
                        <div style="width:100px; height:70px; background:url('${esc(b.car.image || '')}') center/cover; border-radius:8px; flex-shrink:0; background-color:#222;"></div>
                        <div style="flex:1; min-width:200px;">
                            <h4 style="margin:0 0 4px;">${esc(b.car.brand)} ${esc(b.car.model)} (${esc(b.car.year)})</h4>
                            <div class="small" style="color:var(--muted,#888);">
                                ${esc(b.car.location)} · ${esc(b.car.domain)}
                            </div>
                            <div class="small" style="margin-top:6px;">
                                <b>${fmtDate(b.startDate)}</b> → <b>${fmtDate(b.endDate)}</b>
                            </div>
                            <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
                                ${statusBadge(b.status)}
                                <span class="badge2">Depósito: ${esc(b.depositStatus)}</span>
                                <span class="badge2 ok">${fmtCurrency(b.totalPrice)}</span>
                            </div>
                        </div>
                        <div style="display:flex; gap:6px; flex-direction:column;">
                            <button class="btn" onclick="openBookingChat('${b.id}', 'bookings')">💬 Chat</button>
                            ${b.status === 'COMPLETED'
                                ? (b.iReviewed
                                    ? `<span class="badge2 ok" style="text-align:center;">✓ Reseñado</span>`
                                    : `<button class="btn primary" onclick="window._openReviewForm('${b.id}', '${esc(b.car.brand)} ${esc(b.car.model)}', 'al dueño')">★ Dejar reseña</button>`)
                                : ''}
                            ${['PENDING', 'CONFIRMED'].includes(b.status)
                                ? `<button class="btn" onclick="cancelBooking('${b.id}')">Cancelar</button>
                                   <button class="btn primary" onclick="completeBooking('${b.id}')">Marcar completada</button>`
                                : ''}
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            $('accountContent').innerHTML = `<div style="color:var(--warn,#f80); padding:20px;">Error: ${esc(e.message)}</div>`;
        }
    };

    // ============================================
    // Mis Vehículos (as owner) — with Edit
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
                        <div style="width:100px; height:70px; background:url('${esc(c.image || '')}') center/cover; border-radius:8px; flex-shrink:0; background-color:#222;"></div>
                        <div style="flex:1; min-width:200px;">
                            <h4 style="margin:0 0 4px;">${esc(c.brand)} ${esc(c.model)} (${esc(c.year)})</h4>
                            <div class="small" style="color:var(--muted,#888);">
                                ${esc(c.location)} · ${esc(c.domain)} · ${esc(c.category)}
                            </div>
                            <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
                                <span class="badge2 ok">${fmtCurrency(c.price)}/día</span>
                                <span class="badge2">${c.trips || 0} viajes</span>
                                <span class="badge2">${c._count?.bookings || 0} reservas históricas</span>
                                ${c.verified ? '<span class="badge2 ok">Publicado</span>' : '<span class="badge2 warn">En revisión</span>'}
                            </div>
                        </div>
                        <div style="display:flex; gap:6px; flex-direction:column;">
                            <button class="btn primary" onclick="editCar('${c.id}')">Editar</button>
                            <button class="btn" onclick="deleteCar('${c.id}')">Eliminar</button>
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            $('accountContent').innerHTML = `<div style="color:var(--warn,#f80); padding:20px;">Error: ${esc(e.message)}</div>`;
        }
    };

    // ============================================
    // Edit vehicle — inline form rendered in the same panel
    // ============================================
    window.editCar = async (id) => {
        try {
            const cars = await apiCall('/cars/mine');
            const c = cars.find(x => x.id === id);
            if (!c) return showToastSafe('Vehículo no encontrado.');

            const PROVS = ['Azua','Bahoruco','Barahona','Dajabón','Distrito Nacional','Duarte','El Seibo','Elías Piña','Espaillat','Hato Mayor','Hermanas Mirabal','Independencia','La Altagracia','La Romana','La Vega','María Trinidad Sánchez','Monseñor Nouel','Monte Cristi','Monte Plata','Pedernales','Peravia','Puerto Plata','Samaná','San Cristóbal','San José de Ocoa','San Juan','San Pedro de Macorís','Sánchez Ramírez','Santiago','Santiago Rodríguez','Valverde'];

            const cats = {
                LAND: ['Sedan', 'Jeepeta', 'Pickup', 'Micro', 'SUV', 'MOTORCYCLE'],
                WATER: ['Bote', 'JetSki', 'Yate', 'Catamarán', 'BOAT'],
                AIR: ['Helicóptero', 'Avioneta', 'Jet', 'HELICOPTER']
            };

            $('accountContent').innerHTML = `
                <div class="card" style="padding:18px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <h3 style="margin:0;">Editar: ${esc(c.brand)} ${esc(c.model)}</h3>
                        <button class="btn" onclick="switchAccountTab('cars')">← Volver</button>
                    </div>
                    ${!c.verified ? '<div class="small" style="background:rgba(255,140,0,0.1); padding:8px 12px; border-radius:6px; margin-bottom:12px; color:var(--warn,#f80);">⚠️ Este vehículo está en revisión. Si lo editas, seguirá en revisión hasta que un administrador lo apruebe.</div>' : '<div class="small" style="background:rgba(40,180,80,0.1); padding:8px 12px; border-radius:6px; margin-bottom:12px;">ℹ️ Al editar, tu vehículo volverá a revisión y dejará de aparecer en el catálogo público hasta ser aprobado de nuevo.</div>'}
                    <div class="form grid-form">
                        <div class="field"><label>Marca</label><input id="eBrand" value="${esc(c.brand)}" /></div>
                        <div class="field"><label>Modelo</label><input id="eModel" value="${esc(c.model)}" /></div>
                        <div class="field"><label>Año</label><input id="eYear" type="number" value="${esc(c.year)}" /></div>
                        <div class="field"><label>Tipo de vehículo</label>
                            <select id="eDom" onchange="window._refreshEditCats()">
                                <option value="LAND" ${c.domain === 'LAND' ? 'selected' : ''}>Terrestre</option>
                                <option value="WATER" ${c.domain === 'WATER' ? 'selected' : ''}>Acuático</option>
                                <option value="AIR" ${c.domain === 'AIR' ? 'selected' : ''}>Aéreo</option>
                            </select>
                        </div>
                        <div class="field"><label>Categoría</label>
                            <select id="eCat">
                                ${(cats[c.domain] || cats.LAND).map(opt => `<option value="${esc(opt)}" ${opt === c.category ? 'selected' : ''}>${esc(opt)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="field"><label>Capacidad</label><input id="eCapacity" type="number" value="${esc(c.capacity)}" /></div>
                        <div class="field"><label>Precio / día (RD$)</label><input id="ePrice" type="number" value="${esc(c.price)}" /></div>
                        <div class="field"><label>Depósito (RD$)</label><input id="eDeposit" type="number" value="${esc(c.deposit)}" /></div>
                        <div class="field span2"><label>Provincia</label>
                            <select id="eLoc">
                                ${PROVS.map(p => `<option value="${esc(p)}" ${p === c.location ? 'selected' : ''}>${esc(p)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="field span2">
                            <label>Foto del vehículo</label>
                            <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                                <input id="eImageFile" type="file" accept="image/*" capture="environment" style="flex:1; min-width:200px;" onchange="window._uploadEditImage(event)" />
                                <span class="small" style="color:var(--muted,#888);">o pega un enlace abajo</span>
                            </div>
                            <input id="eImage" type="url" value="${esc(c.image || '')}" placeholder="https://..." oninput="window._previewEditImage()" style="margin-top:6px; width:100%;" />
                            <div class="small" id="eImageHint" style="color:var(--muted,#888); margin-top:4px;">Toma una foto o pega un enlace.</div>
                            <img id="eImagePreview" src="${esc(c.image || '')}" style="${c.image ? '' : 'display:none;'} margin-top:8px; max-width:200px; border-radius:8px;" />
                        </div>
                        <div class="field span2"><label>Descripción</label><textarea id="eNote" rows="3">${esc(c.note || '')}</textarea></div>
                        <div class="field span2" style="display:flex; gap:8px; justify-content:flex-end;">
                            <button class="btn" onclick="switchAccountTab('cars')">Cancelar</button>
                            <button class="btn primary" onclick="window._saveCarEdit('${c.id}')">Guardar cambios</button>
                        </div>
                    </div>
                </div>
            `;

            window._refreshEditCats = () => {
                const dom = $('eDom').value;
                const sel = $('eCat');
                sel.innerHTML = (cats[dom] || cats.LAND).map(opt => `<option value="${esc(opt)}">${esc(opt)}</option>`).join('');
            };

            window._previewEditImage = () => {
                const url = $('eImage').value.trim();
                const preview = $('eImagePreview');
                if (url && /^https?:\/\//.test(url)) {
                    preview.src = url;
                    preview.style.display = 'block';
                    preview.onerror = () => { preview.style.display = 'none'; };
                } else {
                    preview.style.display = 'none';
                }
            };

            window._uploadEditImage = async (event) => {
                const file = event.target.files && event.target.files[0];
                if (!file) return;
                const cfg = window.CLOUDINARY_CONFIG;
                const hint = $('eImageHint');
                if (!cfg || !cfg.cloud || !cfg.preset) {
                    if (hint) hint.innerHTML = '⚠️ Subida directa aún no configurada. Por ahora pega un enlace.';
                    showToastSafe('Subida de fotos no configurada. Usa un enlace.');
                    event.target.value = '';
                    return;
                }
                if (file.size > 8 * 1024 * 1024) {
                    showToastSafe('La imagen pesa más de 8 MB.');
                    return;
                }
                try {
                    if (hint) hint.textContent = 'Subiendo foto...';
                    const fd = new FormData();
                    fd.append('file', file);
                    fd.append('upload_preset', cfg.preset);
                    const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloud}/image/upload`, { method: 'POST', body: fd });
                    const data = await res.json();
                    if (data.secure_url) {
                        $('eImage').value = data.secure_url;
                        window._previewEditImage();
                        if (hint) hint.textContent = 'Foto subida.';
                    } else throw new Error(data.error?.message || 'Sin URL');
                } catch (err) {
                    if (hint) hint.textContent = 'No se pudo subir la foto.';
                    showToastSafe('Error subiendo foto: ' + err.message);
                }
            };

            window._saveCarEdit = async (carId) => {
                const payload = {
                    brand: $('eBrand').value.trim(),
                    model: $('eModel').value.trim(),
                    year: Number($('eYear').value),
                    domain: $('eDom').value,
                    category: $('eCat').value,
                    capacity: Number($('eCapacity').value),
                    price: Number($('ePrice').value),
                    deposit: Number($('eDeposit').value),
                    location: $('eLoc').value,
                    image: $('eImage').value.trim(),
                    note: $('eNote').value.trim()
                };
                if (!payload.brand || !payload.model || !payload.price) {
                    return showToastSafe('Marca, modelo y precio son obligatorios.');
                }
                try {
                    const data = await apiCall(`/cars/${carId}`, {
                        method: 'PUT',
                        body: JSON.stringify(payload)
                    });
                    showToastSafe(data.message || 'Vehículo actualizado.');
                    switchAccountTab('cars');
                } catch (e) {
                    showToastSafe('Error: ' + e.message);
                }
            };
        } catch (e) {
            showToastSafe('Error: ' + e.message);
        }
    };

    // ============================================
    // Reservas Recibidas (as owner)
    // ============================================
    const loadOwnerBookings = async () => {
        try {
            const bookings = await apiCall('/bookings/owner');
            const content = $('accountContent');
            if (!bookings.length) {
                content.innerHTML = `<div style="padding:30px; text-align:center; color: var(--muted, #888);">
                    Nadie ha reservado tus vehículos todavía.
                </div>`;
                return;
            }
            content.innerHTML = bookings.map(b => `
                <div class="card" style="padding:14px; margin-bottom:12px;">
                    <div style="display:flex; gap:14px; align-items:center; flex-wrap:wrap;">
                        <div style="width:100px; height:70px; background:url('${esc(b.car.image || '')}') center/cover; border-radius:8px; flex-shrink:0; background-color:#222;"></div>
                        <div style="flex:1; min-width:200px;">
                            <h4 style="margin:0 0 4px;">${esc(b.car.brand)} ${esc(b.car.model)}</h4>
                            <div class="small" style="color:var(--muted,#888);">
                                Rentador: <b>${esc(b.renter.name)}</b> (Reputación: ${esc(b.renter.trustScore)}%)
                                ${b.renter.kycStatus === 'VERIFIED' ? ' · <span style="color:var(--ok,#2c2)">Verificado ✓</span>' : ''}
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
                            <button class="btn" onclick="openBookingChat('${b.id}', 'owner-bookings')">💬 Chat</button>
                            ${['PENDING', 'CONFIRMED'].includes(b.status)
                                ? `<button class="btn primary" onclick="completeBooking('${b.id}')">Cerrar / completar</button>`
                                : ''}
                            ${b.status === 'COMPLETED'
                                ? (b.iReviewed
                                    ? `<span class="badge2 ok" style="text-align:center;">✓ Reseñado</span>`
                                    : `<button class="btn primary" onclick="window._openReviewForm('${b.id}', '${esc(b.renter.name)}', 'al rentador')">★ Calificar rentador</button>`)
                                : ''}
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            $('accountContent').innerHTML = `<div style="color:var(--warn,#f80); padding:20px;">Error: ${esc(e.message)}</div>`;
        }
    };

    // ============================================
    // Booking Chat — opens in the account panel, polls every 3s
    // ============================================
    let chatPollTimer = null;
    let chatCurrentBookingId = null;
    let chatLastCount = 0;

    const stopChatPolling = () => {
        if (chatPollTimer) clearInterval(chatPollTimer);
        chatPollTimer = null;
        chatCurrentBookingId = null;
        chatLastCount = 0;
    };

    window.openBookingChat = (bookingId, returnTab) => {
        stopChatPolling();
        chatCurrentBookingId = bookingId;
        $('accountContent').innerHTML = `
            <div class="card" style="padding:14px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <h3 style="margin:0;">Chat de la reserva</h3>
                    <button class="btn" onclick="switchAccountTab('${esc(returnTab || 'bookings')}')">← Volver</button>
                </div>
                <div id="chatLog" style="height:340px; overflow-y:auto; padding:10px; background:rgba(0,0,0,0.2); border-radius:8px; margin-bottom:10px; display:flex; flex-direction:column; gap:6px;">
                    <div style="text-align:center; color:var(--muted,#888); padding:20px;">Cargando mensajes...</div>
                </div>
                <div style="display:flex; gap:8px;">
                    <input id="chatInputAcc" placeholder="Escribe tu mensaje..." style="flex:1; padding:8px; border-radius:6px; border:1px solid rgba(255,255,255,0.15); background:rgba(0,0,0,0.2); color:inherit;" />
                    <button class="btn primary" onclick="window._sendBookingMsg()">Enviar</button>
                </div>
            </div>
        `;

        const input = $('chatInputAcc');
        if (input) input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') window._sendBookingMsg();
        });

        loadChatMessages(true);
        chatPollTimer = setInterval(() => loadChatMessages(false), 3000);
    };

    const loadChatMessages = async (initial) => {
        if (!chatCurrentBookingId) return;
        try {
            const data = await apiCall(`/chat/${chatCurrentBookingId}`);
            const log = $('chatLog');
            if (!log) { stopChatPolling(); return; }
            if (!data.messages || !data.messages.length) {
                if (initial) {
                    log.innerHTML = `<div style="text-align:center; color:var(--muted,#888); padding:20px;">Aún no hay mensajes. Envía el primero.</div>`;
                }
                chatLastCount = 0;
                return;
            }
            if (data.messages.length === chatLastCount && !initial) return; // nothing new
            chatLastCount = data.messages.length;
            const me = data.me;
            log.innerHTML = data.messages.map(m => {
                const mine = m.senderId === me;
                return `<div style="align-self:${mine ? 'flex-end' : 'flex-start'}; max-width:75%; padding:8px 12px; border-radius:12px; background:${mine ? 'rgba(80,160,255,0.25)' : 'rgba(255,255,255,0.08)'};">
                    <div class="small" style="opacity:0.7; margin-bottom:2px;">${esc(m.sender?.name || '')} · ${fmtTime(m.createdAt)}</div>
                    <div>${esc(m.content)}</div>
                </div>`;
            }).join('');
            log.scrollTop = log.scrollHeight;
        } catch (e) {
            // Stop polling on persistent errors
            if (chatPollTimer) clearInterval(chatPollTimer);
            const log = $('chatLog');
            if (log) log.innerHTML = `<div style="color:var(--warn,#f80); padding:20px;">No se pudo cargar el chat: ${esc(e.message)}</div>`;
        }
    };

    window._sendBookingMsg = async () => {
        const input = $('chatInputAcc');
        if (!input) return;
        const content = input.value.trim();
        if (!content || !chatCurrentBookingId) return;
        try {
            await apiCall('/chat/send', {
                method: 'POST',
                body: JSON.stringify({ bookingId: chatCurrentBookingId, content })
            });
            input.value = '';
            loadChatMessages(false);
        } catch (e) {
            showToastSafe('No se pudo enviar: ' + e.message);
        }
    };

    // ============================================
    // Admin: vehículos pendientes + KYC pendiente
    // ============================================
    const loadAdminPending = async () => {
        try {
            const [cars, kycPending] = await Promise.all([
                apiCall('/cars/admin/pending').catch(() => []),
                apiCall('/kyc/pending').catch(() => [])
            ]);
            const content = $('accountContent');

            // Section 1: Vehicles
            const carsBlock = !cars.length
                ? `<div style="padding:20px; text-align:center; color: var(--muted, #888);">No hay vehículos pendientes.</div>`
                : `<div class="small" style="margin-bottom:12px; color:var(--muted,#888);">
                    ${cars.length} vehículo(s) esperando aprobación:</div>` + cars.map(c => `
                <div class="card" style="padding:14px; margin-bottom:12px;">
                    <div style="display:flex; gap:14px; align-items:center; flex-wrap:wrap;">
                        <div style="width:100px; height:70px; background:url('${esc(c.image || '')}') center/cover; border-radius:8px; flex-shrink:0; background-color:#222;"></div>
                        <div style="flex:1; min-width:200px;">
                            <h4 style="margin:0 0 4px;">${esc(c.brand)} ${esc(c.model)} (${esc(c.year)})</h4>
                            <div class="small" style="color:var(--muted,#888);">
                                ${esc(c.location)} · ${esc(c.domain)} · ${esc(c.category)} · ${fmtCurrency(c.price)}/día
                            </div>
                            <div class="small" style="margin-top:4px;">
                                Publicado por: <b>${esc(c.owner?.name || '—')}</b> (${esc(c.owner?.email || '')})
                            </div>
                            <div class="small" style="margin-top:4px;">${esc(c.note || 'Sin descripción.')}</div>
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

            // Section 2: KYC
            const kycBlock = !kycPending.length
                ? `<div style="padding:20px; text-align:center; color: var(--muted, #888);">No hay verificaciones pendientes.</div>`
                : `<div class="small" style="margin-bottom:12px; color:var(--muted,#888);">
                    ${kycPending.length} verificación(es) esperando revisión:</div>` + kycPending.map(u => `
                <div class="card" style="padding:14px; margin-bottom:12px;">
                    <div style="margin-bottom:10px;">
                        <h4 style="margin:0;">${esc(u.name)} <span class="small" style="color:var(--muted,#888);">· ${esc(u.email)} · ${esc(u.role)}</span></h4>
                        <div class="small" style="color:var(--muted,#888);">Enviado: ${u.kycSubmittedAt ? fmtDate(u.kycSubmittedAt) : '—'}</div>
                    </div>
                    <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;">
                        ${u.kycCedulaFrontUrl ? `<div><div class="small">Cédula frente</div><a href="${esc(u.kycCedulaFrontUrl)}" target="_blank"><img src="${esc(u.kycCedulaFrontUrl)}" style="height:120px; border-radius:6px; background:#222;" /></a></div>` : ''}
                        ${u.kycCedulaBackUrl ? `<div><div class="small">Cédula reverso</div><a href="${esc(u.kycCedulaBackUrl)}" target="_blank"><img src="${esc(u.kycCedulaBackUrl)}" style="height:120px; border-radius:6px; background:#222;" /></a></div>` : ''}
                        ${u.kycSelfieUrl ? `<div><div class="small">Selfie</div><a href="${esc(u.kycSelfieUrl)}" target="_blank"><img src="${esc(u.kycSelfieUrl)}" style="height:120px; border-radius:6px; background:#222;" /></a></div>` : ''}
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button class="btn primary" onclick="window._approveKyc('${u.id}')">✓ Verificar</button>
                        <button class="btn" onclick="window._rejectKyc('${u.id}')">✕ Rechazar</button>
                    </div>
                </div>
            `).join('');

            content.innerHTML = `
                <div style="display:flex; gap:8px; margin-bottom:14px;">
                    <button class="btn primary" id="_admSubVehicles" onclick="window._showAdmSub('vehicles')">Vehículos (${cars.length})</button>
                    <button class="btn" id="_admSubKyc" onclick="window._showAdmSub('kyc')">Verificaciones (${kycPending.length})</button>
                </div>
                <div id="_admSubBody"></div>
            `;
            window._admBlocks = { vehicles: carsBlock, kyc: kycBlock };
            window._showAdmSub('vehicles');
        } catch (e) {
            $('accountContent').innerHTML = `<div style="color:var(--warn,#f80); padding:20px;">Error: ${esc(e.message)}</div>`;
        }
    };

    window._showAdmSub = (sub) => {
        const body = $('_admSubBody');
        const v = $('_admSubVehicles');
        const k = $('_admSubKyc');
        if (v) v.classList.toggle('primary', sub === 'vehicles');
        if (k) k.classList.toggle('primary', sub === 'kyc');
        if (body && window._admBlocks) body.innerHTML = window._admBlocks[sub] || '';
    };

    window._approveKyc = async (userId) => {
        try {
            await apiCall(`/kyc/${userId}/approve`, { method: 'POST' });
            showToastSafe('Usuario verificado.');
            switchAccountTab('admin');
        } catch (e) { showToastSafe('Error: ' + e.message); }
    };

    window._rejectKyc = async (userId) => {
        const reason = prompt('Motivo del rechazo (le llegará al usuario):') || '';
        try {
            await apiCall(`/kyc/${userId}/reject`, {
                method: 'POST',
                body: JSON.stringify({ reason })
            });
            showToastSafe('Verificación rechazada.');
            switchAccountTab('admin');
        } catch (e) { showToastSafe('Error: ' + e.message); }
    };

    // ============================================
    // KYC submission form
    // ============================================
    window._openKycForm = () => {
        stopChatPolling();
        $('accountContent').innerHTML = `
            <div class="card" style="padding:18px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <h3 style="margin:0;">Verifica tu identidad</h3>
                    <button class="btn" onclick="switchAccountTab('bookings')">← Volver</button>
                </div>
                <div class="small" style="color:var(--muted,#888); margin-bottom:14px;">
                    Sube fotos claras y completas. Asegúrate de que se lean los datos y se vea tu cara en la selfie.
                </div>
                <div class="form grid-form">
                    <div class="field span2">
                        <label>Cédula — frente</label>
                        <input type="file" accept="image/*" capture="environment" onchange="window._kycUpload(event,'front')" />
                        <div class="small" id="_kycFrontHint" style="color:var(--muted,#888); margin-top:4px;">No subida.</div>
                        <img id="_kycFrontPrev" style="display:none; margin-top:6px; max-height:140px; border-radius:6px;" />
                    </div>
                    <div class="field span2">
                        <label>Cédula — reverso</label>
                        <input type="file" accept="image/*" capture="environment" onchange="window._kycUpload(event,'back')" />
                        <div class="small" id="_kycBackHint" style="color:var(--muted,#888); margin-top:4px;">No subida.</div>
                        <img id="_kycBackPrev" style="display:none; margin-top:6px; max-height:140px; border-radius:6px;" />
                    </div>
                    <div class="field span2">
                        <label>Selfie (sostén tu cédula junto a tu cara)</label>
                        <input type="file" accept="image/*" capture="user" onchange="window._kycUpload(event,'selfie')" />
                        <div class="small" id="_kycSelfieHint" style="color:var(--muted,#888); margin-top:4px;">No subida.</div>
                        <img id="_kycSelfiePrev" style="display:none; margin-top:6px; max-height:140px; border-radius:6px;" />
                    </div>
                    <div class="field span2" style="display:flex; gap:8px; justify-content:flex-end;">
                        <button class="btn" onclick="switchAccountTab('bookings')">Cancelar</button>
                        <button class="btn primary" onclick="window._submitKyc()">Enviar para revisión</button>
                    </div>
                </div>
            </div>
        `;
        window._kycUrls = { front: null, back: null, selfie: null };
    };

    window._kycUpload = async (event, kind) => {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        const cfg = window.CLOUDINARY_CONFIG;
        const hint = $(`_kyc${kind === 'front' ? 'Front' : kind === 'back' ? 'Back' : 'Selfie'}Hint`);
        const prev = $(`_kyc${kind === 'front' ? 'Front' : kind === 'back' ? 'Back' : 'Selfie'}Prev`);
        if (!cfg || !cfg.cloud || !cfg.preset) {
            if (hint) hint.innerHTML = '⚠️ Subida no configurada. Avísale al admin.';
            return;
        }
        if (file.size > 8 * 1024 * 1024) {
            if (hint) hint.textContent = 'La imagen pesa más de 8 MB.';
            return;
        }
        try {
            if (hint) hint.textContent = 'Subiendo...';
            const fd = new FormData();
            fd.append('file', file);
            fd.append('upload_preset', cfg.preset);
            const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloud}/image/upload`, { method: 'POST', body: fd });
            const data = await res.json();
            if (data.secure_url) {
                window._kycUrls[kind] = data.secure_url;
                if (prev) { prev.src = data.secure_url; prev.style.display = 'block'; }
                if (hint) hint.textContent = 'Subida ✓';
            } else throw new Error(data.error?.message || 'Sin URL');
        } catch (err) {
            if (hint) hint.textContent = 'Error: ' + err.message;
        }
    };

    window._submitKyc = async () => {
        const urls = window._kycUrls || {};
        if (!urls.front && !urls.back && !urls.selfie) {
            return showToastSafe('Sube al menos una foto.');
        }
        try {
            const data = await apiCall('/kyc/submit', {
                method: 'POST',
                body: JSON.stringify({
                    cedulaFrontUrl: urls.front || '',
                    cedulaBackUrl: urls.back || '',
                    selfieUrl: urls.selfie || ''
                })
            });
            showToastSafe(data.message || 'Documentos enviados.');
            switchAccountTab('bookings');
        } catch (e) {
            showToastSafe('Error: ' + e.message);
        }
    };

    // ============================================
    // Review form
    // ============================================
    window._openReviewForm = (bookingId, subjectName, direction) => {
        stopChatPolling();
        // direction = 'al dueño' (renter reviewing) or 'al rentador' (owner reviewing)
        const returnTab = direction === 'al rentador' ? 'owner-bookings' : 'bookings';
        const heading = direction === 'al rentador'
            ? `Calificar a ${esc(subjectName)}`
            : `Reseña: ${esc(subjectName)}`;
        const placeholder = direction === 'al rentador'
            ? '¿El rentador fue puntual y cuidó el vehículo?'
            : '¿Cómo te trataron? ¿El vehículo estaba como esperabas?';
        $('accountContent').innerHTML = `
            <div class="card" style="padding:18px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <h3 style="margin:0;">${heading}</h3>
                    <button class="btn" onclick="switchAccountTab('${returnTab}')">← Volver</button>
                </div>
                <div class="form grid-form">
                    <div class="field span2">
                        <label>Tu calificación</label>
                        <div id="_rvStars" style="font-size:30px; cursor:pointer; user-select:none; letter-spacing:6px;">
                            <span data-n="1">☆</span><span data-n="2">☆</span><span data-n="3">☆</span><span data-n="4">☆</span><span data-n="5">☆</span>
                        </div>
                        <div class="small" id="_rvLabel" style="color:var(--muted,#888); margin-top:4px;">Selecciona de 1 a 5 estrellas</div>
                    </div>
                    <div class="field span2">
                        <label>Comentario (opcional)</label>
                        <textarea id="_rvComment" rows="4" placeholder="${placeholder}"></textarea>
                    </div>
                    <div class="field span2" style="display:flex; gap:8px; justify-content:flex-end;">
                        <button class="btn" onclick="switchAccountTab('${returnTab}')">Cancelar</button>
                        <button class="btn primary" onclick="window._submitReview('${bookingId}', '${returnTab}')">Publicar reseña</button>
                    </div>
                </div>
            </div>
        `;
        window._rvRating = 0;
        document.querySelectorAll('#_rvStars span').forEach(s => {
            s.addEventListener('click', () => {
                const n = Number(s.dataset.n);
                window._rvRating = n;
                document.querySelectorAll('#_rvStars span').forEach(x => {
                    x.textContent = Number(x.dataset.n) <= n ? '★' : '☆';
                });
                const labels = ['','Pésimo','Malo','Regular','Bueno','Excelente'];
                $('_rvLabel').textContent = labels[n] + ' (' + n + '/5)';
            });
        });
    };

    window._submitReview = async (bookingId, returnTab) => {
        const rating = window._rvRating || 0;
        const comment = ($('_rvComment')?.value || '').trim();
        if (rating < 1) return showToastSafe('Selecciona una calificación.');
        try {
            const data = await apiCall('/reviews', {
                method: 'POST',
                body: JSON.stringify({ bookingId, rating, comment })
            });
            showToastSafe(data.message || 'Reseña publicada.');
            switchAccountTab(returnTab || 'bookings');
        } catch (e) {
            showToastSafe('Error: ' + e.message);
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
        } catch (e) { showToastSafe('Error: ' + e.message); }
    };

    window.completeBooking = async (id) => {
        if (!confirm('¿Marcar como completada? Esto liberará el depósito (o aplicará penalidad si hay retraso).')) return;
        try {
            const data = await apiCall(`/bookings/${id}/complete`, { method: 'POST' });
            showToastSafe(data.message || 'Reserva completada.');
            switchAccountTab('bookings');
        } catch (e) { showToastSafe('Error: ' + e.message); }
    };

    window.deleteCar = async (id) => {
        if (!confirm('¿Eliminar este vehículo del catálogo? No se puede deshacer.')) return;
        try {
            await apiCall(`/cars/${id}`, { method: 'DELETE' });
            showToastSafe('Vehículo eliminado.');
            switchAccountTab('cars');
        } catch (e) { showToastSafe('Error: ' + e.message); }
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
        if (close) close.addEventListener('click', () => {
            stopChatPolling();
            $('accountBackdrop').style.display = 'none';
        });

        const backdrop = $('accountBackdrop');
        if (backdrop) backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                stopChatPolling();
                backdrop.style.display = 'none';
            }
        });

        const refreshBtn = () => {
            if (!btn) return;
            btn.style.display = token() ? '' : 'none';
        };
        refreshBtn();

        window.addEventListener('storage', refreshBtn);
        setInterval(refreshBtn, 1500);
    });
})();
