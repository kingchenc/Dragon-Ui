# 🐲 Dragon UI - Ultimate Claude Code Max Usage Dashboard

<p align="center">
  <img src="public/Dragon-Ui.ico" alt="Dragon UI Logo" />
</p>

> **Ultra-fast, cross-platform Claude Code Max usage dashboard with dragon-inspired design, advanced background services, multi-language support, and real-time analytics**

Dragon UI is a high-performance desktop application that provides comprehensive analytics and monitoring for **Claude Code Max** usage with built-in SQLite database, advanced worker architecture, and complete internationalization support. Built with Electron + React + TypeScript for maximum performance and user experience.

![Dragon UI](https://img.shields.io/npm/v/dragon-ui-claude?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSIjN0MzQUVEIi8+Cjwvc3ZnPgo=&label=Dragon%20UI&color=7C3AED)
[![npm](https://img.shields.io/npm/v/dragon-ui-claude?style=for-the-badge&logo=npm&color=CB3837)](https://www.npmjs.com/package/dragon-ui-claude)
[![npm downloads](https://img.shields.io/npm/dt/dragon-ui-claude?style=for-the-badge&logo=npm&color=CB3837)](https://www.npmjs.com/package/dragon-ui-claude)

```bash
npm install -g dragon-ui-claude
```

**Run Dragon UI:**
```bash
# Electron GUI (default)
dragon-ui-claude

# CLI version  
dragon-ui-claude-cli
# or
dragon-ui-claude --cli
```

![Electron](https://img.shields.io/badge/Electron-28.0.0-47848F?style=for-the-badge&logo=electron)
![React](https://img.shields.io/badge/React-18.2.0-61DAFB?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.2.2-3178C6?style=for-the-badge&logo=typescript)
![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?style=for-the-badge&logo=sqlite)

## 📸 Screenshots

<details open>
<summary>🏠 <strong>Dashboard Overview</strong></summary>
<p align="center">
  <img src="public/Overview_Page.png" alt="Dragon UI Overview Page" />
</p>
</details>

<details>
<summary>📊 <strong>Projects Analytics</strong></summary>
<p align="center">
  <img src="public/Projects_Page.png" alt="Dragon UI Projects Page" />
</p>
</details>

<details>
<summary>⚡ <strong>Sessions Monitoring</strong></summary>
<p align="center">
  <img src="public/Sessions_Page.png" alt="Dragon UI Sessions Page" />
</p>
</details>

<details>
<summary>📅 <strong>Monthly Usage Tracking</strong></summary>
<p align="center">
  <img src="public/Monthly_Page.png" alt="Dragon UI Monthly Usage Page" />
</p>
</details>

<details>
<summary>📆 <strong>Daily Usage Analytics</strong></summary>
<p align="center">
  <img src="public/Daily_Page.png" alt="Dragon UI Daily Usage Page" />
</p>
</details>

<details>
<summary>🔴 <strong>Live Session Monitoring</strong></summary>
<p align="center">
  <img src="public/Active_Page.png" alt="Dragon UI Active Session Page" />
</p>
</details>

<details>
<summary>⚙️ <strong>Advanced Settings & Configuration</strong></summary>
<p align="center">
  <img src="public/Settings_Page.png" alt="Dragon UI Settings Page" />
</p>
</details>

## 🚀 Quick Start

### Easy Installation (Recommended)
```bash
# Install globally via npm
npm install -g dragon-ui-claude

# Run Dragon UI (Electron GUI - default)
dragon-ui-claude

# Run CLI version
dragon-ui-claude-cli
# or
dragon-ui-claude --cli

# Or run without installing
npx dragon-ui-claude       # GUI version
npx dragon-ui-claude-cli   # CLI version
npx dragon-ui-claude --cli # CLI version (alternative)
```

> **Why Dragon UI?** The fastest, most comprehensive **Claude Code Max** usage dashboard with real-time analytics, **dual interface options (GUI + CLI)**, multi-language support, and intelligent automation. No configuration needed - just install and run!

## 🚀 Interface Options

### 🖥️ **Dual Interface Options**
- **Electron GUI** - Beautiful desktop application with dragon-inspired design and animations
- **CLI Interface** - Powerful command-line interface for terminal enthusiasts and server environments
- **Same Data** - Both interfaces share the same SQLite database and features
- **Live Updates** - Real-time data synchronization across both interfaces
- **Settings Sync** - Preferences and configurations work across GUI and CLI

### 💻 **CLI Features**
- **Interactive Navigation** - Number-based commands (0-6) for easy page switching
- **Colored Output** - Beautiful terminal colors with monochrome fallback option
- **ASCII Tables** - Professional data presentation with minimal and detailed table styles
- **Live Dashboard** - Real-time updates with configurable refresh intervals (1-60 seconds)
- **Settings Management** - Toggle colors, table styles, and refresh rates on the fly
- **Complete Analytics** - All GUI features available in CLI: Overview, Projects, Sessions, Monthly, Daily, Active
- **Smart Formatting** - Currency, numbers, dates, and durations formatted for terminal display
- **Help System** - Built-in help and navigation assistance

### 🖥️ **GUI Features**
- **Dragon-Inspired Design** - Beautiful dark/light themes with dragon scale patterns and flame effects
- **Real-time Analytics** - Live dashboard with comprehensive usage statistics
- **Multi-Language Support** - 9 languages with instant switching (EN, DE, FR, ES, IT, PT, NL, JA, ZH)
- **Multi-Currency** - 12 currencies with real-time conversion and live exchange rates
- **Advanced Charts** - Activity charts, financial trends, usage patterns with Chart.js
- **Smart Animations** - Smooth transitions with accessibility support and reduce-motion detection
- **Responsive Layout** - Adapts beautifully to different screen sizes and orientations

## ✨ Features

### 🏆 **Advanced Architecture**
- **SQLite Database** - Lightning-fast local database with advanced queries and caching
- **Worker Thread Processing** - Heavy calculations in separate threads for smooth UI
- **Background Data Collector** - Smart async data fetching with user-configurable intervals
- **RAM Cache Service** - Ultra-fast in-memory data storage (<1ms access)
- **Smart Intervals** - User-defined refresh rates (30s to 1h)
- **Concurrent Processing** - Parallel data updates for maximum performance

### 🚀 **Intelligent Setup & Performance**
- **Smart Rebuild Caching** - Avoids unnecessary native module rebuilds (10x faster startup)
- **Auto-Detection System** - Automatically detects when rebuilds are actually needed
- **Dual Cache Strategy** - Separate caches for development and production environments
- **Version-Aware Rebuilds** - Only rebuilds when Electron version changes
- **Zero-Config Setup** - Works out of the box with intelligent fallbacks
- **Background Optimization** - Cache management happens transparently

### 🌍 **Multi-Language Support**
- **9 Languages Supported** - English, German, French, Spanish, Italian, Portuguese, Dutch, Japanese, Chinese
- **Live Language Switching** - Change language instantly without restart
- **Complete Translation** - Every UI element, page, and feature fully translated
- **Dynamic Loading** - Languages loaded on demand for optimal performance

### 💰 **Multi-Currency Support**
- **12 Currencies Supported** - USD, EUR, GBP, JPY, CHF, CAD, AUD, CNY, KRW, INR, BRL, MXN
- **Real-time Exchange Rates** - Live conversion with 5 API fallbacks
- **Auto-Update** - Background currency rate updates

### 🌍 **Global Timezone Support**
- **8 Timezones Supported** - Auto, UTC, EST, PST, GMT, CET, JST, AEST
- **Auto-Detection** - Automatically uses system timezone
- **Live Time Display** - Real-time clock with selected timezone
- **12h/24h Format** - Customizable time format preference

### 📊 **Comprehensive Analytics Dashboard**
- **Real-time cost tracking** - Monitor current period expenses with live updates
- **Session usage metrics** - Track active and historical sessions with detailed breakdowns
- **Daily usage trends** - Beautiful charts showing usage patterns with chronological sorting
- **Project breakdown** - Per-project cost analysis with intelligent project grouping
- **Billing cycle tracking** - Custom billing periods with accurate cost attribution

### 📊 **Complete Dashboard Analytics**
- **Overview** - Cost statistics, active days, models used, real-time activity tracking
- **Projects** - Project-wise cost breakdown with smart folder detection and custom paths
- **Sessions** - Active session monitoring, detailed history, token burn rate analysis
- **Monthly** - Month-over-month trends, budget planning, billing cycle support
- **Daily** - Granular daily breakdown, activity rates, pattern recognition
- **Active Session** - Live session tracking with duration and performance metrics

### 💾 **Database Management**
- **SQLite Integration** - Fast, reliable local database storage
- **Database Operations** - Clear, refresh, and manage your data easily
- **Data Export** - Export usage data in CSV or JSON formats for analysis
- **Lightning-fast Queries** - Optimized SQL for instant results
- **Data Integrity** - ACID compliance with transaction support

### 🐲 **Dragon-Inspired Design System**
- **Dual themes** - Dark mode and light mode with system preference detection
- **Dragon aesthetics** - Subtle dragon scale patterns and flame effects
- **Advanced animations** - Smooth transitions with comprehensive disable option
- **Compact mode** - Space-efficient layout for smaller screens
- **Accessibility** - `prefers-reduced-motion` support and high contrast modes
- **Responsive Design** - Adapts beautifully to different screen sizes

### ⚡ **Technical Excellence**
- **Built-in Analytics** - Direct Claude usage tracking, no external dependencies
- **Cross-platform** - Windows, macOS, Linux support via Electron
- **Ultra-fast startup** - Background services with preload optimization
- **Type-safe** - Full TypeScript implementation with strict typing
- **Real-time updates** - Live data streaming without page refreshes
- **Worker Architecture** - Heavy computations in background threads

### ⚙️ **Advanced Configuration**
- **Multi-Language:** 9 languages with live switching (EN, DE, FR, ES, IT, PT, NL, JA, ZH)
- **Multi-Currency:** 12 currencies with real-time conversion (USD, EUR, GBP, JPY, etc.)
- **Global Timezones:** 8 supported zones with live clock (Auto, UTC, EST, PST, GMT, CET, JST, AEST)
- **Appearance:** Dark/light themes, compact mode (50%-100% scale), animations, dragon effects, dev tools toggle
- **Billing & Refresh:** Custom billing cycles, auto-refresh intervals (30s-1h)
- **Project Management:** Claude project detection, custom paths, SSH support
- **Data Tools:** Modern database dialogs, CSV/JSON export, backup capabilities

### 🚀 **Performance & Setup**
- **Auto-Setup:** Zero-config installation with intelligent native module rebuilds
- **Ultra-Fast:** <3s startup, <1ms data access, ~80MB memory usage
- **Technology:** React 18 + TypeScript + Vite + SQLite + Electron 28
- **Smart Caching:** 10x faster startup after first installation

## 🛠️ Development & Troubleshooting

### Development Setup
```bash
# Clone and setup
git clone https://github.com/KingchenC/dragon-ui
cd dragon-ui && npm install

# Development - GUI
npm run dev          # Vite dev server
npm run electron     # Launch Electron

# Development - CLI
node cli/index.cjs   # Test CLI directly
npm run start        # Build and run GUI
dragon-ui-claude-cli # Test CLI after install

# Building & Distribution
npm run build        # Production build
npm run dist         # Create installer/DMG/AppImage

# CLI Testing Commands
node cli/index.cjs --help     # Show CLI help
node cli/index.cjs --no-color # Test without colors
node cli/index.cjs --minimal  # Test minimal tables
```

### System Requirements
- **Node.js:** 18+ (20+ recommended)
- **OS:** Windows 10/11, macOS 10.14+, Ubuntu 18.04+
- **Memory:** 2GB RAM minimum

### Troubleshooting
Dragon UI includes **intelligent auto-repair** for common issues:
- ✅ **Native modules** - Auto-detects and rebuilds when needed
- ✅ **Dependencies** - Automatically installs missing modules
- ✅ **Build issues** - Auto-builds on first run
- ✅ **Startup optimization** - Smart caching prevents unnecessary rebuilds

**Manual fix:** `npm install -g dragon-ui-claude@latest`


## 🤝 Contributing

Dragon UI is open-source and welcomes contributions! Whether you're fixing bugs, adding features, or improving translations, every contribution matters.

**Quick Start:**
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

Check out our [open issues](https://github.com/KingchenC/dragon-ui/issues) to get started!

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with inspiration from the amazing Claude development community
- [Electron](https://electronjs.org/) - Fantastic cross-platform desktop framework
- [React](https://reactjs.org/) - Modern UI framework
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [SQLite](https://sqlite.org/) - Reliable, fast local database

---

**Built with 🐲 and ❤️ by KingchenC**

*Ultra-fast Claude Code Max Usage Dashboard • Cross-platform • Multi-language • Database-powered*

<p align="center">
  <img src="public/Dragon-Ui.jpeg" alt="Dragon UI Footer" />
</p>
