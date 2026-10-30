with open('tests/test_comprehensive.py', 'r') as f:
    content = f.read()

# Replace the specific lines with correct indentation
content = content.replace(
    '            dangerous_args = {"query": "ls; rm -rf /"}',
    '        dangerous_args = {"query": "ls; rm -rf /"}'
)

content = content.replace(
    '            invalid_status = {"task_id": 1, "status": "invalid_status"}',
    '        invalid_status = {"task_id": 1, "status": "invalid_status"}'
)

with open('tests/test_comprehensive.py', 'w') as f:
    f.write(content)

print('Fixed!')