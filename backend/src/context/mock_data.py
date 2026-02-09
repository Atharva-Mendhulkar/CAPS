"""
Mock Data Generator

Provides realistic mock data for testing and development.
Simulates various user and merchant scenarios.
"""

from datetime import datetime, timedelta, UTC
from caps.context.models import UserContext, MerchantContext


# Mock User Profiles
MOCK_USERS = {
    "user_normal": UserContext(
        user_id="user_normal",
        wallet_balance=1500.0,
        daily_spend_today=200.0,
        transactions_last_5min=1,
        transactions_today=3,
        device_fingerprint="device_abc123",
        is_known_device=True,
        session_age_seconds=3600,
        location="Vellore, TN",
        last_transaction_time=datetime.now(UTC) - timedelta(minutes=15),
        account_age_days=180,
        trust_score=0.8,
        known_contacts=["canteen@vit", "shop@upi"],
    ),
    "user_low_balance": UserContext(
        user_id="user_low_balance",
        wallet_balance=50.0,
        daily_spend_today=450.0,
        transactions_last_5min=0,
        transactions_today=5,
        device_fingerprint="device_xyz789",
        is_known_device=True,
        session_age_seconds=1800,
        location="Chennai, TN",
        last_transaction_time=datetime.now(UTC) - timedelta(minutes=30),
        account_age_days=90,
        trust_score=0.6,
        known_contacts=["shop@upi"],
    ),
    "user_high_velocity": UserContext(
        user_id="user_high_velocity",
        wallet_balance=2000.0,
        daily_spend_today=1800.0,
        transactions_last_5min=8,
        transactions_today=12,
        device_fingerprint="device_def456",
        is_known_device=True,
        session_age_seconds=600,
        location="Bangalore, KA",
        last_transaction_time=datetime.now(UTC) - timedelta(seconds=45),
        account_age_days=365,
        trust_score=0.4, # Lower due to velocity
        known_contacts=["canteen@vit", "cafe@bank", "shop@upi"],
    ),
    "user_new_device": UserContext(
        user_id="user_new_device",
        wallet_balance=1000.0,
        daily_spend_today=0.0,
        transactions_last_5min=0,
        transactions_today=0,
        device_fingerprint="device_new999",
        is_known_device=False,
        session_age_seconds=30,
        location="Mumbai, MH",
        last_transaction_time=None,
        account_age_days=5,
        trust_score=0.2, # Low for new device/account
        known_contacts=[],
    ),
    "user_test": UserContext(
        user_id="user_test",
        wallet_balance=1200.0,
        daily_spend_today=100.0,
        transactions_last_5min=0,
        transactions_today=2,
        device_fingerprint="device_test001",
        is_known_device=True,
        session_age_seconds=1200,
        location="Delhi, DL",
        last_transaction_time=datetime.now(UTC) - timedelta(minutes=45),
        account_age_days=120,
        trust_score=0.9,
        known_contacts=["canteen@vit", "arihant gupta@upi", "arihantgupta@upi"], # Add for testing
    ),
}


# Mock Merchant Profiles
MOCK_MERCHANTS = {
    "canteen@vit": MerchantContext(
        merchant_vpa="canteen@vit",
        reputation_score=0.95,
        is_whitelisted=True,
        total_transactions=5000,
        successful_transactions=4950,
        refund_rate=0.01,
        fraud_reports=0,
        merchant_category="5812",  # Restaurants
        registration_date=datetime.now(UTC) - timedelta(days=730),
    ),
    "shop@upi": MerchantContext(
        merchant_vpa="shop@upi",
        reputation_score=0.85,
        is_whitelisted=True,
        total_transactions=2000,
        successful_transactions=1950,
        refund_rate=0.025,
        fraud_reports=1,
        merchant_category="5411",  # Grocery
        registration_date=datetime.now(UTC) - timedelta(days=365),
    ),
    "newstore@upi": MerchantContext(
        merchant_vpa="newstore@upi",
        reputation_score=0.50,
        is_whitelisted=False,
        total_transactions=50,
        successful_transactions=48,
        refund_rate=0.04,
        fraud_reports=0,
        merchant_category="5999",  # Miscellaneous
        registration_date=datetime.now(UTC) - timedelta(days=15),
    ),
    "scam@merchant": MerchantContext(
        merchant_vpa="scam@merchant",
        reputation_score=0.15,
        is_whitelisted=False,
        total_transactions=100,
        successful_transactions=55,
        refund_rate=0.45,
        fraud_reports=12,
        merchant_category="5999",
        registration_date=datetime.now(UTC) - timedelta(days=7),
    ),
    "cafe@bank": MerchantContext(
        merchant_vpa="cafe@bank",
        reputation_score=0.90,
        is_whitelisted=True,
        total_transactions=3500,
        successful_transactions=3465,
        refund_rate=0.01,
        fraud_reports=0,
        merchant_category="5814",  # Fast Food
        registration_date=datetime.now(UTC) - timedelta(days=540),
    ),
}


def get_default_user() -> UserContext:
    """Get default user for testing."""
    return MOCK_USERS["user_test"]


def get_default_merchant(vpa: str = "unknown@merchant") -> MerchantContext:
    """Get default merchant context for unknown merchants."""
    return MerchantContext(
        merchant_vpa=vpa,
        reputation_score=0.50,
        is_whitelisted=False,
        total_transactions=0,
        successful_transactions=0,
        refund_rate=0.0,
        fraud_reports=0,
        merchant_category="5999",
        registration_date=datetime.now(UTC),
    )
