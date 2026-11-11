# Pathway — learning roadmaps

A small React app for building learning roadmaps and tracking progress, made for a group of 2–3 people.

- **Roadmaps** → milestones → topics, with notes and resource links per topic
- **Private by default, shared by choice**: share a roadmap with registered people so they can follow your progress, comment and set target dates
- **Projects**: start and end dates, Gantt timeline with phases, issue board (open / in progress / resolved) with priority, assignee and due dates
- **Dashboard** with streak, activity heatmap, "continue learning" and a group panel
- **Learning journal** with time spent per session
- **Target dates** per milestone, **weekly goals**, and **revision reminders** 1, 7 and 30 days after finishing a topic
- **Focus timer** that logs sessions to the journal, **comments** on topics, **search** (Ctrl/⌘ K)
- **Duplicate, export and import** roadmaps as JSON
- Dark or light theme following the device setting, works on phones

## Run locally

```bash
npm install
npm run dev
```

Without Firebase keys the app runs in **demo mode**: one user, data saved in the browser's localStorage.

## Connect Firebase

1. In the [Firebase console](https://console.firebase.google.com) create a project.
2. **Authentication → Sign-in method →** enable **Google**.
3. **Firestore Database → Create database** (production mode).
4. **Project settings → Your apps → Web app (`</>`)** — register an app and copy the config values.
5. Copy `.env.example` to `.env.local` and fill in the six values.
6. In `firestore.rules`, replace the placeholder emails with the Google accounts that may use the app.

## Deploy

```bash
npm install -g firebase-tools
firebase login
firebase use --add        # pick your project
npm run build
firebase deploy
```

`firebase deploy` publishes `dist/` to Firebase Hosting and uploads the Firestore security rules.

Every push to `main` also publishes the site automatically through GitHub Actions (`.github/workflows/firebase-hosting-merge.yml`). Security rules are not part of that: deploy them by hand.
After changing the email allow-list, run `firebase deploy --only firestore:rules`.

## Data model (Firestore)

| Collection | Document |
| --- | --- |
| `users/{uid}` | name, email, photo |
| `roadmaps/{id}` | title, emoji, colour, owner, `milestones[]` (each with `topics[]`), `progress.{uid}.{topicId}` |
| `roadmaps/{id}/comments/{id}` | comment on a topic: text, author, topic id |
| `projects/{id}` | name, dates, status, owner, `sharedWith[]`, `phases[]`, `issues.{issueId}` |
| `logs/{id}` | journal entry: text, minutes, date, author, linked roadmap |
