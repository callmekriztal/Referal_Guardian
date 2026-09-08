# 🛡️ Referral Guardian

> **AI-Powered Special Education Referral Continuity & Statutory IDEA Compliance Agent**  
> *Built with pride by Team **Meridian*** 🚀

[![License: MIT](https://img.shields.io/badge/License-MIT-indigo.svg)](https://opensource.org/licenses/MIT)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![LangGraph](https://img.shields.io/badge/LangGraph-Agentic%20Workflow-FF6F00.svg)](https://langchain-ai.github.io/langgraph/)
[![Next.js](https://img.shields.io/badge/Next.js-16%20(App%20Router)-black.svg?logo=next.js&logoColor=white)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20Sync-3ECF8E.svg?logo=supabase&logoColor=white)](https://supabase.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4+-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)

---

## 👥 Built by Team **Meridian**

| Contributor | GitHub Profile | Role |
| :--- | :--- | :--- |
| **Celeste / Kriztal** | [@callmekriztal](https://github.com/callmekriztal) | Lead Developer & System Architect |
| **Aryan Nair** | [@ari2387q](https://github.com/ari2387q) | Core Contributor & AI Agent Engineering |
| **Arun Mathews** | [@arun-mathews](https://github.com/arun-mathews) | Core Contributor & Full-Stack Development |

---

## 📌 Executive Summary & The Problem

### **The Special Education Crisis & The 20-Day Statutory Cliff**
Under the federal **Individuals with Disabilities Education Act (IDEA Part B)** and state administrative codes, public school districts are legally mandated to evaluate a student suspected of having a disability and convene an **Individualized Education Program (IEP)** eligibility meeting within a strict statutory window—typically **20 school/calendar days**.

### **The Silent Referral Blackhole**
In public school districts across the country, Special Education (SPED) Referral Coordinators juggle **40–80 concurrent evaluations** across multiple campuses. A single unreturned email from an external Speech-Language Pathologist, a missing parental consent form, or an unavailable psychologist silently halts the referral. 

- **Child Harm**: Children lose formative months of speech therapy, behavioral intervention, and dyslexia support during critical early developmental windows.
- **District Legal Liability**: Missing the statutory 20-day deadline constitutes a denial of Free Appropriate Public Education (FAPE), exposing school districts to state compliance sanctions, mandatory compensatory education, and costly **Due Process litigation ($20k–$100k+ per case)**.
- **Current Reality**: Coordinators manually track dates across giant spreadsheets and send panicked follow-up emails *after* the legal deadline has already been breached.

---

## 💡 The Solution: Referral Guardian

**Referral Guardian** is an active, closed-loop AI agentic continuity platform that ensures special education referrals never stall, statutory deadlines are strictly met, and clinical diagnostic workflows proceed with human-in-the-loop validation.

```
                  ┌─────────────────────────────────────────────────────────┐
                  │          REFERRAL GUARDIAN AGENTIC WORKFLOW             │
                  └─────────────────────────────────────────────────────────┘
                                               │
                                               ▼
                                      ┌─────────────────┐
                                      │   1. Observe    │ ── Pull Case State & Timeline
                                      └─────────────────┘
                                               │
                                               ▼
                                      ┌─────────────────┐
                                      │  2. Bottleneck  │ ── Deterministic 20-Day Statutory Rules
                                      │    Detection    │    (No Hallucinations)
                                      └─────────────────┘
                                               │
                                               ▼
                                      ┌─────────────────┐
                                      │  3. AI Reason   │ ── Propose Bounded Next Action
                                      │     (LLM)       │    with Evidence & Confidence
                                      └─────────────────┘
                                               │
                                               ▼
                                      ┌─────────────────┐
                              ┌────── │ 4. HITL Approval│ ── LangGraph interrupt()
                              │       │   (Coordinator) │    [Approve / Modify / Reject]
                              │       └─────────────────┘
                      Reject  │                │ Approve / Modify
                              ▼                ▼
                           [ END ]    ┌─────────────────┐
                                      │  5. Execute     │ ── Controlled Side-Effects Executor
                                      └─────────────────┘
                                               │
                                               ▼
                                      ┌─────────────────┐
                                      │   6. Verify     │ ── Automated Verification Loop
                                      └─────────────────┘
                                               │
                                               ▼
                                            [ END ]
```

---

## ✨ Key Features & Technical Highlights

### 1. ⏱️ 100% Deterministic Statutory Bottleneck Sentry
The agent enforces deterministic Python logic (no generative hallucinations for legal compliance) to flag bottlenecks:
- **`APPOINTMENT_DELAYED`**: Triggered when a case reaches or exceeds Day 20 without determination.
- **`NO_SPECIALIST_RESPONSE`**: Clinician contacted but no response logged within target window.
- **`SPECIALIST_UNAVAILABLE`**: Assigned specialist marked as unavailable.
- **`MISSING_DOCUMENT`**: Required parent consent or physician records pending.
- **`REPEATED_FAILURE`**: $\ge 3$ failed outreach attempts, automatically triggering escalation recommendations.

### 2. 🤖 Human-in-the-Loop (HITL) LangGraph Agent
- Built as a stateful cyclic LangGraph workflow with `interrupt()`.
- The AI synthesizes case timeline context and recommends the single best operational action (e.g. `CONTACT_SPECIALIST`, `FIND_ALTERNATIVE_SPECIALIST`, `REQUEST_DOCUMENT`, `ESCALATE_CASE`).
- **Full Coordinator Agency**: Coordinators retain 100% oversight—they can **Approve**, **Modify** (override proposed action), or **Reject** with custom notes before any side-effect executes.

### 3. 🩺 Clinical Specialist Diagnostic Portal (`/educator`)
- Dedicated interface for licensed specialists (Speech Pathologists, School Psychologists, OTs) to review assigned referrals, log diagnostic findings, and toggle clinical availability (`AVAILABLE` / `UNAVAILABLE`).

### 4. 🔄 Automatic Closed-Loop Recovery
- When a specialist logs their diagnostic assessment, the backend **automatically resets the statutory timer back to Day 0 intake**, clears all overdue bottleneck flags, and transitions the case status back to **`ACTIVE`**.

### 5. ⚡ Statutory 20-Day IDEA Timeline Simulator (Time-Warp Engine)
- An interactive simulator embedded directly in the case header allowing judges, coordinators, and testers to accelerate case aging in seconds:
  - **`+5 Days`**: Advances timeline to Day 5.
  - **`+15 Days`**: Advances timeline to Day 15 (Amber compliance warning).
  - **`+21 Days (Overdue)`**: Advances past the 20-day limit, immediately triggering statutory breach detection (`APPOINTMENT_DELAYED`).
  - **`Reset to Day 0`**: Restores the case timeline back to intake date.

### 6. 📜 Immutable Audit Trail & Provenance
- Every recommendation, approval, coordinator override, diagnostic note, and verification result is permanently logged to both SQLite and Supabase PostgreSQL for compliance audits.

---

## 🛠️ Architecture & Tech Stack

| Layer | Technologies Used | Purpose |
| :--- | :--- | :--- |
| **Frontend** | Next.js 16 (App Router), TypeScript, Tailwind CSS, Lucide React | Modern, responsive SPED coordinator dashboard & educator portal |
| **Agentic Framework** | LangGraph, LangChain Core | Cyclic state graph orchestrating observation, reasoning, interrupts, and verification loops |
| **Backend API** | FastAPI, Pydantic v2, Uvicorn | High-performance asynchronous REST API |
| **Database & ORM** | SQLAlchemy, SQLite (Local), Supabase PostgreSQL (Cloud Sync) | Transactional data persistence and multi-client real-time synchronization |
| **AI / LLMs** | OpenRouter (Llama 3.3 70B Instruct), OpenAI (GPT-4o-mini), Mock Provider | Operational reasoning and structured JSON recommendation synthesis |

---

## 📂 Project Structure

```
Referal_Guardian/
├── backend/
│   ├── app/
│   │   ├── agent/
│   │   │   ├── actions.py           # Whitelisted controlled action set
│   │   │   ├── bottleneck.py        # Deterministic statutory bottleneck detection
│   │   │   ├── checkpointer.py      # LangGraph checkpointer memory store
│   │   │   ├── graph.py             # LangGraph StateGraph definition
│   │   │   ├── nodes.py             # Observe, reason, approval, execute & verify nodes
│   │   │   ├── reasoning.py         # LLM reasoning & prompt engineering
│   │   │   ├── state.py             # TypedDict ReferralState schema
│   │   │   └── verification.py      # Automated post-action verification rules
│   │   ├── models/
│   │   │   ├── database.py          # SQLAlchemy engine & session maker
│   │   │   └── models.py            # Case, Specialist, Event, AgentRun, Recommendation models
│   │   ├── services/
│   │   │   ├── action_executor.py   # Side-effect execution layer
│   │   │   ├── case_service.py      # Data access layer & timeline management
│   │   │   └── supabase_client.py   # Supabase cloud synchronization client
│   │   ├── main.py                  # FastAPI application & endpoint routing
│   │   └── seed.py                  # Synthetic clinical demo scenarios
│   ├── tests/                       # Unit & integration test suite
│   ├── pyproject.toml               # Python dependencies
│   └── .env                         # Backend environment variables
├── frontend/
│   ├── app/
│   │   ├── cases/[id]/page.tsx      # Comprehensive Case Detail & LangGraph HITL interface
│   │   ├── educator/page.tsx        # Specialist Diagnostic Assessment Portal
│   │   ├── login/page.tsx           # Authentication portal
│   │   ├── signup/page.tsx          # Account registration
│   │   ├── layout.tsx               # Root layout & role navigation provider
│   │   └── page.tsx                 # Coordinator Dashboard with live KPI counters
│   ├── components/
│   │   ├── HeaderNav.tsx            # Global navigation header
│   │   └── RouteGuard.tsx           # Role-based access control guard
│   ├── lib/
│   │   └── AuthContext.tsx          # Client-side authentication context
│   ├── package.json                 # Next.js dependencies
│   └── tailwind.config.ts           # Tailwind CSS theme configuration
└── README.md                        # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
- **Python 3.11+**
- **Node.js 18+** & **npm**

---

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -e .

# Configure environment variables
cp .env.example .env
# Edit .env with your keys (optional: OPENAI_API_KEY, OPENROUTER_API_KEY, SUPABASE_URL, SUPABASE_KEY)

# Start FastAPI backend server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
The backend will be live at: **`http://localhost:8000`** (Swagger docs at `http://localhost:8000/docs`).

---

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Start Next.js development server
npm run dev
```
The web dashboard will be live at: **`http://localhost:3000`**.

---

## 📡 Key REST API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/dashboard` | Returns real-time KPI metrics (active, stuck, pending actions, escalations) |
| `GET` | `/api/cases` | Lists all referral cases with age, specialist assignment, and bottleneck flags |
| `POST` | `/api/cases` | Initiates a new special education referral case |
| `GET` | `/api/cases/{case_id}` | Fetches full case details and complete chronological timeline |
| `POST` | `/api/cases/{case_id}/fast-forward` | **Time-Warp Simulator**: fast-forwards or resets case age (`{ "days": 21 }`) |
| `POST` | `/api/cases/{case_id}/agent/run` | Triggers the LangGraph agent to evaluate the case and pause for approval |
| `POST` | `/api/cases/{case_id}/agent/approve` | Approves pending AI recommendation and resumes graph execution |
| `POST` | `/api/cases/{case_id}/agent/modify` | Overrides recommended action and executes modified action |
| `POST` | `/api/cases/{case_id}/agent/reject` | Rejects recommendation and terminates current run |
| `POST` | `/api/cases/{case_id}/diagnostics` | Specialist endpoint: submits diagnostic findings and resets timeline |
| `GET` | `/api/specialists` | Lists active specialists with availability status and next opening |

---

## 🎯 Demo Walkthrough Script (for Evaluators & Judges)

1. **Intake**: Open the Coordinator Dashboard at `http://localhost:3000` and click **"New Referral Case"** to create student `stu-rit-5001`.
2. **Statutory Time-Warp**: Open the case and click **`+21 Days (Overdue)`** in the Statutory 20-Day Simulator. The case age updates to 21 days and flags `APPOINTMENT_DELAYED`.
3. **Agent Evaluation**: Click **"Run Referral Guardian AI"**. LangGraph evaluates the overdue statutory breach and recommends **`CONTACT_SPECIALIST`** with 95% confidence.
4. **Coordinator Approval**: Click **"APPROVE ACTION"**. The agent executes the outreach side-effect and verifies it on the immutable timeline.
5. **Specialist Diagnostic Submission**: Open the **Special Educator Portal** (`/educator`), locate the referral, and submit diagnostic evaluation findings.
6. **Automatic Recovery**: Return to the case. The bottleneck is cleared, status is restored to **`ACTIVE`**, and the 20-day countdown timer **reverts back to Day 0**.

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <sub>Built with ❤️ by Team <b>Meridian</b> for seamless special education continuity.</sub>
</div>
