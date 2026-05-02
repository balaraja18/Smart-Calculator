# CALC∞ — Smart Calculator Web App

A beautiful, full-stack calculator with glassmorphism UI, scientific mode, history, graph plotting, and voice input.

---

## 🗂 Project Structure

```
smart-calculator/
├── frontend/
│   ├── index.html      # Main app
│   ├── style.css       # Glassmorphism dark/light UI
│   └── app.js          # Calculator logic + API integration
├── backend/
│   ├── app.py          # Flask REST API
│   └── requirements.txt
├── database/
│   └── calculator.db   # SQLite (auto-created)
└── README.md
```

---

## 🚀 Setup & Run

### 1. Install Python dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Start the Flask backend

```bash
python app.py
```

> The server starts at **http://localhost:5000**

### 3. Open the frontend

Open `frontend/index.html` directly in your browser, OR use a simple HTTP server:

```bash
# Python
python -m http.server 3000 --directory frontend

# Node (npx)
npx serve frontend
```

Then visit **http://localhost:3000**

---

## ✨ Features

| Feature | Details |
|---|---|
| Standard Calculator | +, −, ×, ÷, %, ±, decimal |
| Scientific Mode | sin, cos, tan, log, √, x², xⁿ, π, e, abs, ceil, floor, 1/x |
| Dark / Light Theme | Persisted in localStorage |
| Live Preview | Shows result as you type |
| Calculation History | Stored in SQLite via REST API |
| Export History | Downloads as CSV |
| Graph Plotter | Plots any expression in x |
| Voice Input | Web Speech API (Chrome / Edge) |
| Keyboard Support | Full keyboard input (0-9, operators, Enter, Backspace, Esc) |

---

## 🔌 REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/calculate` | Evaluate expression & save |
| GET | `/api/history` | Get calculation history |
| DELETE | `/api/history` | Clear all history |
| DELETE | `/api/history/<id>` | Delete one entry |
| GET | `/api/export` | Download history as CSV |

### POST /api/calculate

**Request:**
```json
{ "expression": "sin(30) + sqrt(16)" }
```

**Response:**
```json
{ "expression": "sin(30) + sqrt(16)", "result": "4.988" }
```

---

## 🎹 Keyboard Shortcuts

| Key | Action |
|---|---|
| `0-9`, `.` | Input digits |
| `+`, `-`, `*`, `/` | Operators |
| `Enter` or `=` | Calculate |
| `Backspace` | Delete last character |
| `Escape` | Clear all |
| `p` | Insert π |

---

## 📊 Graph Plotter

Click the **Graph** button and enter any expression using `x`, for example:
- `x**2`
- `sin(x)`
- `x**3 - 2*x + 1`
- `1/x`

---

## 🎙 Voice Input

Click **Voice** → **Start**, then say something like:
- *"two plus three"*
- *"sine of ninety"*
- *"square root of sixteen"*
- *"five times four divided by two"*

> Requires Chrome or Edge (Web Speech API).

---

## 🛠 Tech Stack

- **Frontend**: HTML5 · CSS3 (glassmorphism) · Vanilla JS
- **Backend**: Python 3 · Flask · Flask-CORS
- **Database**: SQLite (via Python `sqlite3`)
- **Fonts**: Space Mono · Syne (Google Fonts)
