# Sermon Audio App

A powerful web application for streaming, organizing, and listening to sermons with real-time analytics and engagement tracking. Built with React and Firebase, the app provides both frontend and backend capabilities through Firebase Cloud Functions.

**Live Demo**: https://app.palousefellowship.com

## 🎯 Features

- **Audio Streaming** - Stream sermon audio directly in the browser
- **Sermon Management** - Organize and categorize sermons
- **Listen History** - Track your listening activity
- **Progress Tracking** - Resume sermons where you left off
- **Search & Filter** - Find sermons by title, speaker, or date
- **Analytics Dashboard** - View engagement metrics and statistics
- **Progressive Web App** - Install and use as a native app
- **Real-time Data** - Firebase integration for live updates
- **Cloud Functions** - Backend serverless functions with Firebase

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 19
- **Build Tool**: Vite
- **Backend**: Firebase (Authentication, Realtime Database, Cloud Storage)
- **PWA**: vite-plugin-pwa
- **Routing**: React Router v7
- **Charts**: Recharts for analytics visualization
- **Hosting**: Vercel

### Backend
- **Firebase Cloud Functions** - Node.js 20
- **Firebase Admin SDK** - Database and auth management

## 📦 Installation

### Prerequisites
- Node.js 18+ (20+ for Firebase Functions)
- Firebase account with project set up
- npm or yarn

### Frontend Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/cadinlafon/sermon-audio-app.git
   cd sermon-audio-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file with your Firebase credentials:
   ```
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```
   The app will open at `http://localhost:5173`

### Backend (Cloud Functions) Setup

1. **Navigate to functions directory**
   ```bash
   cd functions
   ```

2. **Install Firebase CLI globally** (if not already installed)
   ```bash
   npm install -g firebase-tools
   ```

3. **Login to Firebase**
   ```bash
   firebase login
   ```

4. **Install function dependencies**
   ```bash
   npm install
   ```

5. **Deploy functions**
   ```bash
   firebase deploy --only functions
   ```

## 🚀 Usage

### Frontend Commands

```bash
# Start development server with HMR
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Backend Commands (Firebase Functions)

```bash
# Local emulation
npm run serve

# Interactive shell
npm run shell

# Deploy to Firebase
npm run deploy

# View function logs
npm run logs
```

## 📁 Project Structure

```
sermon-audio-app/
├── src/                   # Frontend source
│   ├── components/        # React components
│   ├── pages/            # Page components
│   ├── lib/              # Utilities and Firebase config
│   ├── App.jsx           # Main app component
│   └── main.jsx          # Entry point
├── functions/             # Cloud Functions backend
│   ├── index.js          # Function entry points
│   └── package.json      # Function dependencies
├── public/               # Static assets
├── index.html            # HTML template
├── vite.config.js        # Vite configuration
├── firebase.json         # Firebase configuration
├── .firebaserc           # Firebase project config
└── package.json          # Dependencies
```

## 🔐 Authentication

Firebase Authentication handles:
- Email/password login
- User session management
- Protected sermon content
- User profile management

## 💾 Firebase Services Used

- **Realtime Database** - Sermon metadata and user activity
- **Cloud Storage** - Audio file storage
- **Cloud Functions** - Backend logic (sermon processing, analytics)
- **Authentication** - User management

## 📊 Analytics

The dashboard displays:
- Total sermons listened to
- Average listening duration
- Top speakers and series
- Recent activity
- Engagement trends

## 🌐 PWA Features

- **Offline Support** - Listen to downloaded sermons offline
- **Install Prompt** - Add to home screen on mobile
- **App Shell** - Fast loading and app-like experience

## 🎨 UI/UX

- Clean, modern interface
- Responsive design (mobile-first)
- Dark mode support
- Intuitive navigation
- Fast page transitions

## 🧪 Testing

Currently no automated tests configured. Contributions welcome!

## 📝 Code Quality

- **Linting**: ESLint for code consistency
- **Formatting**: Vite + standard JavaScript

## 🚀 Deployment

### Frontend (Vercel)
The app is configured for deployment on Vercel:
```bash
npm run build
# Push to GitHub and connect to Vercel
```

### Backend (Firebase)
```bash
cd functions
firebase deploy --only functions
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

Open source - See LICENSE file for details

## 📞 Support

For issues or questions, please open an issue on GitHub.

## 🔄 Version

Current version: 1.0.0

---

**Live at**: https://sermon-audio-app.vercel.app
**Last Updated**: June 2026
