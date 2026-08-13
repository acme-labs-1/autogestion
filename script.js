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
// CONSULTAR - CON TOTAL POR CÓDIGO DE PAGO INTEGRADO
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

        let totalGeneral = 0;
        let html = `
                    <div class="deudor">👤 ${encontrados[0].Nombre || 'Sin nombre'}</div>
                    <div class="dni">📜 DNI: ${dni}</div>
                    <hr style="border: none; border-top: 1px solid #2a2f4a; margin: 10px 0;">
                `;

        // PRIMERO: Agrupar por CÓDIGO DE PAGO
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

        // Mostrar por cada código de pago
        Object.keys(codigos).forEach(codigo => {
            const grupo = codigos[codigo];
            let totalCodigo = 0;
            
            // Calcular total del código
            grupo.items.forEach(d => {
                let montoStr = String(d.Deuda || '0').replace(/[.,]/g, '').trim();
                const monto = parseFloat(montoStr) || 0;
                totalCodigo += monto;
                totalGeneral += monto;
            });
            
            // Mostrar encabezado del código
            html += `
                        <div style="background: #1a1f35; padding: 10px 12px; border-radius: 8px; margin: 10px 0; border-left: 3px solid #7b61ff;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <span style="color: #7b61ff; font-weight: bold; font-size: 14px;">
                                    📋 Código de pago: ${codigo}
                                </span>
                                <span style="color: #48bb78; font-weight: bold; font-size: 14px;">
                                    Subtotal: $${totalCodigo.toLocaleString('es-AR')}
                                </span>
                            </div>
                    `;
            
            // Agrupar por cartera dentro del código
            const carteras = {};
            grupo.items.forEach(d => {
                const cartera = d.Cartera || 'Sin cartera';
                if (!carteras[cartera]) {
                    carteras[cartera] = [];
                }
                carteras[cartera].push(d);
            });
            
            // Mostrar deudas por cartera
            Object.keys(carteras).forEach(cartera => {
                html += `<div style="margin: 5px 0 5px 10px;">`;
                html += `<div style="color: #8892a8; font-size: 12px; margin-bottom: 3px;">🏢 ${cartera}</div>`;
                
                carteras[cartera].forEach(d => {
                    let montoStr = String(d.Deuda || '0').replace(/[.,]/g, '').trim();
                    const monto = parseFloat(montoStr) || 0;
                    
                    html += `
                                <div class="deuda-item" style="padding: 4px 8px; margin-left: 10px;">
                                    <span class="entidad" style="font-size: 13px;">📌 ${d.Producto || 'N/A'}</span>
                                    <span class="monto" style="font-size: 13px;">$${monto.toLocaleString('es-AR')}</span>
                                </div>
                            `;
                });
                html += `</div>`;
            });
            
            html += `</div>`;
        });

        // Agregar fecha de mora si existe
        const fechaMora = encontrados.find(d => d.Fecha && d.Fecha !== '');
        if (fechaMora) {
            html += `
                        <div style="background: #2a1f3d; padding: 8px 12px; border-radius: 6px; margin: 10px 0; font-size: 13px; color: #fc8181;">
                            ⚠️ Fecha de mora: ${fechaMora.Fecha}
                        </div>
                    `;
        }

        // TOTAL GENERAL
        html += `
                    <div class="total" style="margin-top: 15px; padding: 12px; background: #1a1f35; border-radius: 8px; border: 2px solid #7b61ff;">
                        💰 Deuda total: <span style="color: #48bb78; font-size: 20px;">$${totalGeneral.toLocaleString('es-AR')}</span>
                    </div>
                    
                    <div style="margin-top: 15px; background: #1a1f35; border-radius: 8px; border: 1px solid #2a2f4a; overflow: hidden;">
                        <div style="background: #2a1f3d; padding: 8px 12px; border-bottom: 1px solid #2a2f4a;">
                            <span style="color: #7b61ff; font-weight: bold; font-size: 13px;">📊 Resumen por código de pago</span>
                        </div>
                        <div style="padding: 8px 12px;">
                    `;
        
        // Mostrar resumen de códigos con el mismo estilo que la lista
        Object.keys(codigos).forEach((codigo, index) => {
            const totalCodigo = codigos[codigo].items.reduce((sum, d) => {
                let montoStr = String(d.Deuda || '0').replace(/[.,]/g, '').trim();
                return sum + (parseFloat(montoStr) || 0);
            }, 0);
            
            // Alternar colores de fondo para mejor legibilidad
            const bgColor = index % 2 === 0 ? '#1a1f35' : '#1e2340';
            
            html += `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: ${bgColor}; border-radius: 4px; margin: 2px 0;">
                            <span style="color: #8892a8; font-size: 13px;">
                                📋 ${codigo}
                            </span>
                            <span style="color: #48bb78; font-weight: bold; font-size: 14px;">
                                $${totalCodigo.toLocaleString('es-AR')}
                            </span>
                        </div>
                    `;
        });
        
        html += `
                        </div>
                    </div>
                    
                    <div class="botones-pago">
                        <button class="btn-pago btn-mp" onclick="pagar('mp', ${totalGeneral})">
                            💳 Mercado Pago
                        </button>
                        <button class="btn-pago btn-transferencia" onclick="pagar('transferencia', ${totalGeneral})">
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
// PAGAR - CON DETALLE DE CÓDIGOS
// ============================================

function pagar(metodo, total) {
    const resultado = document.getElementById('resultado');
    const dni = resultado.dataset.dni || document.getElementById('dniInput').value.trim();
    const totalFormateado = total.toLocaleString('es-AR');
    
    // Obtener los códigos de pago del DNI consultado
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
    
    // Generar resumen de códigos para mostrar
    let resumenCodigos = '';
    Object.keys(codigos).forEach(codigo => {
        resumenCodigos += `
                    <div style="display: flex; justify-content: space-between; padding: 4px 8px; background: #1a1f35; border-radius: 4px; margin: 2px 0;">
                        <span style="color: #8892a8; font-size: 13px;">📋 ${codigo}</span>
                        <span style="color: #48bb78; font-weight: bold; font-size: 13px;">$${codigos[codigo].toLocaleString('es-AR')}</span>
                    </div>
                `;
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
                                <span style="color: #e8eaf0;">Total</span>
                                <span style="color: #48bb78;">$${totalFormateado}</span>
                            </div>
                        </div>
                    </div>
                    
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
                    
                    <div style="background: #1a1f35; padding: 12px; border-radius: 8px; margin: 10px 0;">
                        <div style="color: #8892a8; font-size: 13px; margin-bottom: 8px; text-align: center;">
                            📊 Desglose por código de pago
                        </div>
                        ${resumenCodigos}
                        <div style="border-top: 1px solid #2a2f4a; margin: 8px 0; padding-top: 8px;">
                            <div style="display: flex; justify-content: space-between; font-weight: bold;">
                                <span style="color: #e8eaf0;">Total</span>
                                <span style="color: #48bb78;">$${totalFormateado}</span>
                            </div>
                        </div>
                    </div>
                    
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

    resultado.innerHTML = html;
    resultado.style.display = 'block';
}

// ============================================
// REPORTAR PAGO - CON COMPROBANTE MEJORADO
// ============================================

function reportarPago() {
    const resultado = document.getElementById('resultado');
    const dni = resultado.dataset.dni || document.getElementById('dniInput').value.trim();
    
    // Obtener los códigos de pago y totales para mostrar en el formulario
    const encontrados = deudas.filter(d => String(d.DNI).trim() === dni);
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
    
    // Generar resumen de códigos para mostrar en el formulario
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
                
                <!-- Resumen de deuda -->
                <div style="background: #1a1f35; padding: 10px; border-radius: 8px; margin: 10px 0; border: 1px solid #2a2f4a;">
                    <div style="color: #7b61ff; font-weight: bold; font-size: 13px; margin-bottom: 6px;">📊 Resumen de deuda</div>
                    ${resumenCodigos}
                    <div style="border-top: 1px solid #2a2f4a; margin-top: 6px; padding-top: 6px; display: flex; justify-content: space-between;">
                        <span style="color: #e8eaf0; font-weight: bold;">Total a pagar</span>
                        <span style="color: #48bb78; font-weight: bold; font-size: 16px;">$${totalGeneral.toLocaleString('es-AR')}</span>
                    </div>
                </div>

                <!-- Instrucciones para el comprobante -->
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
                    <input type="text" id="reporteNombre" placeholder="Ej: Juan Perez" required>
                </div>

                <div class="form-group">
                    <label>💰 Monto pagado <span style="color: #fc8181;">*</span></label>
                    <input type="number" id="reporteMonto" placeholder="Ej: 11512" value="${totalGeneral}" required>
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

    // Manejar la previsualización del archivo
    document.getElementById('reporteArchivo')?.addEventListener('change', function(e) {
        const preview = document.getElementById('previewImage');
        const fileInfo = document.getElementById('fileInfo');
        
        if (this.files && this.files[0]) {
            const file = this.files[0];
            const fileSize = (file.size / 1024 / 1024).toFixed(2);
            
            // Mostrar información del archivo
            fileInfo.style.display = 'block';
            fileInfo.innerHTML = `
                        📄 ${file.name} (${fileSize} MB)
                        ${fileSize > 5 ? ' ⚠️ Archivo grande, puede tardar en enviarse' : ''}
                    `;
            fileInfo.style.color = fileSize > 5 ? '#fc8181' : '#48bb78';
            
            // Previsualizar imagen
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function(ev) {
                    preview.src = ev.target.result;
                    preview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            } else {
                // Si no es imagen, mostrar icono
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
