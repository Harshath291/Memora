from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import bcrypt
import jwt
from passlib.context import CryptContext

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

JWT_SECRET = os.environ.get('JWT_SECRET', 'memora_secret_key_change_in_production')
JWT_ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Models
class SignupRequest(BaseModel):
    username: str
    email: Optional[str] = None
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class AuthResponse(BaseModel):
    token: str
    username: str
    user_id: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: Optional[str] = None
    password_hash: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class NoteCreate(BaseModel):
    title: str
    content: str

class Note(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class NoteListItem(BaseModel):
    id: str
    title: str
    created_at: datetime

class ReminderCreate(BaseModel):
    title: str
    date: str
    note: Optional[str] = None

class Reminder(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    date: str
    note: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FriendRequest(BaseModel):
    friend_username: str

class Friend(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    friend_username: str
    added_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChecklistItemInput(BaseModel):
    text: str
    checked: bool = False

class CheckboxNoteCreate(BaseModel):
    title: str
    items: List[ChecklistItemInput]

class CheckboxNote(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    items: List[dict]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Auth helpers
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_token(user_id: str, username: str) -> str:
    payload = {"user_id": user_id, "username": username}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        username = payload.get("username")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"user_id": user_id, "username": username}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Auth routes
@api_router.post("/auth/signup", response_model=AuthResponse)
async def signup(req: SignupRequest):
    existing_user = await db.users.find_one({"username": req.username}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    user = User(
        username=req.username,
        email=req.email,
        password_hash=hash_password(req.password)
    )
    user_dict = user.model_dump()
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    await db.users.insert_one(user_dict)
    
    token = create_token(user.id, user.username)
    return AuthResponse(token=token, username=user.username, user_id=user.id)

@api_router.post("/auth/login", response_model=AuthResponse)
async def login(req: LoginRequest):
    user_dict = await db.users.find_one({"username": req.username}, {"_id": 0})
    if not user_dict:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    if not verify_password(req.password, user_dict['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    token = create_token(user_dict['id'], user_dict['username'])
    return AuthResponse(token=token, username=user_dict['username'], user_id=user_dict['id'])

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {"username": current_user["username"], "user_id": current_user["user_id"]}

# Notes routes
@api_router.post("/notes", response_model=Note)
async def create_note(note: NoteCreate, current_user: dict = Depends(get_current_user)):
    new_note = Note(
        user_id=current_user["user_id"],
        title=note.title,
        content=note.content
    )
    note_dict = new_note.model_dump()
    note_dict['created_at'] = note_dict['created_at'].isoformat()
    await db.notes.insert_one(note_dict)
    return new_note

@api_router.get("/notes", response_model=List[NoteListItem])
async def get_notes(current_user: dict = Depends(get_current_user)):
    notes = await db.notes.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0, "id": 1, "title": 1, "created_at": 1}
    ).sort("created_at", -1).to_list(1000)
    
    for note in notes:
        if isinstance(note['created_at'], str):
            note['created_at'] = datetime.fromisoformat(note['created_at'])
    
    return notes

@api_router.get("/notes/{note_id}", response_model=Note)
async def get_note(note_id: str, current_user: dict = Depends(get_current_user)):
    note = await db.notes.find_one({"id": note_id, "user_id": current_user["user_id"]}, {"_id": 0})
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    if isinstance(note['created_at'], str):
        note['created_at'] = datetime.fromisoformat(note['created_at'])
    
    return note

@api_router.get("/notes/on-this-day/list", response_model=List[NoteListItem])
async def get_on_this_day_notes(current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    current_month = now.month
    current_day = now.day
    current_year = now.year
    
    all_notes = await db.notes.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ).to_list(10000)
    
    matching_notes = []
    for note in all_notes:
        created_at = note['created_at']
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        
        if created_at.month == current_month and created_at.day == current_day and created_at.year != current_year:
            matching_notes.append({
                "id": note['id'],
                "title": note['title'],
                "created_at": created_at
            })
    
    matching_notes.sort(key=lambda x: x['created_at'], reverse=True)
    return matching_notes

# Reminders routes
@api_router.post("/reminders", response_model=Reminder)
async def create_reminder(reminder: ReminderCreate, current_user: dict = Depends(get_current_user)):
    new_reminder = Reminder(
        user_id=current_user["user_id"],
        title=reminder.title,
        date=reminder.date,
        note=reminder.note
    )
    reminder_dict = new_reminder.model_dump()
    reminder_dict['created_at'] = reminder_dict['created_at'].isoformat()
    await db.reminders.insert_one(reminder_dict)
    return new_reminder

@api_router.get("/reminders", response_model=List[Reminder])
async def get_reminders(current_user: dict = Depends(get_current_user)):
    reminders = await db.reminders.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ).sort("date", 1).to_list(1000)
    
    for reminder in reminders:
        if isinstance(reminder['created_at'], str):
            reminder['created_at'] = datetime.fromisoformat(reminder['created_at'])
    
    return reminders

# Friends routes
@api_router.post("/friends", response_model=Friend)
async def add_friend(friend_req: FriendRequest, current_user: dict = Depends(get_current_user)):
    friend_user = await db.users.find_one({"username": friend_req.friend_username}, {"_id": 0})
    if not friend_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    existing_friend = await db.friends.find_one({
        "user_id": current_user["user_id"],
        "friend_username": friend_req.friend_username
    }, {"_id": 0})
    
    if existing_friend:
        raise HTTPException(status_code=400, detail="Friend already added")
    
    new_friend = Friend(
        user_id=current_user["user_id"],
        friend_username=friend_req.friend_username
    )
    friend_dict = new_friend.model_dump()
    friend_dict['added_at'] = friend_dict['added_at'].isoformat()
    await db.friends.insert_one(friend_dict)
    return new_friend

@api_router.get("/friends", response_model=List[Friend])
async def get_friends(current_user: dict = Depends(get_current_user)):
    friends = await db.friends.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ).to_list(1000)
    
    for friend in friends:
        if isinstance(friend['added_at'], str):
            friend['added_at'] = datetime.fromisoformat(friend['added_at'])
    
    return friends

# Checkbox notes routes
@api_router.post("/checkbox-notes", response_model=CheckboxNote)
async def create_checkbox_note(note: CheckboxNoteCreate, current_user: dict = Depends(get_current_user)):
    new_note = CheckboxNote(
        user_id=current_user["user_id"],
        title=note.title,
        items=[item.model_dump() for item in note.items]
    )
    note_dict = new_note.model_dump()
    note_dict['created_at'] = note_dict['created_at'].isoformat()
    await db.checkbox_notes.insert_one(note_dict)
    return new_note

@api_router.get("/checkbox-notes", response_model=List[CheckboxNote])
async def get_checkbox_notes(current_user: dict = Depends(get_current_user)):
    notes = await db.checkbox_notes.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    for note in notes:
        if isinstance(note['created_at'], str):
            note['created_at'] = datetime.fromisoformat(note['created_at'])
    
    return notes

@api_router.put("/checkbox-notes/{note_id}", response_model=CheckboxNote)
async def update_checkbox_note(note_id: str, note: CheckboxNoteCreate, current_user: dict = Depends(get_current_user)):
    existing_note = await db.checkbox_notes.find_one({"id": note_id, "user_id": current_user["user_id"]}, {"_id": 0})
    if not existing_note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    update_data = {
        "title": note.title,
        "items": [item.model_dump() for item in note.items]
    }
    
    await db.checkbox_notes.update_one(
        {"id": note_id, "user_id": current_user["user_id"]},
        {"$set": update_data}
    )
    
    updated_note = await db.checkbox_notes.find_one({"id": note_id}, {"_id": 0})
    if isinstance(updated_note['created_at'], str):
        updated_note['created_at'] = datetime.fromisoformat(updated_note['created_at'])
    
    return updated_note

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()