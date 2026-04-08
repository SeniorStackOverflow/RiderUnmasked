# Glovo Rider — Reverse Engineering Notes

**App:** Glovo Rider (`com.logistics.rider.glovo`)
**Version:** v4.2614.1 (code 1210)
**SDK:** min 28 (Android 9) / target 35 (Android 15)
**Decompiled source:** `app-decompiled/com.logistics.rider.glovo/jadx/sources/`

---

## XAPK Structure

| APK | Purpose |
|-----|---------|
| `com.logistics.rider.glovo.apk` | Base app (29,540 classes) |
| `config.arm64_v8a.apk` | Native libs (arm64) |
| `config.xhdpi.apk` | xhdpi density resources |

---

## Entry Points

| Component | Class |
|-----------|-------|
| Main Activity | `com.foodora.courier.main.presentation.MainActivity` |
| Application class | `com.foodora.courier.app.application.CourierApplication` |

---

## Package Architecture

### `com.foodora.courier` — legacy shell
`app`, `base`, `legacy`, `main`, `push`, `rooster`

### `com.roadrunner` — modern feature modules (clean architecture)
| Category | Modules |
|----------|---------|
| Auth & Security | `auth`, `login`, `twofa`, `nafath`, `biometrics`, `face`, `liveness`, `secure` |
| Delivery | `delivery`, `order`, `ontheway`, `recentdeliveries`, `startworking`, `startingarea` |
| Location | `location`, `map`, `heatmap` |
| Earnings | `wallet`, `cashout`, `opportunities`, `freelancing` |
| Comms | `chat`, `customerchat`, `notifications`, `push`, `realtime` |
| Account | `rider`, `user`, `settings`, `sidemenu`, `country` |
| Real-time | `realtime`, `remoteconfig`, `sessionconfig` |

### Third-party SDKs
Retrofit2, OkHttp3, Mapbox, Braze, Freshchat, Adjust, Sentiance, Incognia, Dagger, Coil3, RootBeer (scottyab), Firebase, Huawei HMS

---

## Auth & Security

### API Endpoints (`/api/iam-login/`)

```
POST  /api/iam-login/v2/auth                      ← Login (email/password)
POST  /api/iam-login/v2/auth/2fa/trigger          ← Request 2FA code
POST  /api/iam-login/v2/auth/2fa/verify           ← Verify OTP
POST  /api/iam-login/v2/auth/magic_link/generate  ← Password reset link
POST  /api/iam-login/v2/auth/magic_link/verify    ← Verify magic link
POST  /api/iam-login/v2/auth/refresh_token        ← Refresh access token
PUT   /api/iam-login/v2/auth/logout               ← Logout
PUT   /api/iam-login/users/reset_password         ← Reset password via link
PUT   /api/iam-login/users/update_password        ← Update password (authed)
POST  /api/iam-login/selfie                       ← Upload face/liveness images
```

### Key Classes

| Class | File | Role |
|-------|------|------|
| `ApiError` | `com/roadrunner/auth/api/data/ApiError.java` | Error hierarchy (InvalidCode, TooManyAttempts, InvalidFlow, TwoFaFailureResponse) |
| `LogoutLifecycleCallbacksImpl` | `com/roadrunner/auth/domain/logout/LogoutLifecycleCallbacksImpl.java` | Logout orchestration — cancels coroutines, finishes activities |
| `NafathModalFragment` | `com/roadrunner/nafath/presentation/ui/NafathModalFragment.java` | Saudi national ID verification modal |
| `BiometricsActivity` | `com/roadrunner/biometrics/presentation/BiometricsActivity.java` | Fingerprint/face auth (encrypt/decrypt modes) |
| `LivenessDetectionActivity` | `com/roadrunner/liveness/` | Anti-spoofing — head movement + smile thresholds |
| `IdentityVerificationActivity` | `com/roadrunner/face/` | Static selfie → POST /selfie |

### Token Handling

- **Storage:** `access_token` + `refresh_token` in encrypted SharedPreferences
- **Refresh:** Silent refresh on 401 — controlled by `IS_SEAMLESS_TOKEN_REFRESH_ENABLED` flag
- **HTTP headers:**
  ```
  Authorization: Bearer {access_token}
  XX-Request-Token: {request_signature}   ← request-level signing
  Log-Employee-User: {value}              ← employee login tracking
  ```

### Login Flow
```
LoginActivity → ViewModel (C13006fwu)
  → POST /api/iam-login/v2/auth
  → store access_token + refresh_token
```

### Token Refresh Flow
```
401 response → SessionInvalidException
  → POST /api/iam-login/v2/auth/refresh_token
  → retry original request
```

### 2FA Flow
```
POST /api/iam-login/v2/auth/2fa/trigger  (SMS/email code)
  → user enters code
  → POST /api/iam-login/v2/auth/2fa/verify
  → errors: InvalidCode | TooManyAttempts | InvalidFlow
```

### Logout Flow
```
LogoutLifecycleCallbacksImpl.onActivityResumed()
  → cancel all coroutines
  → finish all non-LogoutActivity activities
  → PUT /api/iam-login/v2/auth/logout
  → clear tokens
```

### Nafath (Saudi Arabia National ID)
```
Backend generates session → returns display_code + expires_at
  → NafathModalFragment (non-dismissible)
  → user scans code in Nafath government app
  → backend receives gov callback
  → VerificationStatus: pending → success/failed/expired
```

### Auth Feature Flags
| Flag | Effect |
|------|--------|
| `IS_SEAMLESS_TOKEN_REFRESH_ENABLED` | Silent token refresh on 401 |
| `IS_AUTH_STATE_MACHINE_ENABLED` | State machine guards on login transitions |
| `IS_LIVENESS_DETECTION_ENABLED` | Enable liveness anti-spoofing step |
| `IS_BIOMETRICS_ENABLED` | Enable biometric login |
| `IS_ASYNC_LOGIN_FLOW_ENABLED` | Async login path |
| `IS_REFRESH_TOKEN_LOGIC_CHANGE_ENABLED` | New refresh strategy |

---

## Root / Tamper Detection

### Orchestrator
**`o/C6082cjy.write()`** — called once at app startup.

```
C6082cjy.write()
  ├─ AbstractC4428brQ.IconCompatParcelizer()  → bitfield (bits 1,2,4)
  ├─ C6081cjx (coroutine)                    → su / mount / getprop checks
  │   ├─ AbstractC12857fuD                   → file + package scan
  │   ├─ C5578caO                            → magic.mount + debuggable
  │   └─ RootBeerNative.checkForRoot()       → native JNI (libfoo.so)
  ├─ fOC.IconCompatParcelizer()              → FLAG_DEBUGGABLE
  └─ Llm.Y()                                 → Frida port 27042
```

### Detection Techniques

| Vector | Technique | Class |
|--------|-----------|-------|
| Root binaries | File existence in 11 paths (`/sbin/`, `/system/xbin/`, etc.) | `AbstractC12857fuD` |
| Root apps | 12 package names (Magisk, SuperSU, KingRoot…) | `AbstractC12857fuD` |
| Root APK | `/system/app/Superuser.apk` existence | `AbstractC4428brQ` |
| Signing | `Build.TAGS = "test-keys"` | `AbstractC4428brQ` |
| Emulator | `Build.HARDWARE` contains `goldfish` / `ranchu` | `AbstractC4428brQ` |
| Emulator | `Build.PRODUCT` contains `sdk` | `AbstractC4428brQ` |
| Emulator | `Build.FINGERPRINT` contains `generic` / `robolectric` | Multiple |
| Eng build | `userdebug` + `dev-keys` combined | `C2593avE` |
| su in PATH | `Runtime.exec(["which", "su"])` | `C6081cjx` |
| System props | `ro.debuggable=1`, `ro.secure=0` via `getprop` | `C6081cjx` |
| Filesystem | `mount` → RW on `/system`, `/system/xbin`, etc. | `C6081cjx` |
| Debugger | `Debug.isDebuggerConnected()` | `AbstractC4428brQ` |
| Debugger | `ApplicationInfo.FLAG_DEBUGGABLE` | `fOC` |
| **Frida** | `new ServerSocket(27042)` → BindException = Frida running | `Llm.java` (Incognia) |
| Native | `System.loadLibrary("toolChecker")` → JNI checkForRoot | `RootBeerNative` |

### Result Bitfield (`AbstractC4428brQ`)
```
Bit 1 (value 2) → test-keys / su found / Superuser.apk
Bit 2 (value 4) → emulator detected
Bit 4 (value 8) → debugger connected
```

### Enforcement: Silent, Server-Side

**No local block.** The app does NOT crash, show a dialog, or call `System.exit()`.

Detection results are packed into `DeviceData` (`o/C4526btI`) and sent via three channels:

| Channel | Destination |
|---------|-------------|
| Firebase Crashlytics | Attached to every crash/event report |
| Incognia SDK | `sendLoginEvent()` / `sendOnboardingEvent()` → Incognia cloud |
| Glovo backend | `POST /api/delivery-flow/v1/courier/device_token` + `compare_device_token` |

Backend decides whether to block login, restrict features, or flag the account.

---

## Device Token Flow

### Endpoints
```
POST /api/delivery-flow/v1/courier/device_token         ← register token
POST /api/delivery-flow/v1/courier/compare_device_token ← verify token matches
```

### What the "device_token" Actually Is

Not a hardware fingerprint — it's a **push notification token** (FCM or HMS).

**Token generation:**
```
Primary:  HmsInstanceId.getInstance(app).getToken()  ← Huawei HMS
Fallback: FirebaseMessaging.getInstance().getToken() ← Google FCM
```
Fetched fresh on each call, not cached.

### Request / Response
```json
// Both endpoints — request body
{ "device_token": "<FCM or HMS token>" }

// compare_device_token — response
{ "device_token_status": true | false }
```

### Call Flow
```
dEU (orchestrator)
  ├─ dEQ.write(orderId) → POST /device_token       (on order events)
  └─ dEI.doWork()       → POST /compare_device_token (periodic verification)
       └─ device_token_status: false → enforcement by backend
```

### Key Classes
| Class | File | Role |
|-------|------|------|
| `eCI` | `o/eCI.java` | Retrofit interface (3 endpoints) |
| `eCJ` | `o/eCJ.java` | Request model `{ device_token }` |
| `eCE` | `o/eCE.java` | Response model `{ device_token_status }` |
| `eCG` | `o/eCG.java` | Retrofit wrapper |
| `dEQ` | `o/dEQ.java` | POST worker (register token) |
| `dEI` | `o/dEI.java` | Compare worker (verify token) |
| `dEU` | `o/dEU.java` | Orchestrator |
| `C2202anj` | `o/C2202anj.java` | Huawei HMS token provider |
| `C2197ane` | `o/C2197ane.java` | Firebase FCM token provider |

### Security Model
```
Session 1: POST /device_token  → server stores token A for account
Session 2: POST /compare_device_token with token B
           → server: A == B?
           → false if device changed (new install, ROM flash, emulator, cloned app)
```

**Weakness:** Replaying the same FCM token across devices bypasses this check entirely — token is not signed or cryptographically bound to hardware at the client level.

---

## Incognia Fingerprinting

**Scale:** 2,193 classes — a serious fraud intelligence platform, not a lightweight library.

### Data Collected

#### Hardware (20+ fields) — `pCO.java`
```
Build.BOARD / BOOTLOADER / BRAND / DEVICE / FINGERPRINT / HARDWARE
Build.HOST / ID / MANUFACTURER / MODEL / PRODUCT / SERIAL
Build.RADIO / TAGS / TIME / USER / DISPLAY
Build.SUPPORTED_ABIS (32-bit + 64-bit)
Build.SOC_MODEL / SOC_MANUFACTURER  (API 31+)
Build.VERSION.MEDIA_PERFORMANCE_CLASS (API 31+)
```

#### Network — `rJD.java` + `Zit.java`
```
TelephonyManager.getAllCellInfo()       ← cell tower IDs
TelephonyManager.getDataNetworkType()  ← 4G/5G/LTE
TelephonyManager.isDataRoamingEnabled()
WifiInfo.getBSSID()                    ← access point MAC
WifiInfo.getSSID()                     ← network name
WifiManager.getScanResults()           ← all nearby WiFi APs
```

#### Location — `UP.java`
```
GPS latitude, longitude, accuracy, timestamp
Passive location updates every 5 minutes
```

#### Sensors — `LXM.java`
```
SensorManager.getSensorList(-1)  ← ALL sensor types
Accelerometer, gyroscope, magnetometer
Sensor power/resolution metadata ← distinguishes real vs simulated hardware
```

#### Installed Apps — `rc.java`
```
getInstalledPackages() → complete app list
Per-app: label, signatures, permissions, install source, APK checksums (API 31+)
System features list
```

#### Accessibility Services — `U.java`
```
getInstalledAccessibilityServiceList()
getEnabledAccessibilityServiceList(-1)
← catches screen readers, automation tools, hook frameworks
```

#### System Settings — `Gi9.java`
```
Screen brightness, font scale, sound effects, vibration
ADB enabled state         ← developer mode indicator
HTTP proxy settings       ← detects Burp/mitmproxy MITM
Auto-rotate, airplane mode, device provisioned status
```

#### Behavioral Signals
```
Timestamps and timing of all actions (runAndMeasureTime)
Accelerometer/gyroscope readings during the event itself
Location delta between events
Sensor jitter/variance ← real hardware vs emulator
```

#### Frida Detection — `Llm.java`
```java
new ServerSocket(27042).close()
// BindException → Frida running → flagged in fingerprint
```

### Encryption Pipeline — `OJe.java`

```
Raw JSON payload
  → Deflate compression (level 5)
  → AES-256-CBC (random 32-byte key + 16-byte IV)
  → HMAC-SHA256 over ciphertext
  → RSA wrapping of the AES key
  → Custom base64 encoding
  → Chunked HTTPS POST (256 bytes/chunk, 10s timeout)
```

Plus **certificate pinning**: server cert hashes included in the request payload — server validates them, making MITM detectable.

### API Endpoint

Stored **encrypted** as a byte array in `Kh.java`, decrypted at runtime via `OJe.Y(byte[])`. Not recoverable from static analysis without executing the decryption routine.

### `sendLoginEvent()` / `sendOnboardingEvent()`

```java
Incognia.sendLoginEvent(accountId, externalId, location, status, tag, properties)
Incognia.sendOnboardingEvent(accountId, externalId, address, tag, properties, status)
```

Both funnel into `bp.java` (payload builder) → encrypted queue → `FAV.java` (HTTP POST).

### Full Pipeline
```
App event (login / onboarding)
  → Collect all data categories above
  → Build p12 event payload (bp.java)
  → Serialize to JSON
  → Deflate → AES-256-CBC → HMAC-SHA256 → RSA wrap
  → Append cert pin hashes
  → Chunked HTTPS POST → Incognia cloud
  → Response: device risk score / fraud signal → Glovo backend acts on it
```

### Key Classes
| Class | File | Role |
|-------|------|------|
| `Incognia` | `com/incognia/Incognia.java` | Main public API |
| `Llm` | `com/incognia/internal/Llm.java` | Frida port 27042 detection |
| `FAV` | `com/incognia/internal/FAV.java` | HTTP POST transmission |
| `OJe` | `com/incognia/internal/OJe.java` | AES/RSA/HMAC encryption |
| `pCO` | `com/incognia/internal/pCO.java` | Build properties collector |
| `rJD` | `com/incognia/internal/rJD.java` | Cellular data collector |
| `Zit` | `com/incognia/internal/Zit.java` | WiFi data collector |
| `UP` | `com/incognia/internal/UP.java` | Location collector (5-min passive) |
| `LXM` | `com/incognia/internal/LXM.java` | Sensor collector |
| `rc` | `com/incognia/internal/rc.java` | Installed app + permissions collector |
| `U` | `com/incognia/internal/U.java` | Accessibility services collector |
| `Gi9` | `com/incognia/internal/Gi9.java` | System settings collector |
| `Kh` | `com/incognia/internal/Kh.java` | Encrypted API endpoint URL |

### Why It's Hard to Bypass

| Signal | What it catches |
|--------|----------------|
| Cell tower + WiFi scan | Location spoofing, emulators |
| Sensor jitter/variance | Real device vs emulator |
| Installed app list | Root tools, hook frameworks, parallel spaces |
| Accessibility services | Automation tools (AutoInput, MacroDroid) |
| ADB enabled | Developer mode / USB debugging |
| HTTP proxy setting | Burp/mitmproxy MITM |
| Frida port 27042 | Dynamic instrumentation |
| Cert pin in payload | MITM of Incognia's own traffic |
| AES+RSA+HMAC | Payload tampering detectable server-side |

Incognia runs **independently** from the app's own root detection — suppressing `C6082cjy` doesn't affect it. The two systems act as independent witnesses to the device state.

---

## Location Tracking

### Architecture: Two Independent Layers

```
FusedLocationProviderClient (Google) / Huawei HMS
            ↓
    ┌───────────────────────────────┐
    │   Layer 1: Glovo native       │   → POST /api/start-working-api/v1/rider_status
    │   (batched, state-driven)     │   → POST /api/start-working-api/v1/heatmaps
    └───────────────────────────────┘
    ┌───────────────────────────────┐
    │   Layer 2: Sentiance SDK      │   → https://api.sentiance.com/
    │   (always-on, autonomous)     │     (separate reporting pipeline)
    └───────────────────────────────┘
```

### API Endpoints

```
POST /api/start-working-api/v1/rider_status      ← rider state + location
POST /api/start-working-api/v1/heatmaps          ← location density aggregation
GET  /api/mobile/couriers/{user_id}/config       ← remote config (tracking params)
```

**Location object fields** (`o/C13007fwv.java`):
```json
{
  "timestamp": long,
  "latitude": double,
  "longitude": double,
  "horizontal_accuracy": float,
  "vertical_accuracy": float,
  "elevation": double,
  "direction": float,
  "direction_accuracy_centi": int,
  "speed": float,
  "speed_centimeter": int,
  "speed_accuracy_centimeter": int,
  "provider": string
}
```

### GPS Collection Pipeline

```
FusedLocationProviderClient.requestLocationUpdates()
  → Mapbox LocationService.getDeviceLocationProvider()
  → Navigator.updateLocation(FixLocation, callback)   ← native Mapbox
  → Sentiance TripLocation event
  → MaxWaitTimeManager batches updates (transaction IDs)
  → POST to Glovo backend (rider_status)
  → POST to Sentiance backend (independently)
```

Huawei devices: `com.huawei.hms.location` replaces Google Play Services.

### Foreground Services (Background Tracking)

| Service | Class | Type Flag | Purpose |
|---------|-------|-----------|---------|
| Sentiance primary | `o/ServiceC14301giC` | `0x808` (location + special use) | Always-on location + trip detection |
| Mapbox navigation | `NavigationNotificationService` | `0x8` (location) | Turn-by-turn navigation |

**Notification ID:** `2123874432` (hardcoded in `o/C14319giU`)

Sentiance service auto-restarts with 500ms exponential backoff — designed to survive system kill.

### Upload Strategy: Batched

`MaxWaitTimeManager` groups fixes into transactions — not one fix per request:
```
"updateLocations start transactionID" → collect batch
"updateLocations send msg"            → trigger upload
"updateLocations success"             → confirm delivery
```

### Sentiance SDK Features

| Feature | What it tracks |
|---------|---------------|
| `CrashDetectionFeature` | Sudden deceleration events |
| `UserContextFeature` | Activity type (walking, driving, stationary) |
| `DrivingInsightsFeature` | Speed, braking, cornering quality |
| `EventTimelineFeature` | Full movement history with timestamps |

Reports to `https://api.sentiance.com/` independently. Glovo accesses this data via Sentiance dashboard, not through the app's API.

### Heatmap Module

`POST /api/start-working-api/v1/heatmaps?version={v}` — sends aggregated location density (not raw coordinates). Used to show couriers where demand is high. Interval-based submission (~5–10 min buckets, inferred from `IntervalConfigurationException`).

### Starting Area (Geofencing)

`com/roadrunner/startingarea/` enforces deliveries begin from designated pickup zones. Backed by Sentiance geofence state machine (`com/sentiance/sdk/geofence/states/`) — entry/exit events drive delivery flow state transitions.

### Feature Flags

| Flag | Effect |
|------|--------|
| `distance-based-location-updates-with-increased-frequency` | Distance threshold replaces time interval |
| `kiwi_rider_status_fetch` | Controls rider status polling rate |
| `enable_system_foreground_service_default` | Background service on/off |

### Key Classes

| Class | File | Role |
|-------|------|------|
| `InterfaceC9442ePy` | `o/InterfaceC9442ePy.java` | Retrofit — rider_status endpoint |
| `InterfaceC7210dKi` | `o/InterfaceC7210dKi.java` | Retrofit — heatmaps endpoint |
| `ServiceC14301giC` | `o/ServiceC14301giC.java` | Sentiance foreground service |
| `C14319giU` | `o/C14319giU.java` | Foreground notification builder |
| `LocationService` | `com/mapbox/common/location/LocationService.java` | Mapbox location provider |
| `HeatmapResponse` | `com/roadrunner/heatmap/data/HeatmapResponse$Companion.java` | Heatmap response model |

---

## Delivery Flow

### Order State Machine

```
DISPATCHED
    ↓  (push notification sent)
COURIER_NOTIFIED  ──── timeout/reject ──→ [next courier]
    ↓  (rider taps Accept)
ACCEPTED
    ↓  (geofence: near pickup)
NEAR_PICKUP
    ↓  (task completed: QR / PIN / photo)
PICKED_UP
    ↓  (rider departs)
LEFT_PICKUP
    ↓  (geofence: near dropoff)
NEAR_DROPOFF
    ↓  (task completed: signature / photo / PIN)
DELIVERED
```

State enum: `com/roadrunner/delivery/repository/api/DeliveryInformation$DeliveryStatus.java`

### API Endpoints

```
# State & delivery list
POST /api/delivery-flow/v1/state                                             ← main state poll
POST /api/delivery-flow/v1/deliveries/list                                   ← paginated delivery list

# Order acceptance
GET  /api/delivery-flow/v1/deliveries/auto-accept                            ← auto-accept mode
POST /api/delivery-flow/v1/messages/{message_id}/acknowledge                 ← ack offer was shown

# Pickup / dropoff task completion
POST /api/delivery-flow/v1/deliveries/{delivery_id}/tasks                    ← submit any task

# Navigation
PUT  /api/delivery-flow/v1/route-preview                                     ← fetch/refresh route

# Order operations
PUT  /api/delivery-flow/v1/deliveries/{delivery_id}/change/transfer          ← hand off to another courier
POST /api/delivery-flow/v1/deliveries/{delivery_id}/deeplink                 ← generate sharing deep link
POST /api/delivery-flow/v1/deliveries/{delivery_id}/proxy-phone              ← proxy call to customer

# Earnings
POST /api/delivery-flow/v1/deliveries/earnings                               ← earnings for delivery IDs

# Push
PUT  /api/delivery-flow/v1/courier/notifications                             ← fetch courier notifications

# Post-delivery
PUT  /api/rider-experience/v1/deliveries/{delivery_id}/delivery_feedback     ← submit rating
POST /api/rider-experience/v1/delivery_feedback_config                       ← fetch rating options

# History
POST /api/rider-experience/v1/couriers/{user_id}/recent-deliveries-dashboard ← summary + earnings
POST /api/rider-experience/v1/couriers/{user_id}/order-history               ← full paginated history
```

### Order Offer Payload (`StateV3$AcceptData`)

```
orderId, vendor { name, address, location }
customer { name, phone }
dropoff  { address, location, delivery notes }
items[]  { name, quantity, price, extras[] }
earnings { base, boost, multiplier }
payment  { method: CARD|CASH|WALLET, amount, isPrepaid }
acceptance timer (countdown)
```

State poll headers on `POST /api/delivery-flow/v1/state`:
```
X-AUTO-ACCEPT, DF-Map-Centric-V2-Enabled, IS-BACKGROUND-SYNC,
Is-B2B-Order, X-Route-Preview-Toggle
```

### Accept / Reject

- **Auto-accept:** `GET /api/delivery-flow/v1/deliveries/auto-accept`
- **Manual accept:** implicit — no dedicated endpoint; state transitions via state poll
- **Reject:** no explicit endpoint — timer expiry or tap reject; acceptance rate tracked and shown in `LasagnaDeclineBottomSheet` / `LasagnaDeclineWithAcceptanceRateBottomSheet`

### Task System — Single Endpoint for All Confirmations

`POST /api/delivery-flow/v1/deliveries/{delivery_id}/tasks`

| Task | Class |
|------|-------|
| QR code scan | `QrScannerFragment` |
| PIN verification | `PinScreenFragment` (PIN hashed locally before submission) |
| Photo proof | `TakePictureTaskUiItem` |
| Digital signature | on-device capture |
| Cash collection | amount received + change |
| Contact verification | customer phone/address |

Split orders: `Instruction$SplitOrder.java` — multiple riders share a delivery.

### In-Transit (ontheway module)

- Periodic state polls: `POST /api/delivery-flow/v1/state` with `IS-BACKGROUND-SYNC`
- Route refresh: `PUT /api/delivery-flow/v1/route-preview` with `X-Refresh`
- Trip planner handles multi-stop stacked deliveries
- Proxy call to customer: `POST /api/delivery-flow/v1/deliveries/{delivery_id}/proxy-phone`
- Delivery notes, entrance photos, gate instructions shown to rider

### Full Order Model

From `com/roadrunner/order/history/data/database/entity/`:
```
Delivery {
  id, orderId
  vendor    { id, name, address, location }
  customer  { id, name, phone, email }
  address   { street, city, postalCode, country, instructions, latLng }
  items[]   { id, name, quantity, price, extras[] }
  payment   { method, amount, currency, isPrepaid }
  cash      { collected, change }
  status    DeliveryStatus
  createdAt, updatedAt
}
```

Persisted in local Room database (`HistoryDatabase.java`) for offline access.

### Architecture Notes

| Pattern | Detail |
|---------|--------|
| Order receipt | Hybrid: push notification + periodic state polling |
| Confirmation | Generic task model — same endpoint for QR, PIN, photo, signature |
| State transitions | Geofence-driven (NEAR_PICKUP, NEAR_DROPOFF) |
| Persistence | Local Room DB for history; server is source of truth for live state |
| Auto-accept | Feature available for high-volume couriers |
| Multi-stop | Trip planner built in for stacked orders |

### Key Classes

| Class | File | Role |
|-------|------|------|
| `DeliveryInformation$DeliveryStatus` | `com/roadrunner/delivery/repository/api/` | Order state enum |
| `StateV3$AcceptData` | `com/roadrunner/delivery/state/` | Order offer UI data |
| `cQZ` | `o/cQZ.java` | Retrofit — state endpoint |
| `InterfaceC5430cVb` | `o/InterfaceC5430cVb.java` | Retrofit — delivery list |
| `InterfaceC8243dla` | `o/InterfaceC8243dla.java` | Retrofit — tasks + transfer + deeplink |
| `cMX` | `o/cMX.java` | Retrofit — auto-accept |
| `eDJ` | `o/eDJ.java` | Retrofit — recent deliveries dashboard |
| `InterfaceC10983exy` | `o/InterfaceC10983exy.java` | Retrofit — order history |
| `HistoryDatabase` | `com/roadrunner/order/history/data/database/` | Local Room DB |
| `LasagnaDeclineBottomSheet` | `com/roadrunner/delivery/` | Rejection UI with acceptance rate |

---

## Realtime Module

### Transport: Socket.IO + FCM (Dual Layer)

```
Primary:   Socket.IO v3 over WebSocket (wss://)
           └─ HTTP long-polling fallback built in
Secondary: FCM/HMS push (background wakeup when Socket.IO is disconnected)
```

### Connection

**Endpoint:** `{realtime_connection_url}/rider-app`
- URL fetched at runtime from Firebase Remote Config key `realtime_connection_url` — not hardcoded
- Socket.IO path: `/socket.io/`
- Enabled/disabled by flag `REALTIME_CONNECTION_ENABLED`

**Auth:**
```
Authorization: Bearer {accessToken}   ← injected at connection time (o/eCY.java:90-93)
```

**Socket.IO options:**
```
transport:    ["websocket"]   ← prefers WS over long-polling
forceNew:     false
autoConnect:  true
reconnection: true            ← managed by eCW / C13759gVt
```

### Message Format

JSON over Socket.IO. Primary event: **`server:delivery_updated`**

```json
{
  "metadata": {
    "eventType": "delivery_updated",
    "timestamp": "2024-01-01T12:00:00Z",
    "source": "dispatcher",
    "version": "1.0"
  },
  "payload": {
    "orderCode": "ABC123",
    "deliveryId": 12345
  },
  "version": "1.0"
}
```

Models: `o/eCK.java` (full message), `o/eCO.java` (metadata), `o/eCM.java` (payload)

### Connection Lifecycle

```
Login complete
  → fetch realtime_connection_url from Remote Config
  → Socket.IO connect to {url}/rider-app with Bearer token
  → register handlers: connect / disconnect / connect_error / server:delivery_updated

server:delivery_updated received
  → parse JSONObject → eCR
  → emit to Kotlin Flow → delivery state manager
  → UI shows order offer screen
```

**Connection states:** `IDLE` → `CONNECTING` → `CONNECTED` → `DISCONNECTED`

### Reconnection — Exponential Backoff (`o/C13759gVt.java`)

```
attempt 1 → wait  1s → reconnect
attempt 2 → wait  2s → reconnect
attempt 3 → wait  4s → reconnect
attempt 4 → wait  8s → reconnect
attempt 5 → wait 16s → reconnect
attempt 6 → wait 32s → final attempt, then stop
```

If **offline:** polls `ConnectivityManager.getActiveNetwork()` every **2 seconds**, reconnects immediately when network returns.

Token refresh: `eCY.RemoteActionCompatParcelizer(newToken, forceNew=true)` — reconnects with fresh Bearer token. Controlled by flag `REALTIME_CONNECTION_RECONNECT_TOKEN_EXPIRATION_ANDROID_ENABLED`.

### Full Delivery Offer Flow (End-to-End)

```
Backend dispatcher
  → Socket.IO emit("server:delivery_updated", { orderCode, deliveryId })
  → eCY.java:244 — JSONObject received, logged, parsed
  → ecy.read.write(eCR) — emitted to Kotlin Flow
  → C11865fbR — delivery state handler
  → UI: order offer screen shown

[If Socket.IO disconnected]
  → Backend sends FCM high-priority push
  → ServiceC3036bGt.onMessageReceived()
  → Deduplicated (last 10 message IDs in memory)
  → C5569caF — intent handler → delivery state fetch
```

### FCM Push Handler (`o/ServiceC3036bGt.java`)

- `onNewToken()` → `RegisterPushTokenWorker` → `POST /api/delivery-flow/v1/courier/device_token`
- `onMessageReceived()` → dedup check → delegates to `C5569caF`
- Deduplication: last **10** message IDs kept in memory

### Session Config (`com/roadrunner/sessionconfig/`)

- `SessionConfigResponse` — realtime session parameters
- `FreshChatConfigResponse` — Freshchat in-app support config
- `SendBirdConfigResponse` — SendBird chat SDK config
- All cached in local `SessionConfigDatabase`

### Key Classes

| Class | File | Role |
|-------|------|------|
| `eCY` | `o/eCY.java` | Socket.IO orchestrator — connection + all handlers |
| `eCW` | `o/eCW.java` | Reconnection manager |
| `C13759gVt` | `o/C13759gVt.java` | Exponential backoff algorithm |
| `eCT` | `o/eCT.java` | Reconnect configuration |
| `eCK` / `eCO` / `eCM` | `o/eCK.java` etc. | Message models |
| `gHR` | `o/gHR.java` | Socket.IO message handler |
| `AbstractC13382gHu` | `o/AbstractC13382gHu.java` | Socket.IO client factory |
| `ServiceC3036bGt` | `o/ServiceC3036bGt.java` | FCM messaging service |
| `C5569caF` | `o/C5569caF.java` | Push message processor |
| `RegisterPushTokenWorker` | `com/roadrunner/push/` | Registers FCM token on login/refresh |
| `SendPushReceiptWorker` | `com/roadrunner/push/` | Sends read receipts for analytics |

---

## Wallet / Cashout

### API Endpoints

```
# Wallet balance
GET  /api/wallet-integration/v2/wallets/{user_id}                                    ← balance + providers
GET  /api/wallet-integration/v3/wallet                                               ← component-based UI data
GET  /api/wallet-integration/v1/wallet/transactions                                  ← transaction history
GET  /api/wallet-integration/v1/wallet/pending-transactions                          ← unsettled transactions
GET  /api/wallet-integration/v1/wallets/{user_id}/payments/transactions              ← payment-specific history
GET  /api/wallet-integration/v1/wallets/{user_id}/vouchers                           ← vouchers

# Provider registration & withdrawal
GET  /api/wallet-integration/v2/wallet/provider-list?flow=topup                      ← available providers
GET  /api/wallet-integration/v1/wallets/registration/{provider_id}                   ← provider requirements
POST /api/wallet-integration/v1/wallets/registration/{provider_id}                   ← submit account details
POST /api/wallet-integration/v1/wallets/withdraw_info/{provider_id}                  ← limits, fees, timing
POST /api/wallet-integration/v2/integrations/wallet/{provider_id}/initiate_payment   ← trigger withdrawal

# Seven-Eleven cash pickup
POST /api/wallet-integration/v1/integrations/seven-eleven/regenerate-qr-code/{user_id}

# Opportunities & bonuses
GET  /api/start-working-api/v1/work_opportunities                                    ← shifts, quests, challenges
GET  /api/start-working-api/v1/bonus_multipliers?zone_id={id}&selected_date={date}   ← dynamic multipliers
```

### Wallet Balance Model (`o/C12541foE.java`)

```json
{
  "type": "string",
  "balance": long,              ← available (smallest currency unit)
  "withdrawBalance": long,      ← eligible for withdrawal
  "payout": long,               ← currently being paid out
  "transactionFee": long,
  "paymentDirection": "INCOMING|OUTGOING",
  "providers": [ { "id", "name", "logo", "flows", "hideWalletBalance", "registrationEnabled" } ],
  "discrepancies": [ { "confirmationNumber", "originalAmount", "actualAmount", "justification", "createdAt", "vendorName" } ],
  "lastClearance": { ... },
  "journal": [ ... ],
  "history": [ ... ]
}
```

### Cashout / Withdrawal Flow

```
1. GET  /api/wallet-integration/v2/wallet/provider-list?flow=topup
         → pick provider (Seven-Eleven, bank transfer, digital wallet)
2. GET  /api/wallet-integration/v1/wallets/registration/{provider_id}
         → fetch required fields (IBAN, account number, etc.)
3. POST /api/wallet-integration/v1/wallets/registration/{provider_id}
         → submit account details
4. POST /api/wallet-integration/v1/wallets/withdraw_info/{provider_id}
         → get min/max amount, fees, processing time
5. POST /api/wallet-integration/v2/integrations/wallet/{provider_id}/initiate_payment
         → trigger payout → status: PENDING → PROCESSING → COMPLETE | FAILED
```

### Earnings Breakdown

Wallet UI built from server-driven components (`com/roadrunner/wallet/redesign/data/model/`):

| Component | Description |
|-----------|-------------|
| `CurrentBalanceComponent` | Available now |
| `QueuedBalanceComponent` | Pending / not yet settled |
| `EarningsComponent` | Total earnings |
| `RecentTransactionsComponent` | Recent activity |
| `CashOutPayOutButtonComponent` | Withdrawal CTA |
| `TopUpButtonComponent` | Top-up CTA |
| `WalletWarningMessageComponent` | Alerts (low balance, discrepancy) |

**Earnings sources:** base delivery pay, tips, surge multipliers, boosts, bonuses, quest rewards.

### Cash-on-Delivery (COD) Reconciliation

Tracked in local Room DB (`o/C6906czc.java`):

```sql
wallet table:
  cashoutAmount INTEGER   ← COD collected from customer
  balance INTEGER         ← running balance
  payout INTEGER          ← already settled
  status INTEGER          ← PENDING | PROCESSING | COMPLETE | FAILED
  paymentDirection        ← IN / OUT
```

When collected cash ≠ expected: a **discrepancy record** is created with `originalAmount`, `actualAmount`, and `justification` — reviewed server-side for reconciliation.

### Opportunities & Bonus Multipliers

**`GET /api/start-working-api/v1/work_opportunities`** response:
```json
{
  "opportunities": [ { "id", "type": "SHIFT|QUEST|CHALLENGE", "startingPoint", "description", "zoneId", "url" } ],
  "zones": [ ... ],
  "activeArea": { ... },
  "startNow": [ ... ]
}
```

**`GET /api/start-working-api/v1/bonus_multipliers`** response:
```json
{ "multipliers": [ { "timeWindow", "value": 1.5, "zoneCoverage", "currency" } ] }
```

Quest progress embedded in rider status response (`questInfo` in `o/C9446eQb`).

### Payment Providers

| Provider | Method | Notes |
|----------|--------|-------|
| Seven-Eleven | QR code cash pickup | Japan/PH markets |
| Bank transfer | Account / IBAN | 1-3 business day processing |
| Digital wallets | Instant | Stripe / Adyen / PayU implied |
| Local gateways | Region-specific | Via generic provider registration |

### Full Earnings Lifecycle

```
Complete deliveries
  → POST /api/delivery-flow/v1/deliveries/earnings (deliveryIds)
  → earnings = base + boost + multiplier + quest rewards

Earnings settle → wallet updated
  → GET /api/wallet-integration/v2/wallets/{user_id}

Request payout
  → provider registration → withdraw_info → initiate_payment

Track status
  → GET /api/wallet-integration/v1/wallet/transactions
```

### Key Classes

| Class | File | Role |
|-------|------|------|
| `InterfaceC12582fou` | `o/InterfaceC12582fou.java` | Retrofit — wallet balance |
| `InterfaceC12594fpF` | `o/InterfaceC12594fpF.java` | Retrofit — transactions |
| `InterfaceC6343cow` | `o/InterfaceC6343cow.java` | Retrofit — provider registration + withdrawal |
| `InterfaceC12775fsb` | `o/InterfaceC12775fsb.java` | Retrofit — top-up + provider list |
| `InterfaceC10909ewd` | `o/InterfaceC10909ewd.java` | Retrofit — opportunities + multipliers |
| `C12541foE` | `o/C12541foE.java` | Wallet balance model |
| `C12690fqw` | `o/C12690fqw.java` | Wallet transactions response |
| `C12537foA` | `o/C12537foA.java` | Discrepancy record model |
| `C10849evW` | `o/C10849evW.java` | Opportunities response |
| `C10856evd` | `o/C10856evd.java` | Bonus multiplier response |
| `C6906czc` | `o/C6906czc.java` | Local wallet Room DB schema |

---

## Mapbox Integration

### SDKs Bundled (15 modules)
`maps`, `navigation`, `navigator`, `search`, `api`, `common`, `geojson`, `core`, `android`, `turf`, `base`, `bindgen`, `annotation`, `auto`, `module`

### Key Architectural Finding: Mapbox ≠ Router

Routing calculation is **not** done via Mapbox Directions API. Glovo uses its own backend with **Naver** (Korean mapping provider):

```
PUT /api/delivery-flow/v1/route-preview   ← Glovo backend (Naver-formatted response)
        ↓
MapboxRouteLineApi                        ← visualization only
        ↓
Map display (turn-by-turn, route line)
```

Mapbox is used for: **map tiles, navigation UI, turn-by-turn display, annotations, search, telemetry.**

### Access Token

Stored encrypted in `resources/res/values/strings.xml`:
```xml
<string name="MAPBOX_PUBLIC_KEY_BITRISE">/.\'!gISvjYunqamNm5OXk7WJ...</string>
<string name="MAPBOX_PUBLIC_KEY_LOCAL">/.\'!</string>
```

Decrypted at runtime (`com/mapbox/common/AccessTokenInitializer.java`):
```
1. Read string resource "mapbox_access_token"
2. If starts with "/.'!" → Base64 decode + XOR with key -63
3. Validate decrypted token
4. Cache in SharedPreferences "mapbox_initialization_settings"
```

### Map Initialization

**`com/roadrunner/map/container/enabled/presentation/MapboxFragment.java`**

Plugins loaded:
- `LocationComponentPluginImpl` — rider location dot
- `AnnotationPluginImpl` — pickup/dropoff markers
- `CameraAnimationsPlugin` — smooth camera movement
- `CompassViewPlugin`, `ScaleBarUtils`, `AttributionPluginImpl`, `GesturesPlugin`

Style loaded via `getStyleDeprecated()` — default Mapbox streets style; no custom Glovo Studio URL found.

### Navigation & Route Line

**Route options** (`com/mapbox/api/directions/v5/models/RouteOptions.java`):
```
baseUrl:             https://api.mapbox.com
geometries:          polyline6
dataset:             mapbox/driving-traffic
annotations:         speed, duration, distance
alternatives:        true
bannerInstructions:  true
computeTollCost:     true
```

**Turn-by-turn:** `MapboxManeuverApi.getManeuvers(RouteProgress)` — tracks current leg, step, distance remaining.

**Route line traffic coloring** (`MapboxRouteLineApi` + `MapboxRouteLineView`):

| Speed | Color |
|-------|-------|
| ≥ 50 mph | Green (free-flow) |
| 25–50 mph | Yellow (moderate) |
| 10–25 mph | Orange (congested) |
| < 10 mph | Red (severe) |

Vanishing route line effect via `VanishingRouteLineExpressions` — shows consumed portion as rider moves. Updates batched via `CoalescingBlockingQueue` to prevent UI lag.

### Markers & Annotations

| Manager | Purpose |
|---------|---------|
| `PointAnnotationManager` | Pickup / dropoff pins |
| `PolylineAnnotationManager` | Route line |
| `CircleAnnotationManager` | Zone radius overlays |

Point annotations use `Bitmap` icons referenced via `icon-image` JSON property. Cluster support for dense areas.

### Search SDK

- Address autocomplete + place search via `api.mapbox.com`
- `HistoryDataProviderImpl` — persistent local search history
- `LocalDataProviderImpl` — offline place data
- `IndexableDataProvidersRegistry` — multi-provider search coordination

### Tile Configuration

```
host:               api.mapbox.com (configurable via TileEndpointConfiguration)
dataset:            mapbox/driving-traffic
geometry format:    polyline6
offline support:    OfflineSwitch monitors connectivity state
stale threshold:    56 days before forcing server tile refresh
```

### Mapbox Telemetry

Reports to (QUIC/HTTP3 + Brotli enabled):
```
https://api.mapbox.com/sdk-sessions/v1
https://events.mapbox.com
https://config.mapbox.com
```

Custom events via `postTelemetryCustomEvent()`, user feedback via `postUserFeedback()`.

### Full Data Flow

```
Glovo backend → PUT /api/delivery-flow/v1/route-preview (Naver routing)
    ↓
Route data → MapboxRouteLineApi (draw polyline + traffic colors)
    ↓
MapboxManeuverApi (turn-by-turn instruction banners)
    ↓
User sees: map + route line + maneuver UI

User GPS → LocationComponentPlugin → rider dot on map
Pickup/dropoff coords → PointAnnotationManager → pin markers
```

### Key Classes

| Class | File | Role |
|-------|------|------|
| `MapboxFragment` | `com/roadrunner/map/container/enabled/presentation/MapboxFragment.java` | Main map UI fragment |
| `AccessTokenInitializer` | `com/mapbox/common/AccessTokenInitializer.java` | Token decryption + init |
| `RouteOptions` | `com/mapbox/api/directions/v5/models/RouteOptions.java` | Routing configuration |
| `MapboxManeuverApi` | `com/mapbox/navigation/tripdata/maneuver/api/MapboxManeuverApi.java` | Turn-by-turn instructions |
| `MapboxRouteLineApi` | `com/mapbox/navigation/ui/maps/route/line/api/MapboxRouteLineApi.java` | Route line data |
| `MapboxRouteLineView` | `com/mapbox/navigation/ui/maps/route/line/api/MapboxRouteLineView.java` | Route line rendering |
| `PointAnnotation` | `com/mapbox/maps/plugin/annotation/generated/PointAnnotation.java` | Pin marker model |
| `TileEndpointConfiguration` | `com/mapbox/navigator/TileEndpointConfiguration.java` | Tile server config |
| `InterfaceC7806ddN` | `o/InterfaceC7806ddN.java` | Retrofit — route-preview endpoint |
| `MapboxSearchSdk` | `com/mapbox/search/MapboxSearchSdk.java` | Search initialization |

---

# Security Analysis

---

## 1. Authentication & Session Management

---

### [CRITICAL] No certificate pinning for Glovo's own API

- **Component:** OkHttp / network layer
- **Problem:** No `CertificatePinner`, custom `X509TrustManager`, or `network_security_config.xml` pinning configuration was found for Glovo's own domains (`/api/iam-login/`, `/api/delivery-flow/`, `/api/wallet-integration/`). Notably, Incognia implements its own pinning (cert hashes embedded in request body), but Glovo's primary API does not.
- **Attack vector:** A user connected to Wi-Fi with an installed CA certificate (corporate network, compromised router) exposes full traffic in plaintext: access_token, refresh_token, GPS coordinates, order data, payment details. Burp Suite / mitmproxy works out of the box with no extra effort.
- **Severity:** CRITICAL
- **Recommendation:** Implement OkHttp `CertificatePinner` with SHA-256 pins for all Glovo production domains, plus backup pins for rotation. Add `network_security_config.xml` with an explicit `<pin-set>`.

---

### [HIGH] SMS-based 2FA — vulnerable to SIM swap and SS7 attacks

- **Component:** `com/roadrunner/twofa/`, `POST /api/iam-login/v2/auth/2fa/trigger`
- **Problem:** The primary second factor is an SMS code. SIM swap (social engineering the mobile operator) or SS7 interception allows an attacker to receive the code without physical access to the victim's phone.
- **Attack vector:** Attacker knows courier's email (data breach) → initiates login → intercepts SMS code → full account access including wallet and earnings.
- **Severity:** HIGH
- **Recommendation:** Add TOTP (RFC 6238) as an SMS alternative. Enforce rate limiting on the trigger endpoint (per-IP and per-account). Alert users when 2FA is triggered from a new device.

---

### [HIGH] Access token not bound to device hardware

- **Component:** Token storage, `com/roadrunner/auth/`
- **Problem:** Access and refresh tokens are stored in encrypted SharedPreferences but are not bound to a specific device (no hardware attestation, no device fingerprint in the token claim). A stolen token from a rooted device can be used on any other device.
- **Attack vector:** Malicious app with root access reads encrypted SharedPreferences (the encryption key is in Keystore, but Keystore can be compromised on a rooted device) → token used on attacker's device with no detection.
- **Severity:** HIGH
- **Recommendation:** Bind tokens to the Android device via Keystore attestation. Verify the binding server-side on every request.

---

### [MEDIUM] Magic link — no visible client-side TTL enforcement

- **Component:** `POST /api/iam-login/v2/auth/magic_link/generate`
- **Problem:** The client sends the request but does not display the link's expiry time to the user and does not appear to invalidate previous links when a new one is requested (server behavior is not verifiable from the client code).
- **Attack vector:** Phishing page captures magic link from email — if the link is long-lived, the attack window is large.
- **Severity:** MEDIUM
- **Recommendation:** Guarantee TTL ≤ 15 minutes, one-time use only, invalidation on re-request. Display expiry time to the user.

---

### [MEDIUM] Biometrics — fallback to device PIN without additional verification

- **Component:** `BiometricsActivity`, `com/roadrunner/biometrics/`
- **Problem:** Android Biometric API allows fallback to device PIN/password, which may be weak (1234, 0000). The app has no control over the device PIN strength.
- **Attack vector:** Attacker with physical device access uses a weak device PIN to bypass biometrics.
- **Severity:** MEDIUM
- **Recommendation:** Use `BiometricPrompt` with `setNegativeButtonText` instead of device credential fallback. Or require re-authentication via `/api/iam-login/v2/auth` on every biometric unlock.

---

## 2. Root / Tamper Detection

---

### [HIGH] All detections bypassed via Magisk DenyList + LSPosed

- **Component:** `o/C6082cjy`, `o/AbstractC4428brQ`, `o/C6081cjx`, `RootBeerNative`
- **Problem:** All 17 Java-layer checks (file paths, Build.TAGS, `which su`, `getprop`, `mount`, package scanning) are trivially bypassed by Magisk DenyList and MagiskHide. LSPosed/Xposed can hook each of these methods and return a clean result. The native `libfoo.so` check is the only meaningful barrier, but it is also bypassable via Frida + Unicorn emulation.
- **Attack vector:** Attacker runs modified client on rooted device with Magisk DenyList → all checks return false → backend receives a "clean" DeviceData → no blocking action taken.
- **Severity:** HIGH
- **Recommendation:** Move critical checks entirely into native code (C/C++ via NDK). Integrate Play Integrity API — hardware-backed attestation that cannot be bypassed at the application level. Include the integrity verdict in every login request.

---

### [HIGH] Frida detected only on default port 27042

- **Component:** `com/incognia/internal/Llm.java`
- **Problem:** `new ServerSocket(27042)` — Frida can be launched on a custom port with a single flag: `frida-server -l 0.0.0.0:12345`. The detection becomes immediately ineffective.
- **Attack vector:** `frida-server --listen 0.0.0.0:9999` → port 27042 is free → `Llm.Y()` returns "clean" → attacker can hook any method freely.
- **Severity:** HIGH
- **Recommendation:** Supplement with: scanning `/proc/net/tcp` for LISTEN sockets with Frida signatures; checking `/proc/self/maps` for `frida-agent`; inspecting thread names via `/proc/self/task/*/comm`; integrity-checking own binary code via hashing.

---

### [MEDIUM] Detection runs only once at startup

- **Component:** `o/C6082cjy.write()` — called once
- **Problem:** If the device is clean at startup but root/Frida is attached later (e.g., via ADB after launch), no re-detection occurs.
- **Attack vector:** Launch app on a clean device → attach Frida → perform fraudulent actions (order manipulation, wallet tampering) without triggering detection.
- **Severity:** MEDIUM
- **Recommendation:** Repeat detection periodically (every N minutes of activity) or before critical operations (order accept, cashout).

---

### [MEDIUM] Silent enforcement gives attacker an iteration loop

- **Component:** Enforcement pipeline (`o/C4426brO`, Firebase, Incognia)
- **Problem:** The app does not notify the user or attacker of a detection event. The attacker can iteratively refine their bypass by observing backend behavior changes (order availability, feature blocking). No error noise = a comfortable environment for reversing the defenses.
- **Attack vector:** Methodical enumeration: enable Magisk → check if orders arrive → disable → compare. Without explicit error feedback, the iterative bypass process is straightforward.
- **Severity:** MEDIUM
- **Recommendation:** Consider "canary" responses (deliberately delayed or slightly modified responses for flagged devices) instead of silence — makes it harder to understand what specifically triggers the defense.

---

## 3. Device Token

---

### [CRITICAL] FCM token as device identity — not hardware-bound

- **Component:** `o/eCI.java`, `o/dEI.java`, `POST /api/delivery-flow/v1/courier/compare_device_token`
- **Problem:** The "device fingerprint" is a FCM push token. A FCM token can be: (1) extracted from a device, (2) replayed on another device, (3) cloned. The token is not cryptographically signed and is not bound to hardware identifiers on the client side. `compare_device_token` only compares two strings.
- **Attack vector:** Attacker extracts FCM token from a legitimate courier's device (via malicious app with `READ_LOGS`, ADB backup, or Firebase project compromise) → registers it on their own device → `compare_device_token` returns `true` → backend considers the device "known".
- **Severity:** CRITICAL
- **Recommendation:** Replace or supplement the FCM token with a cryptographic hardware binding: Android Keystore attestation (key generated inside the secure element, never exported). Sign a server challenge with the Keystore private key — possession of the key proves device ownership.

---

### [HIGH] `compare_device_token` returns only a boolean

- **Component:** `o/eCE.java` — `{ device_token_status: true|false }`
- **Problem:** On mismatch (`false`), the client receives no explanation and takes no visible action. Based on the code, the decision is made server-side only, while the client continues to operate normally.
- **Attack vector:** A compromised device continues processing orders while the backend "considers" a blocking action.
- **Severity:** HIGH
- **Recommendation:** A `false` response should immediately trigger client-side logout and notify the user about a login from a new device.

---

## 4. Incognia Fingerprinting

---

### [MEDIUM] Full installed app list sent to a third party

- **Component:** `com/incognia/internal/rc.java`
- **Problem:** `getInstalledPackages()` returns the complete list of all installed apps, including banking, medical, VPN, and political apps. This is transmitted to Incognia's servers (a third party). The user is not explicitly informed. In several jurisdictions (GDPR, CCPA, app store policies), this requires explicit consent.
- **Attack vector:** Incognia database breach exposes detailed user profiles (political views, health conditions, financial habits) derived from app inventory.
- **Severity:** MEDIUM
- **Recommendation:** Limit transmission to security-relevant packages only (root tools, hooking frameworks). Do not send the full app list to external servers. Add explicit user consent and disclosure.

---

### [LOW] Incognia endpoint URL is obfuscated, not encrypted

- **Component:** `com/incognia/internal/Kh.java`, `OJe.java`
- **Problem:** The URL is obfuscated, but the decryption algorithm (`OJe.Y(byte[])`) is present in the decompiled code. A Frida hook on `OJe.Y` trivially extracts the URL at runtime. This is security through obscurity.
- **Attack vector:** Discovering the endpoint → direct interaction with Incognia API to study the fingerprint data format.
- **Severity:** LOW
- **Recommendation:** Obfuscating the endpoint is not the primary protection mechanism. Rely on the cryptographic payload security (AES+RSA+HMAC), which is implemented correctly.

---

## 5. Location Tracking

---

### [HIGH] GPS data sent to two independent third parties

- **Component:** Sentiance SDK (`https://api.sentiance.com/`), Incognia (passive 5-min updates)
- **Problem:** Precise GPS coordinates of couriers (including home address — where shifts start/end) are transmitted to Sentiance and Incognia without explicit separate notification to the user. Sentiance additionally builds `DrivingInsightsFeature` and `UserContextFeature` — a behavioral profile extending well beyond Glovo's delivery tasks.
- **Attack vector:** Breach of Sentiance or Incognia exposes full movement history of all couriers, including home addresses. Deanonymization via movement pattern analysis is possible.
- **Severity:** HIGH
- **Recommendation:** Limit Sentiance/Incognia data transmission strictly to active shift periods. Do not transmit GPS outside of working hours. Add explicit disclosure in privacy policy listing all sub-processors.

---

### [MEDIUM] Foreground service with auto-restart — tracking cannot be stopped by user

- **Component:** `o/ServiceC14301giC` (Sentiance, 500ms exponential backoff restart)
- **Problem:** The service restarts automatically on any termination. The user cannot stop tracking without uninstalling the app. This violates the principle of data minimization and the data subject's right to object to processing.
- **Attack vector:** GDPR/CCPA compliance risk. In several jurisdictions, users have the right to stop data processing without losing access to the service.
- **Severity:** MEDIUM
- **Recommendation:** Add user control over background tracking. Stop the service outside of active shifts.

---

## 6. Delivery Flow

---

### [HIGH] Order transfer endpoint — potential order hijacking

- **Component:** `PUT /api/delivery-flow/v1/deliveries/{delivery_id}/change/transfer`
- **Problem:** The endpoint transfers an order to another courier. From the client-side code, it is unclear whether the server verifies that the transfer initiator is the current order owner AND that the target courier is valid. If authorization is weak, order hijacking is possible.
- **Attack vector:** Compromised account or MITM intercepts `delivery_id` and sends a transfer to a controlled account → order (and earnings) go to the attacker.
- **Severity:** HIGH
- **Recommendation:** Strict server-side ownership check before any transfer. Require confirmation from the recipient. Audit log for all transfer operations.

---

### [MEDIUM] PIN verification — unknown hashing algorithm

- **Component:** `PinScreenFragment`, `POST /api/delivery-flow/v1/deliveries/{delivery_id}/tasks`
- **Problem:** From the analysis, the PIN is "hashed locally before submission," but the algorithm was not identified. If it is MD5 or SHA-1 without a salt, brute-forcing a 4-digit PIN is trivial (10,000 combinations).
- **Attack vector:** Intercepted task request (via MITM or account compromise) → offline brute-force of PIN hash in seconds.
- **Severity:** MEDIUM
- **Recommendation:** Use HMAC-SHA256 with a server-generated nonce (challenge-response). Never store or transmit the PIN or a weak hash of it.

---

### [MEDIUM] Auto-accept — no additional authentication required

- **Component:** `GET /api/delivery-flow/v1/deliveries/auto-accept`, `o/cMX.java`
- **Problem:** Auto-accept mode is activated with a single GET request. On account compromise, the attacker enables auto-accept → the courier receives orders they did not choose.
- **Attack vector:** Account takeover → enable auto-accept → courier is loaded with orders in inconvenient locations, or attacker physically intercepts orders.
- **Severity:** MEDIUM
- **Recommendation:** Require re-authentication (biometric or password) to enable auto-accept. Send a push notification to the user when the mode is activated.

---

### [MEDIUM] Proxy phone — `callee` parameter may not be validated

- **Component:** `POST /api/delivery-flow/v1/deliveries/{delivery_id}/proxy-phone`
- **Problem:** The endpoint accepts a `callee` parameter (phone number to call). If server-side validation is weak, it may be possible to initiate a call to an arbitrary number through Glovo's proxy infrastructure.
- **Attack vector:** Manipulated `callee` → initiation of expensive international calls at Glovo's expense, or using the proxy to conceal the attacker's real number.
- **Severity:** MEDIUM
- **Recommendation:** Strictly validate `callee` server-side — accept only the registered customer number for the given `delivery_id`.

---

### [LOW] No idempotency key on order accept

- **Component:** Delivery state machine
- **Problem:** No explicit client-side protection against duplicate accept requests. On a slow connection, two identical requests may be sent.
- **Attack vector:** Race condition → duplicate accept (though idempotency should be enforced server-side).
- **Severity:** LOW
- **Recommendation:** Add an idempotency key to the accept request. Disable the accept button after first tap until a server response is received.

---

## 7. Realtime (Socket.IO)

---

### [HIGH] Socket.IO URL sourced from Firebase Remote Config — substitution possible

- **Component:** `o/eCY.java`, Firebase Remote Config (`realtime_connection_url`)
- **Problem:** If Firebase Remote Config is compromised (vulnerability in the Firebase project, leaked service account key), an attacker can change `realtime_connection_url` → the app connects to a malicious Socket.IO server → fake `server:delivery_updated` events with arbitrary `orderCode` and `deliveryId`.
- **Attack vector:** Compromised Firebase project → Remote Config modification → all couriers connect to malicious socket server → fake orders, fake cancellations, DoS.
- **Severity:** HIGH
- **Recommendation:** Hardcode or cryptographically sign the list of allowable Socket.IO hosts. Apply certificate pinning to the Socket.IO server. Do not trust Remote Config for security-critical URLs without additional verification.

---

### [MEDIUM] FCM deduplication — only last 10 messages in memory

- **Component:** `o/ServiceC3036bGt.java`, `o/C5569caF.java`
- **Problem:** Deduplication of push messages is maintained for the last 10 message IDs in memory only. A replay attack with a delay (sending an old message after 11+ new ones) will pass deduplication.
- **Attack vector:** Attacker captures a cancellation FCM message, waits for 11 new messages to arrive, replays it → client reprocesses the cancellation (potential double-processing).
- **Severity:** MEDIUM
- **Recommendation:** Deduplicate by timestamp + message ID (reject messages older than N seconds). Store the dedup window in persistent storage (Room DB), not only in memory.

---

### [LOW] Bearer token transmitted in Socket.IO handshake

- **Component:** `o/eCY.java:90-93`
- **Problem:** The access token is sent in the HTTP header during the WebSocket upgrade. In some Socket.IO implementations, the token may appear in the URL query string and get logged on servers, proxies, or CDNs.
- **Severity:** LOW
- **Recommendation:** Ensure the token is always in the HTTP header, never in the URL. Consider rotating the Socket.IO auth token on each reconnect (separate from the main access token).

---

## 8. Wallet / Cashout

---

### [HIGH] Wallet data stored in unencrypted local Room DB

- **Component:** `o/C6906czc.java`, local Room DB
- **Problem:** The `wallet` table contains `cashoutAmount`, `balance`, `payout`, `providers`, and `history` in an unencrypted SQLite file. On a rooted device, the file is directly readable: `adb shell su -c "cat /data/data/com.logistics.rider.glovo/databases/wallet.db"`.
- **Attack vector:** Malicious app with root access or physical device access → reads financial data, transaction history, wallet balance.
- **Severity:** HIGH
- **Recommendation:** Use SQLCipher to encrypt the Room database. Store the key in the Android Keystore (hardware-backed).

---

### [MEDIUM] Discrepancy system — potential COD amount manipulation

- **Component:** Wallet discrepancy records, `o/C12537foA.java`
- **Problem:** When collected cash does not match the expected amount, a discrepancy record is created with a free-text `justification` field. If server-side validation is weak, a courier could systematically report lower `actualAmount` values with arbitrary justifications.
- **Attack vector:** Fraudulent courier systematically reports smaller COD amounts → financial losses for Glovo/vendors.
- **Severity:** MEDIUM
- **Recommendation:** Automatic flagging of accounts with frequent discrepancies. Maximum allowable deviation threshold. Manual review for large amounts. Require photo/customer signature for COD as proof of amount received.

---

### [MEDIUM] Provider registration — bank details without client-side validation

- **Component:** `POST /api/wallet-integration/v1/wallets/registration/{provider_id}`
- **Problem:** Bank account details (IBAN, account number) are submitted to the server. If client-side validation is absent, an attacker via MITM or a modified client could substitute another user's registered payment details with their own.
- **Attack vector:** MITM during bank account registration → IBAN substituted → funds routed to attacker.
- **Severity:** MEDIUM
- **Recommendation:** Two-step confirmation of payment details (micro-deposit verification or SMS confirmation). Show the user masked details after saving for verification.

---

### [MEDIUM] Seven-Eleven QR regeneration — no visible client-side rate limiting

- **Component:** `POST /api/wallet-integration/v1/integrations/seven-eleven/regenerate-qr-code/{user_id}`
- **Problem:** The client can trigger QR regeneration without restrictions. If the server does not rate-limit this endpoint, a DoS attack on the cashout function is possible (each regeneration invalidates the previous QR).
- **Attack vector:** Automated script continuously regenerates QR codes → previous QR codes are invalidated → courier cannot withdraw funds.
- **Severity:** MEDIUM
- **Recommendation:** Server-side rate limiting: no more than 3–5 regenerations per hour per user.

---

## 9. Mapbox

---

### [HIGH] Mapbox access token protected by XOR with key -63 — trivially reversible

- **Component:** `resources/res/values/strings.xml`, `com/mapbox/common/AccessTokenInitializer.java`
- **Problem:** The token is "encrypted" with Base64 + XOR using the constant `-63`. This is not cryptography — it is obfuscation. Anyone who unpacks the APK and runs the decoding (10 lines of code) obtains a valid Mapbox public token (`pk.eyJ...`).
- **Attack vector:** Extracted token used for: (1) unlimited Mapbox Directions/Geocoding API requests billed to Glovo's account, (2) fingerprinting Glovo's Mapbox account configuration and map styles, (3) enumerating the Mapbox account's assets.
- **Severity:** HIGH
- **Recommendation:** Mapbox public tokens are inherently public but are restricted by URL allowlist on Mapbox's side. Configure a strict URL allowlist in the Mapbox dashboard (allow only Glovo's app package name). Rotate the token. Obfuscation here is unnecessary — proper allowlist configuration is what provides protection.

---

### [MEDIUM] Route calculation via Naver — third party sees all pickup/dropoff addresses

- **Component:** `PUT /api/delivery-flow/v1/route-preview`, Naver routing backend
- **Problem:** All pickup and dropoff addresses for routing pass through Naver (a Korean provider). Naver receives aggregated location data about all Glovo restaurants and customers.
- **Attack vector:** Naver API compromise or traffic analysis from their side exposes Glovo's operational geography (popular restaurants, customer density, working areas).
- **Severity:** MEDIUM
- **Recommendation:** Ensure a Data Processing Agreement (DPA) with Naver. Consider routing through Mapbox (already integrated) or an internal routing engine to eliminate an unnecessary sub-processor.

---

### [LOW] Mapbox telemetry sends data to events.mapbox.com

- **Component:** `com/mapbox/navigator/Telemetry.java`, `com/mapbox/common/module/MapboxHttpClient.java`
- **Problem:** The Mapbox SDK automatically sends telemetry (navigation events, position) to `events.mapbox.com`. Depending on SDK configuration, this may include GPS tracks during active navigation.
- **Severity:** LOW
- **Recommendation:** Explicitly disable Mapbox telemetry if not required. Verify that `MapboxTelemetry.setUserTelemetryRequestState(false)` is called at initialization.

---

## Summary Table

| Component | Issue | Severity |
|-----------|-------|----------|
| Network layer | No certificate pinning for Glovo API | CRITICAL |
| Device Token | FCM token not hardware-bound | CRITICAL |
| Root Detection | All Java checks bypassed by Magisk/LSPosed | HIGH |
| Frida Detection | Only port 27042 checked | HIGH |
| Auth | SMS 2FA — SIM swap vulnerability | HIGH |
| Auth | Token not bound to device | HIGH |
| Realtime | Socket.IO URL from Remote Config | HIGH |
| Wallet DB | Room DB is not encrypted | HIGH |
| Delivery | Order transfer without strong authz | HIGH |
| Location | GPS to Sentiance + Incognia outside shifts | HIGH |
| Mapbox | Token: XOR -63 (needs URL allowlist) | HIGH |
| Wallet | COD discrepancy manipulation | MEDIUM |
| Delivery | PIN hash — unknown algorithm | MEDIUM |
| Delivery | Auto-accept without re-auth | MEDIUM |
| Delivery | Proxy phone callee not validated | MEDIUM |
| Realtime | FCM dedup window = 10 messages | MEDIUM |
| Privacy | Full app list → Incognia | MEDIUM |
| Root Det. | Silent enforcement = feedback loop | MEDIUM |
| Mapbox | Naver sees all delivery addresses | MEDIUM |
| Auth | Magic link — no visible TTL | MEDIUM |
| Biometrics | Fallback to weak device PIN | MEDIUM |
| Foreground Svc | User cannot stop background tracking | MEDIUM |
| Socket.IO | Bearer token in WS handshake | LOW |
| Incognia | Endpoint URL obfuscated, not encrypted | LOW |
| Delivery | No idempotency key on accept | LOW |
| Mapbox | Telemetry to events.mapbox.com | LOW |

---

## Top 3 Priority Issues

### 🔴 #1 — No Certificate Pinning for Glovo's Own Backend [CRITICAL]

This is the single vulnerability that renders all other defenses meaningless. Any user on an untrusted network (corporate Wi-Fi, public hotspot, compromised router) loses all data — tokens, GPS, financial information — without any special tooling required. Notably, Incognia already implements pinning correctly; Glovo's own API does not.

**Fix:** OkHttp `CertificatePinner` with SHA-256 hashes for all production Glovo domains + `network_security_config.xml`.

---

### 🔴 #2 — FCM Token as Device Identity Without Hardware Binding [CRITICAL]

The entire `compare_device_token` mechanism — designed to prevent account cloning and emulator fraud — is defeated by copying a single string. Since wallet and earnings are tied to the account, this makes the entire client-side anti-fraud layer decorative.

**Fix:** Android Keystore attestation: key pair generated in secure element, server sends a challenge, client signs it — possession of the private key proves hardware identity.

---

### 🔴 #3 — Root Detection Entirely Bypassable at OS Level [HIGH]

The full defense chain (17 detection techniques, Incognia, Sentiance) is built on the assumption that the Android environment is trusted. Magisk + DenyList + LSPosed completely destroys this assumption. Without Play Integrity API (hardware attestation), any sufficiently motivated attacker operates in a fully transparent environment with all detections disabled.

**Fix:** Integrate `com.google.android.play.core.integrity.IntegrityManager`. Include the integrity verdict token in every login and critical transaction request. For Huawei: HMS App Signing.

---

## Network Security Configuration Analysis

**File:** `res/xml/network_security_config.xml`
**Referenced in:** `AndroidManifest.xml` via `android:networkSecurityConfig="@xml/network_security_config"`

### Config Content

```xml
<network-security-config>
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">usehurrier.com</domain>
        <domain includeSubdomains="true">deliveryhero.com</domain>
        <domain includeSubdomains="true">deliveryhero.net</domain>
    </domain-config>
</network-security-config>
```

### What It Does (and Doesn't Do)

| Directive | Present | Effect |
|-----------|---------|--------|
| `cleartextTrafficPermitted="false"` | Yes, for 3 domains | Blocks HTTP (non-TLS) to those domains only |
| `<pin-set>` | **No** | **No certificate pinning anywhere in the OS-level config** |
| `<trust-anchors>` | **No** | System CAs trusted by default — MitM trivial with a user CA |
| Global `<base-config>` | **No** | Cleartext is still permitted to all unlisted domains |

### Domain Coverage Gap

The config protects 3 secondary service domains:

| Domain | Used for |
|--------|----------|
| `*.usehurrier.com` | Help center (`helpcenter-{region}.usehurrier.com`), client configs |
| `*.deliveryhero.com` | Feature flags (`client-api.fwf.deliveryhero.net`), Perseus analytics |
| `*.deliveryhero.net` | Same feature flag CDN |

**What's missing:** Glovo's primary production API — handling auth, delivery state, wallet, location uploads — is **not listed at all**. Cleartext traffic to it is not restricted at the OS level, and no certificate pins are declared anywhere in the file.

### No `<pin-set>` — OS-Level Confirmation

The code-level finding (no `CertificatePinner` in OkHttp, no custom `TrustManager`) is confirmed at the manifest level. There is no location in the app where certificate pinning is enforced.

**Attack path:** Install Burp Suite CA on device → configure proxy → full plaintext visibility of all API traffic. No Frida, no patching, no root required.

For comparison: Incognia SDK **does** pin its own certificate inside the encrypted payload body — making it the only component in the app with functional certificate pinning.

### Bonus: Plaintext Secrets in `strings.xml`

Discovered while tracing the listed domains:

| Secret | Value |
|--------|-------|
| `google_api_key` | `AIzaSyC3GVFPoTRxD01Gh3qjtuTrKJboXiNCbx8` (plaintext) |
| `google_crash_reporting_api_key` | same key |
| Firebase DB URL | `https://logistics-54934.firebaseio.com` |
| Firebase App ID | `1:122155123106:android:f7f8137eb6a8ce3e03f2fb` |
| GCS bucket | `logistics-54934.appspot.com` |
| Git SHA | `10b449714f7c91c15d3ea269850da4dc4d6fc8aa` |
| Braze API key | XOR-63 encrypted (not plaintext) |
| Mapbox token | XOR-63 encrypted (not plaintext) |

The Google API key is hardcoded in plaintext — unlike Braze/Mapbox keys which at least use XOR-63 obfuscation. This key could be used to query Google Maps APIs, Firebase, or Crashlytics against Glovo's billing account.

**Severity:** MEDIUM — API key abuse (quota exhaustion, data exfiltration from Firebase if rules are permissive).
**Fix:** Move all API keys to build-time injection via `BuildConfig` or a secrets manager. Never commit to APK resources.

---

## Incognia Endpoint Decryption

### Cipher

All Incognia string constants are encrypted with **AES-128-CBC**. The key is assembled from large integer literals that are silently truncated to bytes at compile time — e.g. `(byte) 24717155` → `0x63` = `'c'`. The resolved key is:

```
Key:  c4K2cfXyjwp6rsde  (hex: 63344b32636658796a77703672736465)
```

Each encrypted value is stored as a lambda class (e.g. `Kh`, `Q4`, `TJL`) that calls `OJe.Y(byte[])`. The layout is:
- Bytes `[0..15]` → AES IV
- Bytes `[16..end]` → AES ciphertext (PKCS7 padding)

### Decrypted Constants

| Constant | Class | Plaintext |
|----------|-------|-----------|
| `iQa.Zd` — `Uri.parse(...)` | `Q4` | `content://com.google.android.gsf.gservices` |
| `iQa.E` — query selection arg | `HW` | `android_id` |
| `Wk.Y` — main POST endpoint | `Kh` | `https://service2.us.incognia.com/mobile/v4` |
| `tju.Enl` — config fetch URL | `TJL` | `https://service4.us.incognia.com/v6/configs` |
| `UgX.B8` — request header name | `By7` | `Accept` |
| `UgX.NOm` — request header name | `FcQ` | `Content-Type` |
| `UgX.pih` — header value (both) | `Wu` | `application/vnd.incognia.api.v3+octet-stream` |

### What Each Constant Does

**GSAID collection** — `iQa.U()` queries `content://com.google.android.gsf.gservices` with selection arg `android_id` to retrieve the Google Services Framework ID. The GSAID is a 64-bit persistent device identifier — more stable than Android SSAID and only cleared by factory reset. Incognia uses it as a hardware fingerprint anchor.

**Main telemetry endpoint** — `https://service2.us.incognia.com/mobile/v4` receives encrypted POST payloads with `Content-Type: application/vnd.incognia.api.v3+octet-stream`. This custom MIME type confirms the body is the AES-256-CBC + HMAC-SHA256 + RSA-encrypted signal blob described in the Incognia Fingerprinting section.

**Config polling** — `https://service4.us.incognia.com/v6/configs` is fetched by a separate client (`tju.java`). Returns server-side Incognia SDK configuration flags.

### Architecture Note

Two distinct hostnames (`service2` vs `service4`) with different API versions (`v4` vs `v6`) indicate Incognia uses microservice partitioning: signal ingestion on `service2`, configuration/feature-flag delivery on `service4`.

---

## Mapbox Token Decryption

### Algorithm

All strings prefixed with `/.'!` in resources use the same scheme:

1. Strip the `/.'!` prefix
2. Base64 decode
3. **Reverse** the byte array
4. XOR every byte with `0xC1` (−63 as signed byte)

From `AccessTokenInitializer.java`:
```java
static void RemoteActionCompatParcelizer() {
    write = (byte) -63;  // 0xC1
}

private static void a(String str, Object[] objArr) {
    byte[] decoded = Base64.decode(str, 0);
    byte[] result = new byte[decoded.length];
    for (int i = 0; i < decoded.length; i++) {
        result[i] = (byte) (decoded[(decoded.length - i) - 1] ^ write);
    }
    objArr[0] = new String(result, StandardCharsets.UTF_8);
}
```

### Decrypted Token

**Resource:** `MAPBOX_PUBLIC_KEY_BITRISE` in `res/values/strings.xml`
**Encrypted:** `/.'!gISvjYunqamNm5OXk7WJprmX8feVrO/4i6iProesorublaC7h5mis4u7o7uPhYyyl4mbua2ZmPPx85iorquIqYuCjaiUhqO3j5ag85eGo6iuq4jwi7ik76qx`

**Plaintext:**
```
pk.eyJ1IjoibGV2aWNvbGUiLCJhIjoiY202YXlxZHVsMDNzbzJrcXFzaTZzcmFoNiJ9.mT60VxgHtRVRZLhhfJLnEA
```

**JWT payload:**
```json
{
  "u": "levicole",
  "a": "cm6ayqdul03so2kqqsi6srah6"
}
```

| Field | Value | Meaning |
|-------|-------|---------|
| Token type | `pk` | Public token (read-only: map tiles, styles) |
| `u` | `levicole` | Mapbox account username that owns the token |
| `a` | `cm6ayqdul03so2kqqsi6srah6` | Token ID within that account |

### Security Implications

**`pk.*` tokens are read-only** — they can fetch map tiles and styles but cannot write data. Direct map data exfiltration is not possible with this token alone.

**Personal account, not a service account** — the username `levicole` is an individual developer's Mapbox account, not a corporate Glovo account. The token is tied to that person's billing quota. If the account is closed, renamed, or the token rotated without updating the app, all map rendering breaks for all users on that app version.

**The `/.'!` obfuscation provides no real protection** — the scheme is reversed in a single Python one-liner. Any analyst with access to the APK recovers the token in under a minute. It is security theatre, not meaningful obfuscation.

**Resource name reveals CI pipeline** — the `BITRISE` suffix shows this token was injected via Bitrise CI secrets. The runtime code looks up `mapbox_access_token` by resource identifier, suggesting a second token may exist in a split APK resource not present in this decompile.

**Severity:** LOW — `pk.*` tokens are inherently public by Mapbox design; their exposure is expected. The real risk is the personal account dependency and the false sense of security from the XOR scheme.

---

## Hardcoded Secrets Audit (`o/` Package + Resources)

### XOR-63 Encoded Strings — All Decrypted

All secrets in the app are stored in `res/values/strings.xml` with the `/.'!` prefix and decoded at runtime via the Mapbox XOR-63 scheme (Base64 → reverse → XOR 0xC1). No secrets are hardcoded directly as Java string literals in the `o/` package — the package contains the decoders and consumers, the values live in resources.

| Resource name | Decrypted value | Service |
|---|---|---|
| `MAPBOX_PUBLIC_KEY_BITRISE` | `pk.eyJ1IjoibGV2aWNvbGUi...` | Mapbox (see Mapbox section) |
| `adjust_app_token` | `ej3vecudasqo` | Adjust mobile attribution SDK |
| `com_braze_api_key` | `c9123712-c5b8-4512-b8a4-d498a004ca08` | Braze push/marketing (FCM) |
| `hms_com_braze_api_key` | `2a9504a4-f55d-4b48-85d8-0dc8f5853b48` | Braze push/marketing (Huawei HMS) |
| `com_braze_firebase_cloud_messaging_sender_id` | `122155123106` | Firebase sender ID (same as `google_app_id`) |
| `funWithFlagToken` | `a72fe3e9-dd5b-49ec-965d-946cc1851726` | FwF feature flags (`fwf.deliveryhero.net`) |
| `rider_scheduling_key` | `V97q1U9jTQBJ8Wu6` | WebView JS bridge HMAC key |
| `ANALYTICS_ATTRIBUTE_KEY` | `1210` | App build number (sent to analytics) |
| `ANALYTICS_ATTRIBUTE_VALUE` | `v4.2614.1` | App version string (sent to analytics) |

### Sentry DSN — Plaintext in AndroidManifest

```
https://ce4db9db3aeb1c3b926e343be5b6acf6@o516780.ingest.us.sentry.io/4506937772670976
```

No obfuscation. Anyone with the APK can:
- Read the Sentry project ID and ingest key
- Submit fabricated crash events to Glovo's Sentry project
- Potentially ingest garbage data to pollute crash analytics

**Severity:** MEDIUM

### Hardcoded API Base URLs in `o/` Package

| URL | File | Purpose |
|---|---|---|
| `https://api.sentiance.com/` | `C11448fNe.java:26` | Sentiance SDK fallback endpoint |
| `https://client-api.fwf.deliveryhero.net/v3/` | `C1538abH.java:136` | FwF feature flag queries |

### Deep Dive: `rider_scheduling_key`

**Value:** `V97q1U9jTQBJ8Wu6`

This is a symmetric shared secret used to authenticate WebView ↔ native JavaScript bridge calls (`C6042cjK.java:568`, `C12162fgx.java:371`). The signing scheme:

```
token = rider_scheduling_key
timestamp = ZonedDateTime.now(UTC).format("yyyy-MM-dd'T'HH")   // changes every hour
input = token + timestamp + requestParam
hsk = HEX( MD5( input.getBytes(UTF-8) ) )
```

The `hsk` value is injected into every JS bridge invocation:
```javascript
window.runApp("...", "...", { hsk: "abc123..." })
```

**Attack surface:** Anyone who knows `rider_scheduling_key` and the current UTC hour can forge valid `hsk` values and call any `window.runApp` handler from an injected WebView script — bypassing the only authentication check on the JS bridge. The key rotates only with an app update.

### Deep Dive: `funWithFlagToken`

**Value:** `a72fe3e9-dd5b-49ec-965d-946cc1851726`

Used as the Bearer/client token in POST requests to `https://client-api.fwf.deliveryhero.net/v3/` (Delivery Hero's FwF — FeatureWFlags platform). The request body includes:

```json
{
  "platform": "android",
  "is_debug": false,
  "app_version": "v4.2614.1",
  "app_build_number": 1210,
  "application_id": "..."
}
```

**Attack surface:** Knowing this token allows querying the full feature flag state for Glovo Rider from outside the app — revealing which features are in rollout, A/B test variants, kill switches, and staged rollout percentages. This is reconnaissance value, not direct account access.

### Summary Table

| Secret | Severity | Impact |
|--------|----------|--------|
| `rider_scheduling_key` | **HIGH** | Forge WebView JS bridge calls |
| Sentry DSN | **MEDIUM** | Pollute crash analytics, ingest fake events |
| `funWithFlagToken` | **MEDIUM** | Query feature flag state externally |
| `adjust_app_token` | **LOW** | Attribution data manipulation |
| `com_braze_api_key` | **LOW** | Push notification abuse (server key needed separately) |
| `hms_com_braze_api_key` | **LOW** | Same, Huawei variant |

---

## Dynamic Analysis — Frida Instrumentation (Session 2)

### Device & Setup

| Item | Value |
|------|-------|
| Device | Samsung SM-A145F (Galaxy A14) |
| Android | Non-rooted |
| ABI | arm64-v8a |
| Frida | 17.9.1 (frida-tools 14.8.1) |
| Method | Frida Gadget embedded via `objection patchapk` + manual smali patching |

### Injection Strategy

Standard `objection patchapk` failed at two points:
1. **apktool 2.7.0-dirty** could not parse `AndroidManifest.xml` (XML parse error). Fixed by downloading apktool 3.0.1 and wrapping it at `venv/bin/apktool`.
2. **objection `--apktool` flag** does not exist. Fixed by placing apktool wrapper in `venv/bin/` (takes PATH priority).

Final approach — **manual smali injection** (bypassing objection entirely for gadget load):

```smali
# CourierApplication.smali — injected at top of onCreate()
const-string v0, "frida-gadget"
invoke-static {v0}, Ljava/lang/System;->loadLibrary(Ljava/lang/String;)V
```

Gadget config (`gadget-config.json`):
```json
{ "interaction": { "type": "listen", "on_load": "wait" } }
```
`on_load: wait` causes the app to pause at `loadLibrary` until Frida connects — reliable attach point.

### APK Repack Requirements (Android 11+ / targetSdk 35)

All three APK splits must be signed with the **same** certificate. The original splits (Glovo key) + patched base (debug key) causes `INSTALL_FAILED_INVALID_APK: signatures are inconsistent`. Solution: strip all `META-INF/` and re-sign all three with `debug.keystore`.

Additionally:
- **`.so` files must be stored uncompressed** (`zip -0`): Android 11+ extracts native libs directly from the ZIP; compressed `.so` → `res=-2` at install.
- **`resources.arsc` must be stored uncompressed** (`zip -0`): required since targetSdk 30+.
- **Page-alignment required for uncompressed `.so`** (`zipalign -f -p 4`): when `android:extractNativeLibs=false`, `.so` files must be 4096-byte aligned in the ZIP so they can be mmap'd. `zipalign -f 4` (without `-p`) produces misaligned offsets → `INSTALL_FAILED_INVALID_APK: Failed to extract native libraries, res=-2`. Always use `-p` flag.

**Always repack from the currently installed APK** (`adb pull /data/app/.../base.apk /tmp/installed_base.apk`), not from the original xapk sources. The installed APK contains all cumulative patches; rebuilding from xapk loses previously applied smali edits.

### Tamper Detection Bypass (o.eUL)

`o.eUL` is the tamper-detection class (~42 throw points, ~12 methods). Two smali patches applied:

| Location | Original | Patch | Effect |
|----------|----------|-------|--------|
| `smali_classes3/o/eUL.smali` ~line 3530 | `if-ne v9, v3, :cond_22` | `goto :cond_22` | Skips first PRNG integrity check |
| `smali_classes3/o/eUL.smali` ~line 17522 | `throw v0` | `return-void` | Silences second integrity check |
| `smali_classes2/com/foodora/.../CourierApplication.smali` | first line of `onCreate()` | `loadLibrary("frida-gadget")` | Gadget injection (kept) |
| `smali_classes5/o/chO.smali` | first line of `onCreate()` | `loadLibrary("frida-gadget")` | Gadget in MAX_INT ContentProvider |

**Note:** Line numbers above are from the ORIGINAL unpatched APK. When rebuilding from the installed APK, these patches are already in place — don't re-apply. Verify by grepping for `return-void` near the RuntimeException constructor call in eUL.

**VerifyError pitfall:** Replacing the `throw v0` block at line 6667 with `goto` caused a Dalvik verifier type-merge conflict (register v0 was `Reference java.lang.Object` on one path, `int` on another). Fixed by patching only the conditional branch, not the throw block.

**Frida runtime hook** in `bypass_integrity.js` additionally suppresses `RemoteActionCompatParcelizer` (the main check method):
```javascript
eUL.RemoteActionCompatParcelizer.overload('[Ljava.lang.Object;').implementation = () => null;
eUL.RemoteActionCompatParcelizer.overload('[Ljava.lang.Object;','int','int','int').implementation = () => null;
```

### Background Crash Swallowing

Background Kotlin coroutine crashes (e.g., `DefaultDispatcher-worker-N: NullPointerException`) were killing the process silently. Fixed via `Thread.setDefaultUncaughtExceptionHandler` override in Frida — main thread crashes still rethrow, background thread crashes are logged and swallowed.

### SSL/TLS Pinning

#### OkHttp Obfuscated Classes (runtime names)

| Runtime class | JADX rename | Role |
|---------------|-------------|------|
| `o.hbA` | `o.C15337hcd` (builder), `o.hbA` | CertificatePinner (data: holds `Set pins`) |
| `o.hcs` | `o.C15352hcs` | Response (fields: `code`, `message`, `request`, `body`) |
| `o.hci` | `o.C15342hci` | Request (fields: `url`, `method`, `headers`, `body`) |
| `o.hcz` | `o/C15370hcz.java` | ResponseBody — obfuscated: `write()` = `string()`, `IconCompatParcelizer()` = `bytes()` |
| `o.C15365hde` | same | SSL handshake verifier (cert pin check runs here) |

**Finding:** `hbA.DEFAULT` is constructed with an **empty pin set** — no hardcoded certificate pins for Glovo's own API. Confirmed earlier finding ([CRITICAL] section above). Pinning bypass via `SSLContext` override is sufficient.

#### Bypass Applied
```javascript
// Override default SSLContext — accept all server certificates
SSLContext.getInstance('TLS').init(null, [TrustAllManager], null);
SSLContext.setDefault(ctx);
// HostnameVerifier — always return true
HttpsURLConnection.setDefaultHostnameVerifier(AlwaysTrueVerifier);
```

### Auth API Endpoints (discovered via Retrofit interfaces)

| Method | Path | Interface class | Purpose |
|--------|------|-----------------|---------|
| POST | `/api/iam-login/v2/auth` | `InterfaceC6073cjp` | Login (email+password) |
| POST | `/api/iam-login/v2/auth` | `InterfaceC6073cjp` | Login (alt overload) |
| POST | `/api/iam-login/v2/auth/refresh_token` | `InterfaceC6073cjp` | Token refresh |
| PUT  | `/api/iam-login/v2/auth/logout` | `InterfaceC6073cjp` | Logout |
| POST | `/api/iam-login/v2/auth/2fa/trigger` | `InterfaceC12404fla` | Trigger 2FA |
| POST | `/api/iam-login/v2/auth/2fa/verify` | `InterfaceC6073cjp` | Verify 2FA code |
| POST | `/api/iam-login/v2/auth/magic_link/generate` | `InterfaceC10057egZ` | Generate magic link / password reset email |
| POST | `/api/iam-login/v2/auth/magic_link/verify` | `InterfaceC6073cjp` | Verify magic link token |
| PUT  | `/api/iam-login/users/reset_password` | `InterfaceC10057egZ` | Set new password |
| POST | `/api/iam-login/selfie` | `dFL` / `InterfaceC9732eaS` | Upload selfie for identity check |
| PUT  | `/api/iam-login/users/update_password` | `InterfaceC6551css` | Update password (authenticated) |

#### Password Reset Request Body

```java
// com.roadrunner.login.data.forgotpassword.ForgotPasswordRequest
// Serialized as JSON: { "user": { ... } }
// Inner user type: C10056egY (contains email field)
```

### Login Requirements Discovered at Runtime

The login endpoint `/api/iam-login/v2/auth` (POST) has two non-obvious requirements beyond credentials:

**1. `XX-Request-Token` header (Incognia device token)**
- Required for all `*.usehurrier.com` requests; without it: `IAL403: Unsupported Rider App`
- With a fake/invalid token: `IAL403: Unauthorized Rider App` (server validates with Incognia's API)
- Generated by `Incognia.generateRequestTokenSync()` via class `o.dYa` (OkHttp interceptor)
- Feature flag `IS_INCOGNIA_TOKEN_IN_API_REQUESTS_ENABLED` gates this in production; it is **OFF** in this build, so the interceptor never runs normally
- See Incognia bypass section below

**2. `X-Installation-Source` header**
- Set by `o.etR.read()` which returns `INVALID_INSTALLATION_SOURCE` when no installer package found (sideloaded APK)
- Fix: hook `o.etR.read()` → return `"com.android.vending"`
- Unclear if server actually rejects `INVALID_INSTALLATION_SOURCE` vs. just logs it — but spoofing is safe

**3. Cluster-specific base URL**
- Fetched from remote config at runtime; not hardcoded
- `gv-md.usehurrier.com` = Moldova/CIS cluster
- Account `andrei.gomonov.md@gmail.com` is on `gv-md` cluster (confirmed: login returns 201)
- App often resolves to wrong cluster (`gv-ba`, `gv-hr`) on reinstall; force via URL rewrite in `dYa.intercept()`

### Full Bypass — Confirmed Working (2026-04-08, re-confirmed)

Login `HTTP 201` achieved. Complete chain of required bypasses:

| Step | Bypass | Without it |
|------|--------|------------|
| 1 | Gadget in `attachBaseContext()` — before libe2ca.so loads | Cert-spoof hooks install too late |
| 2 | `SigningInfo.getSigningCertificateHistory/getApkContentsSigners()` → original cert | `Iu6.Y` embeds debug cert in token |
| 3 | `t2p.Y(String,String)` → no-op (EC key never generated) | `pC.Y(lGI)` sends attestation chain with debug cert to Incognia server → server profile has debug cert → IAL403 |
| 4 | `q6h.Y()` → fixed fake UUID `c0ffeeee-1337-4200-babe-deadbeef0001` | Old installationId associated with debug cert on Incognia server → IAL403 regardless of current cert chain |
| 5 | `m9.Y(okY)` block `VzJ`/`G5R` transitions | Incognia SDK enters error state → null token → `IAL403: Unsupported Rider App` |
| 6 | `etR.read()` → `"com.android.vending"` | Wrong `X-Installation-Source` header |
| 7 | URL rewrite in `dYa.intercept()` → `gv-md.usehurrier.com` | Wrong cluster → `IAL401` (account not found) |
| 8 | Correct password in login UI | `IAL401: Login failed` |

**Token length note:** Token is always 1154 chars regardless of bypass state. Length is NOT an indicator. IAL403 decision is purely server-side based on the installationId's device profile.

**Account details (confirmed from live session):**
- `Log-Employee-Id: 3522221` — rider/employee ID
- `X-Contract-Type: FULL_TIME`
- `global_entity_id: GV_MD`
- `mutex_owner: c627f01c-1c52-4a53-9290-4c2b78d39f1f` — session mutex UUID (changes each session)

**Auth response:** HTTP `201 Created` (not 200) — auth token is created as a new resource.

**Post-login endpoints observed (all returning 200):**
- `GET /api/rider-experience/v1/home?update_trigger=other`
- `GET /api/rider-experience/v3/side_menu`
- `GET /api/start-working-api/v1/qualtrics`
- `POST /api/delivery-flow/v1/courier/device_token` → `204` (registers push token)
- `GET /api/rider-help-center/v1/helpcenter/chat/unread-message-count?global_entity_id=GV_MD` → `404` (no prior support chat)
- `GET /service-prd-client-configs.usehurrier.com/service/v1/global-entity-configs/all.json`
- `GET /api/client-api.fwf.deliveryhero.net/v3/features` (feature flags)

### Incognia SDK Bypass for Re-Signed APK

**Problem:** The Incognia SDK detects the re-signed APK and enters an error state, refusing to generate tokens.

**Root cause — SDK state machine** (`com.incognia.internal.m9`):
```
H5m (not-init)
  ↓ Cv4.Y(Context, IncogniaOptions) called
Fnf (init-started)
  ↓ AK2 dependency container built + stored in uMa.Y
  ↓ m9.Y(yPJ.Y) called (line 296 of Cv4.java)
yPJ (SDK ready, AK2 set)
  ↓ SDK contacts Incognia servers, detects tamper/sig-mismatch
  ↓ Cv4.Y(Throwable) error handler → m9.Y(VzJ.Y)
VzJ (error — token generation blocked)
```

`generateRequestTokenSync()` checks `M79.Y()` which returns `true` only for `Fnf`/`yPJ` states. In `VzJ`/`G5R` it returns `false` → null token.

**Fix:** Hook `m9.Y(okY)` and block transitions to `VzJ`/`G5R`:
```javascript
var m9 = Java.use('com.incognia.internal.m9');
var origSetState = m9.Y.overload('com.incognia.internal.okY');
origSetState.implementation = function(state) {
    var name = state.getClass().getSimpleName();
    if (name === 'G5R' || name === 'VzJ') {
        return; // stay in yPJ
    }
    origSetState.call(this, state);
};
```

This works because `uMa.Y` (AK2 dependency container) is populated at line 272 of `Cv4.Y(F1)`, **before** `m9.Y(yPJ.Y)` is called at line 296. Blocking the subsequent `VzJ` transition keeps the SDK in `yPJ` with AK2 intact, so `GH.Y(long j)` can make the real network call to `service2.us.incognia.com/mobile/v4` and get a valid device token.

**Note:** This state machine bypass makes `generateRequestTokenSync` succeed and contact Incognia servers, but the generated token may still be rejected by Glovo (`IAL403: Unauthorized Rider App`) due to the key attestation path and server-side installationId profile cache described below.

### Frida Hook Summary (bypass_integrity.js)

| Hook | Target | Purpose |
|------|--------|---------|
| eUL(1-arg) pass-through | `o.eUL.RemoteActionCompatParcelizer([Object[])` | Call original (smali patches handle throw points); catch NPE if bYl lookup fails |
| eUL(4-arg) pass-through | `o.eUL.RemoteActionCompatParcelizer([Object[], int, int, int)` | Same — pass-through with NPE guard |
| eUL no-op | `o.eUL.IconCompatParcelizer()` | No-op — called from login-logger coroutine (eUC); bYl.serializer() returns null → NPE on Field cast; no-op prevents crash |
| Background crash swallow | `Thread.setDefaultUncaughtExceptionHandler` | Keep app alive after bg exceptions |
| Block Process.killProcess | `android.os.Process.killProcess` | Prevent self-kill on tamper |
| Block System.exit | `java.lang.System.exit` | Prevent self-kill on tamper |
| SSL TrustAll | `javax.net.ssl.SSLContext` | Accept all server certificates (default SSLContext) |
| WebViewClient SSL bypass | `android.webkit.WebViewClient.onReceivedSslError` | WebView SSL bypass |
| HostnameVerifier | `javax.net.ssl.HttpsURLConnection` | Accept all hostnames |
| **NSC TrustManager bypass** | **`android.security.net.config.NetworkSecurityTrustManager.checkServerTrusted`** | **Anti-SIGSEGV — see below. 2-arg: return void. 3-arg: return `Arrays.asList(chain)`.** |
| **Root TrustManager bypass** | **`android.security.net.config.RootTrustManager.checkServerTrusted`** | **Anti-SIGSEGV outer wrapper — same pattern** |
| HTTP response logger | `o.hpr.$init(o.hcs, Object, o.hcz)` | **Fires for ALL responses** — use this, not `o.hcs.toString` |
| Retrofit error logger | `retrofit2.HttpException.$init(o.hpr)` | Log 4xx/5xx details |
| Installation source spoof | `o.etR.read()` → `"com.android.vending"` | Fix `X-Installation-Source` header |
| ForgotPasswordRequest log | `ForgotPasswordRequest.$init(o.egY)` | Log reset email/country |
| Incognia interceptor force | `o.dYa.intercept(hbY)` | Inject `XX-Request-Token` header (auth paths only) + URL rewrite to gv-md; **waits for `sdkReady` flag before calling `generateRequestTokenSync`** |
| **Incognia error state block** | **`com.incognia.internal.m9.Y(okY)`** | **Block VzJ/G5R — SDK stays in yPJ. Sets `sdkReady=true` on yPJ transition.** |
| Auth request override | `o.cjU.$init(String×4)` | Force countryCode=gv-md; pass through typed username/password |
| Signing cert spoof (Java path) | `SigningInfo.getSigningCertificateHistory/getApkContentsSigners` | Return original Play Store cert (1420 bytes) — bypasses Iu6.Y ✓ |
| Signing cert spoof (PackageInfo) | `ApplicationPackageManager.getPackageInfo(String, int/Flags)` | Replace `pi.signatures` with original cert |
| **t2p.Y() key gen block** | **`com.incognia.internal.t2p.Y(String,String)`** | **No-op → no EC key generated → null cert chain sent to Incognia server** |
| setAttestationChallenge no-op | `KeyGenParameterSpec$Builder.setAttestationChallenge()` | Defense-in-depth (t2p no-op is primary) |
| **installationId spoof** | **`com.incognia.internal.q6h.Y()`** | **Fixed fake UUID → server sees new device → no debug cert in profile → IAL403 bypassed** |
| Iu6.Y diagnostic | `com.incognia.internal.Iu6.Y(PackageInfo, String)` | Log which cert Incognia actually receives (confirmed: original cert ✓) |
| M79.Y diagnostic | `com.incognia.internal.M79.Y(String)` | Log SDK readiness (true = Fnf or yPJ) |
| o.hcs.toString filter | `o.hcs.toString()` | Log Incognia/usehurrier responses (reconstructed manually — never call original, causes recursion) |

### Frida Hook — Error Body Reading

`o.hcz` (ResponseBody) method names are obfuscated. Discovered via reflection:
- `write()` is the renamed `string()` — reads body as UTF-8 string (consumes stream)
- `IconCompatParcelizer()` is the renamed `bytes()` — reads body as byte array

To read error body in `o.hpr.$init` hook:
```javascript
// errorBody is o.hcz (ResponseBody)
var errStr = errorBody.write();  // = string(), consumes the body
console.log('[http-err-body] ' + String(errStr).substring(0, 500));
```

### IAL403 — Root Cause Analysis (Fully Resolved 2026-04-08)

**Summary:** Three separate layers in Incognia SDK. All three must be bypassed simultaneously.

---

#### Path 1 — Java signing cert API (`Iu6.Y`) — BYPASSED ✓

`com.incognia.internal.Iu6.Y(PackageInfo pi, String str)` reads the cert via:
```java
// API >= 28 path (device is API 35):
SigningInfo signingInfo = pi.signingInfo;  // ← must use pi.signingInfo.value in Frida
if (!signingInfo.hasMultipleSigners()) {
    certs = signingInfo.getSigningCertificateHistory();  // ← our spoof hook fires here
} else {
    certs = signingInfo.getApkContentsSigners();
}
```

**Cert spoof hooks (Section 14 of bypass_integrity.js):**
- `SigningInfo.getSigningCertificateHistory()` → returns `[origSig]`
- `SigningInfo.getApkContentsSigners()` → returns `[origSig]`
- `ApplicationPackageManager.getPackageInfo(String, int/Flags)` → replaces `pi.signatures.value`

**Confirmed working** via `Iu6.Y` diagnostic hook: `[Iu6] cert first8=3082058830820370 len=1420` — the original Play Store cert (1420 bytes) is what Iu6.Y actually receives. Our spoof hooks are effective.

**Timing fix:** Gadget must load in `attachBaseContext()` (not ContentProvider) because libe2ca.so loads from an Anonymous-DexFile only 7ms after process namespace setup.

---

#### Path 2 — Android Key Attestation (`t2p`/`pC`) — BYPASSED ✓

Incognia's `pC` class performs **Android Key Attestation**, a hardware-backed mechanism that creates a certificate chain where the leaf cert's attestation extension contains the **actual APK signing cert**. Java hooks cannot intercept this.

**Key class flow:**

```
pC.Y(lGI callback)
  └─ pC.Y(alias, challenge)
       ├─ t2p.Y(alias, challenge)          ← generates EC keypair in AndroidKeyStore
       │    └─ KeyGenParameterSpec.Builder
       │         .setAttestationChallenge(challenge.getBytes())   ← embeds debug cert here
       │    └─ KeyPairGenerator("EC", "AndroidKeyStore").generateKeyPair()
       ├─ KeyStore.getCertificateChain(alias) ← returns hardware-backed chain with debug cert
       └─ returns List<X509Certificate>     ← cert chain sent to Incognia server
```

`pC` additional classes:
- `com.incognia.internal.Qkd` — in-memory TTL cache (1 min); holds OID extension value from leaf cert
- `com.incognia.internal.ZI` — AES-128-CBC encrypted SharedPreferences wrapper
- `com.incognia.internal.L8L.U` — the main Incognia `ZI` (SharedPreferences) instance

**Fix (Section 17 of bypass_integrity.js):** No-op `t2p.Y(String, String)` entirely:
```javascript
t2pClass.Y.overload('java.lang.String', 'java.lang.String').implementation = function(str, str2) {
    console.log('[key-attest] t2p.Y() blocked — no EC key generated, cert chain → null');
    // no-op: getCertificateChain(alias) returns null → pC.Y(lGI) sends null cert list
};
```

**Important:** `setAttestationChallenge` no-op alone is NOT sufficient. With it, `generateKeyPair` still generates a self-signed EC cert (no attestation extension), but the Incognia server registers ANY cert chain (null is needed). No-op'ing `t2p.Y` ensures null cert chain is sent.

---

#### Path 3 — Incognia Server-Side Device Profile Cache — BYPASSED ✓

**The most persistent IAL403 cause.** The Incognia server associates a `installationId` (UUID stored in SharedPreferences via `com.incognia.internal.q6h`) with the device's cert profile. Once a device is registered with a debug cert (even in ONE prior session before bypass was active), the server returns IAL403 for ALL subsequent requests with that installationId — regardless of what cert chain is now sent.

**Why `t2p.Y` no-op still gave 1154-length token:** The Incognia server generates the token based on the stored device profile, not fresh cert submission alone. Server-side cache wins.

**Classes involved:**

| Class | Role |
|-------|------|
| `com.incognia.internal.q6h` | `Y()` — returns persistent installationId (UUID from SharedPreferences `L8L.U`) |
| `com.incognia.internal.ZI` | Encrypted SharedPreferences r/w wrapper (`v8D()` = read, `Y(key,val)` = write) |
| `com.incognia.internal.L8L.U` | Singleton `ZI` instance for Incognia prefs |

**Fix (Section 18 of bypass_integrity.js):** Spoof `q6h.Y()` to return a fixed fake UUID:
```javascript
var q6hClass = Java.use('com.incognia.internal.q6h');
q6hClass.Y.overload().implementation = function() {
    return 'c0ffeeee-1337-4200-babe-deadbeef0001';  // fixed fake — server sees "new device"
};
```

Server has no debug-cert profile for the fake UUID → first registration uses null cert chain (t2p.Y no-op active) → clean device profile → HTTP 201 accepted.

**Token length note:** Token is always 1154 chars. Length is NOT a bypass indicator. The server-side profile determines IAL403, not the token length.

---

#### libe2ca.so Load Timing

```
21:11:43.449  nativeloader(PID 626): Configuring clns-8 for other apk
21:11:43.456  nativeloader(PID 626): Load .../libe2ca.so  [caller: Anonymous-DexFile — in-memory DEX]
              [Only 7ms after namespace setup — before ContentProviders, before Application.onCreate]
```

**Gadget injection order (current):**
1. `CourierApplication.attachBaseContext()` — first 2 instructions (PRIMARY — before libe2ca.so loads)
2. `o.chO.onCreate()` — ContentProvider (FALLBACK — no-op if gadget already loaded)

`libe2ca.so` reads cert via Java API (`getSigningCertificateHistory`), confirmed by Iu6 diagnostic. It does NOT bypass Java hooks via native fopen. However, the Key Attestation path (`t2p`/`pC`) is a separate issue.

**`libe2ca.so` internals (Ghidra):**
- Single export: `JNI_OnLoad` (64-byte trampoline)
- Imports: `fopen` (ONE call site @ `0x18e514`), `read`, `dlopen`, `dlsym`
- All strings encrypted; calls via function pointer after `dlsym`

### Gadget Injection — ContentProvider Layout

ContentProviders in manifest (relevant ones):

| Class | Authority | initOrder | Notes |
|-------|-----------|-----------|-------|
| `o.chO` | `com.logistics.rider.glovo.app-start-time-provider` | `0x7fffffff` (MAX) | Gadget fallback (no-op if already loaded from attachBaseContext) |
| `o.Ea` | `com.logistics.rider.glovo.androidx-startup` | 0 (default) | AndroidX App Startup — may chain to Incognia initializer |
| `o.alv`, `o.alu` | various | 0 | Unknown providers |
| `com.freshchat.consumer.sdk.provider.FreshchatInitProvider` | `...freshchat.initprovider` | 0 | FreshChat init |

**Primary gadget injection: `CourierApplication.attachBaseContext()`, first 2 instructions.** ContentProvider injection alone is insufficient because libe2ca.so loads before ContentProviders run.

### Working Files

| File | Purpose |
|------|---------|
| `bypass_integrity.js` | Main Frida script — integrity + SSL bypass + HTTP logger + cert spoof + key attestation bypass |
| `run_frida.sh` | Auto-launch app → wait for gadget → attach Frida → show logcat |
| `patch_and_install.sh` | Build pipeline: apktool decode → smali patch → repack → sign → install |
| `gadget-config.json` | Frida gadget config (`on_load: wait`) |
| `debug.keystore` | Re-signing keystore (all 3 splits use this) |
| `/tmp/installed_base.apk` | Last pulled device APK — source for repacking |
| `/tmp/libe2ca.so` | Extracted Incognia native lib (1054768 bytes) for static analysis |

### ART GC SIGSEGV Crash — Root Cause & Fix (2026-04-08)

**Symptom:** After a working session the night before, the app started crashing immediately after Frida resumed it. Tombstone: `SIGSEGV SEGV_MAPERR fault addr 0x10` (null pointer dereference at offset 0x10), thread name `hurrier.com/...` (OkHttp worker for usehurrier.com). Stack trace:

```
art::gc::collector::MarkCompact::ThreadFlipVisitor::Run          ← GC firing here
art::ReferenceMapVisitor::VisitFrame                             ← crash: null ref map
...
sun.security.x509.AVAKeyword.isCompliant
sun.security.x509.AVA.toRFC2253CanonicalString
sun.security.x509.RDN.toRFC2253String
sun.security.x509.X500Name.equals
javax.security.auth.x500.X500Principal.equals
com.android.org.conscrypt.TrustManagerImpl.checkTrustedRecursive  ← deep stack
com.android.org.conscrypt.TrustManagerImpl.checkTrusted
com.android.org.conscrypt.TrustManagerImpl.getTrustedChainForServer
android.security.net.config.NetworkSecurityTrustManager.checkServerTrusted
android.security.net.config.RootTrustManager.checkServerTrusted
com.android.org.conscrypt.ConscryptEngineSocket$2.checkServerTrusted
```

**Root cause:** ART's MarkCompact GC fires during full X.509 cert chain validation (`TrustManagerImpl.checkTrustedRecursive`). The GC tries to walk interpreter stack frames for reference maps; the deep `sun.security.x509.*` stack (all in `core-oj.jar`, pure interpreter) has a corrupt/null reference map at that depth on this device (Samsung SM-A145F, Android 15). This is a device/ROM-level ART bug, non-deterministic but frequent under GC pressure.

**Why our `SSLContext.setDefault` TrustAll doesn't prevent this:** Our custom TrustAll TrustManager is set as the DEFAULT SSLContext. However, the app's OkHttp client uses Android's Network Security Config trust manager (`NetworkSecurityTrustManager` → `RootTrustManager` → Conscrypt `TrustManagerImpl`), which is created from the app-level network security config, not the default SSLContext. OkHttp with an explicit `sslSocketFactory`/`x509TrustManager` bypasses `SSLContext.getDefault()`.

**Fix (bypass_integrity.js sections 5d/5e):**
```javascript
var JavaArrays = Java.use('java.util.Arrays');

// NetworkSecurityTrustManager — inner wrapper
var NSCTrustManager = Java.use('android.security.net.config.NetworkSecurityTrustManager');
// 2-arg (void return)
NSCTrustManager.checkServerTrusted.overload(
    '[Ljava.security.cert.X509Certificate;', 'java.lang.String'
).implementation = function(chain, authType) { /* trust all */ };
// 3-arg — returns List<X509Certificate> (used by OkHttp + Chromium WebView)
// MUST return non-null List — returning undefined/null causes Chromium to NPE → second SIGSEGV
NSCTrustManager.checkServerTrusted.overload(
    '[Ljava.security.cert.X509Certificate;', 'java.lang.String', 'java.lang.String'
).implementation = function(chain, authType, host) {
    return JavaArrays.asList(chain);
};

// RootTrustManager — outer wrapper, same pattern
var RootTrustManager = Java.use('android.security.net.config.RootTrustManager');
// ... same hooks as above ...
```

**WebView pitfall:** Chromium's `AndroidNetworkLibrary.verifyServerCertificates` calls the 3-arg `checkServerTrusted` and calls `.size()` on the returned List. If this returns `undefined`/null, a Java NPE propagates to native code → Chromium catches it via `JniAndroid.handleException` → calls `SIGTRAP TRAP_BRKPT` which our UEH catches but the process still dies. Solution: always return `Arrays.asList(chain)`.

---

### Incognia Token Timing Issue & Fix (2026-04-08)

**Problem:** `generateRequestTokenSync(30000)` timed out even though `M79.Y()` returned `true`.

**Root cause:** `M79.Y(String)` returns `true` for BOTH `Fnf` AND `yPJ` states. In `Fnf` state, `Incognia.init()` has started but the `AK2` dependency container is not yet set up (it's set at `Cv4.java:272`, BEFORE `m9.Y(yPJ.Y)` is called at line 296). When `GH.Y(long j)` submits work to `AK2.AO`, if `AK2` is null (Fnf state), the work is lost. CountDownLatch never fires → 30s timeout → null token.

The interceptor fires on the first outbound request to `*.usehurrier.com` (typically the guest `countries/production` endpoint during login screen load), which happens before Incognia finishes init.

**Fix:** JS-level `sdkReady` flag + polling in interceptor:

```javascript
// At top of Java.perform:
var sdkReady = false;

// In m9.Y hook:
if (name === 'yPJ') {
    sdkReady = true;  // AK2 now set up; generateRequestTokenSync will work
}

// In dYa.intercept:
// Only inject token for auth endpoints (blocking other paths during startup causes ANR)
var urlPath = String(request.url.value.url.value);
var needsToken = urlPath.indexOf('/api/iam-login/v2/auth') >= 0;
if (needsToken) {
    if (!sdkReady) {
        var waited = 0;
        while (!sdkReady && waited < 90000) {
            ThreadClass.sleep(200);
            waited += 200;
        }
    }
    token = IncogniaSDK.generateRequestTokenSync(15000);
}
```

**Why `needsToken` filter matters:** Blocking the `countries/production` request (startup data fetch) causes ANR after a few seconds if the SDK takes >5s to reach yPJ. The `countries/production` endpoint does NOT need the Incognia token — only `/api/iam-login/v2/auth` does.

**`eUL.RemoteActionCompatParcelizer` pass-through:** Previously returned `null` (suppressing tamper detection). Changed to `m1.call(this, arr)` (pass-through, catching NPE). The original method throws NPE inside because `bYl.serializer()` returns null for some field lookups; this is caught and null is returned anyway. The smali patches at lines 3530/17522 handle the actual throw points so the app continues.

**`eUL.IconCompatParcelizer` no-op:** Called from `o.eUC` (login-logger coroutine) and other callers. Without the no-op, `bYl.serializer(...)` returns null → cast to `java.lang.reflect.Field` → NPE inside Kotlin coroutine framework (caught silently). The no-op prevents this NPE entirely.

### Frida API Notes (version 17.x)

- **`Module.findExportByName` removed** — use `Module.getExportByName(mod, name)` (throws if not found, unlike the old version that returned null). Wrap in try/catch.
- **Native hooks must be outside `Java.perform()`** — `Interceptor.attach`, `Module.getExportByName`, `Process.findModuleByAddress` are top-level Frida globals, not Java bridge APIs.
- **Static method hook `this.method(args)` calling pattern** — Frida detects reentrance and calls the original implementation. Works correctly for both static and instance methods.

---

## Home Screen API & SUSPENDED Status Bypass (2026-04-08)

### `/api/rider-experience/v1/home` Response Structure

This endpoint is an **aggregated** response that bundles multiple sub-requests into one JSON payload. The top-level structure is:

```json
{
  "raw": {
    "rider_status": {
      "status_code": 200,
      "body": {
        "status": {
          "status": "SUSPENDED",
          "status_text": "Доступ ограничен",
          "description": "Ваш доступ ограничен по одной или нескольким причинам",
          "action": {
            "type": "URL_ACTION",
            "text": "Подробнее",
            "url": "roadrunner://gv-md.usehurrier.com/app/compliance/web/landing"
          }
        },
        "legacy_state": {
          "courier": {
            "id": 245008,
            "name": "Gomonov Andrei",
            "status": "not_working",
            "contract_type": "FULL_TIME",
            "zone": "Center",
            "city": "Chisinau",
            "city_id": 2,
            "can_extend_shift": true
          },
          "heatmap": {"url": "https://production-eu-rider-app-static-data.s3.amazonaws.com/heatmaps/gv-md/..."}
        }
      }
    },
    "delivery_state": {
      "status_code": 200,
      "body": { ... }
    }
  }
}
```

Key observations:
- `raw.rider_status.body.status.status` = suspension state (`"SUSPENDED"`) — drives the restriction banner
- `raw.legacy_state.courier.status` = working state (`"not_working"`) — already `not_working` from server even when suspended; separate field
- `raw.delivery_state` = bundled delivery state response

### Rider Status Enum

**Class:** `o.ePv` (JADX: `o/EnumC9439ePv.java`)

| Enum constant | JSON value (getValue()) |
|---------------|------------------------|
| AVAILABLE | "available" |
| ENDING | "ending" |
| LATE | "late" |
| NOT_WORKING | "not_working" |
| ON_PAID_BREAK | "on_paid_break" |
| ON_BREAK | "on_break" |
| READY | "ready" |
| STARTING | "starting" |
| SUSPENDED | "suspended" |
| WORKING | "working" |

**Deserializer:** `o.eQu` (JADX: `o/C9465eQu.java`) — static method `read(String str)`. Uses switch on `str.hashCode()` + `str.equals()`. **Only handles uppercase strings** ("NOT_WORKING", "SUSPENDED", etc.), NOT the lowercase `getValue()` strings. Unknown values throw `IllegalArgumentException`.

### SUSPENDED Bypass — Root Cause Chain

**Goal:** Replace the "Доступ ограничен" restriction banner with the StartingArea ("Start now") screen.

**Interception point:** `o.dYa.intercept()` — the OkHttp network interceptor for all `*.usehurrier.com` requests (including `/api/rider-experience/v1/home`).

**Root cause of banner persistence (key trap):** The original spoof replaced `"status":"SUSPENDED"` with `"status":"not_working"` (lowercase). The enum deserializer `o.eQu.read("not_working")` throws `IllegalArgumentException: unknown value`. The app falls back to the **Room DB cached SUSPENDED state** and re-renders the restriction banner — even though the spoof was firing correctly in logs.

**Fix:** Use uppercase: `.replace('"status":"SUSPENDED"', '"status":"NOT_WORKING"')`.

**Room DB cache behaviour:** The app loads SUSPENDED status from Room DB before any network response arrives. The restriction banner renders from cache immediately (this is why `StartingAreaNavigateViewUiModelImpl.write()` fires many times BEFORE the first `[home-body]` log). The interceptor hook fires on the subsequent network response and updates the ViewModel. With correct uppercase deserialization, the ViewModel transitions SUSPENDED → NOT_WORKING and the banner dismisses.

### OkHttp Response Body Replacement Technique

Used in the `o.dYa.intercept()` hook. All method names are obfuscated — using the names confirmed via JADX:

| Obfuscated call | Real meaning |
|-----------------|-------------|
| `response.serializer(2097152)` | `response.peekBody(2MB)` — non-destructive read, returns `o.hct` |
| `peeked.write()` | `ResponseBody.string()` — reads as UTF-8 string |
| `peeked.RemoteActionCompatParcelizer()` | `ResponseBody.contentType()` — returns `o.C15336hcc` |
| `Java.use('o.hfu').$new()` | `new okio.Buffer()` |
| `buf.read(string)` | `Buffer.writeUtf8(string)` |
| `buf.size.value` | `Buffer.size` (long field) |
| `Java.use('o.hcz').$new(ct, len, buf)` | `new RealResponseBody(contentType, contentLength, source)` |
| `response.read()` | `Response.newBuilder()` — returns `o.hcw` builder |
| `builder.write()` | `Response.Builder.build()` |

**Pitfall:** `response.body` field (`_hcsBodyField.get(response)`) returns a raw reflection object without Frida type info — calling methods like `contentType()` on it fails with `TypeError: not a function`. Always use the typed object returned from `peekBody()` for content-type extraction.

**Pitfall:** Setting the body via reflection on the builder:
```javascript
var bodyField = Java.use('o.hcw').class.getDeclaredField('IconCompatParcelizer');
bodyField.setAccessible(true);
bodyField.set(builder, newBody);
```
Field name `IconCompatParcelizer` is the obfuscated name of the `body` field in `Response.Builder`.

### StartingAreaNavigateViewUiModelImpl Tamper Check

**Class:** `com.roadrunner.startingarea.presentation.StartingAreaNavigateViewUiModelImpl`

`write()` (returns `gTM` StateFlow) has an embedded identity-hash XOR integrity check that throws NPE (`throw null`) when Frida is active. The happy-path return value is `this.MediaDescriptionCompat.value` (a `gTM` Flow set in the constructor via `AbstractC13670gSl.IconCompatParcelizer(Boolean.FALSE)`).

**⚠ Recursion trap:** Calling `this.write()` inside `implementation = function()` is recursive — NOT a call to the original. Results in StackOverflow on every invocation.

**Fix:**
```javascript
NavVM.write.implementation = function() {
    return this.MediaDescriptionCompat.value;
};
```

**Result:** After SUSPENDED → NOT_WORKING spoof + this tamper fix, the app renders the StartingArea screen with "Start now" / "Sessions" tabs and "Upcoming sessions" section. The restriction banner is gone. ✓

### Additional API Endpoints Observed During StartingArea Load

| Endpoint | Method | Notes |
|----------|--------|-------|
| `/api/start-working-api/v1/qualtrics` | GET | Survey config (Qualtrics intercept ID + project ID) |
| `/api/rider-experience/v1/home?update_trigger=enter_foreground` | GET | Home state poll on foreground |
| `/api/rooster/v2/employees/3522221` | GET | Full employee profile (name, email, contracts, fields) |
| `/api/rooster/v3/employees/3522221/shifts` | GET | Shift schedule (returns `[]` — no shifts booked) |
| `/api/delivery-flow/v1/courier/device_token` | PUT | FCM push token registration |

