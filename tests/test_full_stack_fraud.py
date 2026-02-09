
import pytest
from caps.context.context_service import context_service
from caps.policy.engine import PolicyEngine
from caps.schema import PaymentIntent, IntentType
from caps.intelligence.models import MerchantRiskState
from caps.context.mock_data import get_default_user
import asyncio

def test_e2e_blocked_merchant_denial():
    # 1. Setup Policy Engine
    engine = PolicyEngine()
    
    # 2. Seed Fraud Intelligence with a bad merchant
    bad_vpa = "bad_actor@upi"
    
    # Ensure fresh connection/state if shared
    conn = context_service.fi._get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT OR REPLACE INTO scores 
           (merchant_vpa, risk_state, total_reports, last_updated)
           VALUES (?, ?, ?, ?)""",
        (bad_vpa, "BLOCKED", 100, "2023-01-01T00:00:00")
    )
    conn.commit()
    context_service.fi._close_connection(conn)
    
    # 3. Verify Context Service returns BLOCKED
    ctx = context_service.get_merchant_context(bad_vpa)
    assert ctx.risk_state == "BLOCKED"
    
    # 4. Create Intent
    intent = PaymentIntent(
        intent_type=IntentType.PAYMENT,
        amount=500.0,
        currency="INR",
        merchant_vpa=bad_vpa,
        confidence_score=1.0,
        original_text=f"pay {bad_vpa} 500"
    )
    
    # 5. Evaluate Policy
    # Need user context for hard invariants (balance, limit)
    user_ctx = get_default_user()
    user_ctx.wallet_balance = 50000.0  # Ensure enough funds
    
    # We pass the context we fetched
    result = engine.evaluate(intent, merchant_context=ctx, user_context=user_ctx)
    
    # 6. Expect DENY
    print(f"\nBlocked Decision: {result.decision.value}")
    print(f"Blocked Reason: {result.reason}")
    
    assert result.decision.value == "DENY"
    # The reason should be about the merchant being blocked
    assert "Merchant is blocked" in result.reason or "Merchant is BLOCKED" in result.reason

def test_e2e_brand_impersonation_blocking():
    # Test Brand Impersonation (Layer 4 Rule)
    engine = PolicyEngine()
    
    intent = PaymentIntent(
        intent_type=IntentType.PAYMENT,
        amount=500.0,
        currency="INR",
        merchant_vpa="flipk4rt@upi", # Imposter
        confidence_score=1.0,
        original_text="pay flipk4rt 500"
    )
    
    # Need valid user context
    user_ctx = get_default_user()
    user_ctx.wallet_balance = 50000.0
    
    # Evaluate
    result = engine.evaluate(intent, user_context=user_ctx)
    
    print(f"\nImpersonation Decision: {result.decision.value}")
    print(f"Impersonation Reason: {result.reason}")
    
    assert result.decision.value == "DENY"
    assert "Brand Impersonation Detected" in result.reason
