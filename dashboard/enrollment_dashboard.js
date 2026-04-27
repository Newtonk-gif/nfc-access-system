// ============================================================
//  Dashboard — Enrollment Integration
//  Add this to your dashboard JS to handle the full
//  enroll user flow with the Pico WH reader
// ============================================================

import { getDatabase, ref, set, onValue, remove, get }
  from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

import { getFirestore, collection, addDoc, doc, setDoc }
  from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const rtdb = getDatabase();
const fdb  = getFirestore();

// ── Refs ──────────────────────────────────────────────────────
const enrollmentSessionRef = ref(rtdb, "enrollment_session");
const pendingRef           = ref(rtdb, "pending_enrollments");

// ── State ─────────────────────────────────────────────────────
let enrollmentListener = null;   // holds the unsubscribe function
let capturedUID        = null;

// ── Step 1: Admin clicks "Enroll User" button ─────────────────
async function startEnrollment() {
  capturedUID = null;

  // Tell the Pico to start listening
  await set(enrollmentSessionRef, {
    status:    "awaiting_scan",
    timestamp: Date.now()
  });

  updateUI("waiting");   // show spinner / "Waiting for card tap..."
  console.log("Enrollment session started — Pico is now listening");

  // Step 2: Listen for Pico response
  enrollmentListener = onValue(enrollmentSessionRef, (snapshot) => {
    const session = snapshot.val();
    if (!session) return;

    console.log("Session update:", session.status);

    switch (session.status) {

      case "scanned":
        // UID captured — stop listening, show the form
        capturedUID = session.uid;
        stopListening();
        updateUI("scanned", session.uid);
        console.log("UID captured:", session.uid);
        break;

      case "duplicate":
        stopListening();
        updateUI("duplicate");
        console.warn("Tag already registered");
        break;

      case "timeout":
        stopListening();
        updateUI("timeout");
        console.warn("Enrollment timed out — no card tapped");
        break;

      case "error":
        stopListening();
        updateUI("error");
        console.error("Pico reported a write error");
        break;
    }
  });
}

// ── Step 2: Stop the Firebase listener ───────────────────────
function stopListening() {
  if (enrollmentListener) {
    enrollmentListener();   // calling the returned function unsubscribes
    enrollmentListener = null;
  }
}

// ── Step 3: Admin fills form and clicks "Save User" ──────────
async function saveUser(formData) {
  // formData = { name, role, department, institution, email }

  if (!capturedUID) {
    alert("No UID captured. Please scan a card first.");
    return;
  }

  try {
    // Write to Firestore /users
    const userRef = doc(collection(fdb, "users"));
    await setDoc(userRef, {
      name:        formData.name,
      role:        formData.role,
      department:  formData.department,
      institution: formData.institution,
      email:       formData.email || "",
      rfidTag:     capturedUID,
      active:      true,
      createdAt:   new Date()
    });

    // Write to Firestore /tags
    await setDoc(doc(fdb, "tags", capturedUID), {
      uid:        capturedUID,
      assignedTo: userRef.id,
      active:     true
    });

    console.log("User saved:", formData.name, "| Tag:", capturedUID);

    // Clean up Realtime DB
    await cleanupEnrollment();

    updateUI("saved");
    capturedUID = null;

  } catch (err) {
    console.error("Save failed:", err);
    updateUI("save_error");
  }
}

// ── Step 4: Clean up after enrollment ────────────────────────
async function cleanupEnrollment() {
  // Remove the pending entry matching capturedUID
  const pendingSnap = await get(pendingRef);
  if (pendingSnap.exists()) {
    pendingSnap.forEach((child) => {
      if (child.val().uid === capturedUID) {
        remove(ref(rtdb, "pending_enrollments/" + child.key));
      }
    });
  }
  // Reset enrollment session
  await set(enrollmentSessionRef, { status: "idle" });
}

// ── Cancel enrollment mid-flow ────────────────────────────────
async function cancelEnrollment() {
  stopListening();
  await set(enrollmentSessionRef, { status: "idle" });
  capturedUID = null;
  updateUI("idle");
  console.log("Enrollment cancelled");
}

// ── UI state handler — connect to your actual UI elements ─────
function updateUI(state, uid = null) {
  // Replace these with your actual DOM update logic

  const statusEl  = document.getElementById("enrollment-status");
  const uidField  = document.getElementById("uid-field");
  const formEl    = document.getElementById("enrollment-form");

  switch (state) {
    case "idle":
      if (statusEl) statusEl.textContent = "Ready";
      if (formEl)   formEl.style.display = "none";
      break;

    case "waiting":
      if (statusEl) statusEl.textContent = "Waiting for card tap... (60s timeout)";
      break;

    case "scanned":
      if (statusEl) statusEl.textContent = "Card scanned! Fill in user details.";
      if (uidField) uidField.value = uid;       // auto-fill UID
      if (formEl)   formEl.style.display = "block";  // show the form
      break;

    case "duplicate":
      if (statusEl) statusEl.textContent = "This tag is already registered.";
      break;

    case "timeout":
      if (statusEl) statusEl.textContent = "Timed out. No card was tapped.";
      break;

    case "saved":
      if (statusEl) statusEl.textContent = "User enrolled successfully!";
      if (formEl)   formEl.style.display = "none";
      break;

    case "error":
    case "save_error":
      if (statusEl) statusEl.textContent = "An error occurred. Please try again.";
      break;
  }
}

// ── Export functions for use in your dashboard ────────────────
export { startEnrollment, saveUser, cancelEnrollment };
