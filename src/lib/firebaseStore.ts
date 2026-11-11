import { initializeApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
} from 'firebase/auth'
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import type { Comment, LogEntry, Member, Project, Roadmap } from './types'
import type { OnError, Store, Unsub } from './store'

const env = import.meta.env

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

export const firebaseConfigured = Boolean(config.apiKey && config.projectId)

export function createFirebaseStore(): Store {
  const app = initializeApp(config)
  const auth = getAuth(app)
  const db = getFirestore(app)

  /**
   * Live list of the documents in `name` that this person owns or that were
   * shared with them. Firestore cannot OR those two conditions under our
   * security rules, so it is two listeners merged into one list.
   */
  function watchVisible<T extends { id: string; createdAt: number }>(
    name: string,
    uid: string,
    fix: (doc: T) => T,
    cb: (list: T[]) => void,
    onError: OnError,
  ): Unsub {
    const parts: (Map<string, T> | null)[] = [null, null]
    const emit = () => {
      if (!parts[0] || !parts[1]) return
      const all = new Map([...parts[0], ...parts[1]])
      cb([...all.values()].sort((a, b) => b.createdAt - a.createdAt))
    }
    const read = (i: number) => (snap: { docs: { id: string; data(): unknown }[] }) => {
      parts[i] = new Map(snap.docs.map((d) => [d.id, fix({ ...(d.data() as T), id: d.id })]))
      emit()
    }
    const own = onSnapshot(query(collection(db, name), where('ownerId', '==', uid)), read(0), onError)
    const shared = onSnapshot(query(collection(db, name), where('sharedWith', 'array-contains', uid)), read(1), (err) => {
      // Never let a problem with shared items hide the person's own.
      console.warn(`Could not load shared ${name}`, err)
      parts[1] = new Map()
      emit()
    })
    return () => {
      own()
      shared()
    }
  }

  return {
    mode: 'firebase',

    onAuth(cb) {
      return onAuthStateChanged(auth, (u) => {
        if (!u) return cb(null)
        const member: Member = {
          uid: u.uid,
          name: u.displayName || u.email?.split('@')[0] || 'Learner',
          email: u.email || '',
          photo: u.photoURL,
        }
        // Keep a small profile so teammates can see each other. Fails harmlessly
        // (permission-denied) for accounts that are not on the allow-list.
        setDoc(doc(db, 'users', u.uid), member, { merge: true }).catch(() => {})
        cb(member)
      })
    },

    async signIn() {
      await signInWithPopup(auth, new GoogleAuthProvider())
    },

    signOut: () => fbSignOut(auth),

    watchRoadmaps(uid, cb, onError) {
      return watchVisible<Roadmap>(
        'roadmaps',
        uid,
        (r) => ({ ...r, milestones: r.milestones ?? [], progress: r.progress ?? {}, sharedWith: r.sharedWith ?? [] }),
        cb,
        onError,
      )
    },

    watchLogs(cb, onError) {
      return onSnapshot(
        query(collection(db, 'logs'), orderBy('createdAt', 'desc'), limit(500)),
        (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as LogEntry), id: d.id }))),
        onError,
      )
    },

    watchMembers(cb, onError) {
      return onSnapshot(
        collection(db, 'users'),
        (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as Member), uid: d.id }))),
        onError,
      )
    },

    createRoadmap: (r) => setDoc(doc(db, 'roadmaps', r.id), r),

    updateRoadmap: (id, patch) => updateDoc(doc(db, 'roadmaps', id), { ...patch }),

    deleteRoadmap: (id) => deleteDoc(doc(db, 'roadmaps', id)),

    // Writes only this user's entry for this topic, so teammates updating the
    // same roadmap at the same time never overwrite each other.
    setProgress: (roadmapId, uid, topicId, status) =>
      updateDoc(doc(db, 'roadmaps', roadmapId), {
        [`progress.${uid}.${topicId}`]: status === 'todo' ? deleteField() : { s: status, t: Date.now() },
      }),

    setEntry: (roadmapId, uid, topicId, entry) =>
      updateDoc(doc(db, 'roadmaps', roadmapId), { [`progress.${uid}.${topicId}`]: entry }),

    addLog: (l) => setDoc(doc(db, 'logs', l.id), l),

    deleteLog: (id) => deleteDoc(doc(db, 'logs', id)),

    watchComments(roadmapId, cb, onError) {
      return onSnapshot(
        collection(db, 'roadmaps', roadmapId, 'comments'),
        (snap) =>
          cb(
            snap.docs
              .map((d) => ({ ...(d.data() as Comment), id: d.id }))
              .sort((a, b) => a.createdAt - b.createdAt),
          ),
        onError,
      )
    },

    addComment: (c) => setDoc(doc(db, 'roadmaps', c.roadmapId, 'comments', c.id), c),

    deleteComment: (c) => deleteDoc(doc(db, 'roadmaps', c.roadmapId, 'comments', c.id)),

    watchProjects(uid, cb, onError) {
      return watchVisible<Project>(
        'projects',
        uid,
        (p) => ({ ...p, phases: p.phases ?? [], issues: p.issues ?? {}, sharedWith: p.sharedWith ?? [] }),
        cb,
        onError,
      )
    },

    createProject: (p) => setDoc(doc(db, 'projects', p.id), p),

    updateProject: (id, patch) => updateDoc(doc(db, 'projects', id), { ...patch }),

    deleteProject: (id) => deleteDoc(doc(db, 'projects', id)),

    saveIssue: (projectId, issue) =>
      updateDoc(doc(db, 'projects', projectId), { [`issues.${issue.id}`]: issue, updatedAt: Date.now() }),

    deleteIssue: (projectId, issueId) =>
      updateDoc(doc(db, 'projects', projectId), { [`issues.${issueId}`]: deleteField(), updatedAt: Date.now() }),

    updateMember: (uid, patch) => setDoc(doc(db, 'users', uid), patch, { merge: true }),
  }
}
