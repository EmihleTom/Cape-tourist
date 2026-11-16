import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, storage } from './config';

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64);
}

export const storageService = {
  async uploadUserAvatar(uid: string, file: File): Promise<string> {
    if (!auth.currentUser || auth.currentUser.uid !== uid) {
      throw new Error('You must be signed in to upload a profile photo.');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Profile photo must be smaller than 5 MB.');
    }
    if (!file.type.startsWith('image/')) {
      throw new Error('Please choose a valid image file (PNG, JPG, or WebP).');
    }

    const storageRef = ref(storage, `users/${uid}/avatar/${Date.now()}_${sanitizeFileName(file.name)}`);
    const snapshot = await uploadBytes(storageRef, file, {
      contentType: file.type,
    });
    return getDownloadURL(snapshot.ref);
  },

  async uploadIncidentPhoto(uid: string, file: File): Promise<string> {
    if (!auth.currentUser || auth.currentUser.uid !== uid) {
      throw new Error('You must be signed in to upload an incident attachment.');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('Attachment must be smaller than 10 MB.');
    }
    const storageRef = ref(storage, `incidents/${uid}/${Date.now()}_${sanitizeFileName(file.name)}`);
    const snapshot = await uploadBytes(storageRef, file, {
      contentType: file.type,
    });
    return getDownloadURL(snapshot.ref);
  },

  async uploadBusinessComplianceDoc(uid: string, file: File): Promise<string> {
    if (!auth.currentUser || auth.currentUser.uid !== uid) {
      throw new Error('You must be signed in to upload compliance documents.');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('Compliance file must be smaller than 10 MB.');
    }
    const storageRef = ref(storage, `businesses/${uid}/${Date.now()}_${sanitizeFileName(file.name)}`);
    const snapshot = await uploadBytes(storageRef, file, {
      contentType: file.type,
    });
    return getDownloadURL(snapshot.ref);
  },

  async uploadOfferingPhoto(uid: string, file: File): Promise<string> {
    if (!auth.currentUser || auth.currentUser.uid !== uid) {
      throw new Error('You must be signed in to upload experience photos.');
    }
    if (file.size > 8 * 1024 * 1024) {
      throw new Error('Experience photo must be smaller than 8 MB.');
    }
    if (!file.type.startsWith('image/')) {
      throw new Error('Please choose a valid image file (PNG, JPG, or WebP).');
    }
    const storageRef = ref(storage, `offerings/${uid}/${Date.now()}_${sanitizeFileName(file.name)}`);
    const snapshot = await uploadBytes(storageRef, file, {
      contentType: file.type,
    });
    return getDownloadURL(snapshot.ref);
  },
};
