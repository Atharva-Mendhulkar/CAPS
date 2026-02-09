"""
CAPS API Server - Phase 8: Multi-User Platform
Exposes the CAPS payment processing logic via REST API for frontend integration.
Now with user authentication and database-backed operations.
"""

import logging
from datetime import datetime, timedelta, UTC
from typing import Dict, Any, Optional, List

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables (API keys)
load_dotenv()

from caps.agent import IntentInterpreter
from caps.schema import PaymentIntent, SchemaValidator, IntentType
from caps.context.context_service import ContextService
from caps.policy import PolicyEngine
from caps.execution import DecisionRouter, ExecutionEngine
from caps.memory import SessionMemory
from caps.ledger import AuditLedger
from caps.intelligence import FraudIntelligence

# Auth & Database
from caps.auth import (
    RegisterRequest,
    LoginRequest,
    AuthResponse,
    get_current_user,
    register_user,
    login_user,
)
from caps.database import (
    get_user_by_username,
    get_user_by_id,
    get_all_users,
    get_user_transactions,
    transfer_money,
)

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI App
app = FastAPI(title="CAPS API", version="0.8.0")

# CORS middleware
origins = [
    "http://localhost:5173",  # Vite dev server
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Data Models
class CommandRequest(BaseModel):
    text: str
    user_id: str = "user_default"


class CommandResponse(BaseModel):
    status: str
    message: str
    intent: Optional[Dict[str, Any]] = None
    policy_decision: Optional[str] = None
    execution_result: Optional[Dict[str, Any]] = None
    risk_info: Optional[Dict[str, Any]] = None
    context_used: Optional[Dict[str, Any]] = None
    user_state: Optional[Dict[str, Any]] = None


# Initialize CAPS Components (Singletons)
class CAPSContainer:
    def __init__(self):
        self.ledger = AuditLedger()
        self.memory = SessionMemory()
        self.context_service = ContextService()  # Direct service call (Monolith)
        self.fraud_intelligence = FraudIntelligence()
        self.validator = SchemaValidator()
        
        self.policy_engine = PolicyEngine()
        self.execution_engine = ExecutionEngine(ledger=self.ledger, context_service=self.context_service)
        self.router = DecisionRouter()
        
        self.interpreter = IntentInterpreter()
        
        logger.info("CAPS Components Initialized")


caps = CAPSContainer()


# ============== AUTH ROUTES ==============

@app.post("/auth/register")
async def register(req: RegisterRequest):
    """Register a new user."""
    return register_user(req.username, req.email, req.password)


@app.post("/auth/login")
async def login(req: LoginRequest):
    """Login and get JWT token."""
    return login_user(req.username, req.password)


@app.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user info."""
    return {
        "id": current_user["id"],
        "username": current_user["username"],
        "email": current_user["email"],
        "balance": current_user["balance"],
    }


# ============== USER & TRANSACTION ROUTES ==============

@app.get("/users")
async def list_users(current_user: dict = Depends(get_current_user)):
    """Get list of all users (for recipient selection)."""
    users = get_all_users(exclude_id=current_user["id"])
    return {"users": users}


@app.get("/transactions")
async def get_transactions(current_user: dict = Depends(get_current_user)):
    """Get transaction history for current user."""
    transactions = get_user_transactions(current_user["id"])
    return {"transactions": transactions}


@app.post("/transfer")
async def transfer(
    receiver_username: str,
    amount: float,
    current_user: dict = Depends(get_current_user)
):
    """Direct P2P transfer without voice command."""
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    receiver = get_user_by_username(receiver_username)
    if not receiver:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    if receiver["id"] == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot transfer to yourself")
    
    transaction_id = transfer_money(
        sender_id=current_user["id"],
        receiver_id=receiver["id"],
        amount=amount
    )
    
    if not transaction_id:
        raise HTTPException(status_code=400, detail="Transfer failed - insufficient balance")
    
    # Update balance in response
    updated_user = get_user_by_id(current_user["id"])
    
    return {
        "status": "success",
        "transaction_id": transaction_id,
        "message": f"Transferred ₹{amount:.2f} to {receiver_username}",
        "new_balance": updated_user["balance"]
    }


# ============== LEGACY ROUTES ==============

@app.get("/")
async def root():
    return {"status": "online", "system": "CAPS", "version": "0.8.0"}


@app.get("/context/{user_id}")
async def get_context(user_id: str):
    """Debug endpoint to see user context"""
    ctx = caps.context_service.get_user_context(user_id)
    return ctx.model_dump() if ctx else {"error": "User not found"}


@app.post("/process-command", response_model=CommandResponse)
async def process_command(req: CommandRequest):
    """
    Process a natural language command through the CAPS pipeline.
    """
    logger.info(f"Received command: {req.text} from {req.user_id}")
    
    # 0. Session Memory - Resolve references
    resolved = caps.memory.resolve_reference(req.text)
    enhanced_text = req.text
    
    # Simple replacement logic to help LLM
    if resolved.get("merchant_vpa"):
        # If we have a resolved merchant, append it to the text to ensure LLM sees it
        # regardless of specific phrasing
        enhanced_text = f"{req.text} (merchant: {resolved['merchant_vpa']})"
        
    if resolved.get("amount"):
        enhanced_text = f"{enhanced_text} (amount: {resolved['amount']})"
        
    logger.info(f"Enhanced input: {enhanced_text}")

    # Helper to get current user state
    def get_user_state(uid: str):
        u_ctx = caps.context_service.get_user_context(uid)
        if not u_ctx:
            from caps.context.mock_data import get_default_user
            u_ctx = get_default_user()
        
        # Get recent transactions
        recent_txns = caps.execution_engine.get_transaction_history(uid)
        return {
            "balance": u_ctx.wallet_balance,
            "daily_spend": u_ctx.daily_spend_today,
            "daily_limit": 2000.0, # Hardcoded for now, ideal matches rule
            "trust_score": u_ctx.trust_score,
            "recent_transactions": [
                {
                    "merchant": t.merchant_vpa,
                    "amount": t.amount,
                    "status": t.state.value,
                    "timestamp": t.created_at.isoformat() if t.created_at else None
                } for t in recent_txns[:3] # Top 3
            ]
        }

    # 1. Intent Interpretation
    try:
        intent_data = await caps.interpreter.interpret(enhanced_text)
        
        # Check for Fail-Closed Error
        if intent_data.get("error"):
            logger.warning(f"Intent Interpreter unavailable: {intent_data['error']}")
            return CommandResponse(
                status="error",
                message="Service temporarily unavailable (Rate Limit). Please try again in a moment.",
                intent=intent_data,
                user_state=get_user_state(req.user_id)
            )

        # Merge resolved memory if LLM missed it
        if resolved.get("merchant_vpa") and not intent_data.get("merchant_vpa"):
            intent_data["merchant_vpa"] = resolved["merchant_vpa"]
            logger.info(f"Injected memory merchant: {resolved['merchant_vpa']}")
            
        if resolved.get("amount") and not intent_data.get("amount"):
            intent_data["amount"] = resolved["amount"]
            logger.info(f"Injected memory amount: {resolved['amount']}")

    except Exception as e:
        logger.error(f"Intent parsing failed: {e}")
        # Return graceful error instead of 500
        return CommandResponse(
            status="error", 
            message=f"System Error: {str(e)}",
            user_state=get_user_state(req.user_id)
        )

    # 2. Schema Validation (Trust Gate 1)
    validated_intent, error = caps.validator.validate_safe(intent_data)
    
    if error:
        logger.warning(f"Schema validation failed: {error.message}")
        # Record bad turn
        caps.memory.add_user_turn(req.text, intent_type="UNKNOWN")
        return CommandResponse(
            status="error", 
            message=f"I couldn't understand that clearly. {error.message}",
            intent=intent_data,
            user_state=get_user_state(req.user_id),
            context_used=resolved if resolved else None
        )

    intent = validated_intent # Use the Pydantic model from now on

    # Record user turn in memory
    caps.memory.add_user_turn(
        req.text,
        intent_type=intent.intent_type.value if hasattr(intent.intent_type, 'value') else intent.intent_type,
        amount=intent.amount,
        merchant_vpa=intent.merchant_vpa
    )

    # Validate PAYMENT intents have both amount and receiver
    if intent.intent_type == IntentType.PAYMENT:
        missing = []
        if not intent.amount or intent.amount <= 0:
            missing.append("amount")
        if not intent.merchant_vpa:
            missing.append("recipient")
        
        if missing:
            missing_str = " and ".join(missing)
            logger.warning(f"Payment rejected - missing: {missing_str}")
            return CommandResponse(
                status="error",
                message=f"I need a {missing_str} to process this payment. Try saying something like 'Pay Arihant 500 rupees'.",
                intent=intent.model_dump(),
                user_state=get_user_state(req.user_id),
                context_used=resolved if resolved else None
            )

    # HANDLE NON-PAYMENT INTENTS
    if intent.intent_type == IntentType.BALANCE_INQUIRY:
        user_ctx = caps.context_service.get_user_context(req.user_id)
        if not user_ctx:
            # Create default context if missing
            from caps.context.mock_data import get_default_user
            user_ctx = get_default_user()
            
        return CommandResponse(
            status="processed",
            message="Balance Inquiry",
            intent=intent.model_dump(),
            policy_decision="APPROVE",
            execution_result={
                "balance": user_ctx.wallet_balance,
                "daily_spend": user_ctx.daily_spend_today,
                "currency": "INR"
            },
            user_state=get_user_state(req.user_id),
            context_used=resolved if resolved else None
        )

    if intent.intent_type == IntentType.TRANSACTION_HISTORY:
        history = caps.execution_engine.get_transaction_history(req.user_id)
        history_data = [
            {
                "transaction_id": txn.transaction_id,
                "amount": txn.amount,
                "merchant_vpa": txn.merchant_vpa,
                "state": txn.state.value,
                "timestamp": txn.created_at.isoformat() if txn.created_at else None
            }
            for txn in history
        ]
        return CommandResponse(
            status="processed",
            message="Transaction History",
            intent=intent.model_dump(),
            policy_decision="APPROVE",
            execution_result={
                "history": history_data
            },
            user_state=get_user_state(req.user_id),
            context_used=resolved if resolved else None
        )

    # 3. Context Retrieval (Direct sync call)
    user_ctx = caps.context_service.get_user_context(req.user_id)
    if not user_ctx:
        # Create default context if missing
        from caps.context.mock_data import get_default_user
        user_ctx = get_default_user()
        user_ctx.user_id = req.user_id

    # We need to fetch merchant context if it's a payment
    merchant_ctx = None
    if intent.merchant_vpa:
        merchant_ctx = caps.context_service.get_merchant_context(intent.merchant_vpa)

    # 4. Policy Evaluation
    policy_result = caps.policy_engine.evaluate(intent, user_ctx, merchant_ctx)
    
    # 5. Execution Routing
    execution_result_dict = None
    cmd_status = "processed"
    
    if policy_result.decision.value == "APPROVE":
        logger.info("Policy APPROVED. Executing transaction...")
        
        # Route: Create Transaction Record
        record = caps.router.route(intent, policy_result, req.user_id)
        
        # Execute
        exec_result = caps.execution_engine.execute(record)
        execution_result_dict = exec_result.__dict__
        
        if exec_result.success:
            cmd_status = "executed"
        else:
            cmd_status = "failed"
            
        # Record Payment Attempt in Memory
        caps.memory.record_payment_attempt(
            transaction_id=record.transaction_id,
            merchant_vpa=intent.merchant_vpa or "unknown",
            amount=intent.amount or 0.0,
            decision=policy_result.decision.value,
            success=exec_result.success,
            raw_input=req.text,
            reference_number=exec_result.reference_number
        )
            
    elif policy_result.decision.value == "DENY":
        cmd_status = "denied"
        # Just route to create denied record for logging
        caps.router.route(intent, policy_result, req.user_id)
        
        # Record Failed Payment Attempt in Memory
        caps.memory.record_payment_attempt(
            transaction_id="txn_denied", # Placeholder
            merchant_vpa=intent.merchant_vpa or "unknown",
            amount=intent.amount or 0.0,
            decision=policy_result.decision.value,
            success=False,
            raw_input=req.text
        )


    return CommandResponse(
        status=cmd_status,
        message=f"Processed: {intent.intent_type}",
        intent=intent.model_dump(),
        policy_decision=policy_result.decision.value,
        execution_result=execution_result_dict,
        risk_info={
            "score": policy_result.risk_score,
            "violations": [v.message for v in policy_result.violations],
            "passed_rules": policy_result.passed_rules,
            "reason": policy_result.reason
        },
        context_used=resolved if resolved else None,
        user_state=get_user_state(req.user_id)
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
