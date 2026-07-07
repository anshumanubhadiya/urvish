/* ==========================================================
   Biometric helper functions
   - Face recognition via face-api.js (loaded from CDN)
   - Device fingerprint / face unlock via WebAuthn platform authenticator
   NOTE: WebAuthn only confirms "this device's owner verified with their
   fingerprint/face" — it cannot read a physical fingerprint sensor's raw
   data directly, because browsers are not allowed access to that for
   privacy/security reasons. This is how real production attendance apps
   that support "device biometric" verification work too.
   ========================================================== */

const FACE_MODEL_URL = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights";

const Biometric = {
  faceApiLoaded: false,

  async loadFaceModels() {
    if (this.faceApiLoaded) return;
    await faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODEL_URL);
    this.faceApiLoaded = true;
  },

  async startCamera(videoEl) {
    const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
    videoEl.srcObject = stream;
    return stream;
  },

  stopCamera(stream) {
    if (stream) stream.getTracks().forEach(t => t.stop());
  },

  async getFaceDescriptor(videoEl) {
    const detection = await faceapi
      .detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();
    return detection ? Array.from(detection.descriptor) : null;
  },

  // Euclidean distance between two face descriptors. Lower = more similar.
  // A threshold around 0.5-0.6 is the common convention for face-api.js.
  compareFaces(descA, descB) {
    if (!descA || !descB) return Infinity;
    let sum = 0;
    for (let i = 0; i < descA.length; i++) {
      sum += Math.pow(descA[i] - descB[i], 2);
    }
    return Math.sqrt(sum);
  },

  isWebAuthnSupported() {
    return !!(window.PublicKeyCredential && navigator.credentials);
  },

  // Register the device's biometric (fingerprint/face unlock) for a student
  async registerBiometric(enrollment, displayName) {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "College Attendance System" },
        user: { id: userId, name: enrollment, displayName },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
        timeout: 60000
      }
    });
    // Store credential id (base64) so we can request the same authenticator later
    const credIdB64 = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
    return credIdB64;
  },

  // Verify with the previously registered device biometric
  async verifyBiometric(credIdB64) {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const credId = Uint8Array.from(atob(credIdB64), c => c.charCodeAt(0));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ id: credId, type: "public-key" }],
        userVerification: "required",
        timeout: 60000
      }
    });
    return !!assertion;
  }
};
