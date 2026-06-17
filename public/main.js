// RentaTO — frontend monolito (vanilla JS). Land / Water / Air taxonomy.
const $ = (id) => document.getElementById(id);
const API_BASE = window.RENTARD_API_BASE || '/api';

let cars = [];
let currentUser = JSON.parse(localStorage.getItem('rentard_user')) || null;
let token = localStorage.getItem('rentard_token') || null;
let currentDomain = 'ALL';
let activeCarId = null; // Store for modal operations

window.setDomain = (domain) => {
  currentDomain = domain;
  ['all', 'land', 'water', 'air'].forEach(d => {
    const el = $(`domain-${d}`);
    if (el) el.classList.toggle('active', d.toUpperCase() === domain);
  });
  handleSearch();
};

const saveSession = (data) => {
  currentUser = data.user;
  token = data.token;
  localStorage.setItem('rentard_user', JSON.stringify(currentUser));
  localStorage.setItem('rentard_token', token);
  updateAuthUI();
};

const logout = () => {
  currentUser = null;
  token = null;
  localStorage.removeItem('rentard_user');
  localStorage.removeItem('rentard_token');
  updateAuthUI();
  showToast('Sesión cerrada.');
};
window.logout = logout;

const updateAuthUI = () => {
  const loginBtn = $('openPublishTop');
  if (currentUser) {
    if (loginBtn) loginBtn.innerText = `Salir (${currentUser.name.split(' ')[0]})`;
  } else {
    if (loginBtn) loginBtn.innerText = 'Login / Publicar';
  }
};

const domainLabel = (d) => ({ LAND: 'Terrestre', WATER: 'Acuático', AIR: 'Aéreo' }[d] || d);
const formatCurrency = (val) => {
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(val);
};

// ==========================
// Backend Comms
// ==========================
const fetchCars = async (q = '', loc = '', type = '') => {
  try {
    const params = new URLSearchParams({ q, loc, type });
    if (currentDomain && currentDomain !== 'ALL') params.set('domain', currentDomain);
    const minP = $('minPrice')?.value;
    const maxP = $('maxPrice')?.value;
    const minC = $('minCapacity')?.value;
    if (minP) params.set('minPrice', minP);
    if (maxP) params.set('maxPrice', maxP);
    if (minC) params.set('minCapacity', minC);
    const res = await fetch(`${API_BASE}/cars?${params}`);
    cars = await res.json();
    renderListings(cars, 'listings');
  } catch (err) {
    showToast('No se pudo conectar con el servidor. Intenta de nuevo.');
  }
};

const fetchRecommendations = async () => {
  if (!token) return;
  try {
    const res = await fetch(`${API_BASE}/cars/recommendations`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const recs = await res.json();
    if (recs && recs.length > 0) {
      $('recommendations').style.display = 'block';
      renderListings(recs, 'recommendedListings');
    }
  } catch (err) { console.error('Error cargando recomendaciones', err); }
};

// ==========================
// Rendering
// ==========================
function renderListings(list, containerId) {
  const wrap = $(containerId);
  if (!wrap) return;
  wrap.innerHTML = "";

  if (!list.length) {
    wrap.innerHTML = `<div class="wide" style="grid-column: span 12;">
        <b>No encontramos vehículos.</b><div class="small" style="margin-top:6px">Cambia el tipo (Terrestre, Acuático, Aéreo) o ajusta la búsqueda.</div>
      </div>`;
    return;
  }

  list.forEach(c => {
    const el = document.createElement("article");
    el.className = "car";

    const badgeVerify = c.verified || c.dnaStatus === 'VERIFIED'
      ? `<span class="badge2 ok">Verificado</span>`
      : `<span class="badge2 warn">En revisión</span>`;

    const ratingBadge = (c.reviewCount && c.reviewCount > 0)
      ? `<span class="badge2">★ ${Number(c.rating).toFixed(1)} (${c.reviewCount})</span>`
      : `<span class="badge2">Sin reseñas aún</span>`;

    el.innerHTML = `
        <div class="img" style="background-image: url('${c.image || 'https://images.unsplash.com/photo-1542362567-b05503f35259'}')"></div>
        <div class="body">
          <div class="row">
            <div>
              <h3>${c.brand} ${c.model} (${c.year})</h3>
              <div class="meta">${domainLabel(c.domain)} • ${c.category || c.type} • ${c.location}</div>
            </div>
            <div class="price">${formatCurrency(c.price)}/día</div>
          </div>
          <div class="badges">
            ${badgeVerify}
            ${ratingBadge}
            <span class="badge2">Depósito: ${formatCurrency(c.deposit)}</span>
            <span class="badge2">Cualquier año</span>
          </div>
          <div class="meta" style="margin-top:8px">${c.note || 'Sin descripción.'}</div>
        </div>
        <div class="actions">
          <button class="btn primary view-btn" data-id="${c.id}">Ver y Reservar</button>
        </div>
      `;
    wrap.appendChild(el);
  });

  wrap.querySelectorAll(".view-btn").forEach(btn => {
    btn.addEventListener("click", () => openDetails(btn.getAttribute("data-id")));
  });
}

// ==========================
// FeatureEngine (Informational Modals)
// ==========================
window.openFeature = (type) => {
  const features = {
    limited: {
      title: 'Cualquier año, sin límite',
      body: 'En RentaTO el año del vehículo no descalifica. Lo que importa es que esté en buen estado mecánico y estético. Desde clásicos hasta último modelo, cualquier vehículo puede publicarse si cumple con el chequeo básico de seguridad.'
    },
    verification: {
      title: 'Verificación de identidad y del vehículo',
      body: 'Cada usuario pasa por una verificación de identidad. El vehículo se publica con fotos y datos básicos para que tanto dueño como cliente sepan exactamente lo que se está alquilando.'
    },
    escrow: {
      title: 'Depósito protegido',
      body: 'El depósito de garantía se retiene durante la renta y se libera al devolver el vehículo en buen estado. Si hay daños o multas, queda como respaldo para resolverlos sin pleitos.'
    },
    neural: {
      title: 'Reseñas y reputación',
      body: 'Después de cada renta, ambas partes pueden calificarse con estrellas y comentarios. Esa reputación queda visible en el perfil y ayuda a otros usuarios a confiar.'
    }
  };

  const feat = features[type];
  if (!feat) return;

  $('detailsTitle').textContent = feat.title;
  $('detailsContent').innerHTML = `
    <div class="panel">
      <p style="font-size: 1.1rem; line-height: 1.6; color: var(--muted);">${feat.body}</p>
      <div style="margin-top: 20px; text-align: center;">
        <button class="btn primary" onclick="$('detailsBackdrop').style.display='none'">Entendido</button>
      </div>
    </div>
  `;
  $('detailsBackdrop').style.display = 'flex';
};

// ==========================
// Modal Operations
// ==========================
window.openDetails = (id) => {
  const car = cars.find(x => x.id === id);
  if (!car) return;
  activeCarId = id;

  const trustScore = car.owner && car.owner.trustScore ? car.owner.trustScore : 88;
  $('detailsTitle').textContent = `${car.brand} ${car.model} (${car.year})`;

  $('detailsContent').innerHTML = `
        <div class="modal-grid">
            <div class="panel">
                <h4>Detalles del vehículo</h4>
                <div class="kv">
                    <b>Tipo:</b> ${domainLabel(car.domain)}<br/>
                    <b>Categoría:</b> ${car.category || car.type} • <b>Transmisión:</b> ${car.transmission === 'MANUAL' ? 'Mecánica' : 'Automática'}<br/>
                    <b>Combustible:</b> ${car.energyType || 'GASOLINE'} • <b>Capacidad:</b> ${car.capacity || 4} personas<br/>
                    <b>Autonomía:</b> ${car.fuelRange || 500} km<br/>
                    <b>Placa:</b> ${car.licensePlate || 'N/D'}<br/>
                    <b>Licencia requerida:</b> ${car.requiresOperatorLevel || 'STANDARD_LICENSE'}<br/>
                    <br/>
                    <b>Dueño:</b> ${car.owner ? car.owner.name : '—'} (Reputación: ${trustScore}%)<br/>
                    <b>Reseñas:</b> ${car.reviewCount > 0 ? `★ ${Number(car.rating).toFixed(1)} (${car.reviewCount} reseña${car.reviewCount === 1 ? '' : 's'})` : 'Aún sin reseñas'}<br/>
                    <b>Ubicación:</b> ${car.location}<br/>
                    <b>Precio:</b> ${formatCurrency(car.price)}/día<br/>
                    <b>Depósito de garantía:</b> ${formatCurrency(car.deposit)}<br/>
                    <br/>
                    <b>Descripción:</b> ${car.note || 'Sin descripción.'}
                </div>
                <div class="small" style="margin-top:15px; color: var(--warn)">Toda renta se rige por las leyes dominicanas aplicables (Tránsito 63-17, Seguros 146-02, Firmas Digitales 126-02).</div>
            </div>

            <div class="panel">
                <h4>Reservar</h4>
                <div class="form">
                    <div class="field">
                        <label>Fecha de entrega</label>
                        <input id="bkStart" type="date">
                    </div>
                    <div class="field">
                        <label>Fecha de devolución</label>
                        <input id="bkEnd" type="date">
                    </div>
                    <div class="field span2">
                        <label style="display:flex; gap:8px; align-items:flex-start;">
                        <input id="bkAgree" type="checkbox" style="margin-top:2px">
                        <span class="small">Acepto las condiciones de uso. Entiendo que el depósito de garantía queda retenido durante la renta.</span>
                        </label>
                    </div>
                    <div class="field span2">
                        <button class="btn primary" id="bkConfirm" type="button" onclick="reserveCar()">Reservar ahora</button>
                    </div>
                    <div class="field span2 small" style="color:var(--muted,#888);">
                        Después de reservar podrás chatear con el dueño desde <b>Mi Cuenta → Mis Reservas</b>.
                    </div>
                </div>
            </div>
        </div>
    `;

  $('detailsBackdrop').style.display = "flex";
};

window.reserveCar = async () => {
  if (!token) return showToast('Inicia sesión primero para reservar.');
  const start = $('bkStart').value;
  const end = $('bkEnd').value;
  if (!start || !end || !$('bkAgree').checked) return showToast('Completa las fechas y acepta las condiciones.');

  const car = cars.find(c => c.id === activeCarId);
  if (!car) return;

  try {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ carId: car.id, startDate: new Date(start), endDate: new Date(end), totalPrice: car.price })
    });
    const data = await res.json();
    showToast(data.message || (res.ok ? 'Reserva confirmada.' : (data.error || 'No se pudo reservar.')));
    if (res.ok) $('detailsBackdrop').style.display = 'none';
    fetchCars();
  } catch (err) {
    showToast('No se pudo conectar con el servidor.');
  }
};

// ==========================
// Constants & Helpers
// ==========================
const PROVINCES = [
  "Azua", "Bahoruco", "Barahona", "Dajabón", "Distrito Nacional", "Duarte",
  "El Seibo", "Elías Piña", "Espaillat", "Hato Mayor", "Hermanas Mirabal",
  "Independencia", "La Altagracia", "La Romana", "La Vega", "María Trinidad Sánchez",
  "Monseñor Nouel", "Monte Cristi", "Monte Plata", "Pedernales", "Peravia",
  "Puerto Plata", "Samaná", "San Cristóbal", "San José de Ocoa", "San Juan",
  "San Pedro de Macorís", "Sánchez Ramírez", "Santiago", "Santiago Rodríguez", "Valverde"
];

// Booking chat lives inside Mi Cuenta (account.js); no global sendChat here.

window.openPublish = () => {
  if (!token) {
    $('publishFormContent').innerHTML = `
        <div class="panel" style="max-width:400px; margin:0 auto;">
            <div id="authTabs" style="display:flex; gap:8px; margin-bottom:16px;">
                <button class="btn primary" id="tabLogin" type="button" onclick="switchAuthMode('login')" style="flex:1;">Iniciar Sesión</button>
                <button class="btn" id="tabRegister" type="button" onclick="switchAuthMode('register')" style="flex:1;">Registrarse</button>
            </div>
            <div class="form" style="display:flex; flex-direction:column; gap:12px;">
                <input class="btn" id="authName" placeholder="Nombre completo" type="text" style="display:none;" />
                <input class="btn" id="authEmail" placeholder="Correo" type="email" />
                <input class="btn" id="authPass" type="password" placeholder="Contraseña (mín. 8 caracteres)" />
                <select class="btn" id="authRole" style="display:none;">
                    <option value="RENTER">Quiero rentar vehículos</option>
                    <option value="OWNER">Quiero publicar mis vehículos</option>
                </select>
                <button class="btn primary" id="authSubmit" onclick="handleAuth()">Acceder</button>
                <div class="small text-center">Tus datos quedan protegidos. Solo los usamos para verificar identidad.</div>
            </div>
        </div>`;
    window.authMode = 'login';
  } else {
    $('publishFormContent').innerHTML = `
        <div class="panel">
            <div class="form grid-form">
                <div class="field span2 text-center" style="margin-bottom:10px;">
                    <div style="font-weight:700; font-size:1.1rem; color:var(--primary);">Publica tu vehículo</div>
                    <div class="small" style="color:var(--muted,#888);">Carros, motores, lanchas, jetskis y más. Cualquier año.</div>
                </div>
                <div class="field">
                    <label>Tipo de vehículo</label>
                    <select id="pDom" onchange="updatePubCatsAndDefaults()">
                        <option value="LAND">Terrestre (carro, motor, jeepeta...)</option>
                        <option value="WATER">Acuático (lancha, jetski, yate...)</option>
                        <option value="AIR">Aéreo (avioneta, helicóptero...)</option>
                    </select>
                </div>
                <div class="field">
                    <label>Combustible</label>
                    <select id="pEnergy">
                        <option value="GASOLINE">Gasolina</option>
                        <option value="DIESEL">Gasoil / Diesel</option>
                        <option value="ELECTRIC">Eléctrico</option>
                        <option value="HYBRID">Híbrido</option>
                        <option value="JET_FUEL">Combustible de avión</option>
                        <option value="HUMAN">Sin motor (pedal / remo)</option>
                    </select>
                </div>
                <div class="field">
                    <label>Categoría</label>
                    <select id="pCat"></select>
                </div>
                <div class="field">
                    <label>Capacidad (personas)</label>
                    <input id="pCapacity" type="number" value="5" placeholder="¿Cuántas personas caben?" />
                </div>
                <div class="field">
                    <label>Año</label>
                    <input id="pYear" type="number" placeholder="Ej: 2018" />
                </div>
                <div class="field">
                    <label>Marca</label>
                    <input id="pBrand" placeholder="Ej: Toyota, Honda, Yamaha" />
                </div>
                <div class="field">
                    <label>Modelo</label>
                    <input id="pModel" placeholder="Ej: Corolla, Civic" />
                </div>
                <div class="field">
                    <label>Transmisión</label>
                    <select id="pTrans">
                        <option value="AUTOMATIC">Automática</option>
                        <option value="MANUAL">Mecánica / Sincrónica</option>
                    </select>
                </div>
                <div class="field">
                    <label>Precio por día (RD$)</label>
                    <input id="pPrice" type="number" placeholder="Ej: 2500" />
                </div>
                <div class="field">
                    <label>Depósito de garantía (RD$)</label>
                    <input id="pDeposit" type="number" placeholder="Se devuelve al final si todo va bien" />
                </div>
                <div class="field span2">
                    <label>Foto del vehículo</label>
                    <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                        <input id="pImageFile" type="file" accept="image/*" capture="environment" style="flex:1; min-width:200px;" onchange="uploadCarImage(event)" />
                        <span class="small" style="color:var(--muted,#888);">o pega un enlace abajo</span>
                    </div>
                    <input id="pImage" type="url" placeholder="https://..." oninput="previewImage()" style="margin-top:6px; width:100%;" />
                    <div class="small" id="pImageHint" style="color:var(--muted,#888); margin-top:4px;">
                        Toma una foto con tu teléfono o pega un enlace de imagen.
                    </div>
                    <img id="pImagePreview" style="display:none; margin-top:8px; max-width:200px; border-radius:8px;" />
                </div>
                <div class="field">
                    <label>Placa o matrícula</label>
                    <input id="pPlate" placeholder="Ej: A839211" />
                </div>
                <div class="field">
                    <label>Número de chasis (opcional)</label>
                    <input id="pChassis" placeholder="Opcional" />
                </div>
                <div class="field">
                    <label>¿Cuántos KM rinde el tanque? (opcional)</label>
                    <input type="number" id="pRange" value="500" placeholder="Ej: 500" />
                </div>
                <div class="field">
                    <label>Licencia requerida para conducirlo</label>
                    <select id="pOperator">
                        <option value="STANDARD_LICENSE">Licencia normal de conducir</option>
                        <option value="MOTORCYCLE_LICENSE">Licencia de motor</option>
                        <option value="CAPTAIN_LICENSE">Licencia de capitán/patrón</option>
                        <option value="PILOT_LICENSE">Licencia de piloto</option>
                        <option value="NONE">Ninguna (bici, kayak...)</option>
                    </select>
                </div>
                <input type="hidden" id="pSafety" value="land_standard" />
                <div class="field span2">
                    <label>¿En qué provincia se entrega?</label>
                    <select id="pLoc">
                        <option value="">Selecciona la provincia</option>
                        ${PROVINCES.map(p => `<option value="${p}">${p}</option>`).join('')}
                    </select>
                </div>
                <div class="field span2">
                    <label>Descripción</label>
                    <textarea id="pNote" placeholder="Cuéntale a la gente sobre tu vehículo: estado, qué incluye, condiciones de uso..."></textarea>
                </div>
                <div class="field span2">
                    <div class="small" style="color:var(--muted,#888); margin-bottom:8px; text-align:center;">
                        Tu publicación pasará por una revisión rápida de nuestro equipo antes de aparecer en el catálogo.
                    </div>
                    <button class="btn primary" style="width: 100%;" onclick="publishCar()">Publicar mi vehículo</button>
                </div>
            </div>
        </div>`;
    updatePubCatsAndDefaults();
  }
  $('publishBackdrop').style.display = 'flex';
};

window.updatePubCatsAndDefaults = () => {
  const dom = $('pDom').value;
  const cat = $('pCat');
  if (!cat) return;
  const opts = {
    LAND: ['Sedan', 'Jeepeta', 'Pickup', 'Micro'],
    WATER: ['Bote', 'JetSki', 'Yate', 'Catamarán'],
    AIR: ['Helicóptero', 'Avioneta', 'Jet']
  };
  cat.innerHTML = opts[dom].map(o => `<option value="${o}">${o}</option>`).join('');

  // Update default safety profile and operator levels based on selected domain
  const safety = $('pSafety');
  const operator = $('pOperator');
  const energy = $('pEnergy');
  
  if (dom === 'LAND') {
    if (safety) safety.value = 'land_standard';
    if (operator) operator.value = 'STANDARD_LICENSE';
    if (energy) energy.value = 'GASOLINE';
  } else if (dom === 'WATER') {
    if (safety) safety.value = 'water_standard';
    if (operator) operator.value = 'CAPTAIN_LICENSE';
    if (energy) energy.value = 'DIESEL';
  } else if (dom === 'AIR') {
    if (safety) safety.value = 'air_standard';
    if (operator) operator.value = 'PILOT_LICENSE';
    if (energy) energy.value = 'JET_FUEL';
  }
};

window.switchAuthMode = (mode) => {
  window.authMode = mode;
  const isReg = mode === 'register';
  const nameField = $('authName');
  const roleField = $('authRole');
  const submitBtn = $('authSubmit');
  const tabLogin = $('tabLogin');
  const tabRegister = $('tabRegister');
  if (nameField) nameField.style.display = isReg ? 'block' : 'none';
  if (roleField) roleField.style.display = isReg ? 'block' : 'none';
  if (submitBtn) submitBtn.textContent = isReg ? 'Crear Cuenta' : 'Acceder';
  if (tabLogin) tabLogin.className = isReg ? 'btn' : 'btn primary';
  if (tabRegister) tabRegister.className = isReg ? 'btn primary' : 'btn';
};

window.handleAuth = async () => {
  const mode = window.authMode || 'login';
  const email = $('authEmail').value.trim();
  const pass = $('authPass').value;

  if (!email || !pass) return showToast('Completa correo y contraseña.');

  if (mode === 'register') {
    const name = $('authName').value.trim();
    const role = $('authRole').value;
    if (!name) return showToast('Ingresa tu nombre.');
    if (pass.length < 8) return showToast('La contraseña debe tener al menos 8 caracteres.');

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass, name, role })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Cuenta creada. Iniciando sesión...');
        // Auto-login after register
        await doLogin(email, pass);
      } else {
        const msg = data.issues ? data.issues.map(i => i.message).join('. ') : data.error;
        showToast('No se pudo registrar: ' + msg);
      }
    } catch (err) { showToast('Servidor no disponible.'); }
    return;
  }

  // login mode
  await doLogin(email, pass);
};

const doLogin = async (email, pass) => {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass })
    });
    const data = await res.json();
    if (res.ok) {
      saveSession(data);
      openPublish();
      showToast('Sesión iniciada.');
      fetchRecommendations();
    } else {
      showToast('Acceso denegado: ' + (data.error || 'credenciales inválidas'));
    }
  } catch (err) { showToast('Servidor no disponible.'); }
};

// Backward-compat: keep handleLogin working if referenced elsewhere
window.handleLogin = () => doLogin($('authEmail').value.trim(), $('authPass').value);

window.previewImage = () => {
  const url = $('pImage').value.trim();
  const preview = $('pImagePreview');
  if (!preview) return;
  if (url && /^https?:\/\//.test(url)) {
    preview.src = url;
    preview.style.display = 'block';
    preview.onerror = () => { preview.style.display = 'none'; };
  } else {
    preview.style.display = 'none';
  }
};

// --- Cloudinary unsigned upload (graceful fallback to URL paste) ---
// To enable, set in window before main.js runs:
//   window.CLOUDINARY_CONFIG = { cloud: 'tu_cloud_name', preset: 'tu_unsigned_preset' };
// You can also place it in index.html as an inline <script> before the main.js include.
window.uploadCarImage = async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const cfg = window.CLOUDINARY_CONFIG;
  const hint = $('pImageHint');
  if (!cfg || !cfg.cloud || !cfg.preset) {
    if (hint) hint.innerHTML = '⚠️ Subida directa aún no configurada. Por ahora pega un enlace de imagen abajo.';
    showToast('Aún no se ha configurado el servicio de subida de fotos. Usa un enlace por ahora.');
    event.target.value = '';
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    showToast('La imagen pesa más de 8 MB. Comprime o usa otra.');
    return;
  }
  try {
    if (hint) hint.textContent = 'Subiendo foto...';
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', cfg.preset);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloud}/image/upload`, {
      method: 'POST',
      body: fd
    });
    const data = await res.json();
    if (data.secure_url) {
      $('pImage').value = data.secure_url;
      previewImage();
      if (hint) hint.textContent = 'Foto subida correctamente.';
      showToast('Foto subida.');
    } else {
      throw new Error(data.error?.message || 'Sin URL devuelta');
    }
  } catch (err) {
    if (hint) hint.textContent = 'No se pudo subir la foto. Intenta con un enlace.';
    showToast('No se pudo subir la foto: ' + err.message);
  }
};

window.publishCar = async () => {
  const payload = {
    domain: $('pDom').value,
    energyType: $('pEnergy').value,
    category: $('pCat').value,
    type: $('pCat').value, // Legacy fallback
    year: $('pYear').value,
    brand: $('pBrand').value,
    model: $('pModel').value,
    price: $('pPrice').value,
    deposit: $('pDeposit').value,
    location: $('pLoc').value,
    note: $('pNote').value,
    image: $('pImage') ? $('pImage').value.trim() : '',
    transmission: $('pTrans').value,
    capacity: $('pCapacity').value,
    licensePlate: $('pPlate').value,
    chassisNumber: $('pChassis').value,
    fuelRange: $('pRange').value,
    requiresOperatorLevel: $('pOperator').value,
    safetyProfile: $('pSafety').value
  };

  if (!payload.brand || !payload.model) return showToast('Completa la marca y el modelo.');
  if (!payload.price || Number(payload.price) <= 0) return showToast('Indica un precio por día válido.');
  if (!payload.year) return showToast('Indica el año del vehículo.');
  if (!payload.location) return showToast('Selecciona la provincia de entrega.');

  try {
    const res = await fetch(`${API_BASE}/cars`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message || 'Tu vehículo fue enviado a revisión.');
      $('publishBackdrop').style.display = 'none';
      fetchCars();
    } else {
      const msg = data.issues ? data.issues.map(i => i.message).join('. ') : (data.error || 'No se pudo publicar.');
      showToast(msg);
    }
  } catch (err) { showToast('No se pudo conectar con el servidor.'); }
};

// ==========================
// Utilities / Init
// ==========================
function handleSearch() {
  fetchCars($('q').value, $('loc').value, $('type').value);
}

let toastTimer;
function showToast(text) {
  clearTimeout(toastTimer);
  let t = $('toast');
  if (t) {
    t.innerText = text;
    t.style.opacity = '1';
    toastTimer = setTimeout(() => { t.style.opacity = '0'; }, 3000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  $('year').textContent = new Date().getFullYear();
  updateAuthUI();

  fetchCars();
  fetchRecommendations();

  // Basic Hook Ups
  if ($('go')) $('go').onclick = handleSearch;

  if ($('domain-all')) $('domain-all').onclick = () => setDomain('ALL');
  if ($('domain-land')) $('domain-land').onclick = () => setDomain('LAND');
  if ($('domain-water')) $('domain-water').onclick = () => setDomain('WATER');
  if ($('domain-air')) $('domain-air').onclick = () => setDomain('AIR');

  // Submit search on Enter from any filter input
  ['q', 'minPrice', 'maxPrice', 'minCapacity'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSearch(); });
  });
  ['loc', 'type'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('change', handleSearch);
  });

  ['openPublishHero', 'openPublishTop'].forEach(id => {
    if ($(id)) $(id).onclick = () => {
      if (id === 'openPublishTop' && currentUser) {
        logout();
      } else {
        openPublish();
      }
    };
  });

  // Nav "Publicar Vehículo" links → open publish modal (login form if not authed)
  ['navPublicar', 'navPublicarMobile'].forEach(id => {
    if ($(id)) $(id).onclick = (e) => { e.preventDefault(); openPublish(); };
  });

  if ($('closeDetails')) $('closeDetails').onclick = () => $('detailsBackdrop').style.display = 'none';
  if ($('closePublish')) $('closePublish').onclick = () => $('publishBackdrop').style.display = 'none';

  if ($('detailsBackdrop')) $('detailsBackdrop').addEventListener('click', (e) => {
    if (e.target === $('detailsBackdrop')) $('detailsBackdrop').style.display = 'none';
  });
  if ($('publishBackdrop')) $('publishBackdrop').addEventListener('click', (e) => {
    if (e.target === $('publishBackdrop')) $('publishBackdrop').style.display = 'none';
  });

  // --- Mobile Menu Toggle ---
  const menuBtn = $('menuBtn');
  const mobileMenu = $('mobileMenu');
  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', () => {
      const isVisible = mobileMenu.style.display === 'flex';
      mobileMenu.style.display = isVisible ? 'none' : 'flex';
      menuBtn.setAttribute('aria-expanded', !isVisible);
    });

    // Close menu when clicking links
    mobileMenu.querySelectorAll('.btn').forEach(link => {
      link.addEventListener('click', () => {
        mobileMenu.style.display = 'none';
        menuBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }
});
