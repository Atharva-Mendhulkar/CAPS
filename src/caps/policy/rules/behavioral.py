"""Layer 4: Behavioral Analysis Rules.

These rules analyze user and merchant behavior patterns
to detect anomalies that may indicate fraud or account compromise.
"""

from typing import Optional, Tuple

from caps.schema import PaymentIntent, IntentType
from caps.context import UserContext, MerchantContext
from caps.policy.models import RuleCategory, RuleViolation
from caps.policy.rules import Rule


# Thresholds
MIN_MERCHANT_REPUTATION = 0.3  # Below this = suspicious
NEW_DEVICE_MAX_AMOUNT = 200.0  # Lower limit for new devices


class DeviceValidationRule(Rule):
    """Validate device fingerprint and apply stricter limits for new devices."""
    
    def __init__(self):
        super().__init__(
            name="device_validation",
            category=RuleCategory.BEHAVIORAL,
            description="Validate device and apply new device limits",
            severity="high",
        )
    
    def evaluate(
        self,
        intent: PaymentIntent,
        user_context: Optional[UserContext] = None,
        merchant_context: Optional[MerchantContext] = None,
    ) -> Tuple[bool, Optional[RuleViolation]]:
        if intent.intent_type != IntentType.PAYMENT:
            return True, None
        
        if user_context is None:
            return True, None
        
        # New device with high amount = suspicious
        if not user_context.is_known_device:
            if intent.amount and intent.amount > NEW_DEVICE_MAX_AMOUNT:
                return False, self.create_violation(
                    f"New device detected. "
                    f"Amount ₹{intent.amount:.2f} exceeds new device limit of ₹{NEW_DEVICE_MAX_AMOUNT}",
                    details={
                        "is_known_device": False,
                        "device_fingerprint": user_context.device_fingerprint[:8] + "...",
                        "requested_amount": intent.amount,
                        "new_device_limit": NEW_DEVICE_MAX_AMOUNT,
                    }
                )
        
        return True, None


class MerchantReputationRule(Rule):
    """Check merchant reputation and flag suspicious merchants."""
    
    def __init__(self):
        super().__init__(
            name="merchant_reputation",
            category=RuleCategory.BEHAVIORAL,
            description=f"Merchant reputation must be above {MIN_MERCHANT_REPUTATION}",
            severity="high",
        )
    
    def evaluate(
        self,
        intent: PaymentIntent,
        user_context: Optional[UserContext] = None,
        merchant_context: Optional[MerchantContext] = None,
    ) -> Tuple[bool, Optional[RuleViolation]]:
        if intent.intent_type != IntentType.PAYMENT:
            return True, None
        
        if merchant_context is None:
            # Unknown merchant = proceed with caution
            return True, None
        
        if merchant_context.reputation_score < MIN_MERCHANT_REPUTATION:
            return False, self.create_violation(
                f"Merchant reputation ({merchant_context.reputation_score:.2f}) "
                f"below threshold ({MIN_MERCHANT_REPUTATION}). "
                f"Fraud reports: {merchant_context.fraud_reports}",
                details={
                    "merchant_vpa": merchant_context.merchant_vpa,
                    "reputation_score": merchant_context.reputation_score,
                    "threshold": MIN_MERCHANT_REPUTATION,
                    "fraud_reports": merchant_context.fraud_reports,
                    "refund_rate": merchant_context.refund_rate,
                    "is_whitelisted": merchant_context.is_whitelisted,
                }
            )
        
        return True, None


class FraudReportRule(Rule):
    """Flag merchants with high fraud reports."""
    
    def __init__(self):
        super().__init__(
            name="fraud_reports",
            category=RuleCategory.BEHAVIORAL,
            description="Flag merchants with fraud reports",
            severity="high",
        )
    
    def evaluate(
        self,
        intent: PaymentIntent,
        user_context: Optional[UserContext] = None,
        merchant_context: Optional[MerchantContext] = None,
    ) -> Tuple[bool, Optional[RuleViolation]]:
        if intent.intent_type != IntentType.PAYMENT:
            return True, None
        
        if merchant_context is None:
            return True, None
        
        if merchant_context.fraud_reports >= 5:
            return False, self.create_violation(
                f"Merchant has {merchant_context.fraud_reports} fraud reports",
                details={
                    "merchant_vpa": merchant_context.merchant_vpa,
                    "fraud_reports": merchant_context.fraud_reports,
                    "refund_rate": merchant_context.refund_rate,
                }
            )
        
        return True, None



class BrandImpersonationRule(Rule):
    """Checks for brand impersonation using BrandProtection."""
    
    def __init__(self):
        super().__init__(
            name="brand_impersonation",
            category=RuleCategory.BEHAVIORAL,
            description="Prevent brand impersonation and typosquatting",
            severity="critical",
        )
        from caps.intelligence.brand_protection import BrandProtection
        self.bp = BrandProtection()
    
    def evaluate(
        self,
        intent: PaymentIntent,
        user_context: Optional[UserContext] = None,
        merchant_context: Optional[MerchantContext] = None,
    ) -> Tuple[bool, Optional[RuleViolation]]:
        if intent.intent_type != IntentType.PAYMENT:
            return True, None
            
        if not intent.merchant_vpa:
            return True, None

        is_impersonating, brand = self.bp.check_brand_impersonation(intent.merchant_vpa)
        
        if is_impersonating:
            return False, self.create_violation(
                f"Brand Impersonation Detected: VPA '{intent.merchant_vpa}' mimics brand '{brand}'.",
                details={
                    "merchant_vpa": intent.merchant_vpa,
                    "target_brand": brand,
                }
            )
            
        return True, None


class MerchantRiskRule(Rule):
    """Enforce merchant risk state (BLOCKED/WATCHLIST)."""
    
    def __init__(self):
        super().__init__(
            name="merchant_risk_state",
            category=RuleCategory.BEHAVIORAL,
            description="Enforce merchant risk state restrictions",
            severity="critical",
        )
        # Import internally or keep strings to avoid circular deps if any
        # from caps.intelligence.models import MerchantRiskState

    def evaluate(
        self,
        intent: PaymentIntent,
        user_context: Optional[UserContext] = None,
        merchant_context: Optional[MerchantContext] = None,
    ) -> Tuple[bool, Optional[RuleViolation]]:
        if intent.intent_type != IntentType.PAYMENT:
            return True, None
            
        if merchant_context is None:
            # If no context, we might default to cautious or allow checks elsewhere
            # Usually ContextEvaluator ensures context exists.
            return True, None
            
        risk_state = merchant_context.risk_state
        
        if risk_state == "BLOCKED":
            return False, self.create_violation(
                f"Merchant is BLOCKED due to fraud risk.",
                details={"risk_state": risk_state}
            )
            
        if risk_state == "WATCHLIST":
            # For now, we flag it. 
            # Policy Engine might decide to ESCALATE based on violation severity?
            # Or we return True with a stored warning?
            # Rules return (pass, violation).
            # If we want to ESCALATE, we should return False (violation).
            # And let Decision Router handle it.
            # But wait, strict rules mean DENY if False.
            # CAPS has "Approve", "Deny", "Verify".
            # If ANY rule returns False, it's a Violation.
            # Does Violation mean Deny?
            # Layer 4 failures -> Verify/Deny depending on logic.
            # Let's check caps/policy/engine.py
            
            # For WATCHLIST, maybe we want to force explicit consent but not block.
            # If I return False, it counts as a violation.
            # Violations usually lead to Deny or Reauth.
            # Let's enforce REAUTH (Verify) for Watchlist.
            # So returning False is correct.
            return False, self.create_violation(
                f"Merchant is on WATCHLIST.",
                details={"risk_state": risk_state}
            )
            
        return True, None


# Export all Layer 4 rules
BEHAVIORAL_RULES = [
    DeviceValidationRule(),
    MerchantReputationRule(),
    FraudReportRule(),
    BrandImpersonationRule(),
    MerchantRiskRule(),
]
