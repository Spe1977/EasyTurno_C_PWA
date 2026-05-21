import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

export function connectFirebaseEmulators(): void {
  connectAuthEmulator(getAuth(), 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(getFirestore(), '127.0.0.1', 8080);
}
