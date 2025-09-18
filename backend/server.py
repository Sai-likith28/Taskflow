from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
import uuid
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
# Optional AI integration. If the library isn't available, we provide a noop fallback
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage  # type: ignore
    _AI_AVAILABLE = True
except Exception:  # ImportError or any other issue should not block the API
    _AI_AVAILABLE = False

    class _NoopChat:  # minimal fallback used only when the integration is missing
        def __init__(self, *args, **kwargs):
            pass

        def with_model(self, *_args, **_kwargs):
            return self

        async def send_message(self, _msg):
            return "AI integration disabled"

    class _NoopUserMessage:
        def __init__(self, text: str):
            self.text = text

    # Fallback aliases to keep the rest of the code unchanged
    LlmChat = _NoopChat  # type: ignore
    UserMessage = _NoopUserMessage  # type: ignore

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = "your-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

security = HTTPBearer()

# AI Configuration
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

# Create the main app without a prefix
app = FastAPI(title="TaskFlow API", description="AI-Powered Workflow Automation Tool")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Auth Models
class UserBase(BaseModel):
    email: EmailStr
    full_name: str

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    full_name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Token(BaseModel):
    access_token: str
    token_type: str

# Task Models
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: str = "pending"  # pending, in_progress, completed
    priority: str = "medium"  # low, medium, high
    due_date: Optional[datetime] = None

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    desc
    ription: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[datetime] = None

class Task(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: Optional[str] = None
    status: str = "pending"
    priority: str = "medium"
    due_date: Optional[datetime] = None
    user_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Auth utilities
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"email": email})
    if user is None:
        raise credentials_exception
    return User(**user)

# Auth endpoints
@api_router.post("/auth/register", response_model=Token)
async def register(user: UserCreate):
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    hashed_password = get_password_hash(user.password)
    user_dict = user.dict()
    del user_dict["password"]
    user_obj = User(**user_dict)
    user_data = user_obj.dict()
    user_data["hashed_password"] = hashed_password
    
    await db.users.insert_one(user_data)
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@api_router.post("/auth/login", response_model=Token)
async def login(user_credentials: UserLogin):
    user = await db.users.find_one({"email": user_credentials.email})
    if not user or not verify_password(user_credentials.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["email"]}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@api_router.get("/auth/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

# Task endpoints
@api_router.post("/tasks", response_model=Task)
async def create_task(task: TaskCreate, current_user: User = Depends(get_current_user)):
    task_dict = task.dict()
    task_obj = Task(**task_dict, user_id=current_user.id)
    await db.tasks.insert_one(task_obj.dict())
    return task_obj

@api_router.get("/tasks", response_model=List[Task])
async def get_tasks(current_user: User = Depends(get_current_user)):
    tasks = await db.tasks.find({"user_id": current_user.id}).to_list(1000)
    return [Task(**task) for task in tasks]

@api_router.get("/tasks/{task_id}", response_model=Task)
async def get_task(task_id: str, current_user: User = Depends(get_current_user)):
    task = await db.tasks.find_one({"id": task_id, "user_id": current_user.id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return Task(**task)

@api_router.put("/tasks/{task_id}", response_model=Task)
async def update_task(task_id: str, task_update: TaskUpdate, current_user: User = Depends(get_current_user)):
    # Find existing task
    existing_task = await db.tasks.find_one({"id": task_id, "user_id": current_user.id})
    if not existing_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Update only provided fields
    update_data = {}
    for field, value in task_update.dict(exclude_unset=True).items():
        update_data[field] = value
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc)
        await db.tasks.update_one(
            {"id": task_id, "user_id": current_user.id},
            {"$set": update_data}
        )
    
    # Return updated task
    updated_task = await db.tasks.find_one({"id": task_id, "user_id": current_user.id})
    return Task(**updated_task)

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, current_user: User = Depends(get_current_user)):
    result = await db.tasks.delete_one({"id": task_id, "user_id": current_user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted successfully"}

# AI Response Models
class AITaskSummary(BaseModel):
    summary: str
    insights: List[str]
    recommendations: List[str]

class AIPriorityAnalysis(BaseModel):
    suggested_priority: str
    reasoning: str
    urgency_score: int  # 1-10 scale

# AI Service Functions
async def generate_task_summary(tasks: List[dict]) -> AITaskSummary:
    """Generate AI-powered daily task summary"""
    if not tasks or not EMERGENT_LLM_KEY:
        return AITaskSummary(
            summary="No tasks to summarize",
            insights=[],
            recommendations=[]
        )
    
    try:
        # Prepare task data for AI
        task_data = []
        for task in tasks:
            task_info = f"- {task['title']} (Priority: {task['priority']}, Status: {task['status']})"
            if task.get('description'):
                task_info += f": {task['description']}"
            task_data.append(task_info)
        
        task_list = "\n".join(task_data)
        
        # Initialize AI chat
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"task-summary-{uuid.uuid4()}",
            system_message="You are an AI productivity assistant that analyzes tasks and provides insightful summaries."
        ).with_model("openai", "gpt-4o")
        
        prompt = f"""
        Analyze the following tasks and provide a comprehensive summary:

        {task_list}

        Please provide:
        1. A brief overall summary of the current task situation
        2. 2-3 key insights about productivity patterns or task distribution
        3. 2-3 actionable recommendations for better task management

        Format your response as JSON with keys: summary, insights, recommendations
        """
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Parse response (assuming it's JSON-like)
        import json
        try:
            ai_data = json.loads(response)
            return AITaskSummary(
                summary=ai_data.get('summary', 'Task analysis completed'),
                insights=ai_data.get('insights', []),
                recommendations=ai_data.get('recommendations', [])
            )
        except:
            # Fallback parsing
            return AITaskSummary(
                summary=response[:200] + "..." if len(response) > 200 else response,
                insights=["AI analysis completed"],
                recommendations=["Continue managing tasks effectively"]
            )
            
    except Exception as e:
        logging.error(f"AI task summary error: {str(e)}")
        return AITaskSummary(
            summary="AI analysis temporarily unavailable",
            insights=["System is processing your tasks"],
            recommendations=["Continue with your current workflow"]
        )

async def analyze_task_priority(title: str, description: str, due_date: Optional[datetime] = None) -> AIPriorityAnalysis:
    """Analyze task and suggest priority using AI"""
    if not EMERGENT_LLM_KEY or not _AI_AVAILABLE:
        # Heuristic fallback (free): compute urgency score from due date proximity and keywords
        score = 5
        reasons = []

        # Due date proximity
        if due_date:
            now = datetime.now(timezone.utc)
            if due_date.tzinfo is None:
                # assume UTC for naive datetimes
                due_date = due_date.replace(tzinfo=timezone.utc)
            delta_hours = (due_date - now).total_seconds() / 3600.0
            if delta_hours <= 0:
                score += 3
                reasons.append("Past due: increase urgency")
            elif delta_hours <= 3:
                # Hard rule: anything within 3 hours is High
                score = max(score, 8)
                reasons.append("Due within 3 hours")
            elif delta_hours <= 24:
                score += 4
                reasons.append("Due within 24 hours")
            elif delta_hours <= 72:
                score += 2
                reasons.append("Due in 1–3 days")
            elif delta_hours <= 168:
                score += 1
                reasons.append("Due this week")
            else:
                score -= 1
                reasons.append("Due later than a week")

        # Keywords
        text = f"{title} {description}".lower()
        high_words = ["urgent", "asap", "today", "now", "immediately", "critical", "deadline", "bug", "prod", "exam", "submit"]
        med_words = ["soon", "important", "review", "prepare", "meeting", "follow up", "todo"]
        low_words = ["optional", "someday", "later", "idea", "backlog", "nice to have"]
        if any(w in text for w in high_words):
            score += 3
            reasons.append("High-urgency keywords detected")
        if any(w in text for w in med_words):
            score += 1
            reasons.append("Important keywords detected")
        if any(w in text for w in low_words):
            score -= 2
            reasons.append("Low-urgency keywords detected")

        # Text length / complexity (very rough)
        length = len(description.split()) if description else 0
        if length >= 40:
            score += 1
            reasons.append("Longer description suggests more complexity")

        # Clamp and map
        score = max(1, min(10, int(round(score))))
        if score >= 8:
            priority = "high"
        elif score >= 5:
            priority = "medium"
        else:
            priority = "low"

        return AIPriorityAnalysis(
            suggested_priority=priority,
            reasoning="; ".join(reasons) or "Heuristic analysis completed",
            urgency_score=score
        )
    
    try:
        # Initialize AI chat
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"priority-analysis-{uuid.uuid4()}",
            system_message="You are an AI assistant that analyzes tasks and suggests appropriate priorities."
        ).with_model("openai", "gpt-4o")
        
        due_date_text = f"Due: {due_date.strftime('%Y-%m-%d')}" if due_date else "No due date specified"
        
        prompt = f"""
        Analyze this task and suggest an appropriate priority level:

        Title: {title}
        Description: {description}
        {due_date_text}

        Consider factors like:
        - Urgency (time sensitivity)
        - Importance (impact on goals)
        - Complexity
        - Dependencies

        Suggest priority as "low", "medium", or "high" and provide reasoning.
        Also provide an urgency score from 1-10 (10 being most urgent).

        Format as JSON: {{"suggested_priority": "...", "reasoning": "...", "urgency_score": ...}}
        """
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Parse response
        import json
        try:
            ai_data = json.loads(response)
            return AIPriorityAnalysis(
                suggested_priority=ai_data.get('suggested_priority', 'medium'),
                reasoning=ai_data.get('reasoning', 'Analysis completed'),
                urgency_score=int(ai_data.get('urgency_score', 5))
            )
        except:
            # Fallback
            return AIPriorityAnalysis(
                suggested_priority="medium",
                reasoning="AI suggested medium priority based on task analysis",
                urgency_score=5
            )
            
    except Exception as e:
        logging.error(f"AI priority analysis error: {str(e)}")
        return AIPriorityAnalysis(
            suggested_priority="medium",
            reasoning="Priority analysis temporarily unavailable",
            urgency_score=5
        )

# Dashboard stats
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    tasks = await db.tasks.find({"user_id": current_user.id}).to_list(1000)
    
    total_tasks = len(tasks)
    pending_tasks = len([t for t in tasks if t["status"] == "pending"])
    in_progress_tasks = len([t for t in tasks if t["status"] == "in_progress"])
    completed_tasks = len([t for t in tasks if t["status"] == "completed"])
    
    return {
        "total_tasks": total_tasks,
        "pending_tasks": pending_tasks,
        "in_progress_tasks": in_progress_tasks,
        "completed_tasks": completed_tasks
    }

# AI-powered endpoints
@api_router.get("/ai/task-summary", response_model=AITaskSummary)
async def get_ai_task_summary(current_user: User = Depends(get_current_user)):
    """Get AI-powered daily task summary"""
    tasks = await db.tasks.find({"user_id": current_user.id}).to_list(1000)
    summary = await generate_task_summary(tasks)
    return summary

@api_router.post("/ai/analyze-priority", response_model=AIPriorityAnalysis)
async def analyze_task_priority_endpoint(
    task_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Get AI-powered priority analysis for a task"""
    title = task_data.get("title", "")
    description = task_data.get("description", "")
    due_date = None
    
    if task_data.get("due_date"):
        try:
            due_date = datetime.fromisoformat(task_data["due_date"].replace('Z', '+00:00'))
        except:
            pass
    
    analysis = await analyze_task_priority(title, description, due_date)
    return analysis

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://taskflow-eight-eta.vercel.app",  # your frontend
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
