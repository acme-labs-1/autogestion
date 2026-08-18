// ============================================
// CONFIGURACIÓN
// ============================================
const URL_LOGIN = 'https://carover0.xyz/api/login_deudabot.php';
const URL_REPORTES = 'https://carover0.xyz/api/reportes.json';
const URL_VERIFICADOS = 'https://carover0.xyz/api/verificados.json';
const URL_RECHAZADOS = 'https://carover0.xyz/api/rechazados.json';
const URL_GUARDAR = 'https://carover0.xyz/api/guardar_verificado.php';
const URL_GUARDAR_RECHAZADO = 'https://carover0.xyz/api/guardar_rechazado.php';

// ============================================
// ESTADO
// ============================================
let token = localStorage.getItem('fyd_token') || '';
let usuarioActual = null;
let reportesCache = [];
let verificadosCache = [];
let rechazadosCache = [];
let intervaloAutoRefresh = null;
let filtroActual = 'todos';
let todosLosReportes = [];

// ============================================
// FUNCIONES DE UTILIDAD
// ============================================
function limpiarMonto(monto) {
    if (!monto) return 0;
    if (typeof monto === 'number') return monto;
    let montoStr = String(monto).replace(/[^0-9.]/g, '');
    return parseFloat(montoStr) || 0;
}

function formatMonto(monto) {
    return '$' + Number(monto).toLocaleString('es-AR', { minimumFractionDigits: 0 });
}

function generarID(dni, monto, fecha) {
    const str = `${dni}|${monto}|${fecha}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash;
    }
    return 'FYD-' + Math.abs(hash).toString(16).substring(0, 8).toUpperCase();
}

function mostrarToast(mensaje, tipo = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.textContent = mensaje;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================
// LOGIN / LOGOUT
// ============================================
async function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value.trim();
    const btn = document.getElementById('loginBtn');
    const errorDiv = document.getElementById('loginError');
    const loadingDiv = document.getElementById('loginLoading');

    if (!user || !pass) {
        errorDiv.textContent = '❌ Ingresa usuario y contraseña';
        errorDiv.style.display = 'block';
        return false;
    }

    btn.disabled = true;
    btn.textContent = '⏳ Verificando...';
    loadingDiv.style.display = 'block';
    errorDiv.style.display = 'none';

    try {
        const response = await fetch(URL_LOGIN, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user, pass })
        });
        const data = await response.json();

        if (data.success) {
            token = data.token;
            usuarioActual = data.user;
            localStorage.setItem('fyd_token', token);
            localStorage.setItem('fyd_user', usuarioActual);
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('appScreen').style.display = 'block';
            document.getElementById('adminName').textContent = `👤 ${usuarioActual}`;
            mostrarToast(`✅ Bienvenido ${usuarioActual}`, 'success');
            cargarDatos();
            iniciarAutoRefresh(30);
        } else {
            errorDiv.textContent = '❌ ' + (data.error || 'Credenciales incorrectas');
            errorDiv.style.display = 'block';
            document.getElementById('loginPass').value = '';
            document.getElementById('loginPass').focus();
        }
    } catch (error) {
        errorDiv.textContent = '❌ Error de conexión con el servidor';
        errorDiv.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Ingresar';
        loadingDiv.style.display = 'none';
    }
    return false;
}

function logout() {
    if (confirm('¿Cerrar sesión?')) {
        localStorage.removeItem('fyd_token');
        localStorage.removeItem('fyd_user');
        token = '';
        usuarioActual = null;
        if (intervaloAutoRefresh) clearInterval(intervaloAutoRefresh);
        document.getElementById('appScreen').style.display = 'none';
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('loginPass').value = '';
        document.getElementById('loginUser').value = '';
        document.getElementById('loginUser').focus();
        mostrarToast('🔒 Sesión cerrada', 'info');
    }
}

// ============================================
// CARGAR DATOS
// ============================================
async function cargarDatos() {
    const statusText = document.getElementById('statusText');
    const statusDot = document.getElementById('statusDot');
    statusText.textContent = 'Cargando...';
    statusDot.className = 'dot offline';

    try {
        const [reportesRes, verificadosRes, rechazadosRes] = await Promise.all([
            fetch(URL_REPORTES + '?t=' + Date.now()),
            fetch(URL_VERIFICADOS + '?t=' + Date.now()),
            fetch(URL_RECHAZADOS + '?t=' + Date.now())
        ]);

        if (!reportesRes.ok || !verificadosRes.ok || !rechazadosRes.ok) {
            throw new Error('Error al cargar datos');
        }

        const reportes = await reportesRes.json();
        const verificados = await verificadosRes.json();
        const rechazados = await rechazadosRes.json();

        reportesCache = (reportes || []).map(r => ({
            ...r,
            monto: limpiarMonto(r.monto),
            operacion: r.operacion || generarID(r.dni, r.monto, r.fecha),
            estado: 'pendiente'
        }));

        verificadosCache = (verificados || []).map(r => ({
            ...r,
            monto: limpiarMonto(r.monto),
            estado: 'verificado'
        }));

        rechazadosCache = (rechazados || []).map(r => ({
            ...r,
            monto: limpiarMonto(r.monto),
            estado: 'rechazado'
        }));

        todosLosReportes = [...reportesCache, ...verificadosCache, ...rechazadosCache];

        renderizarEstadisticas();
        renderizarLista();

        statusText.textContent = 'Conectado';
        statusDot.className = 'dot online';
    } catch (error) {
        console.error('Error:', error);
        statusText.textContent = 'Error';
        statusDot.className = 'dot offline';
        mostrarToast('Error al cargar datos: ' + error.message, 'error');
    }
}

// ============================================
// RENDERIZAR ESTADÍSTICAS
// ============================================
function renderizarEstadisticas() {
    document.getElementById('sTotal').textContent = todosLosReportes.length;
    document.getElementById('sPendientes').textContent = reportesCache.length;
    document.getElementById('sVerificados').textContent = verificadosCache.length;
    document.getElementById('sRechazados').textContent = rechazadosCache.length;

    const totalVerificado = verificadosCache.reduce((sum, r) => sum + (r.monto || 0), 0);
    document.getElementById('sMontoVerificado').textContent = formatMonto(totalVerificado);

    const tasa = todosLosReportes.length > 0 ? Math.round((verificadosCache.length / todosLosReportes.length) * 100) : 0;
    document.getElementById('sTasa').textContent = tasa + '%';
}

// ============================================
// FILTRAR
// ============================================
function filtrar(filtro) {
    filtroActual = filtro;
    document.querySelectorAll('.filtros button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filtro === filtro);
    });
    renderizarLista();
}

function renderizarLista() {
    const container = document.getElementById('listaReportes');
    let reportesFiltrados = [];

    if (filtroActual === 'todos') {
        reportesFiltrados = todosLosReportes;
    } else if (filtroActual === 'pendiente') {
        reportesFiltrados = reportesCache;
    } else if (filtroActual === 'verificado') {
        reportesFiltrados = verificadosCache;
    } else if (filtroActual === 'rechazado') {
        reportesFiltrados = rechazadosCache;
    }

    reportesFiltrados = [...reportesFiltrados].reverse();

    if (reportesFiltrados.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">📭</div>
                <p>No hay reportes ${filtroActual === 'todos' ? '' : filtroActual}s</p>
            </div>
        `;
        return;
    }

    container.innerHTML = reportesFiltrados.map(r => {
        const telefono = r.whatsapp || '';
        const telefonoLimpio = telefono.replace(/\D/g, '');
        const whatsappLink = telefonoLimpio.length >= 6 ? `https://wa.me/${telefonoLimpio}` : '#';
        const tieneComprobante = r.comprobante && r.comprobante.length > 0;
        const esPendiente = r.estado === 'pendiente';
        const estadoLabel = r.estado === 'pendiente' ? '⏳ Pendiente' :
                           r.estado === 'verificado' ? '✅ Verificado' : '❌ Rechazado';
        const estadoClass = r.estado === 'pendiente' ? 'pendiente' :
                           r.estado === 'verificado' ? 'verificado' : 'rechazado';
        const cardClass = r.estado === 'verificado' ? 'verified' :
                         r.estado === 'rechazado' ? 'rejected' : '';

        let actions = '';
        if (esPendiente) {
            actions = `
                <div class="actions">
                    <button class="btn btn-success btn-sm" onclick="verificarPago('${r.dni}', '${r.operacion || ''}')">
                        Verificar
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="rechazarPago('${r.dni}', '${r.operacion || ''}')">
                        Rechazar
                    </button>
                </div>
            `;
        }

        return `
            <div class="report-card ${cardClass}">
                <div class="row">
                    <span class="label">👤 Usuario</span>
                    <span class="value">${r.nombre || 'N/A'}</span>
                </div>
                <div class="row">
                    <span class="label">📌 DNI</span>
                    <span class="value">${r.dni || 'N/A'}</span>
                </div>
                <div class="row">
                    <span class="label">📱 Teléfono</span>
                    <span class="value">
                        ${telefono || 'N/A'}
                        ${telefonoLimpio.length >= 6 ? `
                            <a href="${whatsappLink}" target="_blank" class="whatsapp-link" title="WhatsApp">
                                <img src="https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/whatsapp.svg" alt="WhatsApp">
                            </a>
                        ` : ''}
                    </span>
                </div>
                <div class="row">
                    <span class="label">💰 Monto</span>
                    <span class="value ${r.estado === 'verificado' ? 'monto-verde' : 'monto'}">${formatMonto(r.monto)}</span>
                </div>
                <div class="row">
                    <span class="label">📎 Comp.</span>
                    <span class="value">
                        ${tieneComprobante ? `
                            <button class="btn btn-primary btn-sm" onclick="verComprobante('${r.comprobante}', '${r.nombre || 'N/A'}', '${r.dni || 'N/A'}', ${r.monto || 0})">
                                Ver
                            </button>
                        ` : 'Sin adjunto'}
                    </span>
                </div>
                <div class="row">
                    <span class="label">📅 Estado</span>
                    <span class="value"><span class="estado-badge ${estadoClass}">${estadoLabel}</span></span>
                </div>
                ${(r.estado === 'verificado' && r.verificado_por) ? `
                    <div class="row">
                        <span class="label">👤 Verificado por</span>
                        <span class="value" style="color:var(--violet-soft);font-size:12px;">${r.verificado_por}</span>
                    </div>
                ` : ''}
                ${(r.estado === 'rechazado' && r.rechazado_por) ? `
                    <div class="row">
                        <span class="label">👤 Rechazado por</span>
                        <span class="value" style="color:var(--red);font-size:12px;">${r.rechazado_por}</span>
                    </div>
                ` : ''}
                ${actions}
            </div>
        `;
    }).join('');
}


// ============================================
// ACCIONES: VERIFICAR / RECHAZAR
// ============================================
async function verificarPago(dni, operacion) {
    if (!confirm(`¿Verificar pago de DNI ${dni}?`)) return;

    const reporte = reportesCache.find(r => r.dni === dni && r.operacion === operacion);
    if (!reporte) {
        mostrarToast('Reporte no encontrado', 'error');
        return;
    }

    try {
        const datos = {
            dni: reporte.dni,
            nombre: reporte.nombre,
            monto: reporte.monto,
            whatsapp: reporte.whatsapp || '',
            operacion: reporte.operacion || '',
            fecha: reporte.fecha || new Date().toISOString(),
            fecha_verificacion: new Date().toISOString(),
            verificado_por: usuarioActual || 'web_admin'
        };

        const response = await fetch(URL_GUARDAR, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });

        const result = await response.json();
        if (result.ok) {
            mostrarToast(`✅ Pago de ${reporte.nombre} verificado`, 'success');
            cargarDatos();
        } else {
            mostrarToast('Error al verificar: ' + (result.error || 'Error desconocido'), 'error');
        }
    } catch (error) {
        mostrarToast('Error: ' + error.message, 'error');
    }
}

async function rechazarPago(dni, operacion) {
    if (!confirm(`¿Rechazar pago de DNI ${dni}?`)) return;

    const reporte = reportesCache.find(r => r.dni === dni && r.operacion === operacion);
    if (!reporte) {
        mostrarToast('Reporte no encontrado', 'error');
        return;
    }

    try {
        const datos = {
            dni: reporte.dni,
            nombre: reporte.nombre,
            monto: reporte.monto,
            whatsapp: reporte.whatsapp || '',
            operacion: reporte.operacion || '',
            fecha: reporte.fecha || new Date().toISOString(),
            rechazado_por: usuarioActual || 'web_admin'
        };

        const response = await fetch(URL_GUARDAR_RECHAZADO, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });

        const result = await response.json();
        if (result.success) {
            mostrarToast(`❌ Pago de ${reporte.nombre} rechazado`, 'error');
            cargarDatos();
        } else {
            mostrarToast('Error al rechazar: ' + (result.error || 'Error desconocido'), 'error');
        }
    } catch (error) {
        mostrarToast('Error: ' + error.message, 'error');
    }
}

// ============================================
// FUNCIONES PARA COMPROBANTE
// ============================================
function verComprobante(url, nombre, dni, monto) {
    const modal = document.getElementById('modalComprobante');
    const imagen = document.getElementById('modalImagen');
    const info = document.getElementById('modalInfo');
    imagen.src = url;
    info.textContent = `📄 ${nombre} · DNI: ${dni} · ${formatMonto(monto)}`;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function cerrarComprobante(event) {
    if (event && event.target && event.target.id !== 'modalComprobante' && event.target.className !== 'modal-close') {
        return;
    }
    const modal = document.getElementById('modalComprobante');
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarComprobante();
});

// ============================================
// AUTO-REFRESCO
// ============================================
function iniciarAutoRefresh(segundos = 30) {
    if (intervaloAutoRefresh) clearInterval(intervaloAutoRefresh);
    intervaloAutoRefresh = setInterval(cargarDatos, segundos * 1000);
}

// ============================================
// INICIO
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('appScreen').style.display = 'none';
    document.getElementById('loginUser').focus();

    document.getElementById('loginPass').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('loginForm').dispatchEvent(new Event('submit'));
        }
    });
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('appScreen').style.display === 'block') {
        logout();
    }
});




