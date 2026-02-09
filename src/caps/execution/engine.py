"""Execution Engine - Mock UPI Lite payment simulator."""

import logging
import random
import uuid
from datetime import datetime, timedelta, UTC
from typing import Dict, Optional

from caps.execution.models import (
    ExecutionState,
    ExecutionResult,
    TransactionRecord,
    IdempotencyKey,
)
from caps.ledger.models import EventType


logger = logging.getLogger(__name__)


class ExecutionEngine:
    """
    Mock UPI Lite Execution Engine.
    
    Simulates payment execution with:
    - Idempotency checks (prevent duplicate transactions)
    - Hash verification (ensure approval matches execution)
    - Random failure simulation (for testing)
    - Transaction logging
    
    SECURITY: This is a mock engine for testing.
    Real implementation would connect to UPI Lite PSP.
    """
    
    def __init__(self, failure_rate: float = 0.05, ledger=None, context_service=None):
        """
        Initialize the execution engine.
        
        Args:
            failure_rate: Probability of simulated failure (0.0-1.0)
            ledger: Optional AuditLedger for structured logging
            context_service: Optional ContextService for state updates
        """
        self.failure_rate = failure_rate
        self.ledger = ledger
        self.context_service = context_service
        self.idempotency_store: Dict[str, IdempotencyKey] = {}
        self.transaction_log: Dict[str, TransactionRecord] = {}
        self._seed_mock_data()
        
        logger.info(f"Execution Engine initialized (failure_rate={failure_rate})")

    def _seed_mock_data(self):
        """Seed some initial mock transactions for demo purposes."""
        start_time = datetime.now(UTC) - timedelta(days=2)
        users = ["test_user"]
        merchants = ["shop@upi", "cafe@upi", "movies@upi", "cab@upi"]
        
        for i in range(5):
            txn_id = str(uuid.uuid4())
            merchant = merchants[i % len(merchants)]
            amount = 100.0 + (i * 50)
            
            record = TransactionRecord(
                transaction_id=txn_id,
                intent_id=str(uuid.uuid4()),
                intent_hash="mock_intent_hash",
                user_id="test_user",
                amount=amount,
                merchant_vpa=merchant,
                state=ExecutionState.COMPLETED,
                created_at=start_time + timedelta(hours=i*4),
                approval_hash="mock_hash",
                executed_at=start_time + timedelta(hours=i*4, seconds=30)
            )
            self.transaction_log[txn_id] = record
    
    def execute(self, record: TransactionRecord) -> ExecutionResult:
        """
        Execute a payment transaction.
        
        Args:
            record: Transaction record (must be in APPROVED state)
            
        Returns:
            ExecutionResult with success/failure details
        """
        # Validate state
        if record.state != ExecutionState.APPROVED:
            return ExecutionResult(
                success=False,
                transaction_id=record.transaction_id,
                state=record.state,
                message=f"Cannot execute transaction in state: {record.state.value}",
                error_code="INVALID_STATE",
                error_message=f"Expected APPROVED, got {record.state.value}",
            )
        
        # Check idempotency
        idempotency_key = self._generate_idempotency_key(record)
        if existing := self._check_idempotency(idempotency_key):
            logger.warning(f"Duplicate transaction detected: {existing.transaction_id}")
            return ExecutionResult(
                success=False,
                transaction_id=record.transaction_id,
                state=ExecutionState.FAILED,
                message="Duplicate transaction - already processed",
                error_code="DUPLICATE",
                error_message=f"Original transaction: {existing.transaction_id}",
            )
        
        # Verify hashes match
        if not self._verify_hashes(record):
            return ExecutionResult(
                success=False,
                transaction_id=record.transaction_id,
                state=ExecutionState.FAILED,
                message="Hash verification failed - potential tampering",
                error_code="HASH_MISMATCH",
                error_message="Approval hash does not match intent hash",
            )
        
        # Log start of execution
        if self.ledger:
            self.ledger.log_event(
                event_type=EventType.EXECUTION_STARTED,
                payload={
                    "transaction_id": record.transaction_id,
                    "amount": record.amount,
                    "merchant": record.merchant_vpa,
                    "timestamp": datetime.now(UTC).isoformat()
                }
            )

        # Transition to executing
        record.transition_to(ExecutionState.EXECUTING)
        
        # Simulate execution (with random failures)
        if random.random() < self.failure_rate:
            record.transition_to(ExecutionState.FAILED)
            record.error_message = "Simulated network failure"
            
            # Log failure
            if self.ledger:
                self.ledger.log_event(
                    event_type=EventType.EXECUTION_FAILED,
                    payload={
                        "transaction_id": record.transaction_id,
                        "reason": "Simulated network failure"
                    }
                )
            
            return ExecutionResult(
                success=False,
                transaction_id=record.transaction_id,
                state=ExecutionState.FAILED,
                message="Payment failed - please try again",
                error_code="NETWORK_ERROR",
                error_message="Simulated network failure",
            )
        
        # Success!
        record.transition_to(ExecutionState.COMPLETED)
        record.executed_at = datetime.now(UTC)
        record.execution_hash = record.compute_execution_hash()
        
        # Store idempotency key
        self._store_idempotency(idempotency_key, record)
        
        # Log transaction
        self.transaction_log[record.transaction_id] = record
        
        # Generate mock reference number
        ref_number = f"UPI{uuid.uuid4().hex[:12].upper()}"
        
        # Log completion
        if self.ledger:
            self.ledger.log_event(
                event_type=EventType.EXECUTION_COMPLETED,
                payload={
                    "transaction_id": record.transaction_id,
                    "reference_number": ref_number,
                    "execution_hash": record.execution_hash,
                    "timestamp": record.executed_at.isoformat()
                }
            )
        
        logger.info(
            f"Payment executed: {record.transaction_id} "
            f"₹{record.amount} → {record.merchant_vpa} "
            f"[Ref: {ref_number}]"
        )
        
        # Update Context/Risk Engine with success
        if hasattr(self, 'context_service') and self.context_service:
            try:
                from caps.context.models import TransactionRecord as ContextTxnRecord
                
                ctx_txn = ContextTxnRecord(
                    transaction_id=record.transaction_id,
                    user_id=record.user_id,
                    merchant_vpa=record.merchant_vpa,
                    amount=record.amount,
                    timestamp=record.executed_at or datetime.now(UTC),
                    status="success",
                    is_refund=False
                )
                self.context_service.record_transaction(record.user_id, ctx_txn)
            except Exception as e:
                logger.error(f"Failed to record transaction in Context Service: {e}")
        
        return ExecutionResult(
            success=True,
            transaction_id=record.transaction_id,
            state=ExecutionState.COMPLETED,
            message=f"Payment of ₹{record.amount:.2f} to {record.merchant_vpa} successful",
            reference_number=ref_number,
            executed_at=record.executed_at,
            execution_hash=record.execution_hash,
        )
    
    def get_transaction(self, transaction_id: str) -> Optional[TransactionRecord]:
        """Get a transaction by ID."""
        return self.transaction_log.get(transaction_id)
    
    def get_transaction_history(
        self, 
        user_id: str, 
        limit: int = 50,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> list[TransactionRecord]:
        """
        Get transaction history for a user with optional date filtering.
        """
        user_txns = [
            t for t in self.transaction_log.values()
            if t.user_id == user_id
        ]
        
        # Filter by date if provided
        if start_date:
            user_txns = [t for t in user_txns if t.created_at >= start_date]
        if end_date:
            user_txns = [t for t in user_txns if t.created_at <= end_date]
            
        return sorted(user_txns, key=lambda t: t.created_at, reverse=True)[:limit]

    def get_spending_analysis(
        self,
        user_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Analyze spending habits for a user within a timeframe.
        """
        txns = self.get_transaction_history(user_id, limit=1000, start_date=start_date, end_date=end_date)
        
        # Filter only successful debits (spending)
        spending_txns = [
            t for t in txns 
            if t.state in (ExecutionState.COMPLETED, ExecutionState.EXECUTING)
        ]
        
        total_spend = sum(t.amount for t in spending_txns)
        
        # Group by merchant
        by_merchant = {}
        for t in spending_txns:
            merchant = t.merchant_vpa
            if merchant not in by_merchant:
                by_merchant[merchant] = 0.0
            by_merchant[merchant] += t.amount
            
        # Format for chart
        breakdown = [
            {"name": m, "value": amt} 
            for m, amt in by_merchant.items()
        ]
        # Sort by spend
        breakdown.sort(key=lambda x: x["value"], reverse=True)
        
        return {
            "total_spend": total_spend,
            "transaction_count": len(spending_txns),
            "breakdown": breakdown,
            "period": {
                "start": start_date.isoformat() if start_date else "All Time",
                "end": end_date.isoformat() if end_date else "Now"
            }
        }
    
    def _generate_idempotency_key(self, record: TransactionRecord) -> str:
        """Generate idempotency key from transaction details."""
        # Key based on user, merchant, amount, and approximate time window
        time_window = record.created_at.strftime("%Y%m%d%H%M")  # 1-minute window
        return f"{record.user_id}:{record.merchant_vpa}:{record.amount}:{time_window}"
    
    def _check_idempotency(self, key: str) -> Optional[IdempotencyKey]:
        """Check if idempotency key exists and is valid."""
        if key in self.idempotency_store:
            existing = self.idempotency_store[key]
            if datetime.now(UTC) < existing.expires_at:
                return existing
            else:
                # Expired, remove it
                del self.idempotency_store[key]
        return None
    
    def _store_idempotency(self, key: str, record: TransactionRecord) -> None:
        """Store idempotency key."""
        self.idempotency_store[key] = IdempotencyKey(
            key=key,
            transaction_id=record.transaction_id,
            expires_at=datetime.now(UTC) + timedelta(hours=24),
        )
    
    def _verify_hashes(self, record: TransactionRecord) -> bool:
        """Verify that approval hash is present."""
        # In a real system, we'd verify cryptographic signatures
        if not record.approval_hash:
            logger.warning("Missing approval hash")
            return False
        return True
