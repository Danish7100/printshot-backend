from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import razorpay
import os
from datetime import datetime
from pymongo.database import Database

router = APIRouter()

# Initialize Razorpay client
razorpay_client = None
razorpay_key_id = os.getenv('RAZORPAY_KEY_ID')
razorpay_key_secret = os.getenv('RAZORPAY_KEY_SECRET')

if razorpay_key_id and razorpay_key_secret:
    razorpay_client = razorpay.Client(auth=(razorpay_key_id, razorpay_key_secret))
    print("Razorpay configured successfully")
else:
    print("Razorpay API keys are not configured. Payment will not work.")

# Pydantic models
class CreateOrder(BaseModel):
    amount: float
    piId: str
    printerId: str
    pages: int
    userId: str

class VerifyPayment(BaseModel):
    paymentId: str
    orderId: str
    signature: str

# Dependency to get database
def get_database():
    from main import db
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
    return db

@router.post("/create-razorpay-order")
async def create_razorpay_order(order: CreateOrder, db: Database = Depends(get_database)):
    try:
        if not razorpay_client:
            raise HTTPException(status_code=500, detail="Payment gateway is not configured on the server.")

        amount_in_paise = round(order.amount * 100)

        options = {
            "amount": amount_in_paise,
            "currency": "INR",
            "receipt": f"receipt_print_{int(datetime.now().timestamp())}",
            "notes": {
                "userId": order.userId,
                "piId": order.piId,
                "printerId": order.printerId,
                "pages": str(order.pages),
            }
        }

        razorpay_order = razorpay_client.order.create(data=options)
        return {"order_id": razorpay_order["id"], "finalAmount": order.amount}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Payment order creation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create payment order: {str(e)}")

@router.post("/verify")
async def verify_payment(payment: VerifyPayment, db: Database = Depends(get_database)):
    try:
        payment_doc = {
            "paymentId": payment.paymentId,
            "orderId": payment.orderId,
            "signature": payment.signature,
            "status": "completed",
            "createdAt": datetime.now()
        }
        
        db.payments.insert_one(payment_doc)
        return {"success": True}
    except Exception as e:
        print(f"Payment verification error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))