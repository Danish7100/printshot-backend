from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from pymongo.database import Database
from queue_manager import acquire_lock, release_lock, get_queue
from websocket_manager import ws_manager

router = APIRouter()

# Pydantic models
class QueueAdd(BaseModel):
    piId: str
    printerId: str
    userId: str

class QueueRelease(BaseModel):
    piId: str
    printerId: str
    userId: str

# Dependency to get database
def get_database():
    from main import db
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
    return db

@router.post("/add")
async def add_to_queue(queue_data: QueueAdd, db: Database = Depends(get_database)):
    try:
        success = acquire_lock(db, queue_data.piId, queue_data.printerId, queue_data.userId)
        
        # Broadcast real-time update
        updated_queue = get_queue(db, queue_data.piId, queue_data.printerId)
        await ws_manager.broadcast_queue_update(queue_data.piId, queue_data.printerId, updated_queue)
        
        return {"success": success}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/release")
async def release_from_queue(queue_data: QueueRelease, db: Database = Depends(get_database)):
    try:
        success = release_lock(db, queue_data.piId, queue_data.printerId, queue_data.userId)
        
        # Broadcast real-time update
        updated_queue = get_queue(db, queue_data.piId, queue_data.printerId)
        await ws_manager.broadcast_queue_update(queue_data.piId, queue_data.printerId, updated_queue)
        
        return {"success": success}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status")
async def get_queue_status(piId: str, printerId: str, db: Database = Depends(get_database)):
    try:
        print(f"Getting queue for: {piId}, {printerId}")
        
        if not db:
            print("Database not connected")
            raise HTTPException(status_code=500, detail="Database not connected")
        
        queue = get_queue(db, piId, printerId)
        print(f"Queue result: {queue}")
        
        safe_queue = queue if isinstance(queue, list) else []
        print(f"Sending response: {safe_queue}")
        return {"queue": safe_queue}
    except Exception as e:
        print(f"Queue status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))