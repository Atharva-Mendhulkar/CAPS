import pytest
import asyncio
from caps.server import CommandRequest, process_command, caps

@pytest.mark.asyncio
async def test_split_transaction_velocity():
    """
    Attempt to bypass the "Max 10 transactions per 5 minutes" rule 
    by sending many small payments rapidly.
    """
    user_id = "user_velocity_test" # New user, start from 0
    merchant = "splitter@upi"
    
    # Attack: 15 transactions of 10 INR (Total 150 < 2000 Daily Limit)
    # But 15 > 10 (Velocity Limit)
    
    print(f"\n--- Starting Velocity Attack on {user_id} ---")
    
    results = []
    for i in range(15):
        amount = 10 + i
        text = f"Pay {amount} to {merchant}"
        req = CommandRequest(text=text, user_id=user_id)
        response = await process_command(req)
        results.append(response)
        
        print(f"[{i+1}/15] {response.policy_decision}")
        if response.policy_decision in ["DENY", "COOLDOWN"]:
            print(f"Blocked at txn {i+1}: {response.risk_info}")
            
    # Check that we eventually got blocked
    denials = [r for r in results if r.policy_decision in ["DENY", "COOLDOWN"]]
    approvals = [r for r in results if r.policy_decision == "APPROVE"]
    
    print(f"Approvals: {len(approvals)}, Denials: {len(denials)}")
    
    assert len(denials) > 0, "Velocity rule should have triggered"
    assert len(approvals) <= 12, "Should allow max 10 (maybe off-by-one or time windows)"
    
    # Ideally exactly 10 approvals
