import pytest
import uuid
from caps.schema import PaymentIntent, IntentType
from caps.execution import ExecutionEngine
from caps.ledger import AuditLedger
from caps.context.context_service import ContextService
from caps.execution.models import TransactionRecord, ExecutionState
from caps.policy import PolicyResult, PolicyDecision

@pytest.mark.asyncio
async def test_replay_attack_prevention():
    """
    Simulate a Replay Attack using a mock ExecutionEngine.
    """
    # Components
    ledger = AuditLedger()
    context_service = ContextService()
    execution_engine = ExecutionEngine(ledger=ledger, context_service=context_service)
    
    # 1. Create a valid intent (MANUALLY with confidence_score)
    original_intent = PaymentIntent(
        intent_type=IntentType.PAYMENT,
        amount=100.0,
        merchant_vpa="legit@upi",
        confidence_score=1.0, # REQUIRED FIELD
        raw_input="Pay 100 to legit@upi"
    )
    
    # 2. Create Record
    txn_id = str(uuid.uuid4())
    record = TransactionRecord(
        transaction_id=txn_id,
        user_id="user_replay_test",
        intent=original_intent,
        policy_result=PolicyResult(
            decision=PolicyDecision.APPROVE, 
            risk_score=0.1, 
            violations=[],
            reason="Test approval" # REQUIRED FIELD
        ),
        state=ExecutionState.APPROVED # Use ExecutionState enum
    )
    # Note: policy_result and state fields might need precise types from models
    
    # 3. Execute Once
    result1 = execution_engine.execute(record)
    assert result1.success == True
    
    # 4. Replay
    result2 = execution_engine.execute(record)
    
    assert result2.success == False
    assert "Duplicate" in result2.message or "processed" in result2.message
