# 🏴‍☠️ Luffy CLI - AI-Powered CLI Tool

An AI-powered command-line interface inspired by One Piece. Set sail, automate tasks, and conquer the Grand Line of code!

## 📁 Project Structure

```
24_CLI/
├── client/          # Next.js frontend for OAuth device flow
│   ├── app/
│   │   ├── (auth)/sign-in/   # Sign-in page
│   │   ├── approve/          # Device approval page
│   │   └── device/           # Device code entry page
│   ├── components/           # UI components (shadcn/ui)
│   └── lib/                  # Utilities & auth client
│
└── server/          # Backend & CLI
    ├── src/
    │   ├── cli/
    │   │   ├── main.js       # CLI entry point
    │   │   └── commands/
    │   │       └── auth/     # Authentication commands
    │   │           ├── login.js
    │   │           ├── logout.js
    │   │           └── whoami.js
    │   └── lib/
    │       ├── auth.js       # Better Auth configuration
    │       ├── db.js         # Prisma database client
    │       └── token.js      # Token management utilities
    └── prisma/               # Database schema & migrations
```

## 🚀 Features

### CLI Commands

| Command | Description |
|---------|-------------|
| `luffy login` | Authenticate using OAuth Device Flow |
| `luffy logout` | Log out and clear stored credentials |
| `luffy whoami` | Display current authenticated user |

### OAuth Device Flow

The CLI uses the OAuth 2.0 Device Authorization Grant flow:

1. Run `luffy login`
2. A unique device code is generated
3. Browser opens automatically to the authorization page
4. Enter the code and approve the device
5. CLI receives the access token and stores it securely

## 🛠️ Tech Stack

### Client (Frontend)
- **Next.js 16** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **Better Auth Client** - Authentication

### Server (Backend & CLI)
- **Node.js** - Runtime
- **Better Auth** - Authentication server
- **Prisma** - Database ORM
- **Commander.js** - CLI framework
- **@clack/prompts** - Beautiful CLI prompts
- **Chalk** - Terminal styling

## 📦 Installation

### Prerequisites
- Node.js 18+
- PostgreSQL (or your preferred database)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Abhay-0103/AI-Powered-CLI.git
   cd AI-Powered-CLI
   ```

2. **Install dependencies**
   ```bash
   # Client
   cd client
   npm install

   # Server
   cd ../server
   npm install
   ```

3. **Configure environment variables**
   
   Create `.env` file in the server directory:
   ```env
   DATABASE_URL="your-database-url"
   GITHUB_CLIENT_ID="your-github-client-id"
   GITHUB_CLIENT_SECRET="your-github-client-secret"
   BETTER_AUTH_SECRET="your-secret-key"
   ```

4. **Run database migrations**
   ```bash
   cd server
   npx prisma migrate dev
   ```

5. **Start the development servers**
   ```bash
   # Terminal 1 - Client
   cd client
   npm run dev

   # Terminal 2 - Server
   cd server
   npm run dev
   ```

## 🔐 Authentication Flow

```
┌─────────┐                 ┌─────────┐                 ┌─────────┐
│   CLI   │                 │ Server  │                 │ Client  │
└────┬────┘                 └────┬────┘                 └────┬────┘
     │                           │                           │
     │ 1. Request device code    │                           │
     │──────────────────────────>│                           │
     │                           │                           │
     │ 2. Return code + URL      │                           │
     │<──────────────────────────│                           │
     │                           │                           │
     │ 3. Open browser           │                           │
     │───────────────────────────────────────────────────────>
     │                           │                           │
     │                           │    4. User enters code    │
     │                           │<──────────────────────────│
     │                           │                           │
     │                           │    5. User approves       │
     │                           │<──────────────────────────│
     │                           │                           │
     │ 6. Poll for token         │                           │
     │──────────────────────────>│                           │
     │                           │                           │
     │ 7. Return access token    │                           │
     │<──────────────────────────│                           │
     │                           │                           │
     │ 8. Store token locally    │                           │
     └───────────────────────────┘                           │
```


## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/Abhay-0103">Abhay Singh</a>
</p>
