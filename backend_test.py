import requests
import sys
import json
from datetime import datetime, timedelta
import uuid

class TaskFlowAPITester:
    def __init__(self, base_url="https://autoflow-app.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.user_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_register(self):
        """Test user registration"""
        test_email = f"test_user_{datetime.now().strftime('%Y%m%d_%H%M%S')}@example.com"
        test_data = {
            "email": test_email,
            "password": "TestPass123!",
            "full_name": "Test User"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=test_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            print(f"   Token obtained: {self.token[:20]}...")
            return True, test_email
        return False, None

    def test_login(self, email, password="TestPass123!"):
        """Test user login"""
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={"email": email, "password": password}
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            print(f"   Token updated: {self.token[:20]}...")
            return True
        return False

    def test_get_user_info(self):
        """Test getting current user info"""
        success, response = self.run_test(
            "Get User Info",
            "GET",
            "auth/me",
            200
        )
        
        if success and 'id' in response:
            self.user_id = response['id']
            print(f"   User ID: {self.user_id}")
            return True
        return False

    def test_create_task(self, task_data):
        """Test creating a task"""
        success, response = self.run_test(
            f"Create Task: {task_data['title']}",
            "POST",
            "tasks",
            200,
            data=task_data
        )
        
        if success and 'id' in response:
            return True, response['id']
        return False, None

    def test_get_tasks(self):
        """Test getting all tasks"""
        success, response = self.run_test(
            "Get All Tasks",
            "GET",
            "tasks",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} tasks")
            return True, response
        return False, []

    def test_get_task(self, task_id):
        """Test getting a specific task"""
        success, response = self.run_test(
            f"Get Task {task_id}",
            "GET",
            f"tasks/{task_id}",
            200
        )
        return success, response

    def test_update_task(self, task_id, update_data):
        """Test updating a task"""
        success, response = self.run_test(
            f"Update Task {task_id}",
            "PUT",
            f"tasks/{task_id}",
            200,
            data=update_data
        )
        return success, response

    def test_delete_task(self, task_id):
        """Test deleting a task"""
        success, response = self.run_test(
            f"Delete Task {task_id}",
            "DELETE",
            f"tasks/{task_id}",
            200
        )
        return success, response

    def test_dashboard_stats(self):
        """Test getting dashboard statistics"""
        success, response = self.run_test(
            "Dashboard Stats",
            "GET",
            "dashboard/stats",
            200
        )
        
        if success:
            expected_keys = ['total_tasks', 'pending_tasks', 'in_progress_tasks', 'completed_tasks']
            has_all_keys = all(key in response for key in expected_keys)
            if has_all_keys:
                print(f"   Stats: Total={response.get('total_tasks')}, Pending={response.get('pending_tasks')}, In Progress={response.get('in_progress_tasks')}, Completed={response.get('completed_tasks')}")
                return True, response
            else:
                print(f"   Missing expected keys in stats response")
                return False, response
        return False, {}

def main():
    print("🚀 Starting TaskFlow API Testing...")
    print("=" * 50)
    
    tester = TaskFlowAPITester()
    
    # Test 1: User Registration
    print("\n📝 AUTHENTICATION TESTS")
    print("-" * 30)
    
    success, test_email = tester.test_register()
    if not success:
        print("❌ Registration failed, stopping tests")
        return 1

    # Test 2: Get User Info
    if not tester.test_get_user_info():
        print("❌ Get user info failed")
        return 1

    # Test 3: User Login (test with same credentials)
    if not tester.test_login(test_email):
        print("❌ Login failed")
        return 1

    # Test 4: Task Management
    print("\n📋 TASK MANAGEMENT TESTS")
    print("-" * 30)
    
    # Create multiple test tasks
    test_tasks = [
        {
            "title": "High Priority Task",
            "description": "This is a high priority task for testing",
            "priority": "high",
            "status": "pending",
            "due_date": (datetime.now() + timedelta(days=7)).isoformat()
        },
        {
            "title": "Medium Priority Task",
            "description": "This is a medium priority task",
            "priority": "medium",
            "status": "in_progress"
        },
        {
            "title": "Low Priority Completed Task",
            "description": "This task is already completed",
            "priority": "low",
            "status": "completed",
            "due_date": (datetime.now() + timedelta(days=3)).isoformat()
        }
    ]
    
    created_task_ids = []
    
    # Create tasks
    for task_data in test_tasks:
        success, task_id = tester.test_create_task(task_data)
        if success:
            created_task_ids.append(task_id)
        else:
            print(f"❌ Failed to create task: {task_data['title']}")

    # Test 5: Get all tasks
    success, all_tasks = tester.test_get_tasks()
    if not success:
        print("❌ Failed to get tasks")
        return 1

    # Test 6: Get individual tasks
    for task_id in created_task_ids[:2]:  # Test first 2 tasks
        success, task = tester.test_get_task(task_id)
        if not success:
            print(f"❌ Failed to get task {task_id}")

    # Test 7: Update a task
    if created_task_ids:
        update_data = {
            "title": "Updated Task Title",
            "status": "completed",
            "description": "This task has been updated during testing"
        }
        success, updated_task = tester.test_update_task(created_task_ids[0], update_data)
        if not success:
            print("❌ Failed to update task")

    # Test 8: Dashboard Stats
    print("\n📊 DASHBOARD TESTS")
    print("-" * 30)
    
    success, stats = tester.test_dashboard_stats()
    if not success:
        print("❌ Failed to get dashboard stats")

    # Test 9: Delete a task
    if created_task_ids:
        success, _ = tester.test_delete_task(created_task_ids[-1])
        if not success:
            print("❌ Failed to delete task")

    # Test 10: Verify stats updated after deletion
    success, updated_stats = tester.test_dashboard_stats()
    if success and stats:
        if updated_stats.get('total_tasks', 0) == stats.get('total_tasks', 0) - 1:
            print("✅ Dashboard stats updated correctly after deletion")
            tester.tests_passed += 1
        else:
            print("❌ Dashboard stats not updated correctly after deletion")
        tester.tests_run += 1

    # Test 11: Test error handling - invalid task ID
    print("\n🚫 ERROR HANDLING TESTS")
    print("-" * 30)
    
    invalid_task_id = str(uuid.uuid4())
    success, _ = tester.run_test(
        "Get Invalid Task (Should Fail)",
        "GET",
        f"tasks/{invalid_task_id}",
        404
    )
    
    # Test 12: Test unauthorized access
    original_token = tester.token
    tester.token = "invalid_token"
    success, _ = tester.run_test(
        "Unauthorized Access (Should Fail)",
        "GET",
        "tasks",
        401
    )
    tester.token = original_token

    # Print final results
    print("\n" + "=" * 50)
    print("📊 FINAL TEST RESULTS")
    print("=" * 50)
    print(f"Tests Run: {tester.tests_run}")
    print(f"Tests Passed: {tester.tests_passed}")
    print(f"Tests Failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed. Check the output above for details.")
        return 1

if __name__ == "__main__":
    sys.exit(main())