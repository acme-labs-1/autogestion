# 🤖 Deuda Bot — Sistema de Gestión y Verificación de Pagos

Sistema web + backend para **consulta de deudas, desglose por código de pago, detalle por producto, reporte de pagos y verificación administrativa mediante Telegram**.

La arquitectura separa la operación pública de la administración interna:

* **GitHub Pages** → frontend público.
* **CSV** → catálogo de deudas, entidades y descripciones.
* **VPS** → API PHP, almacenamiento de reportes y bot de Telegram.
* **Telegram** → interfaz de administración y verificación.
* **JSON** → persistencia de reportes y verificaciones.
* **localStorage** → almacenamiento local de reportes realizados desde el navegador.

> **Nota:** este README está actualizado a partir del código frontend revisado. La implementación de `autogest_back.php`, `bot.py`, `reportes.json` y `verificados.json` no forma parte del archivo analizado, por lo que las funciones internas del backend se documentan únicamente como arquitectura prevista.

---

# 🏗️ Arquitectura

```text
                              ┌──────────────────────┐
                              │        USUARIO       │
                              └──────────┬───────────┘
                                         │
                         Consulta DNI / Reporta pago
                                         │
                         ┌───────────────┴───────────────┐
                         │                               │
                         ▼                               ▼
              ┌────────────────────┐          ┌────────────────────┐
              │    GITHUB PAGES    │          │        VPS         │
              │                    │          │                    │
              │ HTML + CSS + JS    │          │ autogest_back.php  │
              │ deudas.csv         │          │ reportes.json      │
              │ entidades.csv      │          │                    │
              │ descripcion.csv    │          │                    │
              └─────────┬──────────┘          └─────────┬──────────┘
                        │                               │
                        │                               │ Telegram Bot API
                        │                               ▼
                        │                    ┌────────────────────┐
                        │                    │  ADMINISTRADORES   │
                        │                    │      TELEGRAM      │
                        │                    │                    │
                        │                    │ ✅ Verificar       │
                        │                    │ ❌ Rechazar        │
                        │                    └─────────┬──────────┘
                        │                              │
                        │                              │ Callback
                        │                              ▼
                        │                    ┌────────────────────┐
                        │                    │    BOT PYTHON      │
                        │                    │                    │
                        │                    │ verificados.json   │
                        │                    │ comandos admin     │
                        │                    └────────────────────┘
                        │
                        └────── Consulta directa de los CSV
```

---

# 🔄 Flujo general

El frontend tiene dos recorridos principales.

## 1. Consulta de deuda

```text
Usuario
   │
   │ Ingresa DNI
   ▼
GitHub Pages
   │
   ├── deudas.csv
   ├── entidades.csv
   └── descripcion.csv
   │
   ▼
JavaScript
   │
   ├── Filtrado por DNI
   ├── Agrupación por código
   ├── Agrupación por cartera
   └── Asociación de descripciones
   │
   ▼
Resumen / Detalle
   │
   ▼
Métodos de pago
```

## 2. Reporte de pago

```text
Usuario
   │
   │ DNI + nombre + monto
   │ WhatsApp + comprobante opcional
   ▼
Frontend
   │
   ├── Guarda copia en localStorage
   │
   └── FormData / POST
             │
             ▼
      autogest_back.php
             │
             ├── Validación
             ├── Persistencia
             └── Telegram
                    │
                    ▼
              Administradores
                    │
               ┌────┴────┐
               ▼         ▼
          Verificar    Rechazar
```

---

# 📂 Archivos públicos del frontend

El frontend utiliza tres archivos CSV:

```text
deudas.csv
entidades.csv
descripcion.csv
```

Todos son cargados mediante `fetch()` desde el mismo directorio del frontend.

La carga se realiza al iniciar la página mediante:

```javascript
cargarDatos();
```

El proceso de inicialización está conectado a `DOMContentLoaded`.

---

# 📄 1. `deudas.csv`

Es la fuente principal de información de las deudas.

El frontend espera campos como:

```text
DNI
Nombre
Codigo
Cartera
Producto
Deuda
Fecha
```

También contempla diferentes variantes para determinados campos durante la visualización.

Ejemplo conceptual:

```csv
DNI,Nombre,Codigo,Cartera,Producto,Deuda,Fecha
12345678,Usuario,ABC123,Cartera A,Producto 1,50000,06/08/2026
12345678,Usuario,ABC123,Cartera B,Producto 2,25000,06/08/2026
```

---

# 🏢 2. `entidades.csv`

El frontend carga un archivo adicional para asociar una cartera con una entidad.

La estructura esperada conceptualmente es:

```text
cartera
entidad
```

Durante la carga se crea un mapa:

```text
carteraEntidad
```

Ejemplo:

```text
CARTERA_001 → Entidad A
CARTERA_002 → Entidad B
CARTERA_003 → Entidad C
```

Esto permite que la interfaz muestre la entidad asociada en lugar del identificador interno de la cartera.

El archivo se carga mediante:

```javascript
fetch('entidades.csv')
```

y sus datos son procesados por `csvToJson()`.

---

# 📝 3. `descripcion.csv`

El frontend también carga un catálogo de descripciones u observaciones asociadas a productos.

Puede utilizar campos como:

```text
NumeroProducto
Codigo
codigo
Observaciones
observaciones
OBSERVACIONES
Descripcion
descripcion
```

El sistema genera el mapa:

```text
descripcionProducto
```

Conceptualmente:

```text
Producto 001 → descripción del producto
Producto 002 → observación correspondiente
Producto 003 → descripción correspondiente
```

La descripción se muestra en la vista detallada cuando existe una coincidencia.

---

# ⚙️ 4. Carga de datos

La función principal es:

```javascript
cargarDatos()
```

El proceso tiene una interfaz de progreso.

```text
0%   → Iniciando carga
15%  → Cargando deudas
40%  → Procesando datos
60%  → Cargando entidades
80%  → Cargando observaciones
95%  → Preparando interfaz
100% → Listo
```

Primero se descarga:

```text
deudas.csv
```

Después:

```text
entidades.csv
```

y finalmente:

```text
descripcion.csv
```

Una vez finalizado el proceso:

```javascript
datosCargados = true;
```

---

# 📅 Fecha de actualización del catálogo

El frontend intenta obtener la fecha del archivo mediante el header HTTP:

```text
Last-Modified
```

Si no está disponible, utiliza:

```text
localStorage.fecha_csv
```

Si tampoco existe, genera una fecha local como fallback.

Finalmente guarda:

```text
fecha_csv
```

en `localStorage`.

La fecha se muestra mediante el elemento:

```text
fechaActual
```

---

# 🔎 5. Consulta por DNI

La función principal de consulta es:

```javascript
consultar()
```

El DNI debe cumplir:

```text
7 u 8 dígitos numéricos
```

Ejemplos:

```text
1234567     ✅
12345678    ✅
123456      ❌
123456789   ❌
12A45678    ❌
```

La validación utilizada conceptualmente es:

```javascript
/^\d+$/
```

y se verifica además que la longitud sea entre 7 y 8 caracteres.

---

# 🔍 6. Búsqueda

La búsqueda se realiza directamente sobre:

```javascript
deudas
```

utilizando coincidencia exacta:

```javascript
String(d.DNI).trim() === dni
```

No se consulta una API para buscar la deuda.

El flujo es:

```text
DNI
 │
 ▼
deudas[]
 │
 ▼
filter()
 │
 ▼
Registros coincidentes
```

---

# 📊 7. Vista rápida de deuda

La primera vista corresponde a:

```javascript
consultar()
```

Su objetivo es ofrecer una visualización rápida orientada a la acción.

Los registros se agrupan primero por:

```text
Codigo
```

y dentro de cada código se agrupan las carteras.

La estructura visual es:

```text
DNI
 └── Código de pago
      └── Entidad
           └── Importe
```

Ejemplo:

```text
👤 Usuario
📜 DNI: 12345678

📋 RESUMEN POR CÓDIGO DE PAGO

📋 ABC123                     $50.000
   🏢 Entidad A              $30.000
   🏢 Entidad B              $20.000

📋 XYZ789                     $15.000
   🏢 Entidad C              $15.000

────────────────────────────────
💰 $65.000
```

---

# 💰 8. Cálculo de deuda

Para cada registro se obtiene:

```text
Deuda
```

y se eliminan separadores:

```javascript
String(d.Deuda || '0')
    .replace(/[.,]/g, '')
```

Después se convierte a número.

El sistema calcula:

```text
Total del código
+
Total general
```

Conceptualmente:

```text
Código A
 ├── deuda 1
 ├── deuda 2
 └── deuda 3
      ↓
  Subtotal A

Código B
 ├── deuda 1
 └── deuda 2
      ↓
  Subtotal B

Subtotal A + Subtotal B
           ↓
      Total general
```

---

# 📋 9. Resumen por código

La vista rápida muestra un resumen:

```text
📋 ABC123       $50.000
📋 XYZ789       $15.000

──────────────────────
💰 $65.000
```

Además ofrece las acciones:

```text
📋 Ver detalle
💳 Mercado Pago
🏦 Banco
📢 ¿Ya pagaste? Reporta tu pago
💬 Habla con nosotros
```

---

# 🔍 10. Vista detallada

La función:

```javascript
informame()
```

ofrece una segunda forma de visualizar la deuda.

A diferencia de la vista rápida, aquí la información se agrupa por:

```text
Producto
```

La estructura es:

```text
DNI
 └── Producto
      ├── Observación
      └── Deudas individuales
           ├── Entidad
           ├── Fecha
           └── Importe
```

Ejemplo:

```text
📋 INFORME DETALLADO POR PRODUCTO

📦 Producto 001
Subtotal: $50.000

📝 Observación del producto

🏢 Entidad A       $30.000
📅 06/08/2026

🏢 Entidad B       $20.000
📅 06/08/2026

────────────────────────
💰 Deuda total     $50.000
```

---

# 📝 11. Descripciones de productos

La vista detallada busca la observación correspondiente mediante:

```javascript
descripcionProducto[producto]
```

Si existe una descripción:

```text
📝 Descripción
```

se muestra una sola vez para ese producto.

Si no existe, simplemente no se muestra.

---

# 📅 12. Fecha de mora

La vista detallada contempla diferentes nombres de campo:

```text
Fecha de Mora
FechaMora
Fecha
fecha
```

El sistema utiliza el primero disponible.

Si ninguno existe:

```text
Fecha no disponible
```

---

# 💳 13. Métodos de pago

La función:

```javascript
pagar(metodo, total)
```

recibe:

```text
metodo
total
```

Antes de mostrar los datos de pago, vuelve a calcular el desglose por código.

Los métodos actualmente contemplados son:

```text
Mercado Pago
Transferencia bancaria
```

---

# 💳 14. Mercado Pago

La interfaz muestra:

```text
💳 Mercado Pago
```

junto con:

```text
Desglose por código
Total a pagar
CVU
Alias
Titular
```

El botón:

```text
✅ Ya pagué, reportar
```

abre el formulario de reporte.

---

# 🏦 15. Transferencia bancaria

La interfaz muestra:

```text
🏦 Transferencia Bancaria
```

junto con:

```text
Desglose por código
Total a pagar
CBU
Alias
Banco
Titular
```

También permite:

```text
✅ Ya pagué, reportar
```

---

# 📢 16. Reporte de pago

La función:

```javascript
reportarPago()
```

crea dinámicamente el formulario.

Antes de mostrarlo, vuelve a consultar las deudas del DNI y calcula:

```text
Código → importe
```

y:

```text
Total general
```

El formulario muestra el resumen de la deuda antes de solicitar los datos.

---

# 🧾 17. Datos del reporte

El formulario contiene:

```text
DNI
Nombre completo
Monto pagado
WhatsApp
Comprobante
```

## DNI

Se obtiene automáticamente de la consulta y se muestra como:

```html
readonly
```

El usuario no puede modificarlo desde el formulario.

## Nombre

Campo obligatorio visualmente:

```text
Nombre completo *
```

## Monto

Campo numérico:

```text
Monto pagado *
```

El frontend indica:

```text
Si pagaste varios códigos, ingresá el monto total que depositaste
```

## WhatsApp

Campo mostrado como obligatorio en la interfaz:

```text
WhatsApp *
```

Se utiliza para que el administrador pueda contactar al usuario.

## Comprobante

El archivo se define como:

```html
accept="image/*,.pdf"
```

Por lo tanto, actualmente se aceptan:

```text
Imágenes
PDF
```

El comprobante es opcional pero recomendado.

---

# 📎 18. Previsualización del comprobante

Cuando se selecciona un archivo:

```javascript
FileReader()
```

permite generar una vista previa si se trata de una imagen.

Para archivos que no son imágenes:

```text
📎 Archivo no previsualizable
```

También se muestra:

```text
Nombre del archivo
Tamaño
```

Si supera los 5 MB, se muestra una advertencia.

---

# ⚠️ 19. Límite del comprobante

El envío principal comprueba:

```text
Máximo: 5 MB
```

Si el archivo supera ese tamaño:

```text
❌ El archivo es muy grande
```

y el envío se detiene.

---

# 📤 20. Envío al backend

La función:

```javascript
enviarReporte()
```

crea un objeto:

```javascript
FormData()
```

con:

```text
dni
nombre
monto
whatsapp
comprobante
```

El comprobante solo se agrega si existe un archivo seleccionado.

El envío se realiza mediante:

```text
POST
https://carover0.xyz/api/autogest_back.php
```

utilizando:

```text
multipart/form-data
```

---

# ⏱️ 21. Timeout

El envío utiliza:

```text
AbortController
```

con un timeout de:

```text
60 segundos
```

Si se alcanza el límite:

```text
⏳ El servidor está tardando en responder.
```

El frontend informa al usuario que el reporte fue conservado localmente.

---

# 💾 22. Persistencia local

Antes del envío al servidor, el reporte se guarda mediante:

```javascript
guardarReporteLocal()
```

en:

```text
localStorage
```

utilizando la clave:

```text
reportes_fyd
```

Cada registro incluye conceptualmente:

```json
{
  "fecha": "17/08/2026, 08:30:00",
  "dni": "12345678",
  "nombre": "Usuario",
  "monto": "50000",
  "whatsapp": "5491123456789"
}
```

La fecha se genera mediante:

```javascript
new Date().toLocaleString('es-AR')
```

---

# 🔁 23. Estado local de reportes

El frontend dispone de una función:

```javascript
actualizarReporteLocal(dni, estado)
```

que permite guardar:

```text
estado
fecha_actualizacion
```

en el reporte correspondiente.

También se contempla el estado:

```text
✅ Enviado al servidor
```

y, cuando no existe estado:

```text
Pendiente
```

> **Importante:** en el código actualmente revisado, `enviarReporte()` guarda el reporte localmente antes del POST, pero no llama posteriormente a `actualizarReporteLocal()` cuando recibe `resultado.ok`. Por lo tanto, el marcado automático como `✅ Enviado al servidor` no está conectado al flujo principal de envío actual.

---

# 🔁 24. Reenvío de reportes pendientes

Existe la función:

```javascript
reenviarReportesPendientes()
```

que busca en:

```text
localStorage.reportes_fyd
```

los registros cuyo estado no sea:

```text
✅ Enviado al servidor
```

Estos reportes se reenvían uno por uno al backend.

Entre cada envío existe una espera aproximada de:

```text
1 segundo
```

El flujo es:

```text
localStorage
     │
     ▼
Reportes sin estado enviado
     │
     ▼
Uno por uno
     │
     ▼
POST al VPS
     │
     ▼
resultado.ok
     │
     ▼
actualizarReporteLocal()
```

La función informa al finalizar:

```text
Se reenviaron X de Y reportes pendientes.
```

---

# ⚠️ 25. Consideración sobre el reenvío

Debido a que el envío principal actualmente no marca automáticamente:

```text
✅ Enviado al servidor
```

un reporte exitosamente enviado puede continuar apareciendo localmente como pendiente.

Esto significa que, con el código actual, la función:

```javascript
reenviarReportesPendientes()
```

puede volver a enviar reportes que ya fueron aceptados por el backend.

La corrección natural sería actualizar el estado después de:

```javascript
if (resultado.ok)
```

en `enviarReporte()`.

---

# 📤 26. Exportación local

El frontend dispone de:

```javascript
exportarReportes()
```

La función obtiene:

```text
reportes_fyd
```

y genera un archivo JSON descargable.

El nombre utiliza:

```text
reportes_YYYY-MM-DD.json
```

Ejemplo:

```text
reportes_2026-08-17.json
```

---

# 🔎 27. Consulta de reportes almacenados

Existe:

```javascript
verReportesGuardados()
```

que permite inspeccionar los reportes existentes en `localStorage`.

También existe:

```javascript
verEstadoReportes()
```

que muestra información resumida de los últimos reportes.

Conceptualmente:

```text
📊 Total reportes: X

1. DNI: 12345678 | Usuario | $50000 | Estado: Pendiente
2. DNI: 87654321 | Usuario | $30000 | Estado: ✅ Enviado al servidor
```

Estas funciones son principalmente herramientas de soporte y depuración.

---

# ❌ 28. Manejo de errores

El frontend contempla:

* DNI inválido.
* CSV no disponible.
* Datos todavía no cargados.
* Archivo superior a 5 MB.
* Error HTTP.
* Respuesta que no sea JSON.
* Timeout de 60 segundos.
* Error al enviar comprobante.
* Reintento sin comprobante.
* Reportes conservados localmente.

---

# 🔄 29. Reintento sin comprobante

Si el envío falla y existe un archivo adjunto, el frontend pregunta:

```text
¿Quieres intentar enviar SIN el comprobante?
```

Si el usuario acepta:

```text
Se elimina el archivo
       │
       ▼
Se oculta la previsualización
       │
       ▼
enviarReporte()
```

Esto permite intentar enviar nuevamente únicamente los datos principales.

---

# 📱 30. WhatsApp

La función:

```javascript
abrirWhatsApp()
```

genera un mensaje predefinido utilizando:

```text
Nombre
DNI
```

El formato conceptual es:

```text
Hola, soy Usuario (DNI: 12345678).
Necesito ayuda con mi deuda.
```

Luego abre WhatsApp mediante un enlace `wa.me`.

---

# ✈️ 31. Telegram

La función:

```javascript
abrirTelegram()
```

genera un enlace hacia el bot/canal de atención:

```text
t.me/fydonline
```

incluyendo el DNI como parámetro de inicio.

El mensaje también incorpora:

```text
Nombre
DNI
```

---

# 💬 32. Habla con nosotros

La función:

```javascript
hablaConNosotros()
```

presenta un menú con:

```text
📱 WhatsApp
✈️ Telegram
```

El usuario puede elegir el canal de contacto.

---

# 🗃️ 33. Persistencia del backend

La arquitectura prevista utiliza en el VPS:

```text
VPS
├── autogest_back.php
├── reportes.json
├── verificados.json
└── bot.py
```

## `reportes.json`

Representa conceptualmente los reportes recibidos.

Ejemplo:

```json
{
  "dni": "12345678",
  "nombre": "Usuario",
  "monto": 50000,
  "telefono": "549XXXXXXXXXX",
  "comprobante": "archivo.jpg",
  "fecha": "2026-08-17 15:30:00"
}
```

## `verificados.json`

Representa conceptualmente las operaciones verificadas:

```json
{
  "dni": "12345678",
  "monto": 50000,
  "verificado_por": "Admin",
  "fecha_verificacion": "2026-08-17 15:45:00"
}
```

> Estos formatos corresponden a la arquitectura documentada y no fueron auditados directamente en el archivo frontend.

---

# 📲 34. Telegram administrativo

La arquitectura del backend contempla:

```text
Frontend
   │
   ▼
autogest_back.php
   │
   ├── reportes.json
   │
   ▼
Telegram Bot API
   │
   ▼
Grupo administrativo
```

El administrador puede recibir un reporte y ejecutar acciones como:

```text
✅ Verificar
❌ Rechazar
```

---

# 🔐 35. Callbacks administrativos

La arquitectura documentada utiliza callbacks conceptuales como:

```text
verificar:DNI:telefono
```

y:

```text
rechazar:DNI:telefono
```

Ejemplo:

```text
verificar:12345678:549XXXXXXXXXX
```

> La implementación concreta de estos callbacks no está presente en el archivo frontend analizado.

---

# 📊 36. Comandos administrativos

La arquitectura del bot contempla:

| Comando        | Función                   |
| -------------- | ------------------------- |
| `/stats`       | Estadísticas generales    |
| `/pendientes`  | Reportes pendientes       |
| `/verificados` | Pagos verificados         |
| `/suma`        | Suma de pagos verificados |
| `/exportar`    | Exportación a CSV         |
| `/ruta`        | Ubicación de archivos     |

Estas funciones pertenecen al bot Python del VPS y no están implementadas dentro del frontend revisado.

---

# 🔐 37. Seguridad

El frontend público no contiene el token del bot de Telegram.

La arquitectura mantiene:

```text
GitHub Pages
├── HTML
├── CSS
├── JavaScript
├── deudas.csv
├── entidades.csv
└── descripcion.csv
```

mientras que las operaciones administrativas permanecen en:

```text
VPS
├── PHP
├── JSON
└── Python
```

El token de Telegram debe permanecer exclusivamente en el servidor.

---

# 🧩 38. Separación de responsabilidades

## Frontend

```text
GitHub Pages
├── HTML
├── CSS
├── JavaScript
├── deudas.csv
├── entidades.csv
└── descripcion.csv
```

Responsabilidades:

* interfaz pública;
* carga de datos;
* validación del DNI;
* consulta de deudas;
* agrupación por código;
* agrupación por cartera;
* cálculo de totales;
* asociación cartera → entidad;
* asociación producto → descripción;
* vista rápida;
* vista detallada;
* métodos de pago;
* formulario de reportes;
* almacenamiento local;
* reenvío de reportes;
* exportación local;
* contacto mediante WhatsApp;
* contacto mediante Telegram.

---

## Backend PHP

```text
VPS
└── autogest_back.php
```

Responsabilidades arquitectónicas:

* recibir reportes;
* procesar datos;
* gestionar comprobantes;
* persistir reportes;
* comunicarse con Telegram;
* mantener credenciales privadas.

---

## Bot administrativo

```text
VPS
└── bot.py
```

Responsabilidades arquitectónicas:

* recibir callbacks;
* verificar reportes;
* rechazar reportes;
* consultar JSON;
* calcular pendientes;
* generar estadísticas;
* calcular sumas;
* exportar información;
* ejecutar comandos administrativos.

---

# 🗂️ 39. Estructura del proyecto

```text
GitHub Repository
│
├── index.html
├── styles.css
├── script.js
│
├── deudas.csv
├── entidades.csv
├── descripcion.csv
│
└── assets/
    ├── 154860_b.png
    └── 154500.png


VPS
│
├── autogest_back.php
├── reportes.json
├── verificados.json
└── bot.py
```

---

# 🔁 40. Flujo completo

```text
                                USUARIO
                                   │
                                   ▼
                              Ingresa DNI
                                   │
                                   ▼
                            GitHub Pages
                                   │
                ┌──────────────────┼──────────────────┐
                │                  │                  │
                ▼                  ▼                  ▼
          deudas.csv        entidades.csv      descripcion.csv
                │                  │                  │
                └──────────────────┼──────────────────┘
                                   │
                                   ▼
                              JavaScript
                                   │
                     ┌─────────────┴─────────────┐
                     │                           │
                     ▼                           ▼
              Vista rápida                Vista detallada
                     │                           │
                     │                           │
                     └─────────────┬─────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
              Mercado Pago      Banco       Reportar pago
                                                  │
                                                  ▼
                                            localStorage
                                                  │
                                                  ▼
                                          autogest_back.php
                                                  │
                                                  ▼
                                           reportes.json
                                                  │
                                                  ▼
                                            Telegram Bot
                                                  │
                                                  ▼
                                          Administradores
                                                  │
                                           ┌──────┴──────┐
                                           ▼             ▼
                                      Verificar       Rechazar
                                           │
                                           ▼
                                    verificados.json
```

---

# 📐 41. Modelo de datos

```text
                    ┌─────────────────┐
                    │   deudas.csv    │
                    │                 │
                    │ DNI             │
                    │ Nombre          │
                    │ Codigo          │
                    │ Cartera         │
                    │ Producto        │
                    │ Deuda           │
                    │ Fecha           │
                    └────────┬────────┘
                             │
                             │ consulta
                             ▼
                         FRONTEND
                             │
             ┌───────────────┴────────────────┐
             │                                │
             ▼                                ▼
     entidades.csv                     descripcion.csv
             │                                │
             ▼                                ▼
     Cartera → Entidad                Producto → Descripción
             │                                │
             └───────────────┬────────────────┘
                             │
                             ▼
                    Resultado de consulta
                             │
                             │ reporte
                             ▼
                    ┌─────────────────┐
                    │ reportes.json   │
                    │                 │
                    │ DNI             │
                    │ Nombre          │
                    │ Monto           │
                    │ WhatsApp        │
                    │ Comprobante     │
                    │ Fecha           │
                    └────────┬────────┘
                             │
                             │ verificación
                             ▼
                    ┌─────────────────┐
                    │verificados.json │
                    │                 │
                    │ DNI             │
                    │ Monto           │
                    │ Admin           │
                    │ Fecha           │
                    └─────────────────┘
```

---

# 🛠️ 42. Stack tecnológico

| Componente                 | Tecnología              |
| -------------------------- | ----------------------- |
| Frontend                   | HTML / CSS / JavaScript |
| Hosting frontend           | GitHub Pages            |
| Catálogo de deudas         | CSV                     |
| Catálogo de entidades      | CSV                     |
| Catálogo de descripciones  | CSV                     |
| Backend                    | PHP                     |
| Hosting backend            | VPS                     |
| Persistencia backend       | JSON                    |
| Persistencia local         | Browser `localStorage`  |
| Bot                        | Python                  |
| Administración             | Telegram                |
| Comunicación               | Telegram Bot API        |
| Exportación local          | JSON                    |
| Exportación administrativa | CSV                     |

---

# ⚙️ 43. Detalles de implementación del frontend

## Inicialización

Al cargarse el DOM:

```javascript
DOMContentLoaded
```

se ejecutan:

```text
cargarDatos()
verReportesGuardados()
```

También se configura el comportamiento del campo DNI para permitir la consulta mediante:

```text
Enter
```

---

## Conversión CSV

Todos los CSV se procesan mediante:

```javascript
csvToJson()
```

La función:

1. separa las líneas;
2. obtiene los headers;
3. procesa los valores;
4. contempla valores entre comillas;
5. construye objetos JavaScript.

Resultado conceptual:

```text
CSV
 │
 ▼
csvToJson()
 │
 ▼
Array de objetos
```

---

## Carga de deudas

```javascript
fetch('deudas.csv')
```

genera:

```javascript
deudas = csvToJson(csvData)
```

y posteriormente:

```javascript
datosCargados = true
```

---

## Carga de entidades

```javascript
fetch('entidades.csv')
```

genera:

```javascript
carteraEntidad
```

---

## Carga de descripciones

```javascript
fetch('descripcion.csv')
```

genera:

```javascript
descripcionProducto
```

---

# 🔎 44. Funciones principales

| Función                        | Responsabilidad                |
| ------------------------------ | ------------------------------ |
| `cargarDatos()`                | Carga todos los CSV            |
| `cargarEntidades()`            | Carga entidades                |
| `cargarDescripciones()`        | Carga observaciones            |
| `csvToJson()`                  | Convierte CSV a objetos        |
| `consultar()`                  | Consulta y muestra resumen     |
| `informame()`                  | Muestra detalle por producto   |
| `pagar()`                      | Muestra datos de pago          |
| `reportarPago()`               | Genera formulario              |
| `enviarReporte()`              | Envía reporte al VPS           |
| `guardarReporteLocal()`        | Guarda reporte en localStorage |
| `actualizarReporteLocal()`     | Actualiza estado local         |
| `reenviarReportesPendientes()` | Reenvía reportes               |
| `verReportesGuardados()`       | Inspecciona reportes           |
| `verEstadoReportes()`          | Muestra estados                |
| `exportarReportes()`           | Exporta JSON                   |
| `abrirWhatsApp()`              | Abre contacto WhatsApp         |
| `abrirTelegram()`              | Abre contacto Telegram         |
| `hablaConNosotros()`           | Menú de contacto               |

---

# 🧪 45. Validaciones actuales

## DNI

```text
7 u 8 dígitos
```

## Nombre

El envío verifica que exista:

```text
nombre
```

## Monto

El envío verifica que exista:

```text
monto
```

## Comprobante

El frontend comprueba:

```text
máximo 5 MB
```

## WhatsApp

La interfaz lo presenta como obligatorio, pero la función `enviarReporte()` no bloquea el envío cuando está vacío.

Cuando no se proporciona, envía:

```text
No proporcionado
```

al backend.

---

# ⚠️ 46. Diferencias importantes respecto de versiones anteriores

El frontend actual incorpora funcionalidades que no estaban reflejadas completamente en la documentación anterior:

### Nuevos catálogos

```text
entidades.csv
descripcion.csv
```

### Dos niveles de consulta

```text
Vista rápida
   ↓
por código

Vista detallada
   ↓
por producto
```

### Descripciones

Los productos pueden mostrar observaciones provenientes de:

```text
descripcion.csv
```

### Entidades

Las carteras pueden mostrarse utilizando la entidad asociada desde:

```text
entidades.csv
```

### Comprobantes

Actualmente se permite:

```text
Imagen
PDF
```

no solamente imágenes.

### Contacto

El frontend incorpora:

```text
WhatsApp
Telegram
```

como canales de atención.

---

# ⚠️ 47. Consideraciones técnicas

## Identificación por DNI

El frontend utiliza el DNI como identificador principal de la consulta:

```text
DNI
 ↓
deudas
```

Sin embargo, un DNI puede tener múltiples registros:

```text
1 DNI
 ├── Código A
 ├── Código B
 └── Código C
```

Para los reportes administrativos, depender exclusivamente del DNI puede ser insuficiente si un mismo usuario realiza varios pagos.

---

# ⚠️ 48. Identificación de reportes

Una evolución recomendable sería incorporar:

```text
reporte_id
```

Por ejemplo:

```text
REP-20260817-000123
```

La estructura podría pasar de:

```text
DNI
 │
 └── Reporte
```

a:

```text
reporte_id
 │
 ├── reporte
 └── verificación
```

Esto permitiría identificar inequívocamente cada operación.

---

# ⚠️ 49. Estado de reportes

Actualmente existen dos conceptos diferentes:

```text
Estado local
```

y:

```text
Estado administrativo
```

El estado local puede representar:

```text
Pendiente
✅ Enviado al servidor
```

mientras que el estado administrativo podría representar:

```text
Pendiente
Verificado
Rechazado
```

No deben confundirse.

Un reporte puede estar:

```text
✅ Enviado al servidor
```

pero continuar:

```text
⏳ Pendiente de verificación
```

---

# 🚀 50. Mejoras futuras

## ID único

Implementar:

```text
reporte_id
```

para cada operación.

---

## Estado explícito

Incorporar:

```text
pendiente
verificado
rechazado
```

en el backend.

---

## Corrección del estado local

Después de recibir:

```javascript
resultado.ok
```

el frontend debería actualizar el reporte correspondiente a:

```text
✅ Enviado al servidor
```

Esto evitaría que los reportes correctamente enviados vuelvan a aparecer como pendientes de reenvío.

---

## Base de datos

Si el volumen aumenta:

```text
JSON
  ↓
SQLite
  ↓
MySQL / PostgreSQL
```

---

## API

Actualmente:

```text
Frontend
    │
    ▼
CSV
```

Una evolución posible:

```text
Frontend
    │
    ▼
API
    │
    ▼
Base de datos
```

---

## Auditoría

Una estructura más completa podría incluir:

```text
reporte_id
dni
monto
fecha_creacion
fecha_envio
fecha_verificacion
fecha_rechazo
admin_id
accion
motivo
comprobante
```

Esto permitiría reconstruir el historial completo de cada operación.

---

# 🎯 Principios de diseño

## Seguridad

Las credenciales y funciones administrativas permanecen en el VPS.

## Simplicidad

El catálogo público utiliza CSV estáticos fáciles de reemplazar.

## Separación de responsabilidades

El frontend se ocupa de:

```text
Consulta
Visualización
Reporte
```

mientras el VPS concentra:

```text
Persistencia
Telegram
Administración
```

## Tolerancia a fallos

Los reportes se guardan localmente antes de intentar enviarlos al backend.

## Arquitectura progresiva

El sistema puede evolucionar desde:

```text
CSV + JSON
```

hacia:

```text
API + Base de datos
```

sin necesidad de cambiar completamente la interfaz pública.

---

# 📌 Comandos administrativos

```text
📌 COMANDOS
──────────────────────────────────

/stats        - Estadísticas
/pendientes   - Ver pendientes
/verificados  - Ver pagos verificados
/suma         - Suma de verificados
/exportar     - Exportar CSV
/ruta         - Ubicación de archivos
```

---

# 🚀 Resumen

El sistema está dividido en tres capas:

```text
┌─────────────────────────────────────┐
│            FRONTEND                 │
│                                     │
│ GitHub Pages                        │
│ HTML + CSS + JavaScript             │
│                                     │
│ deudas.csv                          │
│ entidades.csv                       │
│ descripcion.csv                     │
│                                     │
│ Consulta + Pago + Reporte           │
└──────────────────┬──────────────────┘
                   │
                   │ Reporte de pago
                   ▼
┌─────────────────────────────────────┐
│              VPS                    │
│                                     │
│ PHP + JSON                          │
│ Python + Telegram Bot               │
│                                     │
│ Persistencia + Administración       │
└──────────────────┬──────────────────┘
                   │
                   │ Telegram Bot API
                   ▼
┌─────────────────────────────────────┐
│          ADMINISTRADORES            │
│                                     │
│ ✅ Verificar                        │
│ ❌ Rechazar                         │
│ 📊 Estadísticas                     │
│ 📋 Pendientes                       │
│ 📤 Exportaciones                    │
└─────────────────────────────────────┘
```

## Arquitectura resumida

```text
deudas.csv
     │
     ├──────────────┐
     │              │
entidades.csv   descripcion.csv
     │              │
     └──────┬───────┘
            ▼
       GitHub Pages
            │
            ├── Consulta DNI
            │
            ├── Vista rápida
            │
            ├── Vista detallada
            │
            ├── Métodos de pago
            │
            └── Reporte de pago
                    │
                    ├── localStorage
                    │
                    ▼
             autogest_back.php
                    │
                    ├── reportes.json
                    │
                    └── Telegram
                           │
                           ▼
                        bot.py
                           │
                    ┌──────┴──────┐
                    │             │
                Verificar      Rechazar
                    │
                    ▼
             verificados.json
```

