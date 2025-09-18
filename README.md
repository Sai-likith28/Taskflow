# Here are your Instructions
# TaskFlow - AI-Powered Workflow Automation Tool

TaskFlow is a simple task management and workflow automation tool with AI-powered summaries and prioritization.  
The project contains a **FastAPI backend** and a **React frontend**.

---

## 🚀 Run Instructions (Windows PowerShell)

### Prerequisites

- **MongoDB** running locally (or MongoDB Atlas URI)
- **Python 3.10+** with pip
- **Node.js 18+** with npm

---

### 1) Backend (API)

Create a `.env` file:

```powershell
cd taskflow/backend
"MONGO_URL=mongodb://127.0.0.1:27017`nDB_NAME=taskflow`nCORS_ORIGINS=*" | Out-File -Encoding ascii .env -Force

##Install dependencies and run:

python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m uvicorn server:app --host 127.0.0.1 --port 8000 --reload


##Backend API will be available at:
👉 http://127.0.0.1:8000/api

Optional: enable cloud AI (paid by provider):

##Edit backend/.env and add
EMERGENT_LLM_KEY=<your_api_key>

###2) Frontend (React)

##Configure backend URL:

cd taskflow/frontend
"REACT_APP_BACKEND_URL=http://127.0.0.1:8000" | Out-File -Encoding ascii .env -Force


##Install and run:

npm install --legacy-peer-deps --no-fund --no-audit
npm start


##Frontend app will be available at:
👉 http://localhost:3000

###3) Common Issues

##401 Unauthorized: clear token and re-login

// In browser DevTools console
localStorage.removeItem("token");


Changed backend env: restart the backend process

MongoDB not running: start MongoDB service or update MONGO_URL"# Taskflow" 
"# Taskflow" 
