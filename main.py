from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv
from pymongo import MongoClient
from routers import printers, queue, payments, admin
from websocket_manager import WebSocketManager
import uvicorn

load_dotenv()

# Global variables
db = None
ws_manager = WebSocketManager()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global db
    try:
        client = MongoClient(os.getenv('MONGODB_URI'))
        db = client.print_platform
        print("Connected to MongoDB")
    except Exception as e:
        print(f"MongoDB connection error: {e}")
    
    yield
    
    # Shutdown
    if db is not None:
        db.client.close()

app = FastAPI(
    title="PrintShot Backend",
    description="Backend API for the PrintShot document printing service",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get database
def get_database():
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
    return db

# Include routers
app.include_router(printers.router, prefix="/api/printers", tags=["printers"])
app.include_router(queue.router, prefix="/api/queue", tags=["queue"])
app.include_router(payments.router, prefix="/api/payments", tags=["payments"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])

# Health check
@app.get("/health")
async def health_check():
    return {"status": "OK", "timestamp": "2024-01-01T00:00:00.000Z"}

# Test endpoint
@app.get("/api/test")
async def test_endpoint():
    return {"message": "Backend is working!", "queue": []}

# Test queue with mock data
@app.get("/api/test-queue-data")
async def test_queue_data(db=Depends(get_database)):
    try:
        printers = list(db.printers.find({}).limit(5))
        queues = list(db.queues.find({}).limit(5))
        
        # Convert ObjectId to string for JSON serialization
        for printer in printers:
            printer['_id'] = str(printer['_id'])
        for queue in queues:
            queue['_id'] = str(queue['_id'])
        
        return {
            "message": "Database test",
            "printersCount": len(printers),
            "queuesCount": len(queues),
            "samplePrinters": printers,
            "sampleQueues": queues
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False, log_level="info")