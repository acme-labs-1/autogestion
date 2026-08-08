# 🤖 Deuda Bot — Sistema de Gestión y Verificación de Pagos

Sistema web + backend para **consulta de deudas, reporte de pagos y verificación administrativa mediante Telegram**.

La arquitectura separa la consulta pública de deudas de la gestión interna de pagos:

* **GitHub Pages** → frontend público y catálogo de deudas.
* **VPS** → API PHP, almacenamiento de reportes y bot de Telegram.
* **Telegram** → interfaz de administración y verificación.
* **JSON** → almacenamiento de reportes y verificaciones.

---

## 🏗️ Arquitectura

```text
                        ┌──────────────────────┐
                        │       USUARIO        │
                        └──────────┬───────────┘
                                   │
                         Consulta DNI / Reporte
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
          ┌──────────────────┐          ┌──────────────────┐
          │   GITHUB PAGES   │          │       VPS        │
          │                  │          │                  │
          │ HTML + JS        │          │ autogest_back.php│
          │                  │          │                  │
          │   deudas.csv     │          │  reportes.json   │
          └──────────────────┘          └────────┬─────────┘
                                                 │
                                                 │ Telegram API
                                                 ▼
                                      ┌──────────────────────┐
                                      │    ADMINISTRADORES   │
                                      │       TELEGRAM       │
                                      │                      │
                                      │  ✅ Verificar        │
                                      │  ❌ Rechazar         │
                                      └──────────┬───────────┘
                                                 │
                                                 │ Callback
                                                 ▼
                                      ┌──────────────────────┐
                                      │      BOT PYTHON      │
                                      │                      │
                                      │ verificados.json    │
                                      │ /stats               │
                                      │ /pendientes          │
                                      │ /verificados         │
                                      │ /suma                │
                                      │ /exportar            │
                                      └──────────────────────┘
```

---

# 🔄 Flujo del sistema

## 1. Consulta de deuda

La consulta de deuda se realiza directamente desde el frontend.

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
   │ JavaScript procesa CSV
   ▼
Filtrado por DNI
   │
   ▼
Deudas + total
```

El usuario ingresa su DNI en la página web.

El JavaScript descarga:

```text
deudas.csv
```

desde el repositorio de GitHub y procesa el archivo directamente en el navegador.

El frontend:

1. Descarga el CSV.
2. Parsea las filas.
3. Busca coincidencias por DNI.
4. Obtiene las deudas correspondientes.
5. Calcula el total.
6. Muestra la información al usuario.

Esta operación no requiere una consulta al backend.

---

# 💳 2. Reporte de pago

Cuando el usuario realiza un pago, puede reportarlo desde la página web.

El flujo es:

```text
Frontend
   │
   │ FormData
   ▼
autogest_back.php
   │
   ├── Validación
   │
   ├── Guardado
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

El formulario puede incluir:

* DNI
* Nombre
* Monto
* Teléfono / WhatsApp
* Comprobante

Los datos se envían mediante `FormData` al endpoint PHP ubicado en el VPS.

Ejemplo conceptual:

```text
POST /autogest_back.php
Content-Type: multipart/form-data
```

La API PHP valida los datos recibidos y almacena el reporte.

---

# 🗃️ 3. Almacenamiento de reportes

Los reportes enviados por los usuarios se almacenan en:

```text
reportes.json
```

Este archivo contiene la información necesaria para procesar posteriormente las verificaciones.

Un registro puede contener conceptualmente:

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

> **Importante:** el bot no utiliza un campo `estado` para determinar si un reporte está pendiente.

El estado se determina mediante la relación entre:

```text
reportes.json
       │
       │ comparación por DNI
       ▼
verificados.json
```

Por lo tanto:

```text
PENDIENTES = REPORTES - VERIFICADOS
```

La condición se determina por DNI.

---

# 📲 4. Notificación a Telegram

Después de almacenar el reporte, PHP utiliza la **Telegram Bot API** para enviar una notificación al grupo de administradores.

El mensaje contiene los datos del reporte y botones inline:

```text
┌──────────────────────────────────┐
│ 💳 NUEVO REPORTE DE PAGO         │
│                                  │
│ 👤 Usuario : Usuario             │
│ 📌 DNI     : 12345678            │
│ 💰 Monto   : $50,000             │
│                                  │
│ [ ✅ Verificar ]                 │
│ [ ❌ Rechazar  ]                 │
└──────────────────────────────────┘
```

Los botones contienen el DNI y el teléfono del reporte dentro del callback.

```text
verificar:DNI:telefono
rechazar:DNI:telefono
```

Ejemplo:

```text
verificar:12345678:549XXXXXXXXXX
```

Esto permite al bot identificar el reporte y disponer del número de contacto asociado a la operación.

---

# 🔐 5. Verificación administrativa

La verificación se realiza directamente desde Telegram.

```text
Administrador
      │
      │ Click ✅ Verificar
      ▼
Telegram
      │
      │ Callback Query
      │ verificar:DNI:telefono
      ▼
Bot Python
      │
      │ Consulta reportes.json
      ▼
Verificación
      │
      ▼
verificados.json
      │
      ▼
Actualizar mensaje
```

Cuando un administrador presiona:

```text
✅ Verificar
```

el bot:

1. Recibe el `callback_query`.
2. Extrae el DNI y teléfono.
3. Busca el reporte correspondiente.
4. Comprueba si ya fue verificado.
5. Registra la operación en `verificados.json`.
6. Actualiza el mensaje de Telegram.
7. Muestra los datos del administrador que realizó la operación.
8. Genera el enlace de WhatsApp correspondiente.

El mensaje pasa a mostrar:

```text
✅ PAGO VERIFICADO
───────────────────────────────────
👤 Usuario : Usuario
📌 DNI     : 12345678
💰 Monto   : $50,000
👤 Verificado por: Admin
───────────────────────────────────
📱 Contactar: https://wa.me/549XXXXXXXXXX
```

---

# ❌ 6. Rechazo de reportes

El administrador también puede seleccionar:

```text
❌ Rechazar
```

El callback utilizado es:

```text
rechazar:DNI:telefono
```

El bot procesa la operación y muestra la información correspondiente al administrador.

También se genera el enlace de WhatsApp asociado al teléfono del reporte:

```text
📱 Contactar: https://wa.me/549XXXXXXXXXX
```

Esto permite contactar rápidamente al usuario desde Telegram.

---

# 📚 7. Historial de verificaciones

Los pagos verificados se almacenan en:

```text
verificados.json
```

Este archivo funciona como histórico de las operaciones aprobadas.

Conceptualmente:

```json
{
    "dni": "12345678",
    "monto": 50000,
    "verificado_por": "Admin",
    "fecha_verificacion": "2026-08-06 15:45:00"
}
```

La información de `verificados.json` se utiliza para:

* determinar qué reportes ya fueron procesados;
* calcular pendientes;
* mostrar verificaciones;
* calcular sumas;
* generar estadísticas;
* exportar información.

---

# 📊 8. Comandos administrativos

El bot proporciona comandos para consultar y administrar la información almacenada en el VPS.

## `/stats`

Muestra estadísticas generales del sistema.

Ejemplo:

```text
📊 ESTADÍSTICAS
───────────────────────────────────

📋 Reportes:       125
⏳ Pendientes:      12
✅ Verificados:    108

💰 Total reportado:   $X
💰 Total verificado:  $Y
```

Los pendientes se calculan comparando los reportes existentes con los DNI que ya aparecen en `verificados.json`.

---

## `/pendientes`

Muestra los reportes que todavía no fueron verificados.

```text
📋 PENDIENTES
───────────────────────────────────

👤 Usuario : Usuario
📌 DNI     : 12345678
💰 Monto   : $50,000

👤 Usuario : Otro Usuario
📌 DNI     : 87654321
💰 Monto   : $25,000
```

La lista se obtiene mediante:

```text
reportes.json
      │
      ├── DNI verificado → excluir
      │
      └── DNI no verificado → pendiente
```

---

## `/verificados`

Muestra los últimos pagos verificados.

```text
✅ VERIFICADOS
───────────────────────────────────

👤 Usuario : Usuario
📌 DNI     : 12345678
💰 Monto   : $50,000
📅 Fecha   : 06/08/2026

👤 Usuario : Otro Usuario
📌 DNI     : 87654321
💰 Monto   : $25,000
📅 Fecha   : 06/08/2026
```

Los datos se obtienen de `verificados.json`.

---

## `/suma`

Calcula la suma de los pagos verificados.

```text
💰 SUMA DE VERIFICADOS
───────────────────────────────────

Cantidad: 108
Total:    $X
```

El cálculo se realiza a partir de los registros almacenados en:

```text
verificados.json
```

---

## `/exportar`

Genera un archivo CSV con la información disponible para su utilización externa.

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

Esto permite realizar análisis, respaldos o procesamiento posterior de los datos.

---

## `/ruta`

Muestra las ubicaciones utilizadas por el sistema para los archivos de datos.

Ejemplo conceptual:

```text
📁 ARCHIVOS

reportes:
    /ruta/reportes.json

verificados:
    /ruta/verificados.json
```

---

# 🗂️ Estructura de almacenamiento

El sistema utiliza un archivo CSV público y dos archivos JSON en el backend.

```text
GitHub Repository
└── deudas.csv


VPS
├── reportes.json
└── verificados.json
```

### `deudas.csv`

Catálogo público de deudas.

Es un recurso estático utilizado directamente por el frontend.

### `reportes.json`

Contiene los reportes enviados por los usuarios.

No se utiliza un campo `estado` para determinar pendientes.

### `verificados.json`

Contiene el histórico de pagos procesados como verificados.

La comparación entre ambos archivos permite determinar qué reportes continúan pendientes.

---

# 🔒 Seguridad

La arquitectura separa deliberadamente el frontend público de la lógica administrativa.

## Token de Telegram

El token del bot se encuentra exclusivamente en el VPS.

```text
❌ GitHub Pages
❌ JavaScript público
❌ deudas.csv

✅ VPS
```

El navegador nunca recibe las credenciales de Telegram.

---

## Validación de API

La API PHP valida los datos recibidos antes de almacenarlos.

Las validaciones incluyen, según corresponda:

* campos obligatorios;
* formato del DNI;
* monto;
* teléfono;
* comprobante;
* tamaño del archivo;
* tipo de archivo permitido.

---

## Autorización administrativa

Las funciones administrativas están restringidas mediante:

```text
ADMIN_IDS
```

El bot comprueba el ID de Telegram del usuario antes de ejecutar comandos y operaciones administrativas.

Conceptualmente:

```python
if user_id not in ADMIN_IDS:
    reject_request()
```

Esto evita que usuarios externos puedan utilizar las funciones administrativas del bot.

---

# 🧩 Separación de responsabilidades

## Frontend

```text
GitHub Pages
├── HTML
├── CSS
├── JavaScript
└── deudas.csv
```

Responsabilidades:

* interfaz web;
* consulta por DNI;
* procesamiento del CSV;
* cálculo y visualización de deudas;
* envío de reportes.

---

## Backend PHP

```text
VPS
└── autogest_back.php
```

Responsabilidades:

* recibir reportes;
* validar datos;
* almacenar información;
* gestionar comprobantes;
* comunicarse con Telegram;
* mantener las credenciales privadas.

---

## Bot administrativo

```text
VPS
└── bot.py
```

Responsabilidades:

* recibir callbacks de Telegram;
* verificar reportes;
* rechazar reportes;
* consultar JSON;
* calcular pendientes;
* generar estadísticas;
* calcular sumas;
* exportar datos;
* ejecutar comandos administrativos.

---

# 🔁 Flujo completo

```text
                         USUARIO
                            │
                  ┌─────────┴─────────┐
                  │                   │
             Consulta DNI        Reporta pago
                  │              (con comprobante)
                  ▼                   │
             GitHub Pages             ▼
                  │                VPS / PHP
             deudas.csv                │
                  │                    ▼
                  │              reportes.json
                  │                    │
                  │                    ▼
                  │          Telegram con botones
                  │                    │
                  │              ┌─────┴─────┐
                  │              │           │
                  │          Verificar    Rechazar
                  │          callback     callback
                  │          DNI + tel    DNI + tel
                  │              │           │
                  │              └─────┬─────┘
                  │                    │
                  │                    ▼
                  │                Bot Python
                  │                    │
                  │          ┌─────────┼─────────┐
                  │          │         │         │
                  │          ▼         ▼         ▼
                  │    verificados  Pendientes  Stats
                  │       .json      calculados
                  │          │       por diferencia
                  │          │
                  │          ▼
                  │     /verificados
                  │
                  │
                  └──────────► Resultado
```

---

# 📌 Comandos

```text
📌 COMANDOS
───────────────────────────────────

/stats       - Estadísticas
/pendientes  - Ver pendientes
/verificados - Ver pagos verificados
/suma        - Suma de verificados
/exportar    - Exportar CSV
/ruta        - Ubicación de archivos
```

---

# 🎯 Principios de diseño

### Seguridad

Las credenciales y operaciones administrativas permanecen en el VPS.

### Simplicidad

El catálogo de deudas utiliza un CSV estático que puede actualizarse fácilmente desde GitHub.

### Separación de responsabilidades

El frontend público no tiene acceso directo a las funciones administrativas ni al token de Telegram.

### Centralización

Los reportes, verificaciones, estadísticas y exportaciones se gestionan desde el backend.

### Persistencia simple

Los datos se almacenan en archivos JSON, evitando introducir una base de datos cuando el volumen y las necesidades del sistema no lo requieren.

---

# 🛠️ Stack tecnológico

| Componente       | Tecnología              |
| ---------------- | ----------------------- |
| Frontend         | HTML / CSS / JavaScript |
| Hosting frontend | GitHub Pages            |
| Datos públicos   | CSV                     |
| Backend          | PHP                     |
| Hosting backend  | VPS                     |
| Persistencia     | JSON                    |
| Bot              | Python                  |
| Administración   | Telegram                |
| Comunicación     | Telegram Bot API        |
| Exportación      | CSV                     |

---

# 📐 Resumen de arquitectura

```text
GitHub Pages
    │
    └── Consulta de deudas
             │
             └── deudas.csv


Usuario
    │
    └── Reporte de pago
        (con comprobante)
             │
             ▼
           VPS
             │
       autogest_back.php
             │
       ┌─────┴─────┐
       ▼           ▼
reportes.json   Telegram
                   │
        botones con DNI + teléfono
                   │
              Administradores
                   │
              Bot Python
          callback DNI + teléfono
                   │
          ┌────────┼────────┬────────────┐
          ▼        ▼        ▼            ▼
  verificados   Pendientes  Stats    Exportar CSV
     .json      calculados
                   │
                   ▼
              /pendientes

verificados.json
       │
       ├── /verificados
       ├── /suma
       └── cálculo de pendientes
```

---

# 🚀 Resumen

El sistema utiliza una arquitectura distribuida pero sencilla:

```text
                 ┌──────────────────┐
                 │   GITHUB PAGES   │
                 │                  │
                 │  Consulta deuda  │
                 └────────┬─────────┘
                          │
                       CSV estático
                          │
                          ▼
                      USUARIO
                          │
                    Reporte de pago
                          │
                          ▼
                 ┌──────────────────┐
                 │       VPS        │
                 │                  │
                 │  PHP + JSON      │
                 │  Python + Bot    │
                 └────────┬─────────┘
                          │
                    Telegram API
                          │
                          ▼
                 ┌──────────────────┐
                 │ ADMINISTRADORES  │
                 │                  │
                 │ ✅ Verificar     │
                 │ ❌ Rechazar      │
                 └──────────────────┘
```

El frontend se encarga de **consultar y recibir reportes**, mientras que el VPS concentra la **lógica sensible, persistencia y administración**.

La verificación se realiza desde Telegram mediante callbacks que contienen **DNI + teléfono**, y el bot utiliza `verificados.json` para determinar qué reportes ya fueron procesados y cuáles continúan pendientes.
