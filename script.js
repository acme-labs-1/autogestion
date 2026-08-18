// ============================================
// FUNCIONES DE PROGRESO PARA EL OVERLAY
// ============================================

function updateProgress(bar, status, percent, message) {
    if (bar) {
        bar.style.width = percent + '%';
    }
    if (status) {
        status.textContent = message;
    }
    console.log(`📊 Progreso: ${percent}% - ${message}`);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// VARIABLES GLOBALES
// ============================================

let deudas = [];
let datosCargados = false;
let carteraEntidad = {};
let descripcionProducto = {};

// ============================================
// FUNCIONES DE AYUDA
// ============================================

function toggleHelp() {
    const panel = document.getElementById('helpPanel');
    panel.classList.toggle('active');
    if (!panel.classList.contains('active')) {
        document.querySelectorAll('.help-answer').forEach(el => el.classList.remove('open'));
        document.querySelectorAll('.arrow').forEach(el => el.classList.remove('open'));
    }
}

function toggleAnswer(element) {
    const answer = element.nextElementSibling;
    const arrow = element.querySelector('.arrow');
    answer.classList.toggle('open');
    arrow.classList.toggle('open');
}

// ============================================
// FUNCIÓN PARA CONVERTIR CSV A JSON
// ============================================

function csvToJson(csv) {
    const lines = csv.trim().split('\n');
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    const result = [];

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let char of lines[i]) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());
        
        const obj = {};
        headers.forEach((header, index) => {
            let value = values[index] || '';
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
            }
            obj[header] = value.trim();
        });
        result.push(obj);
    }
    return result;
}

// ============================================
// CARGAR ENTIDADES DESDE entidades.csv
// ============================================

async function cargarEntidades() {
    try {
        const response = await fetch('entidades.csv');
        if (!response.ok) {
            console.warn('⚠️ No se pudo cargar entidades.csv');
            return;
        }
        
        const csvData = await response.text();
        const entidades = csvToJson(csvData);
        
        carteraEntidad = {};
        entidades.forEach(item => {
            const cartera = item.cartera || item.Cartera || '';
            const entidad = item.entidad || item.Entidad || '';
            if (cartera && entidad) {
                carteraEntidad[cartera.trim()] = entidad.trim();
            }
        });
        
        console.log('✅ Entidades cargadas:', Object.keys(carteraEntidad).length);
    } catch (error) {
        console.error('Error al cargar entidades:', error);
    }
}

// ============================================
// CARGAR DESCRIPCIONES DESDE descripcion.csv
// ============================================

async function cargarDescripciones() {
    try {
        const response = await fetch('descripcion.csv');
        if (!response.ok) {
            console.warn('⚠️ No se pudo cargar descripcion.csv');
            return;
        }
        
        const csvData = await response.text();
        console.log('📄 CSV descripcion:', csvData.substring(0, 200));
        
        const descripciones = csvToJson(csvData);
        
        console.log('📋 Columnas descripcion.csv:', Object.keys(descripciones[0] || {}));
        
        descripcionProducto = {};
        descripciones.forEach(item => {
            const codigo = item.NumeroProducto || 
                          item['NumeroProducto'] || 
                          item.Codigo || 
                          item.codigo || 
                          '';
            
            const observacion = item.Observaciones || 
                               item.observaciones || 
                               item.OBSERVACIONES ||
                               item.Descripcion || 
                               item.descripcion || 
                               '';
            
            if (codigo && observacion) {
                descripcionProducto[codigo.trim()] = observacion.trim();
                console.log(`✅ Cargado: ${codigo} -> ${observacion.substring(0, 30)}...`);
            }
        });
        
        console.log('✅ Observaciones cargadas:', Object.keys(descripcionProducto).length);
        console.log('📋 Primeras 5 claves:', Object.keys(descripcionProducto).slice(0, 5));
        console.log('📋 Mapeo completo:', descripcionProducto);
        
    } catch (error) {
        console.error('Error al cargar descripciones:', error);
    }
}

// ============================================
// CARGAR DEUDAS - CON PROGRESO
// ============================================

async function cargarDatos() {
    const progressBar = document.getElementById('progressBar');
    const loadingStatus = document.getElementById('loadingStatus');
    const overlay = document.getElementById('loadingOverlay');
    
    try {
        // Paso 1: Inicio
        updateProgress(progressBar, loadingStatus, 0, '⏳ Iniciando carga...');
        await sleep(300);
        
        // Paso 2: Cargar deudas
        updateProgress(progressBar, loadingStatus, 15, '📂 Cargando deudas...');
        const response = await fetch('deudas.csv');

        if (!response.ok) {
            throw new Error(`Error al cargar: ${response.status}`);
        }

        updateProgress(progressBar, loadingStatus, 40, '📊 Procesando datos...');
        const csvData = await response.text();
        deudas = csvToJson(csvData);
        datosCargados = true;

        console.log(`✅ ${deudas.length} deudas cargadas correctamente`);
        console.log('📋 Columnas deudas.csv:', Object.keys(deudas[0] || {}));
        
        // Paso 3: Cargar entidades
        updateProgress(progressBar, loadingStatus, 60, '🏢 Cargando entidades...');
        await cargarEntidades();
        
        // Paso 4: Cargar descripciones
        updateProgress(progressBar, loadingStatus, 80, '📝 Cargando observaciones...');
        await cargarDescripciones();
        
        // Paso 5: Finalizar
        updateProgress(progressBar, loadingStatus, 95, '✅ Preparando interfaz...');
        await sleep(400);
        
        // Ocultar el error si estaba visible
        const errorCarga = document.getElementById('errorCarga');
        if (errorCarga) errorCarga.style.display = 'none';

        // Actualizar fecha
        const lastModified = response.headers.get('Last-Modified');
        let fechaMostrar;
        
        if (lastModified) {
            const fecha = new Date(lastModified);
            fechaMostrar = fecha.toLocaleDateString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } else {
            const fechaGuardada = localStorage.getItem('fecha_csv');
            if (fechaGuardada) {
                fechaMostrar = fechaGuardada;
            } else {
                const now = new Date();
                fechaMostrar = now.toLocaleDateString('es-AR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
        }
        
        localStorage.setItem('fecha_csv', fechaMostrar);
        const fechaSpan = document.getElementById('fechaActual');
        if (fechaSpan) fechaSpan.textContent = fechaMostrar;

        // Ocultar overlay con transición
        updateProgress(progressBar, loadingStatus, 100, '✅ ¡Listo!');
        await sleep(500);
        
        if (overlay) {
            overlay.classList.add('hidden');
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 800);
        }
        
        console.log('✅ Carga completada exitosamente');

    } catch (error) {
        console.error('Error al cargar CSV:', error);
        
        // Mostrar error en el overlay
        if (overlay) {
            overlay.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 48px; margin-bottom: 20px;">❌</div>
                    <h2 style="color: #fc8181; font-size: 20px; margin-bottom: 10px;">Error al cargar datos</h2>
                    <p style="color: #8892a8; font-size: 14px; margin-bottom: 15px;">
                        Verifica que el archivo <b>deudas.csv</b> esté en el mismo directorio.
                    </p>
                    <p style="color: #4a5270; font-size: 12px;">${error.message}</p>
                    <button onclick="location.reload()" style="
                        margin-top: 20px;
                        padding: 12px 30px;
                        background: #7b61ff;
                        border: none;
                        border-radius: 8px;
                        color: white;
                        font-weight: 600;
                        cursor: pointer;
                    ">🔄 Reintentar</button>
                </div>
            `;
        }
        
        // También mostrar en el panel de error
        const errorCarga = document.getElementById('errorCarga');
        if (errorCarga) {
            errorCarga.style.display = 'block';
            errorCarga.innerHTML = `
                ❌ No se pudo cargar el archivo de deudas.<br>
                Verifica que el archivo <b>deudas.csv</b> esté en el mismo directorio.<br>
                <small style="color: #fc8181;">${error.message}</small>
            `;
        }
    }
}

// ============================================
// GUARDAR REPORTE LOCALMENTE
// ============================================

function guardarReporteLocal(datos) {
    try {
        let reportes = [];
        const stored = localStorage.getItem('reportes_fyd');
        if (stored) {
            reportes = JSON.parse(stored);
        }
        
        reportes.push({
            fecha: new Date().toLocaleString('es-AR'),
            ...datos
        });
        
        localStorage.setItem('reportes_fyd', JSON.stringify(reportes));
        
        console.log('📝 Reporte guardado localmente:', datos);
        console.log(`📊 Total reportes: ${reportes.length}`);
        
        return true;
    } catch (error) {
        console.error('Error al guardar reporte:', error);
        return false;
    }
}

// ============================================
// ENVIAR REPORTE AL VPS CON COMPROBANTE
// ============================================

async function enviarReporte() {
    const dni = document.getElementById('reporteDni').value;
    const nombre = document.getElementById('reporteNombre').value;
    const monto = document.getElementById('reporteMonto').value;
    const whatsapp = document.getElementById('reporteWhatsApp').value;
    const archivoInput = document.getElementById('reporteArchivo');
    const statusDiv = document.getElementById('envioStatus');

    if (!nombre || !monto) {
        alert('❌ Completa todos los campos obligatorios (Nombre y Monto)');
        return;
    }

    statusDiv.style.display = 'block';
    statusDiv.innerHTML = '⏳ Enviando reporte...';
    statusDiv.style.color = '#7b61ff';

    const formData = new FormData();
    formData.append('dni', dni);
    formData.append('nombre', nombre);
    formData.append('monto', monto);
    formData.append('whatsapp', whatsapp || 'No proporcionado');
    
    if (archivoInput.files && archivoInput.files[0]) {
        const fileSize = archivoInput.files[0].size / 1024 / 1024;
        if (fileSize > 5) {
            alert('⚠️ El archivo es muy grande (' + fileSize.toFixed(1) + 'MB). Máximo permitido: 5MB');
            statusDiv.style.display = 'none';
            return;
        }
        formData.append('comprobante', archivoInput.files[0]);
    }

    const datosReporte = {
        dni: dni,
        nombre: nombre,
        monto: monto,
        whatsapp: whatsapp
    };
    guardarReporteLocal(datosReporte);

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        const response = await fetch('https://carover0.xyz/api/autogest_back.php', {
            method: 'POST',
            body: formData,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        const text = await response.text();
        let resultado;
        try {
            resultado = JSON.parse(text);
        } catch (e) {
            console.error('Respuesta no JSON:', text);
            throw new Error('El servidor no respondió correctamente. Intenta sin comprobante.');
        }

        if (resultado.ok) {
            statusDiv.innerHTML = '✅ ¡Reporte enviado correctamente!';
            statusDiv.style.color = '#48bb78';

            alert(
                `✅ ¡Reporte enviado!\n\nDNI: ${dni}\nNombre: ${nombre}\nMonto: $${parseFloat(monto).toLocaleString('es-AR')}\nWhatsApp: ${whatsapp || 'No proporcionado'}\n\n⏳ Tu pago será procesado a la brevedad.`);

            document.getElementById('reporteNombre').value = '';
            document.getElementById('reporteMonto').value = '';
            document.getElementById('reporteWhatsApp').value = '';
            document.getElementById('reporteArchivo').value = '';
            document.getElementById('previewImage').style.display = 'none';

            setTimeout(() => consultar(), 1500);
        } else {
            throw new Error(resultado.error || 'Error al enviar');
        }
    } catch (error) {
        console.error('Error:', error);
        
        if (error.name === 'AbortError') {
            statusDiv.innerHTML = '⏳ El servidor está tardando en responder. El reporte se guardó localmente.';
            statusDiv.style.color = '#f6ad55';
            alert(
                `⏳ Tiempo de espera agotado\n\n` +
                `El servidor está procesando tu solicitud.\n` +
                `Tu reporte se ha guardado localmente.\n` +
                `Intenta nuevamente o espera la confirmación.\n\n` +
                `Si el problema persiste, envía sin comprobante.`
            );
        } else {
            statusDiv.innerHTML = `❌ Error: ${error.message}`;
            statusDiv.style.color = '#fc8181';
            
            if (archivoInput.files && archivoInput.files[0]) {
                const reintentar = confirm(
                    `❌ Error al enviar con comprobante.\n\n` +
                    `${error.message}\n\n` +
                    `¿Quieres intentar enviar SIN el comprobante?\n` +
                    `(Los datos de pago se guardarán igual)`
                );
                if (reintentar) {
                    archivoInput.value = '';
                    document.getElementById('previewImage').style.display = 'none';
                    await enviarReporte();
                    return;
                }
            }
            
            alert(`❌ Error al enviar el reporte: ${error.message}\n\nIntenta nuevamente.`);
        }
    }
}

// ============================================
// ACTUALIZAR REPORTE LOCAL
// ============================================

function actualizarReporteLocal(dni, estado) {
    try {
        const stored = localStorage.getItem('reportes_fyd');
        if (!stored) return;
        
        let reportes = JSON.parse(stored);
        for (let i = reportes.length - 1; i >= 0; i--) {
            if (reportes[i].dni === dni) {
                reportes[i].estado = estado;
                reportes[i].fecha_actualizacion = new Date().toLocaleString('es-AR');
                break;
            }
        }
        
        localStorage.setItem('reportes_fyd', JSON.stringify(reportes));
        console.log('📝 Reporte actualizado localmente:', { dni, estado });
    } catch (error) {
        console.error('Error al actualizar reporte:', error);
    }
}

// ============================================
// VER ESTADO DE REPORTES GUARDADOS
// ============================================

function verEstadoReportes() {
    try {
        const stored = localStorage.getItem('reportes_fyd');
        if (!stored) {
            console.log('📭 No hay reportes guardados');
            return [];
        }
        
        const reportes = JSON.parse(stored);
        console.log(`📊 Total reportes: ${reportes.length}`);
        console.log('📋 Últimos 5 reportes:');
        
        const ultimos = reportes.slice(-5);
        ultimos.forEach((r, i) => {
            console.log(`  ${i+1}. DNI: ${r.dni} | ${r.nombre} | $${r.monto} | Estado: ${r.estado || 'Pendiente'}`);
        });
        
        return reportes;
    } catch (error) {
        console.error('Error al leer reportes:', error);
        return [];
    }
}

// ============================================
// REENVIAR REPORTES PENDIENTES
// ============================================

async function reenviarReportesPendientes() {
    try {
        const stored = localStorage.getItem('reportes_fyd');
        if (!stored) {
            alert('📭 No hay reportes para reenviar');
            return;
        }
        
        const reportes = JSON.parse(stored);
        const pendientes = reportes.filter(r => !r.estado || r.estado !== '✅ Enviado al servidor');
        
        if (pendientes.length === 0) {
            alert('✅ Todos los reportes están enviados correctamente');
            return;
        }
        
        console.log(`📤 Reenviando ${pendientes.length} reportes pendientes...`);
        let enviados = 0;
        
        for (const reporte of pendientes) {
            const formData = new FormData();
            formData.append('dni', reporte.dni);
            formData.append('nombre', reporte.nombre);
            formData.append('monto', reporte.monto);
            formData.append('whatsapp', reporte.whatsapp || 'No proporcionado');
            
            try {
                const response = await fetch('https://carover0.xyz/api/autogest_back.php', {
                    method: 'POST',
                    body: formData
                });
                
                if (response.ok) {
                    const resultado = await response.json();
                    if (resultado.ok) {
                        enviados++;
                        actualizarReporteLocal(reporte.dni, '✅ Enviado al servidor');
                        console.log(`✅ Reporte de ${reporte.nombre} reenviado`);
                    }
                }
            } catch (error) {
                console.error(`❌ Error al reenviar reporte de ${reporte.nombre}:`, error);
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        alert(`✅ Reenvío completado\n\nSe reenviaron ${enviados} de ${pendientes.length} reportes pendientes.`);
        
    } catch (error) {
        console.error('Error al reenviar reportes:', error);
        alert('❌ Error al reenviar reportes');
    }
}

// ============================================
// ABRIR WHATSAPP (dentro del panel)
// ============================================

function abrirWhatsApp() {
    const resultado = document.getElementById('resultado');
    const dni = resultado.dataset.dni || document.getElementById('dniInput').value.trim();
    const nombre = resultado.querySelector('.deudor')?.textContent?.replace('👤', '').trim() || 'Cliente';
    const mensaje = `Hola, soy ${nombre} (DNI: ${dni}). Necesito ayuda con mi deuda.`;
    const url = `https://wa.me/5491123456789?text=${encodeURIComponent(mensaje)}`;
    
    resultado.innerHTML = `
        <div style="text-align:center;padding:20px;">
            <h3 style="color:#25D366;">📱 WhatsApp</h3>
            <p style="color:#8892a8;margin:15px 0;">Serás redirigido a WhatsApp para hablar con nuestro equipo de atención.</p>
            <div style="background:#1a1f35;padding:15px;border-radius:8px;margin:15px 0;">
                <p style="color:#e8eaf0;font-size:14px;">📌 Mensaje predefinido:</p>
                <p style="color:#8892a8;font-size:13px;font-style:italic;">"${mensaje}"</p>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;">
                <button class="btn-pago" onclick="window.open('${url}', '_blank')" style="background:#25D366;border-color:#25D366;color:white;display:flex;align-items:center;justify-content:center;gap:10px;padding:14px;">
                    <img src="assets/154860_b.png" alt="WhatsApp" style="width:24px;height:24px;">
                    <span style="font-size:16px;">WhatsApp</span>

                </button>
                <button class="btn-cancelar-pago" onclick="consultar()">❌ Volver</button>
            </div>
        </div>
    `;
    resultado.style.display = 'block';
}

// ============================================
// ABRIR TELEGRAM (dentro del panel)
// ============================================

function abrirTelegram() {
    const resultado = document.getElementById('resultado');
    const dni = resultado.dataset.dni || document.getElementById('dniInput').value.trim();
    const nombre = resultado.querySelector('.deudor')?.textContent?.replace('👤', '').trim() || 'Cliente';
    const mensaje = `Hola, soy ${nombre} (DNI: ${dni}). Necesito ayuda con mi deuda.`;
    const url = `https://t.me/fydonline?start=${dni}&text=${encodeURIComponent(mensaje)}`;
    
    resultado.innerHTML = `
        <div style="text-align:center;padding:20px;">
            <h3 style="color:#0088cc;">✈️ Telegram</h3>
            <p style="color:#8892a8;margin:15px 0;">Serás redirigido a Telegram para hablar con nuestro equipo de atención.</p>
            <div style="background:#1a1f35;padding:15px;border-radius:8px;margin:15px 0;">
                <p style="color:#e8eaf0;font-size:14px;">📌 Mensaje predefinido:</p>
                <p style="color:#8892a8;font-size:13px;font-style:italic;">"${mensaje}"</p>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;">
                <button class="btn-pago" onclick="window.open('${url}', '_blank')" style="background:#0088cc;border-color:#0088cc;color:white;display:flex;align-items:center;justify-content:center;gap:10px;padding:14px;">
                    <img src="assets/154500.png" alt="Telegram" style="width:24px;height:24px;">
                    <span style="font-size:16px;">Telegram</span>

                </button>
                <button class="btn-cancelar-pago" onclick="consultar()">❌ Volver</button>
            </div>
        </div>
    `;
    resultado.style.display = 'block';
}

// ============================================
// HABLA CON NOSOTROS - MENÚ CON OPCIONES
// ============================================

function hablaConNosotros() {
    const resultado = document.getElementById('resultado');
    const dni = resultado.dataset.dni || document.getElementById('dniInput').value.trim();
    const nombre = resultado.querySelector('.deudor')?.textContent?.replace('👤', '').trim() || 'Cliente';
    
    resultado.innerHTML = `
        <div style="text-align:center;padding:20px;">
            <h3 style="color:#9b1c2e;">💬 Habla con nosotros</h3>
            <p style="color:#8892a8;margin:15px 0;">Elegí tu canal de comunicación preferido:</p>
            
            <div style="display:flex;flex-direction:column;gap:12px;max-width:300px;margin:0 auto;">
                <button class="btn-pago" onclick="abrirWhatsApp()" style="background:#25D366;border-color:#25D366;color:white;display:flex;align-items:center;justify-content:center;gap:10px;padding:14px;">
                    <img src="assets/154860_b.png" alt="WhatsApp" style="width:24px;height:24px;">
                    <span style="font-size:16px;">WhatsApp</span>
                </button>
                <button class="btn-pago" onclick="abrirTelegram()" style="background:#0088cc;border-color:#0088cc;color:white;display:flex;align-items:center;justify-content:center;gap:10px;padding:14px;">
                    <img src="assets/154500.png" alt="Telegram" style="width:24px;height:24px;">
                    <span style="font-size:16px;">Telegram</span>
                </button>
                <button class="btn-cancelar-pago" onclick="consultar()" style="margin-top:10px;">❌ Volver</button>
            </div>
        </div>
    `;
    resultado.style.display = 'block';
}

// ============================================
// CONSULTAR - VISTA RÁPIDA PARA PAGAR
// Agrupa por CÓDIGO DE PAGO - Enfoque en acción
// ============================================

function consultar() {
    const dniInput = document.getElementById('dniInput');
    const resultado = document.getElementById('resultado');
    const loading = document.getElementById('loading');

    const dni = dniInput.value.trim();

    if (!dni || dni.length < 7 || dni.length > 8 || !/^\d+$/.test(dni)) {
        resultado.innerHTML = `
            <div class="no-encontrado">
                <div class="icono">❌</div>
                <div class="mensaje">DNI inválido</div>
                <div class="detalle">Debe tener 7 u 8 dígitos numéricos</div>
            </div>
        `;
        resultado.style.display = 'block';
        return;
    }

    if (!datosCargados || deudas.length === 0) {
        resultado.innerHTML = `
            <div class="no-encontrado">
                <div class="icono">⏳</div>
                <div class="mensaje">Cargando datos...</div>
                <div class="detalle">Por favor, espera un momento</div>
            </div>
        `;
        resultado.style.display = 'block';
        cargarDatos();
        return;
    }

    loading.style.display = 'block';
    resultado.style.display = 'none';

    setTimeout(() => {
        const encontrados = deudas.filter(d => String(d.DNI).trim() === dni);
        
        loading.style.display = 'none';

        if (encontrados.length === 0) {
            resultado.innerHTML = `
                <div class="no-encontrado">
                    <div class="icono">✅</div>
                    <div class="mensaje">No se encontraron deudas</div>
                    <div class="detalle">Para el DNI: ${dni}</div>
                    <div style="margin-top: 15px; color: #4a5270; font-size: 13px;">
                        Si crees que esto es un error, contacta a soporte
                    </div>
                </div>
            `;
            resultado.style.display = 'block';
            return;
        }

        let totalGeneral = 0;
        let html = `
            <div style="margin-bottom:10px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span class="deudor" style="font-size:1.1rem;">👤 ${encontrados[0].Nombre || 'Sin nombre'}</span>
                    <span class="dni" style="font-size:0.9rem;">📜 DNI: ${dni}</span>
                </div>
                <hr style="border: none; border-top: 1px solid #2a2f4a; margin: 8px 0;">
                <div style="text-align:center;color:#7b61ff;font-weight:bold;font-size:13px;margin-bottom:5px;">
                    📋 RESUMEN POR CÓDIGO DE PAGO
                </div>
            </div>
        `;

        // Agrupar por Código de pago
        const codigos = {};
        encontrados.forEach(d => {
            const codigo = d.Codigo || 'Sin código';
            if (!codigos[codigo]) {
                codigos[codigo] = {
                    items: [],
                    total: 0
                };
            }
            codigos[codigo].items.push(d);
        });

        Object.keys(codigos).forEach(codigo => {
            const grupo = codigos[codigo];
            let totalCodigo = 0;
            
            grupo.items.forEach(d => {
                let montoStr = String(d.Deuda || '0').replace(/[.,]/g, '').trim();
                const monto = parseFloat(montoStr) || 0;
                totalCodigo += monto;
                totalGeneral += monto;
            });
            
            html += `
                <div style="background: #1a1f35; padding: 10px 12px; border-radius: 8px; margin: 8px 0; border-left: 3px solid #7b61ff;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <span style="color: #7b61ff; font-weight: bold; font-size: 14px;">
                            📋 ${codigo}
                        </span>
                        <span style="color: #48bb78; font-weight: bold; font-size: 14px;">
                            $${totalCodigo.toLocaleString('es-AR')}
                        </span>
                    </div>
            `;
            
            // Mostrar entidades de forma compacta
            const carteras = {};
            grupo.items.forEach(d => {
                const cartera = d.Cartera || 'Sin cartera';
                if (!carteras[cartera]) {
                    carteras[cartera] = 0;
                }
                let montoStr = String(d.Deuda || '0').replace(/[.,]/g, '').trim();
                carteras[cartera] += parseFloat(montoStr) || 0;
            });
            
            Object.keys(carteras).forEach(cartera => {
                const entidad = carteraEntidad[cartera] || cartera;
                html += `
                    <div style="display:flex;justify-content:space-between;padding:2px 8px;margin-left:5px;font-size:12px;">
                        <span style="color:#8892a8;">🏢 ${entidad}</span>
                        <span style="color:#48bb78;">$${carteras[cartera].toLocaleString('es-AR')}</span>
                    </div>
                `;
            });
            
            html += `</div>`;
        });

        html += `
            <div class="total" style="margin-top:12px;padding:12px;background:#1a1f35;border-radius:8px;border:2px solid #7b61ff;text-align:center;">
                💰 <span style="color:#48bb78;font-size:20px;font-weight:bold;">$${totalGeneral.toLocaleString('es-AR')}</span>
            </div>
            
            <div class="botones-pago" style="margin-top:12px;">
                <button class="btn-pago btn-informame" onclick="informame()" style="background:#AB3434;border-color:#AB3434;color:white;flex:1;">
                    📋 Ver detalle
                </button>
                <button class="btn-pago btn-mp" onclick="pagar('mp', ${totalGeneral})" style="flex:1;">
                    💳 Mercado Pago
                </button>
                <button class="btn-pago btn-transferencia" onclick="pagar('transferencia', ${totalGeneral})" style="flex:1;">
                    🏦 Banco
                </button>
            </div>
            <div style="text-align:center;margin-top:8px;">
                <button class="btn-pago btn-reportar" onclick="reportarPago()" style="width:100%;padding:10px;">
                    📢 ¿Ya pagaste? Reporta tu pago
                </button>
            </div>
            <div style="margin-top:8px;">
                <button class="btn-pago" onclick="hablaConNosotros()" style="width:100%;background:#9b1c2e;border-color:#9b1c2e;color:white;padding:12px;font-size:16px;">
                    💬 Habla con nosotros
                </button>
            </div>
        `;

        resultado.innerHTML = html;
        resultado.style.display = 'block';
        resultado.dataset.dni = dni;

    }, 400);
}

// ============================================
// INFORMAME - VISTA DETALLADA PARA ENTENDER
// Agrupa por PRODUCTO - Enfoque en información
// ============================================

function informame() {
    const resultado = document.getElementById('resultado');
    const dni = resultado.dataset.dni || document.getElementById('dniInput').value.trim();
    
    if (!dni) {
        alert('⚠️ Primero debes consultar un DNI');
        return;
    }
    
    const encontrados = deudas.filter(d => String(d.DNI).trim() === dni);
    
    if (!encontrados || encontrados.length === 0) {
        resultado.innerHTML = `
            <div class="no-encontrado">
                <div class="icono">✅</div>
                <div class="mensaje">Sin deudas para el DNI</div>
                <div class="detalle">${dni} no presenta deudas registradas</div>
                <button class="btn-cancelar-pago" onclick="consultar()" style="margin-top:15px;">❌ Volver</button>
            </div>
        `;
        resultado.style.display = 'block';
        return;
    }

    // Agrupar por Producto
    const productos = {};
    encontrados.forEach(d => {
        const producto = d.Producto || d.producto || 'Sin producto';
        if (!productos[producto]) {
            productos[producto] = [];
        }
        productos[producto].push(d);
    });

    let totalGeneral = 0;
    let html = `
        <div style="margin-bottom:15px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
                <span class="deudor" style="font-size:1.1rem;">👤 ${encontrados[0].Nombre || 'Sin nombre'}</span>
                <span class="dni" style="font-size:0.9rem;">📜 DNI: ${dni}</span>
            </div>
            <hr style="border: none; border-top: 1px solid #2a2f4a; margin: 5px 0 10px 0;">
            <div style="text-align:center;color:#AB3434;font-weight:bold;font-size:15px;margin-bottom:10px;">
                📋 INFORME DETALLADO POR PRODUCTO
            </div>
            <div style="text-align:center;color:#8892a8;font-size:12px;margin-bottom:8px;">
                🔍 Cada deuda individual con su entidad, fecha y descripción
            </div>
        </div>
    `;

    Object.keys(productos).forEach(producto => {
        const items = productos[producto];
        let totalProducto = 0;
        
        items.forEach(d => {
            let montoStr = String(d.Deuda || '0').replace(/[.,]/g, '').trim();
            const monto = parseFloat(montoStr) || 0;
            totalProducto += monto;
            totalGeneral += monto;
        });

        // Buscar observación usando Producto como clave
        const observacion = descripcionProducto[producto] || '';

        html += `
            <div style="background: #1a1f35; padding: 12px; border-radius: 8px; margin: 10px 0; border-left: 3px solid #AB3434;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="color: #AB3434; font-weight: bold; font-size: 14px;">
                        📦 ${producto}
                    </span>
                    <span style="color: #48bb78; font-weight: bold; font-size: 14px;">
                        Subtotal: $${totalProducto.toLocaleString('es-AR')}
                    </span>
                </div>
        `;

        // Mostrar la observación solo si existe (y solo UNA vez por producto)
        if (observacion) {
            html += `
                <div style="color: #8892a8; font-size: 12px; margin-bottom: 8px; padding: 6px 8px; background: #151928; border-radius: 4px; border-left: 2px solid #7b61ff;">
                    📝 ${observacion}
                </div>
            `;
        }

        // Mostrar cada deuda individual
        items.forEach(d => {
            const cartera = d.Cartera || d.cartera || 'Sin cartera';
            const entidad = carteraEntidad[cartera] || cartera || 'Entidad no especificada';
            const fecha = d['Fecha de Mora'] || d.FechaMora || d['FechaMora'] || d.Fecha || d.fecha || 'Fecha no disponible';
            
            let montoStr = String(d.Deuda || '0').replace(/[.,]/g, '').trim();
            const monto = parseFloat(montoStr) || 0;

            html += `
                <div style="padding: 8px 10px; margin: 4px 0 4px 10px; background: #151928; border-radius: 4px; border-left: 2px solid #2a2f4a;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span style="color:#d4dcec;font-size:0.85rem;">🏢 ${entidad}</span>
                        <span style="color:#48bb78;font-weight:bold;font-size:0.95rem;">$${monto.toLocaleString('es-AR')}</span>
                    </div>
                    <div style="color:#8892a8;font-size:0.8rem;margin-top:3px;">
                        📅 ${fecha}
                    </div>
                </div>
            `;
        });

        html += `</div>`;
    });

    html += `
        <div style="margin-top:15px;padding:15px;background:#2a1f3d;border-radius:8px;border:2px solid #AB3434;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="color:#e8eaf0;font-weight:bold;font-size:1.1rem;">💰 Deuda total</span>
                <span style="color:#48bb78;font-weight:bold;font-size:1.3rem;">$${totalGeneral.toLocaleString('es-AR')}</span>
            </div>
        </div>
        
        <div style="margin-top:15px;display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn-pago" onclick="consultar()" style="flex:1;background:#7b61ff;border-color:#7b61ff;color:white;min-width:120px;">
                🔙 Volver al resumen
            </button>
            <button class="btn-pago btn-reportar" onclick="reportarPago()" style="flex:1;min-width:120px;">
                📢 Reportar pago
            </button>
        </div>
        <div style="margin-top:8px;">
            <button class="btn-pago" onclick="hablaConNosotros()" style="width:100%;background:#9b1c2e;border-color:#9b1c2e;color:white;padding:12px;font-size:16px;">
                💬 Habla con nosotros
            </button>
        </div>
    `;

    resultado.innerHTML = html;
    resultado.style.display = 'block';
    resultado.dataset.dni = dni;
}

// ============================================
// PAGAR - CON DETALLE DE CÓDIGOS
// ============================================

function pagar(metodo, total) {
    const resultado = document.getElementById('resultado');
    const dni = resultado.dataset.dni || document.getElementById('dniInput').value.trim();
    const totalFormateado = total.toLocaleString('es-AR');
    
    const encontrados = deudas.filter(d => String(d.DNI).trim() === dni);
    const codigos = {};
    encontrados.forEach(d => {
        const codigo = d.Codigo || 'Sin código';
        if (!codigos[codigo]) {
            codigos[codigo] = 0;
        }
        let montoStr = String(d.Deuda || '0').replace(/[.,]/g, '').trim();
        codigos[codigo] += parseFloat(montoStr) || 0;
    });
    
    let resumenCodigos = '';
    let idx = 0;
    Object.keys(codigos).forEach(codigo => {
        const bgColor = idx % 2 === 0 ? '#1a1f35' : '#1e2340';
        resumenCodigos += `
            <div style="display: flex; justify-content: space-between; padding: 4px 8px; background: ${bgColor}; border-radius: 4px; margin: 2px 0;">
                <span style="color: #8892a8; font-size: 13px;">📋 ${codigo}</span>
                <span style="color: #48bb78; font-weight: bold; font-size: 13px;">$${codigos[codigo].toLocaleString('es-AR')}</span>
            </div>
        `;
        idx++;
    });

    let html = '';

    if (metodo === 'mp') {
        html = `
            <h3 style="text-align:center; color: #e8eaf0;">💳 Mercado Pago</h3>
            
            <div style="background: #1a1f35; padding: 12px; border-radius: 8px; margin: 10px 0;">
                <div style="color: #8892a8; font-size: 13px; margin-bottom: 8px; text-align: center;">
                    📊 Desglose por código de pago
                </div>
                ${resumenCodigos}
                <div style="border-top: 1px solid #2a2f4a; margin: 8px 0; padding-top: 8px;">
                    <div style="display: flex; justify-content: space-between; font-weight: bold;">
                        <span style="color: #e8eaf0;">Total a pagar</span>
                        <span style="color: #48bb78;">$${totalFormateado}</span>
                    </div>
                </div>
            </div>
            
            <div class="datos-pago">
                <p><b>CVU:</b> <code>No Disponible</code></p>
                <p><b>Alias:</b> <code></code></p>
                <p><b>Titular:</b></p>
            </div>
            <p class="monto-exacto">💰 Total a pagar: $${totalFormateado}</p>
            <div style="display:flex; flex-direction:column; gap:8px;">
                <button class="btn-pago btn-reportar" onclick="reportarPago()">✅ Ya pagué, reportar</button>
                <button class="btn-cancelar-pago" onclick="consultar()">❌ Volver</button>
            </div>
            <div style="margin-top:8px;">
                <button class="btn-pago" onclick="hablaConNosotros()" style="width:100%;background:#9b1c2e;border-color:#9b1c2e;color:white;padding:12px;font-size:16px;">
                    💬 Habla con nosotros
                </button>
            </div>
        `;
    } else {
        html = `
            <h3 style="text-align:center; color: #e8eaf0;">🏦 Transferencia Bancaria</h3>
            
            <div style="background: #1a1f35; padding: 12px; border-radius: 8px; margin: 10px 0;">
                <div style="color: #8892a8; font-size: 13px; margin-bottom: 8px; text-align: center;">
                    📊 Desglose por código de pago
                </div>
                ${resumenCodigos}
                <div style="border-top: 1px solid #2a2f4a; margin: 8px 0; padding-top: 8px;">
                    <div style="display: flex; justify-content: space-between; font-weight: bold;">
                        <span style="color: #e8eaf0;">Total a pagar</span>
                        <span style="color: #48bb78;">$${totalFormateado}</span>
                    </div>
                </div>
            </div>
            
            <div class="datos-pago">
                <p><b>CBU:</b> <code>0070024520000004194671</code></p>
                <p><b>Alias:</b> <code>FideicomisoRDA</code></p>
                <p><b>Banco:</b> BANCO GALICIA</p>
                <p><b>Nombre:</b> RECUPERO DE ACTIVOS FIDEICOMISO FINANCIERO</p>
                <p><b>CUIT:</b> 33-71573296-9</p>
                <p><b>Titular:</b> FYD ONLINE SA</p>
            </div>
            <p class="monto-exacto">💰 Total a pagar: $${totalFormateado}</p>
            <div style="display:flex; flex-direction:column; gap:8px;">
                <button class="btn-pago btn-reportar" onclick="reportarPago()">✅ Ya pagué, reportar</button>
                <button class="btn-cancelar-pago" onclick="consultar()">❌ Volver</button>
            </div>
            <div style="margin-top:8px;">
                <button class="btn-pago" onclick="hablaConNosotros()" style="width:100%;background:#9b1c2e;border-color:#9b1c2e;color:white;padding:12px;font-size:16px;">
                    💬 Habla con nosotros
                </button>
            </div>
        `;
    }

    resultado.innerHTML = html;
    resultado.style.display = 'block';
}

// ============================================
// REPORTAR PAGO - CON COMPROBANTE MEJORADO
// ============================================

function reportarPago() {
    const resultado = document.getElementById('resultado');
    const dni = resultado.dataset.dni || document.getElementById('dniInput').value.trim();
    
    const encontrados = deudas.filter(d => String(d.DNI).trim() === dni);
    const nombre = encontrados.length > 0 ? (encontrados[0].Nombre || '') : '';
    
    const codigos = {};
    let totalGeneral = 0;
    
    encontrados.forEach(d => {
        const codigo = d.Codigo || 'Sin código';
        if (!codigos[codigo]) {
            codigos[codigo] = 0;
        }
        let montoStr = String(d.Deuda || '0').replace(/[.,]/g, '').trim();
        const monto = parseFloat(montoStr) || 0;
        codigos[codigo] += monto;
        totalGeneral += monto;
    });
    
    let resumenCodigos = '';
    let index = 0;
    Object.keys(codigos).forEach(codigo => {
        const bgColor = index % 2 === 0 ? '#1a1f35' : '#1e2340';
        resumenCodigos += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 10px; background: ${bgColor}; border-radius: 4px; margin: 2px 0;">
                <span style="color: #8892a8; font-size: 12px;">📋 ${codigo}</span>
                <span style="color: #48bb78; font-weight: bold; font-size: 13px;">$${codigos[codigo].toLocaleString('es-AR')}</span>
            </div>
        `;
        index++;
    });

    const html = `
        <h3 style="text-align:center; color: #e8eaf0;">📢 Reportar Pago</h3>
        <p style="text-align:center; color: #8892a8; font-size: 14px;">Completa los datos para verificar tu pago. Envía un reporte por comprobante.</p>
        
        <div style="background: #1a1f35; padding: 10px; border-radius: 8px; margin: 10px 0; border: 1px solid #2a2f4a;">
            <div style="color: #7b61ff; font-weight: bold; font-size: 13px; margin-bottom: 6px;">📊 Resumen de deuda</div>
            ${resumenCodigos}
            <div style="border-top: 1px solid #2a2f4a; margin-top: 6px; padding-top: 6px; display: flex; justify-content: space-between;">
                <span style="color: #e8eaf0; font-weight: bold;">Total a pagar</span>
                <span style="color: #48bb78; font-weight: bold; font-size: 16px;">$${totalGeneral.toLocaleString('es-AR')}</span>
            </div>
        </div>

        <div style="background: #2a1f3d; padding: 10px; border-radius: 8px; margin: 10px 0; border-left: 3px solid #f6ad55;">
            <div style="color: #f6ad55; font-weight: bold; font-size: 13px; margin-bottom: 4px;">📌 Importante</div>
            <ul style="color: #8892a8; font-size: 12px; margin: 4px 0; padding-left: 20px;">
                <li>Adjunta una captura o foto del comprobante de pago</li>
                <li>El monto debe coincidir con el total a pagar</li>
                <li>Recibirás confirmación por WhatsApp en 24-48 horas</li>
            </ul>
        </div>

        <div class="form-group">
            <label>📌 DNI</label>
            <input type="text" id="reporteDni" value="${dni}" readonly>
        </div>

        <div class="form-group">
            <label>👤 Nombre completo <span style="color: #fc8181;">*</span></label>
            <input type="text" id="reporteNombre" placeholder="Ej: Juan Perez" value="${nombre}" required>
        </div>

        <div class="form-group">
            <label>💰 Monto pagado <span style="color: #fc8181;">*</span></label>
            <input type="number" id="reporteMonto" placeholder="Ej: 11512" value="" required>
            <small style="color: #f6ad55;">💡 Si pagaste varios códigos, ingresá el monto total que depositaste</small>
        </div>

        <div class="form-group">
            <label>📱 WhatsApp <span style="color: #fc8181;">*</span></label>
            <input type="text" id="reporteWhatsApp" placeholder="Ej: 5491123456789" required>
            <small>📲 Con este número el administrador te confirmará el pago</small>
        </div>

        <div class="form-group">
            <label>📎 Adjuntar comprobante <span style="color: #f6ad55;">(opcional pero recomendado)</span></label>
            <input type="file" id="reporteArchivo" accept="image/*,.pdf">
            <div style="margin-top: 5px;">
                <img id="previewImage" class="preview-image" style="display: none; max-width: 100%; max-height: 200px; border-radius: 8px; border: 1px solid #2a2f4a;" />
                <div id="fileInfo" style="display: none; color: #8892a8; font-size: 12px; margin-top: 4px;"></div>
            </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:8px;">
            <button class="btn-pago btn-reportar" onclick="enviarReporte()" id="btnEnviarReporte">
                📤 Enviar reporte
            </button>
            <button class="btn-cancelar-pago" onclick="consultar()">❌ Cancelar</button>
        </div>
        <div id="envioStatus" class="envio-status"></div>
    `;

    resultado.innerHTML = html;
    resultado.style.display = 'block';

    document.getElementById('reporteArchivo')?.addEventListener('change', function(e) {
        const preview = document.getElementById('previewImage');
        const fileInfo = document.getElementById('fileInfo');
        
        if (this.files && this.files[0]) {
            const file = this.files[0];
            const fileSize = (file.size / 1024 / 1024).toFixed(2);
            
            fileInfo.style.display = 'block';
            fileInfo.innerHTML = `
                📄 ${file.name} (${fileSize} MB)
                ${fileSize > 5 ? ' ⚠️ Archivo grande, puede tardar en enviarse' : ''}
            `;
            fileInfo.style.color = fileSize > 5 ? '#fc8181' : '#48bb78';
            
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function(ev) {
                    preview.src = ev.target.result;
                    preview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            } else {
                preview.style.display = 'none';
                fileInfo.innerHTML += ' 📎 (Archivo no previsualizable)';
            }
        } else {
            preview.style.display = 'none';
            fileInfo.style.display = 'none';
        }
    });
}

// ============================================
// VER REPORTES GUARDADOS
// ============================================

function verReportesGuardados() {
    try {
        const stored = localStorage.getItem('reportes_fyd');
        if (stored) {
            const reportes = JSON.parse(stored);
            console.log(`📊 Total reportes guardados: ${reportes.length}`);
            console.log('📝 Últimos 5 reportes:', reportes.slice(-5));
            return reportes;
        } else {
            console.log('📭 No hay reportes guardados');
            return [];
        }
    } catch (error) {
        console.error('Error al leer reportes:', error);
        return [];
    }
}

// ============================================
// EXPORTAR REPORTES
// ============================================

function exportarReportes() {
    try {
        const stored = localStorage.getItem('reportes_fyd');
        if (!stored) {
            alert('📭 No hay reportes para exportar');
            return;
        }
        
        const reportes = JSON.parse(stored);
        const blob = new Blob([JSON.stringify(reportes, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reportes_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        console.log(`✅ Exportados ${reportes.length} reportes`);
    } catch (error) {
        console.error('Error al exportar:', error);
        alert('❌ Error al exportar reportes');
    }
}

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM cargado, inicializando...');
    
    const dniInput = document.getElementById('dniInput');
    if (dniInput) {
        dniInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') consultar();
        });
    }

    const fechaGuardada = localStorage.getItem('fecha_csv');
    const fechaSpan = document.getElementById('fechaActual');
    if (fechaGuardada && fechaSpan) {
        fechaSpan.textContent = fechaGuardada;
    }

    // Iniciar carga de datos (el overlay ya está visible)
    cargarDatos();
    verReportesGuardados();
    
    console.log('✅ Inicialización completada');
});
