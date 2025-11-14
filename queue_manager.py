import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pymongo.database import Database

async def get_real_ids(db: Database, fake_pi_id: str, fake_printer_id: str) -> Optional[Dict[str, str]]:
    """Get real IDs from fake IDs"""
    printer_doc = db.printers.find_one({"fakePiId": fake_pi_id, "fakePrinterId": fake_printer_id})
    if printer_doc:
        return {"piId": printer_doc["piId"], "printerId": printer_doc["printerName"]}
    return None

async def remove_user_from_all_queues(db: Database, user_id: str):
    """Remove user from all queues"""
    queues_with_user = list(db.queues.find({"queue.userId": user_id}))

    for queue_doc in queues_with_user:
        user_is_active = queue_doc["queue"][0]["userId"] == user_id if queue_doc["queue"] else False
        updated_queue = [u for u in queue_doc["queue"] if u["userId"] != user_id]

        if user_is_active and updated_queue:
            updated_queue[0]["status"] = "active"
            updated_queue[0]["locked_at"] = datetime.now().isoformat()
        
        db.queues.update_one(
            {"_id": queue_doc["_id"]},
            {"$set": {"queue": updated_queue}}
        )

async def get_queue(db: Database, fake_pi_id: str, fake_printer_id: str) -> List[Dict[str, Any]]:
    """Get queue for a printer"""
    try:
        if not db:
            print("Database not connected")
            return []
        
        real_ids = await get_real_ids(db, fake_pi_id, fake_printer_id)
        if not real_ids:
            print(f"No real IDs found for: {fake_pi_id}, {fake_printer_id}")
            return []
        
        queue_doc = db.queues.find_one({"piId": real_ids["piId"], "printerId": real_ids["printerId"]})
        print(f"Queue document found: {queue_doc}")
        return queue_doc.get("queue", []) if queue_doc else []
    except Exception as e:
        print(f"Error in get_queue: {e}")
        return []

async def acquire_lock(db: Database, fake_pi_id: str, fake_printer_id: str, user_id: str) -> bool:
    """Add user to queue and acquire lock if possible"""
    await remove_user_from_all_queues(db, user_id)

    real_ids = await get_real_ids(db, fake_pi_id, fake_printer_id)
    if not real_ids:
        raise Exception("Printer not found with the provided IDs.")

    pi_id, printer_id = real_ids["piId"], real_ids["printerId"]
    queue_doc = db.queues.find_one({"piId": pi_id, "printerId": printer_id})

    new_user_entry = {
        "userId": user_id,
        "joinedAt": datetime.now(),
        "status": "waiting",
        "locked_at": None,
    }

    if queue_doc:
        has_active_user = any(u["status"] == "active" for u in queue_doc["queue"])

        if not has_active_user:
            new_user_entry["status"] = "active"
            new_user_entry["locked_at"] = datetime.now().isoformat()
            db.queues.update_one(
                {"_id": queue_doc["_id"]},
                {"$push": {"queue": {"$each": [new_user_entry], "$position": 0}}}
            )
            return True
        else:
            db.queues.update_one(
                {"_id": queue_doc["_id"]},
                {"$push": {"queue": new_user_entry}}
            )
            return False
    else:
        new_user_entry["status"] = "active"
        new_user_entry["locked_at"] = datetime.now().isoformat()
        db.queues.insert_one({
            "piId": pi_id,
            "printerId": printer_id,
            "queue": [new_user_entry],
        })
        return True

async def release_lock(db: Database, fake_pi_id: str, fake_printer_id: str, user_id: str) -> bool:
    """Release user from queue"""
    real_ids = await get_real_ids(db, fake_pi_id, fake_printer_id)
    if not real_ids:
        return False

    pi_id, printer_id = real_ids["piId"], real_ids["printerId"]
    queue_doc = db.queues.find_one({"piId": pi_id, "printerId": printer_id})

    if not queue_doc or not queue_doc["queue"]:
        return False
    
    user_index = next((i for i, u in enumerate(queue_doc["queue"]) if u["userId"] == user_id), -1)

    if user_index == -1:
        return False

    user_was_active = user_index == 0
    updated_queue = [u for u in queue_doc["queue"] if u["userId"] != user_id]

    if user_was_active and updated_queue:
        updated_queue[0]["status"] = "active"
        updated_queue[0]["locked_at"] = datetime.now().isoformat()

    update_result = db.queues.update_one(
        {"_id": queue_doc["_id"]},
        {"$set": {"queue": updated_queue}}
    )

    return update_result.modified_count > 0