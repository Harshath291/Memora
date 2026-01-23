from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ServerSelectionTimeoutError
from fastapi.responses import JSONResponse
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from passlib.context import CryptContext

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# External integration config
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')

app = FastAPI()
api_router = APIRouter(prefix="/api")

JWT_SECRET = os.environ.get('JWT_SECRET', 'memora_secret_key_change_in_production')
JWT_ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# In-memory store of active websocket connections keyed by user_id
# NOTE: For production use, replace with a distributed pub/sub (Redis, etc.)
connected_users: Dict[str, List[WebSocket]] = {}

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
    avatar: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AvatarUpdate(BaseModel):
    avatar: str

class NoteCreate(BaseModel):
    title: str
    content: str
    theme: Optional[str] = None
    font: Optional[str] = None
    attachments: Optional[List[dict]] = None

class Note(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    content: str
    theme: Optional[str] = None
    font: Optional[str] = None
    attachments: List[dict] = Field(default_factory=list)
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

class FriendRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    from_user_id: str
    from_username: str
    to_user_id: str
    to_username: str
    message: Optional[str] = None
    status: str = Field(default='pending')
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MessageCreate(BaseModel):
    to_username: str
    content: str

class Message(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    from_user_id: str
    to_user_id: str
    content: str
    read_by: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PublicUser(BaseModel):
    username: str
    user_id: str
    avatar: Optional[str] = None
    created_at: datetime

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
    try:
        try:
            existing_user = await db.users.find_one({"username": req.username}, {"_id": 0})
        except ServerSelectionTimeoutError:
            raise HTTPException(status_code=503, detail="Database unavailable")

        if existing_user:
            raise HTTPException(status_code=400, detail="Username already exists")
        
        user = User(
            username=req.username,
            email=req.email,
            password_hash=hash_password(req.password)
        )
        user_dict = user.model_dump()
        user_dict['created_at'] = user_dict['created_at'].isoformat()

        try:
            await db.users.insert_one(user_dict)
        except ServerSelectionTimeoutError:
            raise HTTPException(status_code=503, detail="Database unavailable")

        token = create_token(user.id, user.username)
        return AuthResponse(token=token, username=user.username, user_id=user.id)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unhandled exception in signup")
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.post("/auth/login", response_model=AuthResponse)
async def login(req: LoginRequest):
    try:
        try:
            user_dict = await db.users.find_one({"username": req.username}, {"_id": 0})
        except ServerSelectionTimeoutError:
            raise HTTPException(status_code=503, detail="Database unavailable")

        if not user_dict:
            raise HTTPException(status_code=401, detail="Invalid username or password")
        
        if not verify_password(req.password, user_dict['password_hash']):
            raise HTTPException(status_code=401, detail="Invalid username or password")
        
        token = create_token(user_dict['id'], user_dict['username'])
        return AuthResponse(token=token, username=user_dict['username'], user_id=user_dict['id'])
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unhandled exception in login")
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {"username": current_user["username"], "user_id": current_user["user_id"]}


@api_router.get("/users/me/profile")
async def get_my_profile(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Ensure avatar field exists
    user.setdefault('avatar', None)
    return {"username": user.get('username'), "user_id": user.get('id'), "avatar": user.get('avatar')}


@api_router.post("/users/me/avatar")
async def upload_avatar(payload: AvatarUpdate, current_user: dict = Depends(get_current_user)):
    # Payload.avatar is expected to be a data URL (base64)
    avatar_data = payload.avatar
    if not avatar_data or not isinstance(avatar_data, str):
        raise HTTPException(status_code=400, detail="Invalid avatar data")

    await db.users.update_one({"id": current_user["user_id"]}, {"$set": {"avatar": avatar_data}})
    return JSONResponse(status_code=200, content={"status": "ok", "avatar": avatar_data})


@api_router.delete("/users/me/avatar")
async def delete_avatar(current_user: dict = Depends(get_current_user)):
    await db.users.update_one({"id": current_user["user_id"]}, {"$unset": {"avatar": ""}})
    return JSONResponse(status_code=200, content={"status": "deleted"})

# Notes routes
@api_router.post("/notes", response_model=Note)
async def create_note(note: NoteCreate, current_user: dict = Depends(get_current_user)):
    new_note = Note(
        user_id=current_user["user_id"],
        title=note.title,
        content=note.content,
        theme=note.theme,
        font=note.font,
        attachments=note.attachments or []
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

# Update an existing note
@api_router.put("/notes/{note_id}", response_model=Note)
async def update_note(note_id: str, note_update: NoteCreate, current_user: dict = Depends(get_current_user)):
    existing_note = await db.notes.find_one({"id": note_id, "user_id": current_user["user_id"]}, {"_id": 0})
    if not existing_note:
        raise HTTPException(status_code=404, detail="Note not found")

    update_payload = {"title": note_update.title, "content": note_update.content}
    if hasattr(note_update, 'theme'):
        update_payload['theme'] = note_update.theme
    if hasattr(note_update, 'font'):
        update_payload['font'] = note_update.font
    if hasattr(note_update, 'attachments') and note_update.attachments is not None:
        update_payload['attachments'] = note_update.attachments

    await db.notes.update_one(
        {"id": note_id},
        {"$set": update_payload}
    )

    updated_note = await db.notes.find_one({"id": note_id}, {"_id": 0})
    if isinstance(updated_note['created_at'], str):
        updated_note['created_at'] = datetime.fromisoformat(updated_note['created_at'])

    # Ensure attachments and theme fields exist
    updated_note.setdefault('attachments', [])
    updated_note.setdefault('theme', None)

    return updated_note

# Delete an existing note
@api_router.delete("/notes/{note_id}")
async def delete_note(note_id: str, current_user: dict = Depends(get_current_user)):
    existing_note = await db.notes.find_one({"id": note_id, "user_id": current_user["user_id"]}, {"_id": 0})
    if not existing_note:
        raise HTTPException(status_code=404, detail="Note not found")

    await db.notes.delete_one({"id": note_id})

    return JSONResponse(status_code=200, content={"status": "deleted"})

# Compatibility endpoints for clients that cannot use PUT/DELETE (some dev proxies/extensions)
@api_router.post("/notes/{note_id}/update", response_model=Note)
async def update_note_post(note_id: str, note_update: NoteCreate, current_user: dict = Depends(get_current_user)):
    return await update_note(note_id, note_update, current_user)

@api_router.post("/notes/{note_id}/delete")
async def delete_note_post(note_id: str, current_user: dict = Depends(get_current_user)):
    return await delete_note(note_id, current_user)
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

@api_router.put("/reminders/{reminder_id}", response_model=Reminder)
async def update_reminder(reminder_id: str, reminder_update: ReminderCreate, current_user: dict = Depends(get_current_user)):
    existing = await db.reminders.find_one({"id": reminder_id, "user_id": current_user["user_id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Reminder not found")

    update_payload = {"title": reminder_update.title, "date": reminder_update.date, "note": reminder_update.note}
    await db.reminders.update_one({"id": reminder_id}, {"$set": update_payload})

    updated = await db.reminders.find_one({"id": reminder_id}, {"_id": 0})
    if isinstance(updated['created_at'], str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])

    return updated

@api_router.delete("/reminders/{reminder_id}")
async def delete_reminder(reminder_id: str, current_user: dict = Depends(get_current_user)):
    logger.info(f"delete_reminder called: id={reminder_id} user={current_user}")
    existing = await db.reminders.find_one({"id": reminder_id, "user_id": current_user["user_id"]}, {"_id": 0})
    logger.info(f"delete lookup result: {existing}")
    if not existing:
        raise HTTPException(status_code=404, detail="Reminder not found")

    await db.reminders.delete_one({"id": reminder_id})
    logger.info(f"deleted reminder {reminder_id}")
    return JSONResponse(status_code=200, content={"status": "deleted"})

# Friends routes
@api_router.post("/friends", response_model=Friend)
async def add_friend(friend_req: FriendRequest, current_user: dict = Depends(get_current_user)):
    """Compatibility endpoint: instead of immediately creating a friend link, create a FriendRequest so the recipient can accept."""
    recipient = await db.users.find_one({"username": friend_req.friend_username}, {"_id": 0})
    if not recipient:
        raise HTTPException(status_code=404, detail="User not found")

    if recipient['id'] == current_user['user_id']:
        raise HTTPException(status_code=400, detail="Cannot add yourself as friend")

    existing_friend = await db.friends.find_one({
        "user_id": current_user["user_id"],
        "friend_username": friend_req.friend_username
    }, {"_id": 0})
    if existing_friend:
        raise HTTPException(status_code=400, detail="Friend already added")

    # If request already exists (pending), return it
    existing_request = await db.friend_requests.find_one({"from_user_id": current_user['user_id'], "to_username": friend_req.friend_username, "status": "pending"}, {"_id": 0})
    if existing_request:
        raise HTTPException(status_code=400, detail="Friend request already sent")

    new_req = FriendRequest(
        from_user_id=current_user['user_id'],
        from_username=current_user['username'],
        to_user_id=recipient['id'],
        to_username=recipient['username'],
    )
    req_dict = new_req.model_dump()
    req_dict['created_at'] = req_dict['created_at'].isoformat()
    await db.friend_requests.insert_one(req_dict)
    logger.info(f"Friend request created from {current_user['username']} to {recipient['username']}")
    return JSONResponse(status_code=200, content={"status": "request_sent"})

@api_router.get('/users/{username}', response_model=PublicUser)
async def get_public_user(username: str, current_user: dict = Depends(get_current_user)):
    lg = logging.getLogger(__name__)
    lg.info(f"get_public_user requested by user_id={current_user.get('user_id')} for username={username}")
    user = await db.users.find_one({'username': username}, {'_id': 0, 'password_hash': 0})
    if not user:
        lg.warning(f"get_public_user: user not found username={username} requested_by={current_user.get('user_id')}")
        raise HTTPException(status_code=404, detail='User not found')
    lg.info(f"get_public_user: found username={username}")
    user.setdefault('avatar', None)
    if isinstance(user['created_at'], str):
        user['created_at'] = datetime.fromisoformat(user['created_at'])
    return PublicUser(username=user['username'], user_id=user['id'], avatar=user.get('avatar'), created_at=user['created_at'])

@api_router.post('/messages', response_model=Message)
async def send_message(payload: MessageCreate, current_user: dict = Depends(get_current_user)):
    # Only allow messaging between friends (current_user has added recipient)
    recipient = await db.users.find_one({'username': payload.to_username}, {'_id': 0})
    if not recipient:
        raise HTTPException(status_code=404, detail='Recipient not found')

    friend_link = await db.friends.find_one({'user_id': current_user['user_id'], 'friend_username': payload.to_username}, {'_id': 0})
    if not friend_link:
        raise HTTPException(status_code=403, detail='You can only message users you have added as friends')

    new_msg = Message(
        from_user_id=current_user['user_id'],
        to_user_id=recipient['id'],
        content=payload.content,
        read_by=[]
    )
    msg_dict = new_msg.model_dump()
    msg_dict['created_at'] = msg_dict['created_at'].isoformat()
    msg_dict['read_by'] = []
    await db.messages.insert_one(msg_dict)

    # Broadcast the new message to any connected websocket sessions of the recipient
    try:
        recipient_id = recipient['id']
        event_payload = {"event": "new_message", "payload": msg_dict}
        for ws in connected_users.get(recipient_id, []):
            try:
                await ws.send_json(event_payload)
            except Exception:
                # ignore per-connection failures; they'll be cleaned on disconnect
                pass
    except Exception:
        logger.exception("Failed to broadcast message via websocket")

    return new_msg

@api_router.get('/messages/{friend_username}', response_model=List[Message])
async def get_conversation(friend_username: str, current_user: dict = Depends(get_current_user)):
    friend_user = await db.users.find_one({'username': friend_username}, {'_id': 0})
    if not friend_user:
        raise HTTPException(status_code=404, detail='User not found')

    # Ensure friendship exists (current_user has added friend)
    friend_link = await db.friends.find_one({'user_id': current_user['user_id'], 'friend_username': friend_username}, {'_id': 0})
    if not friend_link:
        raise HTTPException(status_code=403, detail='Messages not available for non-friends')

    msgs = await db.messages.find({
        '$or': [
            {'from_user_id': current_user['user_id'], 'to_user_id': friend_user['id']},
            {'from_user_id': friend_user['id'], 'to_user_id': current_user['user_id']},
        ]
    }, {'_id': 0}).sort('created_at', 1).to_list(1000)

    for m in msgs:
        if isinstance(m['created_at'], str):
            try:
                m['created_at'] = datetime.fromisoformat(m['created_at'])
            except Exception:
                # fallback if timezone formatting differs
                m['created_at'] = datetime.fromisoformat(m['created_at'].replace('Z','+00:00'))
    return msgs

@api_router.post('/messages/{friend_username}/read')
async def mark_messages_read(friend_username: str, current_user: dict = Depends(get_current_user)):
    friend_user = await db.users.find_one({'username': friend_username}, {'_id': 0})
    if not friend_user:
        raise HTTPException(status_code=404, detail='User not found')

    # Only allow marking messages read if friend relation exists
    friend_link = await db.friends.find_one({'user_id': current_user['user_id'], 'friend_username': friend_username}, {'_id': 0})
    if not friend_link:
        raise HTTPException(status_code=403, detail='Not friends')

    # Add current_user to read_by for all messages from friend_user to current_user
    result = await db.messages.update_many(
        {'from_user_id': friend_user['id'], 'to_user_id': current_user['user_id'], 'read_by': {'$ne': current_user['user_id']}},
        {'$addToSet': {'read_by': current_user['user_id']}}
    )

    # Notify friend via websocket that their messages were read
    try:
        notify_payload = {"event": "messages_read", "payload": {"by_user_id": current_user['user_id'], "friend_user_id": friend_user['id']}}
        for ws in connected_users.get(friend_user['id'], []):
            try:
                await ws.send_json(notify_payload)
            except Exception:
                pass
    except Exception:
        logger.exception("Failed to notify friend about read status")

    return JSONResponse(status_code=200, content={"updated": result.modified_count})

@api_router.get('/messages/unread_counts')
async def get_unread_counts(current_user: dict = Depends(get_current_user)):
    pipeline = [
        {'$match': {'to_user_id': current_user['user_id'], 'read_by': {'$ne': current_user['user_id']}}},
        {'$group': {'_id': '$from_user_id', 'count': {'$sum': 1}}}
    ]
    agg = await db.messages.aggregate(pipeline).to_list(1000)
    result = []
    for row in agg:
        user = await db.users.find_one({'id': row['_id']}, {'_id': 0, 'username': 1})
        if user:
            result.append({'friend_user_id': row['_id'], 'friend_username': user['username'], 'count': row['count']})
    return result


@app.websocket('/ws')
async def websocket_endpoint(websocket: WebSocket, token: Optional[str] = None):
    # Expect client to connect with ws://.../ws?token=<jwt>
    await websocket.accept()
    try:
        if not token:
            await websocket.close(code=1008)
            return
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('user_id')
        if not user_id:
            await websocket.close(code=1008)
            return
    except Exception:
        await websocket.close(code=1008)
        return

    conns = connected_users.setdefault(user_id, [])
    conns.append(websocket)
    logger.info(f"WebSocket connected: user={user_id}")

    try:
        # Listen for client-sent JSON messages for actions like 'mark_read' to avoid extra REST round-trips
        while True:
            data = await websocket.receive_json()
            if isinstance(data, dict) and data.get('event') == 'mark_read':
                friend_id = data.get('friend_user_id')
                if friend_id:
                    await db.messages.update_many(
                        {'from_user_id': friend_id, 'to_user_id': user_id, 'read_by': {'$ne': user_id}},
                        {'$addToSet': {'read_by': user_id}}
                    )
                    # notify friend
                    notify_payload = {"event": "messages_read", "payload": {"by_user_id": user_id, "friend_user_id": friend_id}}
                    for ws in connected_users.get(friend_id, []):
                        try:
                            await ws.send_json(notify_payload)
                        except Exception:
                            pass
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: user={user_id}")
        # cleanup
        if websocket in connected_users.get(user_id, []):
            connected_users[user_id].remove(websocket)
    except Exception:
        logger.exception("WebSocket error")
        if websocket in connected_users.get(user_id, []):
            connected_users[user_id].remove(websocket)

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

@api_router.delete('/friends/{friend_username}')
async def remove_friend(friend_username: str, current_user: dict = Depends(get_current_user)):
    """Remove a friend relationship mutually between current_user and friend_username."""
    lg = logging.getLogger(__name__)
    lg.info(f"remove_friend requested by user_id={current_user.get('user_id')} target={friend_username}")

    # Ensure friend link exists for current user
    existing = await db.friends.find_one({'user_id': current_user['user_id'], 'friend_username': friend_username}, {'_id': 0})
    if not existing:
        lg.warning(f"remove_friend: no existing friend link for user={current_user.get('user_id')} friend={friend_username}")
        raise HTTPException(status_code=404, detail='Friend relationship not found')

    # Delete both directions: current->friend and friend->current if present
    try:
        await db.friends.delete_one({'user_id': current_user['user_id'], 'friend_username': friend_username})
        # find friend's user id
        friend_user = await db.users.find_one({'username': friend_username}, {'_id': 0})
        if friend_user:
            await db.friends.delete_one({'user_id': friend_user['id'], 'friend_username': current_user['username']})
        lg.info(f"remove_friend: removed friendship between {current_user.get('user_id')} and {friend_username}")
    except Exception:
        lg.exception('Error removing friend links')
        raise HTTPException(status_code=500, detail='Failed to remove friend')

    return JSONResponse(status_code=200, content={'status': 'removed'})

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

@app.exception_handler(ServerSelectionTimeoutError)
async def mongo_unavailable_handler(request, exc):
    return JSONResponse(status_code=503, content={"detail": "Database unavailable"})

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