import pytest
import asyncio
from caps.server import CommandRequest, process_command, caps

@pytest.mark.asyncio
async def test_wallet_draining_simulation():
    """
    Simulate a 'Wallet Draining' attack where an attacker (or compromised agent)
    initiates a rapid sequence of payments to different merchants to empty the wallet.
    """
    # Use an existing mock user from mock_data to ensure context persistence
    # 'user_1' has 5000 balance and 2000 daily limit
    user_id = "user_1" 
    
    # Attack payload: 5 rapid transactions of 400 INR (Total 2000)
    payloads = [
         "Pay 400 to thief1@upi",
         "Pay 400 to thief2@upi",
         "Pay 400 to thief3@upi",
         "Pay 400 to thief4@upi",
         "Pay 400 to thief5@upi"
    ]
    
    print(f"\n--- Starting Draining Attack on {user_id} ---")
    results = []
    
    for i, text in enumerate(payloads):
        ctx = caps.context_service.get_user_context(user_id)
        # We need to manually reset daily spend if this test runs multiple times or order matters
        # But for now we assume fresh state or cumulative
        print(f"[{i}] Pre-Txn Spend: {ctx.daily_spend_today}")

        req = CommandRequest(text=text, user_id=user_id)
        response = await process_command(req)
        results.append(response)
        
        print(f"[{i}] Result: {response.policy_decision} ({response.status})")
        
        # Small delay to simulate network
        await asyncio.sleep(0.1)
        
    # Expectation: 
    # 1. Daily Limit is 2000. 5x400 = 2000. All pass (unless velocity triggers).
    # 2. If we try a 6th one, it MUST fail.
    
    req_final = CommandRequest(text="Pay 400 to thief6@upi", user_id=user_id)
    res_final = await process_command(req_final)
    
    print(f"Final Txn Result: {res_final.policy_decision}")
    print(f"Risk Info: {res_final.risk_info}")

    assert res_final.policy_decision == "DENY", "Should deny 6th transaction due to Daily Limit"
    assert "exceed daily limit" in str(res_final.risk_info) or "Velocity" in str(res_final.risk_info)
