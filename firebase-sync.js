/* Gmail login (Firebase Auth) and cloud save (Cloud Firestore) for Nightshift Drive.
   Data layout:
     users/{uid}                 -> { name, credits, sel, stats, updatedAt }
     users/{uid}/cars/{carId}    -> one document per owned car (paint, finish, rims, tires, engine levels, underglow)
   If firebase-config.js still has the YOUR_* placeholders, this file does nothing and the game runs with local saving only. */
import { firebaseConfig } from './firebase-config.js';

const V = '10.12.2';
const configured = firebaseConfig && firebaseConfig.apiKey && firebaseConfig.apiKey.indexOf('YOUR_') !== 0;

if (configured) {
  try {
    const [appM, authM, fsM] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`)
    ]);
    const app = appM.initializeApp(firebaseConfig);
    const auth = authM.getAuth(app);
    const db = fsM.getFirestore(app);
    const provider = new authM.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    const slim = u => u && { uid: u.uid, name: u.displayName || '', email: u.email || '', photo: u.photoURL || '' };

    window.NSD_CLOUD = {
      onAuth(cb) {
        authM.onAuthStateChanged(auth, u => cb(slim(u)));
        authM.getRedirectResult(auth).catch(() => {});
      },
      async signIn() {
        try {
          await authM.signInWithPopup(auth, provider);
        } catch (err) {
          if (err && (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment')) {
            await authM.signInWithRedirect(auth, provider);
            return;
          }
          throw err;
        }
      },
      signOut() { return authM.signOut(auth); },
      async pull(uid) {
        const userSnap = await fsM.getDoc(fsM.doc(db, 'users', uid));
        if (!userSnap.exists()) return null;
        const carsSnap = await fsM.getDocs(fsM.collection(db, 'users', uid, 'cars'));
        const owned = {};
        carsSnap.forEach(d => { owned[d.id] = d.data(); });
        const d = userSnap.data();
        return { name: d.name, credits: d.credits, sel: d.sel, stats: d.stats, owned };
      },
      async push(uid, data, user) {
        const batch = fsM.writeBatch(db);
        batch.set(fsM.doc(db, 'users', uid), {
          name: data.name, credits: Math.max(0, Math.floor(data.credits)), sel: data.sel, stats: data.stats,
          photo: (user && user.photo) || '', updatedAt: fsM.serverTimestamp()
        }, { merge: true });
        Object.keys(data.owned).forEach(id => {
          batch.set(fsM.doc(db, 'users', uid, 'cars', id), data.owned[id], { merge: true });
        });
        await batch.commit();
      }
    };
    window.dispatchEvent(new Event('nsd-cloud-ready'));
  } catch (e) {
    console.warn('Nightshift Drive: cloud save unavailable', e);
  }
}
