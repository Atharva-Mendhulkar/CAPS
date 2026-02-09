"""
Trust and Safety Rules (Layer 4)

These rules leverage the dynamic trust profile of the user.
"""

from typing import Optional, Tuple
from caps.policy.rules import Rule
from caps.policy.models import RuleCategory, RuleViolation
from caps.context.models import UserContext, MerchantContext
from caps.schema import PaymentIntent


class NewPayeeRule(Rule):
    """
    Flags payments to new contacts (unknown to user).
    
    If amount is high (> ₹500) and payee is new, increase risk.
    """
    
    def __init__(self):
        super().__init__(
            name="check_new_payee",
            category=RuleCategory.BEHAVIORAL,
            description="Checks if payee is a known contact",
            severity="medium"
        )
    
    def evaluate(self, intent: PaymentIntent, user_context: Optional[UserContext], merchant_context: Optional[MerchantContext]) -> Tuple[bool, Optional[RuleViolation]]:
        if not user_context or not intent.merchant_vpa:
            return True, None

        # Check if known
        is_known = intent.merchant_vpa in user_context.known_contacts
        
        # If new payee
        if not is_known:
            # If amount is significant (> ₹500), flag it
            if intent.amount and intent.amount > 500:
                return False, self.create_violation(
                    message=f"High value payment to new payee: {intent.merchant_vpa}",
                    details={"amount": intent.amount, "limit": 500}
                )
        
        return True, None


class TrustScoreRule(Rule):
    """
    Adjusts risk tolerance based on user's trust score.
    
    Low trust users (<0.4) get stricter scrutiny.
    """
    
    def __init__(self):
        super().__init__(
            name="check_trust_score",
            category=RuleCategory.BEHAVIORAL,
            description="Evaluates user trust score",
            severity="medium"
        )
    
    def evaluate(self, intent: PaymentIntent, user_context: Optional[UserContext], merchant_context: Optional[MerchantContext]) -> Tuple[bool, Optional[RuleViolation]]:
        if not user_context:
            return True, None
            
        score = user_context.trust_score
        
        if score < 0.4:
            # Low trust user - flag as violation to increase risk score or require stepped-up auth
            # In our current model, violations = friction.
            return False, self.create_violation(
                message=f"Low trust user profile (score: {score:.2f})",
                details={"trust_score": score}
            )
            
        return True, None


TRUST_RULES = [
    NewPayeeRule(),
    TrustScoreRule(),
]
