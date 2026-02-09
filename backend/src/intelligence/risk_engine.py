"""Risk Engine - Manages Merchant Risk States.

Implements the state machine for merchant trust:
NEW -> TRUSTED -> WATCHLIST -> BLOCKED
"""

from datetime import datetime, timedelta, UTC
from typing import Optional, Dict

from caps.intelligence.models import MerchantScore, MerchantRiskState, MerchantBadge

# Configuration
MIN_TRUSTED_TXNS = 5
MIN_TRUSTED_DAYS = 7
MAX_REFUND_RATE = 0.20  # 20%
WATCHLIST_COOLDOWN_DAYS = 30


class RiskEngine:
    """Manages merchant risk state transitions."""
    
    def __init__(self):
        pass
    
    def evaluate_state_transition(
        self,
        merchant_vpa: str,
        total_txns: int,
        total_refunds: int,
        first_seen: datetime,
        current_state: MerchantRiskState = MerchantRiskState.NEW,
        is_impersonating: bool = False
    ) -> MerchantRiskState:
        """
        Determine the new risk state for a merchant.
        
        Args:
            merchant_vpa: Merchant ID
            total_txns: Valid payments count
            total_refunds: Refund count
            first_seen: Timestamp of first interaction
            current_state: Current risk state
            is_impersonating: Flag from brand protection
            
        Returns:
            New MerchantRiskState
        """
        # 1. Immediate Block Condition
        if is_impersonating:
            return MerchantRiskState.BLOCKED
            
        # If already blocked, stay blocked (requires manual override)
        if current_state == MerchantRiskState.BLOCKED:
            return MerchantRiskState.BLOCKED
            
        # Calculate stats
        refund_rate = total_refunds / total_txns if total_txns > 0 else 0.0
        days_active = (datetime.now(UTC) - first_seen).days
        
        # 2. Transition NEW -> TRUSTED
        if current_state == MerchantRiskState.NEW:
            if total_txns >= MIN_TRUSTED_TXNS and days_active >= MIN_TRUSTED_DAYS:
                # Only upgrade if refunds are low
                if refund_rate < 0.05:
                    return MerchantRiskState.TRUSTED
            return MerchantRiskState.NEW
            
        # 3. Transition TRUSTED -> WATCHLIST
        if current_state == MerchantRiskState.TRUSTED:
            if refund_rate > MAX_REFUND_RATE:
                return MerchantRiskState.WATCHLIST
            return MerchantRiskState.TRUSTED
            
        # 4. Transition WATCHLIST -> BLOCKED
        if current_state == MerchantRiskState.WATCHLIST:
            # If refund rate continues to spike
            if refund_rate > 0.50: 
                return MerchantRiskState.BLOCKED
                
            # If behavior improves (manual review or long time clean?)
            # For now, we don't auto-upgrade from WATCHLIST easily
            return MerchantRiskState.WATCHLIST
            
        return MerchantRiskState.NEW
