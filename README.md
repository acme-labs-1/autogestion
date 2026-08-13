# 🤖 Deuda Bot — Sistema de Gestión y Verificación de Pagos

Sistema web + backend para **consulta de deudas, desglose por código de pago, reporte de pagos y verificación administrativa mediante Telegram**.

La arquitectura separa la operación pública de la administración interna:

- **GitHub Pages** → frontend público y catálogo de deudas.
- **VPS** → API PHP, almacenamiento de reportes y bot de Telegram.
- **Telegram** → interfaz de administración y verificación.
- **JSON** → persistencia de reportes y verificaciones.
- **localStorage** → respaldo local de los reportes enviados desde el navegador.

> **Nota:** este README documenta el comportamiento confirmado del frontend y la arquitectura descrita para el backend. La implementación PHP/bot no está incluida en los archivos revisados aquí, por lo que las validaciones internas del backend se describen como parte de la arquitectura, no como detalles auditados de código.

---

## 🏗️ Arquitectura

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
                        └────── Consulta directa del CSV
```

---

# 🔄 Flujo general

El sistema tiene dos recorridos principales:

### 1. Consulta de deuda

```text
Usuario
   │
   │ Ingresa DNI
   ▼
GitHub Pages
   │
   │ HTTP GET
   ▼
deudas.csv
   │
   │ JavaScript
   ▼
Filtrado por DNI
   │
   ▼
Deudas agrupadas por cartera
   │
   ▼
Total + métodos de pago
```

### 2. Reporte de pago

```text
Usuario
   │
   │ Completa formulario
   │ DNI + nombre + monto
   │ WhatsApp + comprobante opcional
   ▼
Frontend
   │
   ├── Guarda copia local
   │   └── localStorage
   │
   │ FormData / POST
   ▼
autogest_back.php
   │
   ├── Validación
   ├── Persistencia
   └── Notificación
          │
          ▼
      Telegram
          │
          ▼
   Administradores
          │
      ┌───┴───┐
      ▼       ▼
  Verificar Rechazar
```

---

# 🔎 1. Consulta de deuda

La consulta se realiza directamente desde el frontend, sin necesidad de consultar el backend.

## Proceso

```text
Usuario
   │
   │ Ingresa DNI
   ▼
GitHub Pages
   │
   │ HTTP GET
   ▼
deudas.csv
   │
   │ JavaScript
   ▼
Filtrado por DNI
   │
   ▼
Agrupación por Código de Pago
   │
   ├── Código A → detalle + subtotal
   ├── Código B → detalle + subtotal
   └── Código C → detalle + subtotal
   │
   ▼
Total general
```

El frontend descarga `deudas.csv`, lo convierte a objetos JavaScript y busca coincidencias exactas por DNI.

Después de encontrar los registros, la información se organiza en dos niveles:

```text
DNI
 └── Código de pago
      └── Cartera
           └── Producto + Deuda
```

Para cada código se calcula un subtotal y finalmente se calcula el total general.

### Validación del DNI

El frontend acepta únicamente:

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

### Agrupación por Código de Pago

La lógica actual agrupa primero por `Codigo` y luego por `Cartera`.

Ejemplo:

```text
👤 Usuario
📜 DNI: 12345678

📋 Código de pago: ABC123       Subtotal: $50.000

🏢 Cartera A
   📌 Producto 1                 $30.000

🏢 Cartera B
   📌 Producto 2                 $20.000

📋 Código de pago: XYZ789       Subtotal: $15.000

🏢 Cartera C
   📌 Producto 3                 $15.000

────────────────────────────────────────
💰 Deuda total                  $65.000
```

### Resumen por código

Además del detalle, el frontend muestra un resumen compacto:

```text
📊 Resumen por código de pago

📋 ABC123                         $50.000
📋 XYZ789                         $15.000
────────────────────────────────────────
💰 Deuda total                   $65.000
```

Esto permite identificar rápidamente cuánto corresponde a cada código sin perder el detalle de las carteras y productos.

### Fecha de mora

Si alguno de los registros encontrados contiene `Fecha`, el frontend muestra la fecha de mora asociada.

---
# 📄 2. Estructura esperada de `deudas.csv`

El frontend utiliza campos como:

```text
DNI
Nombre
Codigo
Cartera
Producto
Deuda
Fecha
```

Ejemplo conceptual:

```csv
DNI,Nombre,Codigo,Cartera,Producto,Deuda,Fecha
12345678,Usuario,ABC123,Cartera A,Producto 1,50000,06/08/2026
12345678,Usuario,ABC123,Cartera B,Producto 2,25000,06/08/2026
```

El sistema puede mostrar:

```text
👤 Usuario
📜 DNI: 12345678
📋 Código de pago: ABC123

🏢 Cartera A
📌 Producto 1              $50.000

🏢 Cartera B
📌 Producto 2              $25.000

💰 Deuda total:            $75.000
```

---

# 💳 3. Métodos de pago

Una vez calculado el **total general**, el frontend ofrece:

```text
💳 Mercado Pago
🏦 Transferencia
```

Ambos métodos utilizan el mismo total general de la consulta.

Al seleccionar un método, el sistema vuelve a mostrar el desglose por código:

```text
📊 Desglose por código de pago

📋 ABC123                         $50.000
📋 XYZ789                         $15.000
────────────────────────────────────────
Total                             $65.000
```

Después se muestran los datos correspondientes al método seleccionado.

---

# 📢 4. Reporte de pago

El usuario puede reportar un pago desde la consulta.

El formulario contiene:

- **DNI** → obtenido automáticamente de la consulta y en modo lectura.
- **Nombre completo**.
- **Monto pagado**.
- **WhatsApp**.
- **Comprobante** opcional.

El comprobante utiliza:

```html
accept="image/*"
```

y se muestra una vista previa antes del envío.

### Límite del frontend

El archivo se comprueba antes del envío:

```text
Máximo: 5 MB
```

Si supera el límite, el envío se detiene.

---
# 📤 5. Envío al backend

El frontend utiliza `FormData` y realiza:

```text
POST https://carover0.xyz/api/autogest_back.php
```

Contenido conceptual:

```text
multipart/form-data
```

Campos enviados:

```text
dni
nombre
monto
whatsapp
comprobante
```

El comprobante solo se agrega cuando el usuario selecciona uno.

---

# 💾 6. Persistencia local del reporte

Antes de enviar el reporte al servidor, el frontend guarda una copia en:

```text
localStorage
```

Clave utilizada:

```text
reportes_fyd
```

La copia local contiene, entre otros datos:

```json
{
  "fecha": "13/08/2026, 10:30:00",
  "dni": "12345678",
  "nombre": "Usuario",
  "monto": "50000",
  "whatsapp": "5491123456789"
}
```

El estado local puede actualizarse con valores como:

```text
Pendiente
✅ Enviado al servidor
```

Este estado indica la situación del envío desde el navegador y **no equivale al estado administrativo de verificación del backend**.

La estructura conceptual es:

```json
{
  "fecha": "13/08/2026, 10:30:00",
  "dni": "12345678",
  "nombre": "Usuario",
  "monto": "50000",
  "whatsapp": "5491123456789"
}
```

Esto permite conservar información localmente si el servidor demora o si existe un problema temporal de comunicación.

---

# 🔁 7. Reintento de reportes

El frontend dispone de mecanismos para trabajar con reportes pendientes de envío.

Puede:

1. Leer `reportes_fyd` desde `localStorage`.
2. Identificar reportes que no figuren como enviados.
3. Reenviarlos uno por uno.
4. Esperar aproximadamente 1 segundo entre envíos.
5. Marcar localmente los reportes enviados correctamente.

También existe una función de consulta de los reportes almacenados para depuración:

```text
verReportesGuardados()
```

y una función de exportación:

```text
exportarReportes()
```

que genera un archivo JSON local.

---

# ⏱️ 8. Timeout y manejo de errores

El envío principal utiliza un timeout de:

```text
60 segundos
```

Si se supera:

```text
El servidor está tardando en responder.
```

El frontend informa que el reporte quedó guardado localmente.

Si el envío falla mientras se adjuntó un comprobante, se ofrece una segunda oportunidad:

```text
Reintentar sin comprobante
```

Esto permite separar los problemas relacionados con el archivo de los problemas generales del reporte.

---

# 📤 9. Exportación local

El frontend dispone de:

```javascript
exportarReportes()
```

La función toma los reportes almacenados en `localStorage` y genera un archivo JSON local con formato:

```text
reportes_YYYY-MM-DD.json
```

También existe:

```javascript
verReportesGuardados()
```

para inspeccionar los reportes almacenados localmente durante tareas de soporte o depuración.

---

# 🗃️ 10. Almacenamiento en el VPS

La arquitectura del backend utiliza:

```text
VPS
├── reportes.json
└── verificados.json
```

## `reportes.json`

Contiene los reportes recibidos desde el frontend.

Ejemplo conceptual:

```json
{
  "dni": "12345678",
  "nombre": "Usuario",
  "monto": 50000,
  "telefono": "549XXXXXXXXXX",
  "comprobante": "archivo.jpg",
  "fecha": "2026-08-06 15:30:00"
}
```

## `verificados.json`

Contiene el histórico de operaciones verificadas.

Ejemplo conceptual:

```json
{
  "dni": "12345678",
  "monto": 50000,
  "verificado_por": "Admin",
  "fecha_verificacion": "2026-08-06 15:45:00"
}
```

---

# ⚠️ 11. Determinación de pendientes

La arquitectura documentada **no utiliza un campo `estado` como fuente principal para determinar pendientes**.

La relación administrativa es:

```text
reportes.json
      │
      │ comparación por DNI
      ▼
verificados.json
```

Esto es independiente del estado local utilizado por el frontend:

```text
localStorage
└── reportes_fyd
      └── estado = "✅ Enviado al servidor"
```

El estado local indica que el navegador logró enviar el reporte; la verificación administrativa se registra en `verificados.json`.

Conceptualmente:

```text
PENDIENTES = REPORTES - VERIFICADOS
```

Por lo tanto:

```text
DNI en reportes.json
        │
        ├── existe en verificados.json → procesado
        │
        └── no existe                  → pendiente
```

> Esta lógica debe considerarse cuidadosamente si un mismo DNI puede realizar más de un pago o generar múltiples reportes. Comparar únicamente por DNI puede hacer que operaciones diferentes se consideren una sola operación.

---

# 📲 12. Telegram

Después de almacenar el reporte, el backend notifica al grupo administrativo mediante la **Telegram Bot API**.

Conceptualmente:

```text
Frontend
   │
   ▼
autogest_back.php
   │
   ▼
reportes.json
   │
   ▼
Telegram Bot API
   │
   ▼
Grupo de administradores
```

El mensaje incluye los datos necesarios para identificar la operación.

Ejemplo:

```text
💳 NUEVO REPORTE DE PAGO
──────────────────────────────────

👤 Usuario : Usuario
📌 DNI     : 12345678
💰 Monto   : $50.000

[ ✅ Verificar ]
[ ❌ Rechazar  ]
```

---

# 🔐 13. Callbacks administrativos

Los botones utilizan callbacks asociados al DNI y teléfono del reporte.

### Verificar

```text
verificar:DNI:telefono
```

Ejemplo:

```text
verificar:12345678:549XXXXXXXXXX
```

### Rechazar

```text
rechazar:DNI:telefono
```

Ejemplo:

```text
rechazar:12345678:549XXXXXXXXXX
```

El bot utiliza estos datos para identificar la operación y ejecutar la acción correspondiente.

---

# ✅ 14. Verificación administrativa

El flujo es:

```text
Administrador
      │
      │ Click "Verificar"
      ▼
Telegram
      │
      │ Callback Query
      ▼
Bot Python
      │
      ├── Busca reporte
      ├── Comprueba verificación
      ├── Registra operación
      ▼
verificados.json
      │
      ▼
Actualiza mensaje de Telegram
```

La operación verificada registra conceptualmente:

```text
DNI
Monto
Administrador
Fecha de verificación
```

También puede generarse un enlace de contacto por WhatsApp.

---

# ❌ 15. Rechazo

El administrador puede seleccionar:

```text
❌ Rechazar
```

El callback asociado es:

```text
rechazar:DNI:telefono
```

El bot procesa la operación y actualiza la información mostrada en Telegram.

---

# 📊 16. Comandos administrativos

El bot dispone de los siguientes comandos:

| Comando | Función |
|---|---|
| `/stats` | Estadísticas generales |
| `/pendientes` | Reportes todavía no verificados |
| `/verificados` | Últimos pagos verificados |
| `/suma` | Suma de pagos verificados |
| `/exportar` | Exportación a CSV |
| `/ruta` | Ubicación de archivos de datos |

---

## `/stats`

Muestra información general:

```text
📊 ESTADÍSTICAS
──────────────────────────────────

📋 Reportes:       125
⏳ Pendientes:      12
✅ Verificados:    108

💰 Total reportado:   $X
💰 Total verificado:  $Y
```

---

## `/pendientes`

Muestra operaciones no verificadas:

```text
📋 PENDIENTES
──────────────────────────────────

👤 Usuario : Usuario
📌 DNI     : 12345678
💰 Monto   : $50.000
```

---

## `/verificados`

Muestra verificaciones recientes:

```text
✅ VERIFICADOS
──────────────────────────────────

👤 Usuario : Usuario
📌 DNI     : 12345678
💰 Monto   : $50.000
📅 Fecha   : 13/08/2026
```

---

## `/suma`

Calcula el total de operaciones verificadas:

```text
💰 SUMA DE VERIFICADOS
──────────────────────────────────

Cantidad: 108
Total:    $X
```

---

## `/exportar`

Genera un CSV para procesamiento externo:

```text
reportes.json
      │
      ▼
 Bot Python
      │
      ▼
    CSV
      │
      ▼
Administrador
```

---

## `/ruta`

Muestra las ubicaciones utilizadas para los archivos:

```text
📁 ARCHIVOS

reportes:
    /ruta/reportes.json

verificados:
    /ruta/verificados.json
```

---

# 🔒 17. Seguridad

La arquitectura separa el frontend público de las funciones sensibles.

## Token de Telegram

El token del bot permanece exclusivamente en el VPS:

```text
❌ GitHub Pages
❌ JavaScript público
❌ deudas.csv

✅ VPS
```

El navegador nunca debería recibir el token de Telegram.

## Autorización administrativa

Las operaciones administrativas están restringidas mediante:

```text
ADMIN_IDS
```

Conceptualmente:

```python
if user_id not in ADMIN_IDS:
    reject_request()
```

Esto evita que usuarios externos ejecuten comandos administrativos.

---

# 🧩 18. Separación de responsabilidades

## Frontend

```text
GitHub Pages
├── HTML
├── CSS
├── JavaScript
└── deudas.csv
```

Responsabilidades:

- interfaz pública;
- carga del catálogo;
- validación del DNI;
- consulta de deudas;
- agrupación por cartera;
- cálculo del total;
- visualización de métodos de pago;
- reporte de pagos;
- almacenamiento local temporal;
- reintento de reportes;
- exportación local de reportes.

---

## Backend PHP

```text
VPS
└── autogest_back.php
```

Responsabilidades arquitectónicas:

- recibir reportes;
- validar datos;
- almacenar información;
- gestionar comprobantes;
- comunicarse con Telegram;
- mantener las credenciales privadas.

---

## Bot administrativo

```text
VPS
└── bot.py
```

Responsabilidades:

- recibir callbacks de Telegram;
- verificar reportes;
- rechazar reportes;
- consultar JSON;
- calcular pendientes;
- generar estadísticas;
- calcular sumas;
- exportar información;
- ejecutar comandos administrativos.

---

# 🗂️ 19. Estructura del proyecto

Estructura conceptual:

```text
GitHub Repository
│
├── index.html
├── styles.css
├── script.js
└── deudas.csv


VPS
│
├── autogest_back.php
├── reportes.json
├── verificados.json
└── bot.py
```

El frontend puede ejecutarse como sitio estático.

El backend y el bot requieren el entorno del VPS.

---

# 🔁 20. Flujo completo

```text
                                USUARIO
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
               Consulta DNI                  Reporta pago
                    │                    DNI + monto + WhatsApp
                    │                       + comprobante
                    ▼                             │
             GitHub Pages                         ▼
                    │                        VPS / PHP
                    ▼                             │
              deudas.csv                         ▼
                    │                      reportes.json
                    │                             │
                    │                             ▼
                    │                       Telegram Bot API
                    │                             │
                    │                             ▼
                    │                       Administradores
                    │                             │
                    │                       ┌─────┴─────┐
                    │                       │           │
                    │                   Verificar    Rechazar
                    │                       │           │
                    │                       └─────┬─────┘
                    │                             │
                    │                             ▼
                    │                        Bot Python
                    │                             │
                    │                ┌────────────┼────────────┐
                    │                │            │            │
                    │                ▼            ▼            ▼
                    │          verificados   Pendientes     Stats
                    │             .json       calculados
                    │                │
                    │                ▼
                    │          /verificados
                    │
                    ▼
                 Resultado
```

---

# 📐 21. Modelo de datos

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

# 🛠️ 22. Stack tecnológico

| Componente | Tecnología |
|---|---|
| Frontend | HTML / CSS / JavaScript |
| Hosting frontend | GitHub Pages |
| Datos públicos | CSV |
| Backend | PHP |
| Hosting backend | VPS |
| Persistencia backend | JSON |
| Persistencia local | Browser `localStorage` |
| Bot | Python |
| Administración | Telegram |
| Comunicación | Telegram Bot API |
| Exportación | CSV / JSON |

---

# ⚙️ 23. Detalles de implementación del frontend

### Carga de datos

Al iniciar el documento:

```text
DOMContentLoaded
      │
      ├── cargarDatos()
      └── verReportesGuardados()
```

`cargarDatos()` realiza un `GET` de `deudas.csv`, convierte el contenido mediante `csvToJson()` y marca los datos como disponibles.

### Fecha del catálogo

El frontend intenta utilizar el header HTTP:

```text
Last-Modified
```

Si no está disponible, utiliza:

```text
localStorage.fecha_csv
```

y finalmente genera una fecha local como fallback.

### Consulta

La función `consultar()`:

1. Valida el DNI.
2. Comprueba que el CSV esté cargado.
3. Busca coincidencias exactas por DNI.
4. Agrupa por `Codigo`.
5. Calcula el subtotal de cada código.
6. Agrupa cada código por `Cartera`.
7. Calcula el total general.
8. Muestra el resumen por código.
9. Ofrece los métodos de pago.
10. Permite reportar el pago.

### Pago

La función `pagar()` recibe:

```text
metodo
 total
```

y reconstruye el desglose de códigos del DNI consultado para mostrarlo junto con los datos del método de pago.

### Reporte

La función `reportarPago()` crea dinámicamente el formulario y mantiene el DNI asociado a la consulta.

La función `enviarReporte()`:

- valida nombre y monto;
- crea `FormData`;
- valida el tamaño del comprobante;
- guarda una copia local;
- ejecuta el `POST` al VPS;
- espera como máximo 60 segundos;
- procesa la respuesta JSON;
- limpia el formulario si el envío es correcto;
- ofrece reintento sin comprobante si corresponde.

---
# 🧪 24. Manejo de errores

El frontend contempla:

- CSV no disponible.
- DNI inválido.
- Datos todavía no cargados.
- Archivo demasiado grande.
- Respuesta HTTP no válida.
- Respuesta del backend que no sea JSON.
- Timeout de 60 segundos.
- Error al enviar comprobante.
- Reintento sin comprobante.
- Reportes pendientes almacenados localmente.

Si la respuesta del backend no puede interpretarse como JSON, el frontend considera que el servidor no respondió correctamente.

---

# ⚠️ 25. Consideraciones técnicas

## Comparación por DNI

La arquitectura actual utiliza el DNI como identificador principal para relacionar reportes y verificaciones.

Esto funciona correctamente si:

```text
1 DNI = 1 operación relevante
```

pero puede ser insuficiente si:

```text
1 DNI → múltiples pagos
```

o:

```text
1 DNI → múltiples reportes
```

En una evolución futura sería preferible utilizar un identificador único de operación, por ejemplo:

```text
reporte_id
```

y relacionar:

```text
reporte_id
    │
    ├── reporte
    └── verificación
```

Esto evitaría ambigüedades y permitiría conservar correctamente el historial de múltiples pagos del mismo DNI.

---

# 🚀 26. Posibles mejoras futuras

### Identificador único de reporte

```text
REP-20260813-000123
```

Permitiría identificar cada operación independientemente del DNI.

### Estado explícito

En lugar de inferir el estado exclusivamente mediante archivos:

```text
pendiente
verificado
rechazado
```

Esto permitiría mantener un historial más preciso.

### Base de datos

Si el volumen crece, podría migrarse:

```text
JSON
  ↓
SQLite / MySQL / PostgreSQL
```

### API para consulta

Actualmente:

```text
Frontend → deudas.csv
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

### Auditoría

Agregar:

```text
reporte_id
admin_id
fecha_creacion
fecha_verificacion
fecha_rechazo
accion
motivo
```

permitiría reconstruir completamente la historia de cada operación.

---

# 🎯 Principios de diseño

### Seguridad

Las credenciales y operaciones administrativas permanecen en el VPS.

### Simplicidad

El catálogo público utiliza un CSV estático que puede actualizarse fácilmente.

### Separación de responsabilidades

El frontend público no tiene acceso al token de Telegram ni a las funciones administrativas.

### Tolerancia a fallos

Los reportes se conservan localmente para reducir el riesgo de pérdida ante fallos temporales de red o backend.

### Persistencia simple

Los archivos JSON permiten mantener una arquitectura sencilla mientras el volumen de datos sea manejable.

### Escalabilidad progresiva

La arquitectura permite evolucionar desde:

```text
CSV + JSON
```

hacia:

```text
API + Base de datos
```

sin cambiar necesariamente la interfaz administrativa.

---

# 📌 Comandos

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
│ deudas.csv                          │
│                                     │
│ Consulta + Reporte                  │
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
│          ADMINISTRADORES             │
│                                     │
│ ✅ Verificar                        │
│ ❌ Rechazar                         │
│ 📊 Estadísticas                    │
│ 📋 Pendientes                       │
│ 📤 Exportaciones                    │
└─────────────────────────────────────┘
```

## Arquitectura resumida

```text
deudas.csv
    │
    ▼
GitHub Pages
    │
    ├── Consulta DNI
    │
    └── Reporte de pago
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
                    ├── Verificar
                    ├── Rechazar
                    ├── Pendientes
                    ├── Estadísticas
                    ├── Sumas
                    └── Exportar
```

El frontend se encarga de la **consulta y recepción de reportes**, mientras que el VPS concentra la **persistencia, comunicación con Telegram y administración**.

La arquitectura actual es simple y funcional, pero el siguiente salto técnico importante sería incorporar un **ID único por operación** para dejar de depender exclusivamente del DNI como identificador de reportes y verificaciones.
