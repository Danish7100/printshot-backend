from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime
from pymongo.database import Database
import random

router = APIRouter()

# Pydantic models
class PrinterRegister(BaseModel):
    ownerName: str
    piId: str
    printerName: str
    address: str
    phone: str
    costPerPage: float

class OwnerVerify(BaseModel):
    phone: str

# Dependency to get database
def get_database():
    from main import db
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
    return db

@router.post("/register")
async def register_printer(printer: PrinterRegister, db: Database = Depends(get_database)):
    try:
        fake_pi_id = str(uuid.uuid4())
        fake_printer_id = str(uuid.uuid4())

        new_printer = {
            "ownerName": printer.ownerName,
            "piId": printer.piId,
            "printerName": printer.printerName,
            "address": printer.address,
            "phone": printer.phone,
            "costPerPage": printer.costPerPage,
            "fakePiId": fake_pi_id,
            "fakePrinterId": fake_printer_id,
            "createdAt": datetime.now(),
        }

        db.printers.update_one(
            {"piId": printer.piId, "printerName": printer.printerName},
            {"$set": new_printer},
            upsert=True
        )

        return {
            "message": "Printer registered successfully",
            "fakePiId": fake_pi_id,
            "fakePrinterId": fake_printer_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/details")
async def get_printer_details(piId: str, printerId: str, db: Database = Depends(get_database)):
    try:
        printer = db.printers.find_one(
            {"fakePiId": piId, "fakePrinterId": printerId},
            {"_id": 0, "costPerPage": 1, "ownerName": 1, "address": 1}
        )

        if not printer:
            raise HTTPException(status_code=404, detail="Printer not found.")

        return printer
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/verify-owner")
async def verify_owner(owner: OwnerVerify, db: Database = Depends(get_database)):
    try:
        owner_doc = db.printers.find_one({"phone": owner.phone})

        if not owner_doc:
            raise HTTPException(status_code=404, detail="No printer owner found with this phone number.")

        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status")
async def get_printer_status(printerName: str):
    try:
        # Mock status - in production, this would check actual printer status
        mock_statuses = ['idle', 'busy', 'offline', 'error']
        random_status = random.choice(mock_statuses)
        
        return {"status": random_status}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))