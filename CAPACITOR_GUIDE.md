# RentaTO — Guía para empaquetar como app Android (Capacitor)

Esto convierte RentaTO en una app nativa instalable. El enfoque MVP: un
"shell" nativo que carga la web app en vivo (https://renta-to.vercel.app).
Así la app se actualiza sola cuando haces deploy a Vercel, sin re-publicar el
APK cada vez. Cuando quieras una versión 100% offline, cambiamos a bundlear `dist`.

> ⚠️ El APK NO se puede generar desde mi sandbox ni solo con este repo: requiere
> Android SDK + Gradle + Java. Hazlo en tu Crostini (pesado pero posible) o, más
> cómodo, con un build en la nube (ver "Opción B" al final).

---

## Requisitos (una sola vez)

En tu Crostini (Debian):

```bash
# Java 17 (Gradle de Android lo necesita)
sudo apt update && sudo apt install -y openjdk-17-jdk

# Verifica
java -version   # debe decir 17.x
```

Android Studio en Crostini es pesado. Si tu Chromebook tiene poca RAM (<8GB),
salta a la **Opción B (build en la nube)** — es lo que recomiendo.

---

## Opción A — Build local en Crostini

### 1. Instalar Capacitor y los plugins

Desde la raíz del repo (`~/RentaTO`):

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android \
            @capacitor/camera @capacitor/geolocation @capacitor/push-notifications \
            @capacitor/splash-screen
```

### 2. Construir el frontend

```bash
npm run build      # genera dist/
```

### 3. Inicializar Android

`capacitor.config.ts` ya está en el repo, así que sólo agrega la plataforma:

```bash
npx cap add android
npx cap sync android
```

Esto crea la carpeta `android/`. **No la subas a git** (ya está en `.gitignore`).

### 4. Permisos (cámara, ubicación, notificaciones)

Edita `android/app/src/main/AndroidManifest.xml` y agrega dentro de `<manifest>`,
antes de `<application>`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

### 5. Compilar el APK de prueba (debug)

```bash
cd android
./gradlew assembleDebug
# El APK queda en:
# android/app/build/outputs/apk/debug/app-debug.apk
```

Pásalo a tu teléfono (o usa el file manager de ChromeOS) e instálalo activando
"orígenes desconocidos". Listo para probar.

### 6. APK/AAB firmado para Play Store

Play Store exige un **App Bundle (.aab)** firmado:

```bash
# Genera una llave de firma (GUÁRDALA, sin ella no puedes actualizar la app nunca)
keytool -genkey -v -keystore rentato-release.keystore \
  -alias rentato -keyalg RSA -keysize 2048 -validity 10000

# Compila el bundle
cd android
./gradlew bundleRelease
# Queda en android/app/build/outputs/bundle/release/app-release.aab
```

Para firmar automáticamente, crea `android/keystore.properties` (NO lo subas a git):

```
storeFile=../../rentato-release.keystore
storePassword=TU_PASSWORD
keyAlias=rentato
keyPassword=TU_PASSWORD
```

---

## Opción B — Build en la nube (recomendado para Chromebook)

Si Crostini sufre con Android Studio/Gradle, usa un servicio de build:

- **Ionic Appflow** (de los creadores de Capacitor): conectas el repo de GitHub,
  configuras la firma una vez, y te genera el AAB en sus servidores. Free tier
  limitado pero suficiente para arrancar.
- **GitHub Actions + un workflow de build Android**: gratis para repos públicos.
  Cuando quieras, te genero el `.github/workflows/android.yml` que compila el AAB
  en cada tag y lo deja como artifact descargable. Sólo dime y lo armo.

---

## Publicar en Google Play

1. Crea cuenta en **Google Play Console** (pago único de US$25).
2. Crea la app, sube el `.aab`.
3. Llena: ficha (capturas, ícono 512×512, descripción), clasificación de
   contenido, política de privacidad (necesitas una URL — te puedo generar una
   página `/privacidad` simple), y el cuestionario de seguridad de datos
   (declara que recoges: ubicación, fotos, email, teléfono).
4. Manda a revisión. Android suele aprobar en 1-3 días.

## iOS (más adelante)

iOS requiere **Mac** para compilar y firmar (Xcode), más cuenta **Apple Developer
(US$99/año)**. No es viable desde Chromebook. Cuando tengas acceso a una Mac:

```bash
npm install @capacitor/ios
npx cap add ios
npx cap sync ios
npx cap open ios   # abre Xcode
```

---

## Notas sobre los plugins nativos

Tu web app actual sube fotos vía el input `<input type="file" capture>`, que en
el WebView de Capacitor **ya abre la cámara nativa** — así que la subida de
cédula/vehículo funciona sin tocar código. El plugin `@capacitor/camera` sólo lo
necesitas si quieres una experiencia de cámara más fina (recortar, etc.).

`@capacitor/geolocation` y `@capacitor/push-notifications` están instalados pero
aún no cableados en la UI. Cuando quieras usarlos (ej. "vehículos cerca de mí" o
notificar reservas por push en vez de email), te integro el JS correspondiente.
