# Resume Master

An AI-powered resume tailoring and job application management platform. Resume Master helps job seekers automatically customize their resumes and generate cover letters for specific job postings using LLM intelligence — while maintaining truthfulness and never fabricating experience.

## Features

- **AI Resume Tailoring** — Analyzes job descriptions and intelligently rewrites resume bullets to match requirements, adding action verbs and quantified impacts
- **Cover Letter Generation** — Creates professional, tailored cover letters for each application
- **Skills Categorization** — Auto-groups skills into logical categories aligned with the target role
- **Batch Applications** — Apply to multiple jobs at once with individually tailored documents
- **Duplicate Detection** — Prevents wasted generations on reposted or similar roles
- **Cross-Profile Learning** — References past applications to maintain consistency across profiles
- **Document Export** — Generates downloadable DOCX and PDF files
- **Profile Sharing** — Share professional profiles with other users for collaboration
- **Knowledge Base** — Admins can define custom guidelines injected into all AI prompts
- **Cost Tracking** — Monitors token usage and calculates cost per application
- **Multi-Provider AI** — Supports OpenAI, Azure OpenAI, Anthropic Claude, and Google Gemini
- **Admin Dashboard** — User approval, AI model configuration, pricing management, and analytics

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI, SQLAlchemy, Alembic, Uvicorn |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Database | MySQL 8.0 |
| AI/LLM | OpenAI, Azure OpenAI, Anthropic, Google Gemini |
| Auth | JWT (python-jose), bcrypt |
| Documents | python-docx, LibreOffice (PDF conversion) |
| Deployment | Docker, Docker Compose |

## Project Structure

```
Resume-Master/
├── backend/
│   ├── main.py                # FastAPI app entry point
│   ├── config.py              # Environment configuration
│   ├── database.py            # SQLAlchemy setup
│   ├── auth.py                # JWT & password utilities
│   ├── models/                # ORM models
│   ├── routers/               # API route handlers
│   ├── services/              # Business logic (AI, DOCX, PDF)
│   ├── schemas/               # Pydantic request/response models
│   ├── alembic/               # Database migrations
│   ├── uploads/               # Generated files
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/             # Page components
│   │   ├── components/        # Reusable UI components
│   │   ├── api/               # API client modules
│   │   ├── types/             # TypeScript interfaces
│   │   └── hooks/             # Custom React hooks
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

## Prerequisites

- Python 3.11+
- Node.js 20+
- MySQL 8.0+
- (Optional) Docker & Docker Compose
- (Optional) LibreOffice — for PDF conversion

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/your-username/Resume-Master.git
cd Resume-Master
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/resume_master
AZURE_OPENAI_API_KEY=your-key-here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-12-01-preview
UPLOAD_DIR=./uploads
CORS_ORIGINS=http://localhost:5173
JWT_SECRET_KEY=change-me-in-production
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_INPUT_PRICE_PER_1K=0.005
DEFAULT_OUTPUT_PRICE_PER_1K=0.015
```

### 3. Create the MySQL database

```sql
CREATE DATABASE resume_master CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 4. Backend setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 5. Frontend setup

```bash
cd frontend
npm install
```

## Running the Application

### Development Mode

Start the backend and frontend in separate terminals:

```bash
# Terminal 1 — Backend (http://localhost:8000)
cd backend
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — Frontend (http://localhost:5173)
cd frontend
npm run dev
```

### Docker Compose

```bash
docker-compose up --build
```

Both services start automatically:
- Backend: `http://localhost:8000`
- Frontend: `http://localhost:5173`

## API Documentation

Once the backend is running, interactive API docs are available at:

- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create a new account |
| POST | `/api/auth/login` | Login and receive JWT token |
| GET | `/api/profiles` | List user profiles |
| POST | `/api/profiles` | Create a new profile |
| POST | `/api/generate` | Generate tailored resume + cover letter |
| POST | `/api/generate/batch` | Batch generate for multiple jobs |
| GET | `/api/applications` | List past applications |
| GET | `/api/generate/download/{filename}` | Download generated files |
| GET | `/api/admin/stats` | Admin dashboard statistics |

All endpoints except `/auth/register` and `/auth/login` require a JWT Bearer token.

## User Roles

| Role | Description |
|------|-------------|
| **Admin** | Full access — user approval, AI model config, pricing, knowledge base |
| **Bidder** | Create profiles, generate and download applications |
| **Caller** | View-only access to applications and history |

The first user to register with the username matching `DEFAULT_ADMIN_USERNAME` is automatically promoted to admin.

## AI Provider Configuration

Resume Master supports multiple LLM providers. Configure the active provider through the Admin Dashboard or directly in the database:

| Provider | Required Config |
|----------|----------------|
| Azure OpenAI | API key, endpoint, deployment name, API version |
| OpenAI | API key, model ID |
| Anthropic | API key (direct or Azure AI Foundry) |
| Google Gemini | API key, model ID |

The system supports a **two-tier model** approach:
- **Primary model** — Used for quality-critical tasks (resume tailoring, cover letters)
- **Utility model** — Used for cheaper extraction tasks (company name, duplicate detection)

## Database Migrations

```bash
cd backend

# Generate a new migration after model changes
alembic revision --autogenerate -m "description of changes"

# Apply migrations
alembic upgrade head

# Rollback one step
alembic downgrade -1
```

## License

This project is proprietary. All rights reserved.
