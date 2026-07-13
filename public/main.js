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
      body: `
        <p>RentaTÓ no descalifica vehículos por su año de fabricación, color, marca, modelo o categoría. La plataforma admite vehículos terrestres, acuáticos y aéreos, sin distinción ni clasismo.</p>
        <p>Las condiciones de uso, alquiler, entrega, devolución, garantías, depósitos, responsabilidades y cualquier otro término relacionado con la transacción serán establecidos y acordados exclusivamente entre el propietario o representante del vehículo y la persona que lo alquile.</p>
        <p>RentaTÓ no es parte de dichos acuerdos ni interviene en las negociaciones entre las partes. Su función se limita a facilitar la conexión entre quienes ofrecen vehículos y quienes desean alquilarlos. En consecuencia, las obligaciones y compromisos derivados del alquiler corresponden únicamente a las partes que celebren el acuerdo.</p>
      `
    },
    neural: {
      title: 'Reseñas y reputación',
      body: '<p>Después de cada renta, ambas partes pueden calificarse con estrellas y comentarios. Esa reputación queda visible en el perfil y ayuda a otros usuarios a confiar.</p>'
    },
    about: {
      title: 'Quiénes somos',
      body: `
        <div style="text-align:center; margin-bottom:14px;">
          <div style="font-size:1.4rem; font-weight:800; color:#002277;">RentaTÓ</div>
          <div style="font-style:italic; font-weight:700; background:linear-gradient(90deg,#ff6a00,#e62525);-webkit-background-clip:text;background-clip:text;color:transparent;">Muévete sin límites</div>
        </div>
        <p>RentaTÓ es un marketplace innovador creado para conectar personas que desean rentar cualquier medio de transporte con propietarios o empresas que tienen vehículos disponibles para alquiler.</p>
        <p>Nuestra plataforma permite alquilar medios de transporte terrestres, acuáticos y aéreos, sin importar el año, modelo o condición del vehículo, porque cada publicación muestra información clara, transparente y detallada para que ambas partes tengan seguridad al momento de hacer negocios.</p>
        <p>Nosotros nos encargamos de conectar de forma rápida y eficiente a:</p>
        <p>✅ Personas que necesitan rentar un vehículo.<br/>
        ✅ Personas o empresas que desean generar ingresos rentando sus unidades.</p>
        <p>En RentaTÓ, entendemos que toda unidad tiene valor y que cualquier persona debe tener acceso a soluciones de movilidad adaptadas a su necesidad.</p>

        <h4 style="margin:18px 0 8px; color:#002277;">¿Qué puedes rentar en RentaTÓ?</h4>

        <p><b>🚗 Transporte Terrestre</b></p>
        <ul>
          <li>Automóviles</li><li>Jeepetas / SUVs</li><li>Camionetas</li><li>Motocicletas</li>
          <li>Autobuses</li><li>Patinetas eléctricas</li><li>Four Wheels / ATV</li>
          <li>Camiones de carga</li><li>Furgonetas / Vans</li><li>Bicicletas</li>
          <li><em>…y otros vehículos que califiquen dentro de esta categoría.</em></li>
        </ul>

        <p><b>🚤 Transporte Acuático</b></p>
        <ul>
          <li>Yates</li><li>Jet Ski</li><li>Lanchas rápidas</li><li>Botes de pesca</li>
          <li>Catamaranes</li><li>Veleros</li><li>Ferry privados</li><li>Kayaks</li>
          <li>Canoas</li><li>Barcos turísticos</li>
          <li><em>…y otros vehículos que califiquen dentro de esta categoría.</em></li>
        </ul>

        <p><b>✈️ Transporte Aéreo</b></p>
        <ul>
          <li>Helicópteros</li><li>Avionetas privadas</li><li>Jets ejecutivos</li>
          <li>Aviones charter</li><li>Drones de transporte</li><li>Aeronaves recreativas</li>
          <li>Ultraligeros</li><li>Planeadores</li><li>Hidroaviones</li><li>Helicópteros turísticos</li>
          <li><em>…y otras aeronaves que califiquen dentro de esta categoría.</em></li>
        </ul>

        <h4 style="margin:18px 0 8px; color:#002277;">Nuestra misión</h4>
        <p>Convertirnos en la plataforma líder que conecta personas y empresas en un ecosistema de alquiler de transporte, ofreciendo opciones confiables, transparentes y accesibles para movilizarse sin límites.</p>
        <p><b>RentaTÓ no solo renta vehículos… crea conexiones, oportunidades y libertad de movimiento.</b></p>

        <div style="text-align:center; margin:16px 0;">
          <div style="font-size:1.2rem; font-weight:800; color:#002277;">RentaTÓ</div>
          <div style="font-style:italic; font-weight:700; background:linear-gradient(90deg,#ff6a00,#e62525);-webkit-background-clip:text;background-clip:text;color:transparent;">Muévete sin límites</div>
        </div>

        <p style="font-size:0.85rem; opacity:0.75;"><em>Inspirado en plataformas digitales de conexión entre oferta y demanda como Airbnb y Uber Technologies, pero enfocado en el mundo completo del transporte.</em></p>
      `
    },
    terms: {
      title: 'Términos y Condiciones',
      body: `
        <p><b>1. Naturaleza de la Plataforma</b></p>
        <p>RentaTÓ es una plataforma tecnológica de intermediación cuya finalidad es facilitar la conexión entre personas físicas o jurídicas que ofrecen vehículos en alquiler y personas interesadas en contratarlos.</p>
        <p>RentaTÓ no es propietaria, administradora, operadora, arrendadora, subarrendadora, representante ni aseguradora de los vehículos anunciados en la plataforma. Asimismo, RentaTÓ no participa en la negociación, celebración, ejecución o cumplimiento de los contratos de alquiler celebrados entre los usuarios.</p>
        <p>Los contratos de alquiler son celebrados única y exclusivamente entre el propietario o representante autorizado del vehículo y el usuario interesado en alquilarlo.</p>

        <p><b>2. Alcance del Servicio</b></p>
        <p>La función de RentaTÓ se limita a: facilitar la publicación de anuncios; promocionar los anuncios mediante herramientas tecnológicas y de mercadeo; facilitar el contacto entre las partes; proveer herramientas de búsqueda, filtros y comunicación; y ofrecer acceso a la información del anunciante mediante el pago de la tarifa correspondiente, cuando aplique.</p>
        <p>El pago realizado a RentaTÓ corresponde exclusivamente al uso de la plataforma tecnológica y al servicio de intermediación digital. Dicho pago no constituye el alquiler del vehículo ni representa garantía de que las partes celebren un contrato.</p>

        <p><b>3. Vehículos Publicados</b></p>
        <p>Podrán anunciarse vehículos terrestres, acuáticos y aéreos, siempre que su publicación no contravenga la legislación vigente de la República Dominicana.</p>
        <p>La aceptación de un anuncio dentro de la plataforma no constituye una certificación, inspección, garantía ni aprobación por parte de RentaTÓ.</p>

        <p><b>4. Responsabilidad de los Usuarios</b></p>
        <p>Cada propietario o representante será el único responsable de: la legalidad del vehículo; la exactitud de la información publicada; el estado físico y mecánico del vehículo; los permisos, licencias, seguros y autorizaciones requeridos por la ley; el precio del alquiler; y los depósitos, garantías y condiciones de uso.</p>
        <p>Cada arrendatario será responsable de verificar las condiciones ofrecidas antes de aceptar cualquier acuerdo.</p>

        <p><b>5. Condiciones del Alquiler</b></p>
        <p>Las condiciones relativas al precio, duración, depósitos, seguros, entrega, devolución, combustible, kilometraje, mantenimiento, daños, penalidades y demás aspectos del alquiler serán pactadas exclusivamente entre el propietario y el arrendatario.</p>
        <p>RentaTÓ no interviene en dichas negociaciones ni forma parte del contrato celebrado entre las partes.</p>

        <p><b>6. Descargo de Responsabilidad</b></p>
        <p>RentaTÓ no garantiza: la disponibilidad de los vehículos; la veracidad absoluta de los anuncios; el estado mecánico o estructural de los vehículos; la identidad o solvencia económica de los usuarios; ni el cumplimiento de las obligaciones asumidas entre las partes.</p>
        <p>En consecuencia, RentaTÓ no será responsable por accidentes, daños materiales, lesiones personales, robos, pérdidas económicas, incumplimientos contractuales, fraudes, multas, sanciones administrativas o conflictos derivados de la relación entre propietario y arrendatario.</p>

        <p><b>7. Política de Contenido</b></p>
        <p>Los usuarios garantizan que toda información publicada es verdadera, actualizada y de su propiedad o cuentan con autorización para utilizarla.</p>
        <p>RentaTÓ podrá eliminar cualquier publicación que sea falsa o engañosa; infrinja derechos de terceros; incite actividades ilícitas; contenga lenguaje ofensivo o discriminatorio; o vulnere la legislación vigente o estos Términos y Condiciones.</p>

        <p><b>8. Política de Privacidad</b></p>
        <p>RentaTÓ recopilará únicamente la información necesaria para la prestación de sus servicios, incluyendo datos de registro, contacto y uso de la plataforma.</p>
        <p>Los datos personales serán tratados conforme a la legislación aplicable de la República Dominicana y utilizados para: gestionar las cuentas de usuario; facilitar la comunicación entre las partes; mejorar la experiencia dentro de la plataforma; atender requerimientos legales cuando corresponda; y enviar comunicaciones relacionadas con el servicio, cuando el usuario las haya aceptado.</p>
        <p>RentaTÓ no comercializa datos personales de sus usuarios sin una base legal o el consentimiento correspondiente.</p>

        <p><b>9. Publicidad</b></p>
        <p>Como parte de su modelo de negocio, RentaTÓ podrá mostrar anuncios publicitarios, promociones y contenido patrocinado dentro de la plataforma.</p>
        <p>La presencia de publicidad no constituye recomendación, certificación ni respaldo de los productos o servicios anunciados.</p>

        <p><b>10. Propiedad Intelectual</b></p>
        <p>La marca RentaTÓ, su logotipo, diseño, software, bases de datos, interfaz gráfica, contenido original y demás elementos que integran la plataforma son propiedad exclusiva de sus titulares y se encuentran protegidos por la legislación aplicable sobre propiedad intelectual.</p>

        <p><b>11. Legislación Aplicable</b></p>
        <p>Estos Términos y Condiciones se interpretarán conforme a la legislación vigente de la República Dominicana, incluyendo, en la medida en que resulte aplicable al funcionamiento de la plataforma: la Constitución de la República Dominicana; la Ley No. 126-02 sobre Comercio Electrónico, Documentos y Firmas Digitales; la Ley General de Protección de los Derechos del Consumidor o Usuario (Ley No. 358-05), cuando corresponda; la Ley No. 172-13 sobre Protección de Datos de Carácter Personal, respecto al tratamiento de datos personales; y cualquier otra disposición legal o reglamentaria aplicable.</p>

        <p><b>12. Jurisdicción</b></p>
        <p>Toda controversia relacionada con el uso de la plataforma será conocida por los tribunales competentes de la República Dominicana, salvo que una norma de orden público establezca una competencia distinta.</p>

        <p><b>13. Aceptación</b></p>
        <p>Al registrarse, acceder o utilizar RentaTÓ, el usuario declara haber leído, comprendido y aceptado íntegramente estos Términos y Condiciones.</p>
      `
    }
  };

  const feat = features[type];
  if (!feat) return;

  $('detailsTitle').textContent = feat.title;
  $('detailsContent').innerHTML = `
    <div class="panel">
      <div style="font-size: 1rem; line-height: 1.6; color: var(--muted); text-align: left;">${feat.body}</div>
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
            <div class="panel" style="grid-column: span 2;">
                <h4>Contactar al dueño</h4>
                <div id="unlockBox">
                    <div class="small" style="color:var(--muted,#888);">Cargando...</div>
                </div>
            </div>
            <div class="panel" style="grid-column: span 2;">
                <h4>Reseñas</h4>
                <div id="carReviews"><div class="small" style="color:var(--muted,#888);">Cargando reseñas...</div></div>
            </div>
        </div>
    `;

  loadCarReviews(car.id);
  loadUnlockBox(car.id);
  $('detailsBackdrop').style.display = "flex";
};

// ── Connection unlock ($1 via PayPal) ──
async function loadUnlockBox(carId) {
  const box = $('unlockBox');
  if (!box) return;
  if (!token) {
    box.innerHTML = `<div class="small" style="color:var(--muted,#888);">Inicia sesión para contactar al dueño.</div>`;
    return;
  }
  const car = cars.find(c => c.id === carId);
  if (car && currentUser && car.ownerId === currentUser.id) {
    box.innerHTML = `<div class="small" style="color:var(--muted,#888);">Este vehículo es tuyo.</div>`;
    return;
  }
  try {
    // Already unlocked?
    const st = await fetch(`${API_BASE}/payments/unlock-status/${carId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(r => r.json());
    if (st.unlocked) {
      renderUnlockedContact(box, st.contactPhone);
      return;
    }
    // Payment config
    const cfg = await fetch(`${API_BASE}/payments/config`).then(r => r.json());
    if (!cfg.enabled || !cfg.clientId) {
      box.innerHTML = `<div class="small" style="color:var(--muted,#888);">El contacto directo aún no está disponible. Reserva y coordina por el chat.</div>`;
      return;
    }
    box.innerHTML = `
      <p class="small" style="color:var(--muted,#888);">Desbloquea el teléfono/WhatsApp del dueño por <b>US$1</b> (pago único por este vehículo).</p>
      <div id="paypalUnlockBtn" style="margin-top:10px; max-width:320px;"></div>
      <div class="small" id="unlockMsg" style="margin-top:8px;"></div>
    `;
    loadPayPalSdk(cfg.clientId, cfg.currency, () => renderPayPalButton(carId));
  } catch (err) {
    box.innerHTML = `<div class="small" style="color:var(--muted,#888);">No se pudo cargar el contacto.</div>`;
  }
}

function renderUnlockedContact(box, phone) {
  const clean = (phone || '').replace(/[^\d+]/g, '');
  const wa = clean ? `https://wa.me/${clean.replace(/^\+/, '')}` : null;
  box.innerHTML = `
    <div style="background:rgba(40,180,80,0.1); padding:14px; border-radius:8px;">
      <div class="small" style="color:var(--ok,#2c2);">✓ Contacto desbloqueado</div>
      <div style="margin-top:8px; font-size:1.2rem; font-weight:700;">${phone || 'El dueño no registró teléfono'}</div>
      ${wa ? `<a class="btn primary" href="${wa}" target="_blank" style="margin-top:10px; display:inline-block;">Abrir WhatsApp</a>` : ''}
    </div>`;
}

let _paypalSdkLoaded = false;
function loadPayPalSdk(clientId, currency, onReady) {
  if (_paypalSdkLoaded && window.paypal) { onReady(); return; }
  const s = document.createElement('script');
  s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency || 'USD')}`;
  s.onload = () => { _paypalSdkLoaded = true; onReady(); };
  s.onerror = () => { const m = $('unlockMsg'); if (m) m.textContent = 'No se pudo cargar PayPal.'; };
  document.body.appendChild(s);
}

function renderPayPalButton(carId) {
  if (!window.paypal) return;
  const mount = $('paypalUnlockBtn');
  if (!mount) return;
  window.paypal.Buttons({
    createOrder: async () => {
      const res = await fetch(`${API_BASE}/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ carId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo crear la orden');
      return data.orderId;
    },
    onApprove: async (data) => {
      const res = await fetch(`${API_BASE}/payments/capture-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ orderId: data.orderID, carId })
      });
      const out = await res.json();
      const box = $('unlockBox');
      if (res.ok) {
        if (box) renderUnlockedContact(box, out.contactPhone);
        showToast(out.message || '¡Contacto desbloqueado!');
      } else {
        const m = $('unlockMsg');
        if (m) m.textContent = out.error || 'El pago no se completó.';
      }
    },
    onError: () => {
      const m = $('unlockMsg');
      if (m) m.textContent = 'Hubo un problema con PayPal. Intenta de nuevo.';
    }
  }).render('#paypalUnlockBtn');
}

async function loadCarReviews(carId) {
  const box = $('carReviews');
  if (!box) return;
  try {
    const res = await fetch(`${API_BASE}/reviews/car/${carId}`);
    const reviews = await res.json();
    if (!reviews || !reviews.length) {
      box.innerHTML = `<div class="small" style="color:var(--muted,#888);">Este vehículo aún no tiene reseñas. ¡Sé el primero en rentarlo!</div>`;
      return;
    }
    box.innerHTML = reviews.map(r => {
      const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
      const date = new Date(r.createdAt).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });
      return `<div style="padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.08);">
        <div style="display:flex; justify-content:space-between; gap:8px;">
          <b>${r.author?.name || 'Usuario'}</b>
          <span style="color:#f5b301;">${stars}</span>
        </div>
        <div class="small" style="color:var(--muted,#888); margin-top:2px;">${date}</div>
        ${r.comment ? `<div style="margin-top:6px;">${r.comment.replace(/[<>]/g, '')}</div>` : ''}
      </div>`;
    }).join('');
  } catch (err) {
    box.innerHTML = `<div class="small" style="color:var(--muted,#888);">No se pudieron cargar las reseñas.</div>`;
  }
}

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
                <label class="terms-accept" id="authTermsWrap" style="display:none;">
                    <input type="checkbox" id="authTerms" />
                    <span>He leído y acepto los <a href="#" onclick="openFeature('terms'); return false;">Términos y Condiciones</a> de RentaTÓ.</span>
                </label>
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
                    <label>Teléfono / WhatsApp de contacto</label>
                    <input id="pPhone" type="tel" placeholder="Ej: 809-555-1234" />
                    <div class="small" style="color:var(--muted,#888); margin-top:4px;">
                        No se muestra públicamente. El rentador lo desbloquea pagando US$1 para contactarte directo.
                    </div>
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
  const termsWrap = $('authTermsWrap');
  if (termsWrap) termsWrap.style.display = isReg ? 'flex' : 'none';
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
    const terms = $('authTerms');
    if (terms && !terms.checked) return showToast('Debes aceptar los Términos y Condiciones para crear tu cuenta.');

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
    contactPhone: $('pPhone') ? $('pPhone').value.trim() : '',
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

  initHeroCarousel();
  initBrandAudio();
});

// ==========================
// Hero image carousel
// ==========================
// Logo de RentaTÓ (separador entre categorías)
const HC_LOGO = 'https://res.cloudinary.com/dor8g1woi/image/upload/c_pad,w_900,h_500,b_white,f_auto,q_auto/rentato/logo';

// Imágenes por palabra clave (loremflickr devuelve una foto real del término).
// Usamos UN solo término claro por imagen (evita resultados ambiguos) y un lock
// numérico para que la foto quede fija y no cambie en cada carga.
let _hcLock = 20;
const KW = (keyword) => `https://loremflickr.com/900/500/${keyword}?lock=${_hcLock++}`;

// 10 medios de transporte por categoría (según la lista oficial de RentaTÓ)
const HC_LAND = [
  'car', 'suv', 'pickup+truck', 'motorcycle', 'bus',
  'scooter', 'atv', 'truck', 'van', 'bicycle'
].map(KW);

const HC_WATER = [
  'yacht', 'jetski', 'speedboat', 'boat', 'catamaran',
  'sailboat', 'ferry', 'kayak', 'canoe', 'boat+sea'
].map(KW);

const HC_AIR = [
  'helicopter', 'airplane', 'jet', 'aircraft', 'drone',
  'airplane+sky', 'aviation', 'plane', 'seaplane', 'helicopter+flight'
].map(KW);

function initHeroCarousel() {
  const track = $('hcTrack');
  const dotsWrap = $('hcDots');
  const catLabel = $('hcCat');
  if (!track) return;

  // Construir la secuencia: logo → 10 terrestres → logo → 10 acuáticos → logo → 10 aéreos
  const seq = [];
  const push = (url, cat) => seq.push({ url, cat });
  push(HC_LOGO, '');
  HC_LAND.forEach(u => push(u, 'Terrestre'));
  push(HC_LOGO, '');
  HC_WATER.forEach(u => push(u, 'Acuático'));
  push(HC_LOGO, '');
  HC_AIR.forEach(u => push(u, 'Aéreo'));

  // Render slides
  track.innerHTML = seq.map(s =>
    `<div class="hc-slide${s.cat === '' ? ' hc-logo' : ''}" style="background-image:url('${s.url}')"></div>`
  ).join('');
  const slides = Array.from(track.children);

  let idx = 0;
  let timer = null;

  // Dots (uno por slide sería demasiado con 33; ponemos uno por bloque/categoría)
  dotsWrap.innerHTML = '';
  const blockStarts = [];
  seq.forEach((s, i) => { if (s.cat === '') blockStarts.push(i); });
  blockStarts.push(seq.length);
  const dotTargets = [0]; // logo inicial
  // un punto por cada categoría (apunta a la primera imagen del bloque)
  for (let b = 0; b < blockStarts.length - 1; b++) {
    const firstImg = blockStarts[b] + 1;
    if (firstImg < seq.length && seq[firstImg].cat) dotTargets.push(firstImg);
  }
  dotTargets.forEach((t) => {
    const d = document.createElement('button');
    d.type = 'button';
    d.className = 'hc-dot';
    d.addEventListener('click', () => go(t, true));
    dotsWrap.appendChild(d);
  });

  const render = () => {
    track.style.transform = `translateX(-${idx * 100}%)`;
    // etiqueta de categoría
    if (catLabel) {
      const cat = seq[idx].cat;
      catLabel.textContent = cat;
      catLabel.style.opacity = cat ? '1' : '0';
    }
    // punto activo = el bloque al que pertenece el slide actual
    const dots = dotsWrap.querySelectorAll('.hc-dot');
    let activeDot = 0;
    dotTargets.forEach((t, i) => { if (idx >= t) activeDot = i; });
    dots.forEach((d, i) => d.classList.toggle('active', i === activeDot));
  };
  const go = (n, manual) => {
    idx = (n + slides.length) % slides.length;
    render();
    if (manual) restart();
  };
  const next = () => go(idx + 1);
  const restart = () => { if (timer) clearInterval(timer); timer = setInterval(next, 3500); };

  if ($('hcNext')) $('hcNext').onclick = () => go(idx + 1, true);
  if ($('hcPrev')) $('hcPrev').onclick = () => go(idx - 1, true);
  render();
  restart();
}

// ==========================
// Brand logo → audio modal
// ==========================
function initBrandAudio() {
  const btn = $('brandLogoBtn');
  const backdrop = $('brandAudioBackdrop');
  const audio = $('brandAudio');
  const msg = $('brandAudioMsg');
  if (!btn || !backdrop) return;

  const open = () => {
    backdrop.style.display = 'flex';
    if (audio) {
      audio.currentTime = 0;
      const p = audio.play();
      if (p && p.catch) p.catch(() => {
        if (msg) msg.textContent = 'Toca ► para reproducir.';
      });
      audio.onerror = () => {
        if (msg) msg.textContent = 'Aún no se ha subido el audio de RentaTÓ.';
      };
    }
  };
  const close = () => {
    backdrop.style.display = 'none';
    if (audio) { audio.pause(); }
  };

  btn.addEventListener('click', open);
  if ($('closeBrandAudio')) $('closeBrandAudio').addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
}
