from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from pymongo.database import Database

router = APIRouter()

# Pydantic models
class KickUser(BaseModel):
    userId: str
    piId: str
    printerId: str

# Dependency to get database
async def get_database():
    from main import db
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
    return db

@router.get("/queue")
async def get_admin_queue(db: Database = Depends(get_database)):
    try:
        queues = list(db.queues.find({}))
        
        # Convert ObjectId to string for JSON serialization
        for queue in queues:
            queue['_id'] = str(queue['_id'])
        
        return {"queues": queues}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/kick-user")
async def kick_user(kick_data: KickUser, db: Database = Depends(get_database)):
    try:
        result = db.queues.update_one(
            {"piId": kick_data.piId, "printerId": kick_data.printerId},
            {"$pull": {"queue": {"userId": kick_data.userId}}}
        )

        return {"success": result.modified_count > 0}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/printers-by-owner")
async def get_printers_by_owner(phone: str, db: Database = Depends(get_database)):
    try:
        print(f"Fetching printers for phone: {phone}")
        printers = list(db.printers.find({"phone": phone}))
        
        print(f"Found printers: {len(printers)}")
        
        # Convert ObjectId to string for JSON serialization
        for printer in printers:
            printer['_id'] = str(printer['_id'])
        
        return printers
    except Exception as e:
        print(f"Error fetching printers by owner: {e}")
        raise HTTPException(status_code=500, detail=str(e))