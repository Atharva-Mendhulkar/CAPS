
import pytest
import sqlite3
from datetime import datetime, timedelta, UTC
from caps.intelligence.aggregator import FraudIntelligence
from caps.intelligence.models import MerchantRiskState

@pytest.fixture
def fi_service():
    service = FraudIntelligence(db_path=":memory:")
    yield service
    service.close()

def test_new_to_trusted_transition(fi_service):
    merchant = "good_merchant@upi"
    
    # 1. Manually insert record with old timestamp (>7 days ago)
    # to satisfy "days_active" requirement
    old_date = (datetime.now(UTC) - timedelta(days=8)).isoformat()
    conn = fi_service._get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO scores (merchant_vpa, first_report, last_updated, risk_state) VALUES (?, ?, ?, ?)",
        (merchant, old_date, old_date, "NEW")
    )
    conn.commit()
    
    # 2. Add 4 successful transactions (Total 4) -> Should stay NEW
    for _ in range(4):
        state = fi_service.update_transaction_stats(merchant, success=True)
        assert state == MerchantRiskState.NEW
    
    # 3. Add 5th transaction (Total 5) -> Should become TRUSTED
    # MIN_TRUSTED_TXNS = 5
    state = fi_service.update_transaction_stats(merchant, success=True)
    assert state == MerchantRiskState.TRUSTED

def test_trusted_to_watchlist_transition(fi_service):
    merchant = "risky_merchant@upi"
    
    # Setup trusted merchant (old enough, enough txns)
    old_date = (datetime.now(UTC) - timedelta(days=30)).isoformat()
    conn = fi_service._get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO scores 
           (merchant_vpa, first_report, total_txns, total_refunds, risk_state) 
           VALUES (?, ?, ?, ?, ?)""",
        (merchant, old_date, 100, 0, "TRUSTED")
    )
    conn.commit()
    
    # Current stats: 100 txns, 0 refunds. Refund rate 0%.
    
    # 2. Add refunds. MAX_REFUND_RATE = 0.20 (20%)
    # To exceed 20%, we need > 25 refunds (if txns = 100+refunds? No, total_txns usually includes successes? 
    # RiskEngine calculates: refund_rate = total_refunds / total_txns
    # Depending on how we count. update_transaction_stats increments total_refunds OR total_txns.
    # So if total_txns = 100 (successes), total_refunds = X.
    # We need X / 100 > 0.20 => X > 20.
    
    # Add 25 refunds
    for _ in range(25):
        fi_service.update_transaction_stats(merchant, is_refund=True)
    
    # Now: 100 success, 25 refunds.
    # rate = 25 / 100 = 0.25 > 0.20
    
    # Verify state
    score = fi_service.get_merchant_score(merchant)
    
    # Note: update_transaction_stats calls evaluate.
    # Only the call that crossed the threshold triggers transition.
    # But since we called it 25 times, the last one definitely checks.
    
    # Debug: RiskEngine defines refund_rate = total_refunds / total_txns
    # If total_txns tracks *successful* payments (as per description), then this logic holds.
    
    assert score.risk_state == MerchantRiskState.WATCHLIST
