// RENTARD | Supremacía x1000 - Universal Taxonomy (Land, Water, Air)
const $ = (id) => document.getElementById(id);
const API_BASE = 'http://localhost:3000/api';

let cars = [];
let currentUser = JSON.parse(localStorage.getItem('rentard_user')) || null;
let token = localStorage.getItem('rentard_token') || null;
let currentDomain = 'LAND';
let activeCarId = null; // Store for modal operations

window.setDomain = (domain) => {
  currentDomain = domain;
  ['land', 'water', 'air'].forEach(d => {
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
};

const updateAuthUI = () => {
  const loginBtn = $('openPublishTop');
  if (currentUser) {
    if (loginBtn) loginBtn.innerText = `DNA: ${currentUser.name}`;
  } else {
    if (loginBtn) loginBtn.innerText = 'Login / Publicar';
  }
};

const formatCurrency = (val) => {
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(val);
};

// ==========================
// Backend Comms
// ==========================
const fetchCars = async (q = '', loc = '', type = '') => {
  try {
    const params = new URLSearchParams({ q, loc, type, domain: currentDomain });
    const res = await fetch(`${API_BASE}/cars?${params}`);
    cars = await res.json();
    renderListings(cars, 'listings');
  } catch (err) {
    showToast('Fallo en conexión con servidores universales.');
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
  } catch (err) { console.error('Recommendation Sync Error', err); }
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
        <b>Cero activos localizados.</b><div class="small" style="margin-top:6px">Cambia tu dominio (Terrestre, Acuático, Aéreo) o ajusta la búsqueda.</div>
      </div>`;
    return;
  }

  list.forEach(c => {
    const el = document.createElement("article");
    el.className = "car";

    const badgeVerify = c.verified || c.dnaStatus === 'VERIFIED'
      ? `<span class="badge2 ok">Verificado Legalmente</span>`
      : `<span class="badge2 warn">Pendiente Verificación</span>`;

    el.innerHTML = `
        <div class="img" style="background-image: url('${c.image || 'https://images.unsplash.com/photo-1542362567-b05503f35259'}')"></div>
        <div class="body">
          <div class="row">
            <div>
              <h3>${c.brand} ${c.model} (${c.year})</h3>
              <div class="meta">${c.domain} • ${c.category || c.type} • Ubicación Cero: ${c.location}</div>
            </div>
            <div class="price">${formatCurrency(c.price)}/día</div>
          </div>
          <div class="badges">
            ${badgeVerify}
            <span class="badge2">Deposit: ${formatCurrency(c.deposit)}</span>
            <span class="badge2">Cualquier Año</span>
          </div>
          <div class="meta" style="margin-top:8px">${c.note || 'Asset DNA Registrado en Ledger WORM.'}</div>
        </div>
        <div class="actions">
          <button class="btn primary view-btn" data-id="${c.id}">Inspeccionar y Reservar</button>
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
      title: 'Polisémica Universal: Sin Límite de Año',
      body: 'En RENTARD, el año del vehículo no es un factor de exclusión. Nos enfocamos en la integridad mecánica y estética. Cualquier modelo, desde clásicos hasta último modelo, puede ser inyectado al ecosistema si cumple con el Protocolo de Seguridad.'
    },
    verification: {
      title: 'Verificación de Identidad y Activo',
      body: 'Cada usuario pasa por un proceso de KYC (Know Your Customer) biométrico. El vehículo es inspeccionado digitalmente mediante un checklist de 21 puntos y fotos en tiempo real con hashing SHA-256 para garantizar transparencia total.'
    },
    escrow: {
      title: 'Smart Escrow: Protección Total',
      body: 'Los fondos de reserva y el depósito de garantía se mantienen en un contrato inteligente de custodia (Escrow). Solo se liberan tras la confirmación mutua de entrega exitosa, protegiendo tanto al dueño como al rentador de cualquier eventualidad.'
    },
    neural: {
      title: 'Reputación Neural y Feedback',
      body: 'El sistema Neural analiza el comportamiento histórico de los usuarios para generar un Trust Score (Social DNA). Las estrellas y comentarios no son solo texto; son trazas de confianza que determinan el acceso a activos de mayor nivel.'
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
  $('detailsTitle').textContent = `Mapeo Jurídico: ${car.brand} ${car.model} (${car.year})`;

  $('detailsContent').innerHTML = `
        <div class="modal-grid">
            <div class="panel">
                <h4>Detalles Técnicos y Contractuales</h4>
                <div class="kv">
                    <b>ID de Hash:</b> ${car.id}<br/>
                    <b>Dominio:</b> ${car.domain}<br/>
                    <b>Categoría:</b> ${car.category || car.type} • <b>Transmisión:</b> ${car.transmission || 'AUTOMATIC'}<br/>
                    <b>Tipo de Energía:</b> ${car.energyType || 'GASOLINE'} • <b>Capacidad:</b> ${car.capacity || 4} pers.<br/>
                    <b>Autonomía:</b> ${car.fuelRange || 500} KM/Millas<br/>
                    <b>Placa/Registro:</b> ${car.licensePlate || 'N/D'}<br/>
                    <b>Chasis/VIN:</b> ${car.chassisNumber || 'N/D'}<br/>
                    <b>Nivel Operador:</b> ${car.requiresOperatorLevel || 'STANDARD_LICENSE'}<br/>
                    <b>Perfil Seguridad:</b> <span class="badge2 ok" style="padding: 2px 6px; font-size: 10px;">${car.safetyProfile || 'land_standard'}</span><br/>
                    <br/>
                    <b>Propietario / Trust:</b> ${car.owner ? car.owner.name : 'VVIP'} (Score: ${trustScore}%)<br/>
                    <b>Ubicación Cero:</b> ${car.location}<br/>
                    <b>Tarifa Diaria:</b> ${formatCurrency(car.price)}/día<br/>
                    <b>Póliza Smart Escrow:</b> ${formatCurrency(car.deposit)}<br/>
                    <br/>
                    <b>Condiciones Reportadas:</b> ${car.note || 'Sin reportes irregulares.'}
                </div>
                <div class="small" style="margin-top:15px; color: var(--warn)">Recordatorio: Todo contrato se ampara bajo las Leyes 126-02 (Firmas Digitales), 63-17 (Tránsito), 146-02 (Seguros), y regulaciones sectoriales (IDAC/Armada).</div>
            </div>
            
            <div class="panel">
                <h4>Reservar (Escrow Integrado)</h4>
                <div class="form">
                    <div class="field">
                        <label>Extracción Start</label>
                        <input id="bkStart" type="date">
                    </div>
                    <div class="field">
                        <label>Retorno Final</label>
                        <input id="bkEnd" type="date">
                    </div>
                    <div class="field span2">
                        <label style="display:flex; gap:8px; align-items:flex-start;">
                        <input id="bkAgree" type="checkbox" style="margin-top:2px">
                        <span class="small">Acepto los términos de la Taxonomía Universal y me declaro portador de las credenciales adecuadas. Admito ser retenido el depósito de daños.</span>
                        </label>
                    </div>
                    <div class="field span2">
                        <button class="btn primary" id="bkConfirm" type="button" onclick="reserveCar()">Firma de Escrow Neural</button>
                    </div>
                </div>
            </div>
            
            <div class="panel" style="grid-column: span 2;">
                <h4>Comunicaciones Neurales con Propietario</h4>
                <div class="chatbox">
                    <div class="chatlog" id="chatMessages" aria-label="Mensajes">Esperando sincronización...</div>
                    <div style="display:flex; gap:8px;">
                        <input id="chatInput" placeholder="Emitir traza neural..." style="flex:1" class="btn" />
                        <button class="btn primary" onclick="sendChat()">Enviar</button>
                    </div>
                </div>
            </div>
        </div>
    `;

  $('detailsBackdrop').style.display = "flex";
};

window.reserveCar = async () => {
  if (!token) return showToast('Petición Abortada: Requiere Identidad Neural (Iniciar Sesión).');
  const start = $('bkStart').value;
  const end = $('bkEnd').value;
  if (!start || !end || !$('bkAgree').checked) return showToast('Valida fechas y condiciones de la Póliza Escrow.');

  const car = cars.find(c => c.id === activeCarId);
  if (!car) return;

  try {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ carId: car.id, startDate: new Date(start), endDate: new Date(end), totalPrice: car.price })
    });
    const data = await res.json();
    showToast(data.message || 'Escrow sincronizado correctamente.');
    if (res.ok) $('detailsBackdrop').style.display = 'none';
    fetchCars();
  } catch (err) {
    showToast('Escrow Network Denied.');
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

window.sendChat = async () => {
  const input = $('chatInput');
  const content = input.value.trim();
  if (!content || !token) return;

  const car = cars.find(c => c.id === activeCarId);
  if (!car) return;

  try {
    const res = await fetch(`${API_BASE}/chat/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ bookingId: 'general-inquiry', receiverId: car.ownerId, content })
    });
    if (res.ok) {
      $('chatMessages').innerHTML += `<div class="msg me">${content}</div>`;
      input.value = '';
    }
  } catch (err) { showToast('Fallo transmisión neural.'); }
};

window.openPublish = () => {
  if (!token) {
    $('publishFormContent').innerHTML = `
        <div class="panel" style="max-width:400px; margin:0 auto;">
            <h4>Login para Propietarios</h4>
            <div class="form" style="display:flex; flex-direction:column; gap:12px;">
                <input class="btn" id="authEmail" placeholder="Correo" type="email" />
                <input class="btn" id="authPass" type="password" placeholder="Contraseña Neural" />
                <button class="btn primary" onclick="handleLogin()">Acceder</button>
                <div class="small text-center">Protocolo regido por la Ley Biométrica RD.</div>
            </div>
        </div>`;
  } else {
    $('publishFormContent').innerHTML = `
        <div class="panel">
            <div class="form grid-form">
                <div class="field span2 text-center" style="margin-bottom:10px;">
                    <div style="font-weight:700; font-size:1.1rem; color:var(--primary);">Taxonomía Múltiple Soportada</div>
                </div>
                <div class="field">
                    <label>Dominio de Activo</label>
                    <select id="pDom" onchange="updatePubCatsAndDefaults()">
                        <option value="LAND">Terrestre</option>
                        <option value="WATER">Acuático</option>
                        <option value="AIR">Aéreo</option>
                    </select>
                </div>
                <div class="field">
                    <label>Tipo de Energía</label>
                    <select id="pEnergy">
                        <option value="GASOLINE">Gasolina / Automotriz</option>
                        <option value="DIESEL">Gasoil / Marino</option>
                        <option value="ELECTRIC">Eléctrico Pura</option>
                        <option value="JET_FUEL">Jet Fuel / Aeronáutico</option>
                        <option value="HUMAN">Humano (Tracción)</option>
                    </select>
                </div>
                <div class="field">
                    <label>Categoría</label>
                    <select id="pCat"></select>
                </div>
                <div class="field">
                    <label>Transmisión</label>
                    <select id="pTrans">
                        <option value="AUTOMATIC">Automático</option>
                        <option value="MANUAL">Manual</option>
                        <option value="DIRECT_DRIVE">Direct Drive</option>
                        <option value="CVT">CVT</option>
                    </select>
                </div>
                <div class="field">
                    <label>Capacidad (Personas)</label>
                    <input type="number" id="pCapacity" min="1" max="100" value="5" />
                </div>
                <div class="field">
                    <label>Año</label>
                    <input type="number" id="pYear" min="1950" max="2100" placeholder="Ej: 2008" />
                </div>
                <div class="field">
                    <label>Marca</label>
                    <input id="pBrand" placeholder="Ej: Toyota / SeaRay / Cessna" />
                </div>
                <div class="field">
                    <label>Modelo</label>
                    <input id="pModel" placeholder="Ej: Corolla / Bowrider" />
                </div>
                <div class="field">
                    <label>Tarifa Diaria (RD$)</label>
                    <input id="pPrice" type="number" placeholder="Tarifa Base" />
                </div>
                <div class="field">
                    <label>Póliza Escrow (RD$)</label>
                    <input id="pDeposit" type="number" placeholder="Garantía / Retención" />
                </div>
                <div class="field">
                    <label>Identificación de Placa/Registro</label>
                    <input id="pPlate" placeholder="Ej: A839211 o Reg. ID" />
                </div>
                <div class="field">
                    <label>Número de Chasis (VIN/Tail/Hull)</label>
                    <input id="pChassis" placeholder="Ej: VIN8923KJNSDF901" />
                </div>
                <div class="field">
                    <label>Autonomía Estimada (KM/Millas)</label>
                    <input type="number" id="pRange" value="500" placeholder="Autonomía de combustible" />
                </div>
                <div class="field">
                    <label>Licencia / Nivel de Operación</label>
                    <select id="pOperator">
                        <option value="STANDARD_LICENSE">Licencia Estándar (Categoría 2+)</option>
                        <option value="CAPTAIN_LICENSE">Licencia de Capitán (Patrón de Yate)</option>
                        <option value="PILOT_LICENSE">Licencia de Piloto Aviador</option>
                        <option value="NONE">Sin Requerimiento (Bici/Tracción Humana)</option>
                    </select>
                </div>
                <div class="field">
                    <label>Perfil de Seguridad WORM</label>
                    <select id="pSafety">
                        <option value="land_standard">Estándar Terrestre (21 puntos)</option>
                        <option value="water_standard">Inspección de Casco y Salvavidas</option>
                        <option value="air_standard">Inspección de Aeronavegabilidad (FAA/IDAC)</option>
                        <option value="micromobility">Seguridad General</option>
                    </select>
                </div>
                <div class="field span2">
                    <label>Ubicación Cero (Base de Extracción)</label>
                    <select id="pLoc">
                        <option value="">Seleccionar Provincia</option>
                        ${PROVINCES.map(p => `<option value="${p}">${p}</option>`).join('')}
                    </select>
                </div>
                <div class="field span2">
                    <label>Evidencia de Integridad (Notas)</label>
                    <textarea id="pNote" placeholder="Aceptamos cualquier año, describe la condición de uso para evitar Disputas Jurídicas."></textarea>
                </div>
                <div class="field span2">
                    <button class="btn primary" style="width: 100%;" onclick="publishCar()">Inyectar Asset a RENTARD</button>
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

window.handleLogin = async () => {
  const email = $('authEmail').value;
  const pass = $('authPass').value;
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
      showToast('Autorización Concedida.');
      fetchRecommendations();
    } else {
      showToast('Rechazo DNA: ' + data.error);
    }
  } catch (err) { showToast('Server offline.'); }
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
    transmission: $('pTrans').value,
    capacity: $('pCapacity').value,
    licensePlate: $('pPlate').value,
    chassisNumber: $('pChassis').value,
    fuelRange: $('pRange').value,
    requiresOperatorLevel: $('pOperator').value,
    safetyProfile: $('pSafety').value
  };

  if (!payload.brand || !payload.price) return showToast('Datos Incompletos.');

  try {
    const res = await fetch(`${API_BASE}/cars`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      showToast('¡Activo Universal Sincronizado!');
      $('publishBackdrop').style.display = 'none';
      fetchCars();
    } else {
      showToast('Falla Jurídica: ' + data.error);
    }
  } catch (err) { showToast('Server Error'); }
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

  if ($('domain-land')) $('domain-land').onclick = () => setDomain('LAND');
  if ($('domain-water')) $('domain-water').onclick = () => setDomain('WATER');
  if ($('domain-air')) $('domain-air').onclick = () => setDomain('AIR');

  ['openPublishHero', 'openPublishTop'].forEach(id => {
    if ($(id)) $(id).onclick = openPublish;
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
