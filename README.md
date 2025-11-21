# BINA|studio (Lightweight web code editor)

BINA|studio is a small, responsive, accessible web-based code editor demo built with plain HTML5, CSS3, and JavaScript (ES6+). It's inspired by VSCode layout but intentionally uses a custom glassmorphism aesthetic.

Features
- VSCode-like layout: sidebar, explorer, tabs, status bar.
- Glassmorphism-inspired design with vibrant accents.
- Basic editing features: line numbers, auto-indent, Tab → spaces, syntax highlighting for HTML/CSS/JS.
- File explorer with collapsible folders and clickable files (sample project tree).
- Responsive: works on desktop and mobile (sidebar becomes overlay).
- Accessibility: semantic HTML, ARIA roles, keyboard focus states.
- Lightweight: no heavy libraries, only Google Fonts.

Files
- index.html — application shell and markup
- styles.css — UI and theme
- app.js — editor logic (file tree, tabs, highlighting, auto-indent)

How to run
1. Open `index.html` in any modern browser (Chrome, Firefox, Edge).
2. The editor is fully client-side and requires no build step.

Notes
- Syntax highlighting is regex-based and lightweight — perfect for demos but not a replacement for full parsers (like Prism/CodeMirror/Monaco).
- The project is intentionally dependency-minimal to prioritize fast load and simple customization.

License: MIT
