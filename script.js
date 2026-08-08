// ============================================
// VARIABLES GLOBALES
// ============================================

let deudas = [];
let datosCargados = false;

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
// FUNCIoN PARA CONVERTIR CSV A JSON
// ============================================

function csvToJson(csv) {
    const lines = csv.trim().split('\n');
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().toUpperCase());
    const result = [];

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const values = lines[i].split(',').map(v => v.trim());
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = values[index] || '';
        });
        result.push(obj);
    }
    return result;
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
        const response = await fetch('https://carover0.xyz/api/autogest_back.php', {
            method: 'POST',
            body: formData
        });

        const resultado = await response.json();

        if (resultado.ok) {
            statusDiv.innerHTML = '✅ ¡Reporte enviado correctamente!';
            statusDiv.style.color = '#48bb78';

            alert(
                `✅ ¡Reporte enviado!\n\nDNI: ${dni}\nNombre: ${nombre}\nMonto: $${parseFloat(monto).toLocaleString('es-AR')}\nWhatsApp: ${whatsapp || 'No proporcionado'}\n\n⏳ Tu pago sera procesado a la brevedad.`);

            setTimeout(() => consultar(), 1500);
        } else {
            throw new Error(resultado.error || 'Error al enviar');
        }
    } catch (error) {
        console.error('Error:', error);
        statusDiv.innerHTML = `❌ Error al enviar: ${error.message}`;
        statusDiv.style.color = '#fc8181';
        alert(`❌ Error al enviar el reporte: ${error.message}\n\nIntenta nuevamente.`);
    }
}

// ============================================
// CARGAR CSV
// ============================================

async function cargarDatos() {
    try {
        const response = await fetch('deudas.csv');

        if (!response.ok) {
            throw new Error(`Error al cargar: ${response.status}`);
        }

        const csvData = await response.text();
        deudas = csvToJson(csvData);
        datosCargados = true;

        console.log(`✅ ${deudas.length} deudas cargadas correctamente`);
        document.getElementById('errorCarga').style.display = 'none';

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
        document.getElementById('fechaActual').textContent = fechaMostrar;

    } catch (error) {
        console.error('Error al cargar CSV:', error);
        document.getElementById('errorCarga').style.display = 'block';
        document.getElementById('errorCarga').innerHTML = `
                    ❌ No se pudo cargar el archivo de deudas.<br>
                    Verifica que el archivo <b>deudas.csv</b> este en el mismo directorio.<br>
                    <small style="color: #fc8181;">${error.message}</small>
                `;
    }
}

// ============================================
// CONSULTAR
// ============================================

function consultar() {
    const dniInput = document.getElementById('dniInput');
    const resultado = document.getElementById('resultado');
    const loading = document.getElementById('loading');

    const dni = dniInput.value.trim();

    // Validar DNI
    if (!dni || dni.length < 7 || dni.length > 8 || !/^\d+$/.test(dni)) {
        resultado.innerHTML = `
                    <div class="no-encontrado">
                        <div class="icono">❌</div>
                        <div class="mensaje">DNI invalido</div>
                        <div class="detalle">Debe tener 7 u 8 digitos numericos</div>
                    </div>
                `;
        resultado.style.display = 'block';
        return;
    }

    // Verificar que los datos estén cargados
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
        // BUSCAR POR DNI EN LA COLUMNA CUENTA
        const encontrados = deudas.filter(d => String(d.CUENTA).trim() === dni);
        
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

        let total = 0;
        let html = `
                    <div class="deudor">👤 ${encontrados[0].DEUDOR}</div>
                    <div class="dni">📜 DNI: ${dni}</div>
                    <hr style="border: none; border-top: 1px solid #2a2f4a; margin: 10px 0;">
                `;

        encontrados.forEach(d => {
            const monto = parseFloat(String(d.TOTAL).replace(/[.,]/g, '')) || 0;
            total += monto;
            html += `
                        <div class="deuda-item">
                            <span class="entidad">🏢 ${d.ENTIDAD}</span>
                            <span class="monto">$${monto.toLocaleString('es-AR')}</span>
                        </div>
                    `;
        });

        html += `
                    <div class="total">💰 Deuda total: <span>$${total.toLocaleString('es-AR')}</span></div>
                    <div class="botones-pago">
                        <button class="btn-pago btn-mp" onclick="pagar('mp', ${total})">
                            💳 Mercado Pago
                        </button>
                        <button class="btn-pago btn-transferencia" onclick="pagar('transferencia', ${total})">
                            🏦 Transferencia
                        </button>
                    </div>
                    <div style="text-align:center; margin-top: 10px;">
                        <button class="btn-pago btn-reportar" onclick="reportarPago()" style="width:100%; padding: 10px;">
                            📢 ¿Ya pagaste? Reporta tu pago
                        </button>
                    </div>
                `;

        resultado.innerHTML = html;
        resultado.style.display = 'block';
        resultado.dataset.dni = dni;

    }, 400);
}

// ============================================
// PAGAR
// ============================================

function pagar(metodo, total) {
    const totalFormateado = total.toLocaleString('es-AR');

    let html = '';

    if (metodo === 'mp') {
        html = `
                    <h3 style="text-align:center; color: #e8eaf0;">💳 Mercado Pago</h3>
                    <div class="datos-pago">
                        <p><b>CVU:</b> <code>0000003100064272868986</code></p>
                        <p><b>Alias:</b> <code>LUNA.FUTBOL.VELA</code></p>
                        <p><b>Titular:</b> FYD ONLINE SA</p>
                    </div>
                    <p class="monto-exacto">Monto exacto: $${totalFormateado}</p>
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <button class="btn-pago btn-reportar" onclick="reportarPago()">✅ Ya pague, reportar</button>
                        <button class="btn-cancelar-pago" onclick="consultar()">❌ Volver</button>
                    </div>
                `;
    } else {
        html = `
                    <h3 style="text-align:center; color: #e8eaf0;">🏦 Transferencia Bancaria</h3>
                    <div class="datos-pago">
                        <p><b>CBU:</b> <code>0000003100064272868986</code></p>
                        <p><b>Alias:</b> <code>CACA.APESTA.FEO</code></p>
                        <p><b>Banco:</b> Banco X</p>
                        <p><b>Titular:</b> FYD ONLINE SA</p>
                    </div>
                    <p class="monto-exacto">Monto exacto: $${totalFormateado}</p>
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <button class="btn-pago btn-reportar" onclick="reportarPago()">✅ Ya pague, reportar</button>
                        <button class="btn-cancelar-pago" onclick="consultar()">❌ Volver</button>
                    </div>
                `;
    }

    const resultado = document.getElementById('resultado');
    resultado.innerHTML = html;
    resultado.style.display = 'block';
}

// ============================================
// REPORTAR PAGO
// ============================================

function reportarPago() {
    const resultado = document.getElementById('resultado');
    const dni = resultado.dataset.dni || document.getElementById('dniInput').value.trim();

    const html = `
                <h3 style="text-align:center; color: #e8eaf0;">📢 Reportar Pago</h3>
                <p style="text-align:center; color: #8892a8; font-size: 14px;">Completa los datos para verificar tu pago</p>

                <div class="form-group">
                    <label>📌 DNI</label>
                    <input type="text" id="reporteDni" value="${dni}" readonly>
                </div>

                <div class="form-group">
                    <label>👤 Nombre completo</label>
                    <input type="text" id="reporteNombre" placeholder="Ej: Juan Perez">
                </div>

                <div class="form-group">
                    <label>💰 Monto pagado</label>
                    <input type="number" id="reporteMonto" placeholder="Ej: 11512">
                </div>

                <div class="form-group">
                    <label>📱 WhatsApp</label>
                    <input type="text" id="reporteWhatsApp" placeholder="Ej: 5491123456789">
                    <small>Con este numero el administrador te confirmara el pago</small>
                </div>

                <div class="form-group">
                    <label>📎 Adjuntar comprobante (opcional)</label>
                    <input type="file" id="reporteArchivo" accept="image/*">
                    <img id="previewImage" class="preview-image" />
                </div>

                <div style="display:flex; flex-direction:column; gap:8px;">
                    <button class="btn-pago btn-reportar" onclick="enviarReporte()">📤 Enviar reporte</button>
                    <button class="btn-cancelar-pago" onclick="consultar()">❌ Cancelar</button>
                </div>
                <div id="envioStatus" class="envio-status"></div>
            `;

    resultado.innerHTML = html;
    resultado.style.display = 'block';

    document.getElementById('reporteArchivo')?.addEventListener('change', function(e) {
        const preview = document.getElementById('previewImage');
        if (this.files && this.files[0]) {
            const reader = new FileReader();
            reader.onload = function(ev) {
                preview.src = ev.target.result;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(this.files[0]);
        } else {
            preview.style.display = 'none';
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
            console.log('📝 ultimos 5 reportes:', reportes.slice(-5));
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
// ENTER PARA CONSULTAR
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('dniInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') consultar();
    });

    const fechaGuardada = localStorage.getItem('fecha_csv');
    if (fechaGuardada) {
        document.getElementById('fechaActual').textContent = fechaGuardada;
    }

    cargarDatos();
    verReportesGuardados();
});