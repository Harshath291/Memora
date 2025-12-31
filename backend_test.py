import requests
import sys
import json
from datetime import datetime, timedelta

class MemoraAPITester:
    def __init__(self, base_url="https://note-memora.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_id = None
        self.username = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_note_id = None
        self.created_reminder_id = None
        self.created_friend_id = None
        self.created_checkbox_note_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        print(f"   Method: {method}")
        if data:
            print(f"   Data: {json.dumps(data, indent=2)}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)

            print(f"   Response Status: {response.status_code}")
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_signup(self):
        """Test user signup"""
        test_username = f"testuser_{datetime.now().strftime('%H%M%S')}"
        success, response = self.run_test(
            "User Signup",
            "POST",
            "auth/signup",
            200,
            data={
                "username": test_username,
                "email": "test@example.com",
                "password": "TestPass123!"
            }
        )
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user_id']
            self.username = response['username']
            print(f"   Stored token and user info for {self.username}")
            return True
        return False

    def test_login(self):
        """Test user login with existing credentials"""
        if not self.username:
            print("❌ No username available for login test")
            return False
            
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={
                "username": self.username,
                "password": "TestPass123!"
            }
        )
        if success and 'token' in response:
            self.token = response['token']
            return True
        return False

    def test_get_me(self):
        """Test get current user info"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        return success and response.get('username') == self.username

    def test_create_note(self):
        """Test creating a note"""
        success, response = self.run_test(
            "Create Note",
            "POST",
            "notes",
            200,
            data={
                "title": "Test Note",
                "content": "This is a test note content for API testing."
            }
        )
        if success and 'id' in response:
            self.created_note_id = response['id']
            return True
        return False

    def test_get_notes(self):
        """Test getting all notes"""
        success, response = self.run_test(
            "Get All Notes",
            "GET",
            "notes",
            200
        )
        return success and isinstance(response, list)

    def test_get_note_detail(self):
        """Test getting a specific note"""
        if not self.created_note_id:
            print("❌ No note ID available for detail test")
            return False
            
        success, response = self.run_test(
            "Get Note Detail",
            "GET",
            f"notes/{self.created_note_id}",
            200
        )
        return success and response.get('id') == self.created_note_id

    def test_on_this_day_notes(self):
        """Test getting on this day notes"""
        success, response = self.run_test(
            "Get On This Day Notes",
            "GET",
            "notes/on-this-day/list",
            200
        )
        return success and isinstance(response, list)

    def test_create_reminder(self):
        """Test creating a reminder"""
        future_date = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')
        success, response = self.run_test(
            "Create Reminder",
            "POST",
            "reminders",
            200,
            data={
                "title": "Test Reminder",
                "date": future_date,
                "note": "This is a test reminder note."
            }
        )
        if success and 'id' in response:
            self.created_reminder_id = response['id']
            return True
        return False

    def test_get_reminders(self):
        """Test getting all reminders"""
        success, response = self.run_test(
            "Get All Reminders",
            "GET",
            "reminders",
            200
        )
        return success and isinstance(response, list)

    def test_add_friend(self):
        """Test adding a friend"""
        # First create another user to be a friend
        friend_username = f"friend_{datetime.now().strftime('%H%M%S')}"
        friend_signup = self.run_test(
            "Create Friend User",
            "POST",
            "auth/signup",
            200,
            data={
                "username": friend_username,
                "password": "FriendPass123!"
            }
        )
        
        if not friend_signup[0]:
            print("❌ Failed to create friend user")
            return False
        
        # Now add the friend
        success, response = self.run_test(
            "Add Friend",
            "POST",
            "friends",
            200,
            data={
                "friend_username": friend_username
            }
        )
        if success and 'id' in response:
            self.created_friend_id = response['id']
            return True
        return False

    def test_get_friends(self):
        """Test getting all friends"""
        success, response = self.run_test(
            "Get All Friends",
            "GET",
            "friends",
            200
        )
        return success and isinstance(response, list)

    def test_create_checkbox_note(self):
        """Test creating a checkbox note"""
        success, response = self.run_test(
            "Create Checkbox Note",
            "POST",
            "checkbox-notes",
            200,
            data={
                "title": "Test Checkbox Note",
                "items": [
                    {"text": "First task", "checked": False},
                    {"text": "Second task", "checked": True},
                    {"text": "Third task", "checked": False}
                ]
            }
        )
        if success and 'id' in response:
            self.created_checkbox_note_id = response['id']
            return True
        return False

    def test_get_checkbox_notes(self):
        """Test getting all checkbox notes"""
        success, response = self.run_test(
            "Get All Checkbox Notes",
            "GET",
            "checkbox-notes",
            200
        )
        return success and isinstance(response, list)

    def test_update_checkbox_note(self):
        """Test updating a checkbox note"""
        if not self.created_checkbox_note_id:
            print("❌ No checkbox note ID available for update test")
            return False
            
        success, response = self.run_test(
            "Update Checkbox Note",
            "PUT",
            f"checkbox-notes/{self.created_checkbox_note_id}",
            200,
            data={
                "title": "Updated Checkbox Note",
                "items": [
                    {"text": "Updated first task", "checked": True},
                    {"text": "Updated second task", "checked": False},
                    {"text": "New third task", "checked": False}
                ]
            }
        )
        return success and response.get('id') == self.created_checkbox_note_id

    def test_invalid_auth(self):
        """Test API with invalid authentication"""
        old_token = self.token
        self.token = "invalid_token"
        
        success, response = self.run_test(
            "Invalid Auth Test",
            "GET",
            "auth/me",
            401
        )
        
        self.token = old_token
        return success

def main():
    print("🚀 Starting Memora API Testing...")
    print("=" * 60)
    
    tester = MemoraAPITester()
    
    # Test sequence
    test_sequence = [
        ("User Signup", tester.test_signup),
        ("User Login", tester.test_login),
        ("Get Current User", tester.test_get_me),
        ("Create Note", tester.test_create_note),
        ("Get All Notes", tester.test_get_notes),
        ("Get Note Detail", tester.test_get_note_detail),
        ("Get On This Day Notes", tester.test_on_this_day_notes),
        ("Create Reminder", tester.test_create_reminder),
        ("Get All Reminders", tester.test_get_reminders),
        ("Add Friend", tester.test_add_friend),
        ("Get All Friends", tester.test_get_friends),
        ("Create Checkbox Note", tester.test_create_checkbox_note),
        ("Get All Checkbox Notes", tester.test_get_checkbox_notes),
        ("Update Checkbox Note", tester.test_update_checkbox_note),
        ("Invalid Auth Test", tester.test_invalid_auth),
    ]
    
    failed_tests = []
    
    for test_name, test_func in test_sequence:
        try:
            if not test_func():
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {str(e)}")
            failed_tests.append(test_name)
    
    # Print results
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS")
    print("=" * 60)
    print(f"Tests run: {tester.tests_run}")
    print(f"Tests passed: {tester.tests_passed}")
    print(f"Tests failed: {len(failed_tests)}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if failed_tests:
        print(f"\n❌ Failed tests:")
        for test in failed_tests:
            print(f"   - {test}")
    else:
        print(f"\n✅ All tests passed!")
    
    return 0 if len(failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())