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
// FUNCIÓN PARA CONVERTIR CSV A JSON
// ============================================

function csvToJson(csv) {
    const lines = csv.trim().split('\n');
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    const result = [];

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        // Dividir por coma pero respetando valores entre comillas
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
            // Limpiar comillas si existen
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
// ENVIAR REPORTE AL VPS CON COMPROBANTE - VERSION ORIGINAL MEJORADA
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
    
    // Verificar tamaño del archivo
    if (archivoInput.files && archivoInput.files[0]) {
        const fileSize = archivoInput.files[0].size / 1024 / 1024; // en MB
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
        // Timeout de 60 segundos para el fetch
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        const response = await fetch('https://carover0.xyz/api/autogest_back.php', {
            method: 'POST',
            body: formData,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Verificar que la respuesta sea JSON
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

            // Limpiar campos
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
        
        // Si es error de abort, mostrar mensaje de tiempo
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
            
            // Ofrecer intentar sin comprobante
            if (archivoInput.files && archivoInput.files[0]) {
                const reintentar = confirm(
                    `❌ Error al enviar con comprobante.\n\n` +
                    `${error.message}\n\n` +
                    `¿Quieres intentar enviar SIN el comprobante?\n` +
                    `(Los datos de pago se guardarán igual)`
                );
                if (reintentar) {
                    // Limpiar el archivo y reintentar
                    archivoInput.value = '';
                    document.getElementById('previewImage').style.display = 'none';
                    // Llamar de nuevo pero sin archivo
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
        // Buscar el último reporte con ese DNI y actualizarlo
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
            
            // Pequeña pausa entre envíos
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        alert(`✅ Reenvío completado\n\nSe reenviaron ${enviados} de ${pendientes.length} reportes pendientes.`);
        
    } catch (error) {
        console.error('Error al reenviar reportes:', error);
        alert('❌ Error al reenviar reportes');
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
        console.log('📋 Primer registro:', deudas[0]); // Para debug
        
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
                    Verifica que el archivo <b>deudas.csv</b> esté en el mismo directorio.<br>
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
                        <div class="mensaje">DNI inválido</div>
                        <div class="detalle">Debe tener 7 u 8 dígitos numéricos</div>
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
        // BUSCAR POR DNI
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

        let total = 0;
        let html = `
                    <div class="deudor">👤 ${encontrados[0].Nombre || 'Sin nombre'}</div>
                    <div class="dni">📜 DNI: ${dni}</div>
                    <div style="color: #8892a8; font-size: 13px; margin-bottom: 10px;">
                        📋 Código de pago: ${encontrados[0].Codigo || 'N/A'}
                    </div>
                    <hr style="border: none; border-top: 1px solid #2a2f4a; margin: 10px 0;">
                `;

        // Agrupar por cartera
        const carteras = {};
        encontrados.forEach(d => {
            const cartera = d.Cartera || 'Sin cartera';
            if (!carteras[cartera]) {
                carteras[cartera] = [];
            }
            carteras[cartera].push(d);
        });

        // Mostrar deudas agrupadas por cartera
        Object.keys(carteras).forEach(cartera => {
            html += `<div style="margin-bottom: 10px;">`;
            html += `<div style="color: #7b61ff; font-weight: bold; font-size: 14px;">🏢 ${cartera}</div>`;
            
            carteras[cartera].forEach(d => {
                // Limpiar el monto: eliminar puntos, comas y convertir a número
                let montoStr = String(d.Deuda || '0').replace(/[.,]/g, '').trim();
                const monto = parseFloat(montoStr) || 0;
                total += monto;
                
                html += `
                            <div class="deuda-item">
                                <span class="entidad">📌 ${d.Producto || 'N/A'}</span>
                                <span class="monto">$${monto.toLocaleString('es-AR')}</span>
                            </div>
                        `;
            });
            html += `</div>`;
        });

        // Agregar información de fecha si existe
        if (encontrados[0].Fecha && encontrados[0].Fecha !== '') {
            html += `
                        <div style="background: #2a1f3d; padding: 8px 12px; border-radius: 6px; margin: 10px 0; font-size: 13px; color: #fc8181;">
                            ⚠️ Fecha de mora: ${encontrados[0].Fecha}
                        </div>
                    `;
        }

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
                        <button class="btn-pago btn-reportar" onclick="reportarPago()">✅ Ya pagué, reportar</button>
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
                        <button class="btn-pago btn-reportar" onclick="reportarPago()">✅ Ya pagué, reportar</button>
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
                    <small>Con este número el administrador te confirmará el pago</small>
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
