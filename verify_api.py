import requests
import sys

def test_api():
    url = "http://localhost:8000/process-command"
    payload = {
        "text": "pay shop@upi 100",
        "user_id": "test_user_1"
    }
    
    try:
        print(f"Sending request to {url}...")
        response = requests.post(url, json=payload)
        response.raise_for_status()
        
        data = response.json()
        print("Response:", data)
        
        if data["status"] == "processed":
            print("✅ API Verification Passed")
            sys.exit(0)
        else:
            print("❌ API returned unexpected status")
            sys.exit(1)
            
    except Exception as e:
        print(f"❌ API Verification Failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    test_api()
