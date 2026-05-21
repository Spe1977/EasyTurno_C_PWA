// Firebase Web SDK configuration for the EasyTurno project.
//
// These values are NOT secrets — Firebase documents this explicitly:
// https://firebase.google.com/docs/projects/api-keys
// The apiKey identifies the project to the Firebase backend; access control
// is enforced by Firebase Authentication + Firestore Security Rules.
// Committing this file is the standard, recommended pattern.

import type { FirebaseOptions } from 'firebase/app';

export const firebaseConfig: FirebaseOptions = {
  apiKey: 'AIzaSyCTFCS6WMsEaJXZhCwkDzpMYqXrfMoobJY',
  authDomain: 'easyturno.firebaseapp.com',
  projectId: 'easyturno',
  storageBucket: 'easyturno.firebasestorage.app',
  messagingSenderId: '643527700508',
  appId: '1:643527700508:web:bbd0d5d701c157d7506fd9',
};
