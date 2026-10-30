with open('tests/test_comprehensive.py', 'r') as f:
    content = f.read()

# Fix the health check tests
old_health = '''    def test_health_root(self, client):
        """Test root health endpoint."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"

    def test_health_db(self, client):
        """Test database health endpoint."""
        response = client.get("/health/db")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["database"] == "connected"

    def test_health_ai(self, client):
        """Test AI service health endpoint."""
        response = client.get("/health/ai")
        # May be unhealthy due to test API key, but endpoint should respond
        assert response.status_code in [200, 503]
        data = response.json()
        assert "status" in data'''

new_health = '''    def test_health_root(self, client):
        """Test root health endpoint."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"

    def test_health_db(self, client):
        """Test database health endpoint."""
        response = client.get("/health/db")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["database"] == "connected"

    def test_health_ai(self, client):
        """Test AI service health endpoint."""
        response = client.get("/health/ai")
        # May be unhealthy due to test API key, but endpoint should respond
        assert response.status_code in [200, 503]
        data = response.json()
        assert "status" in data'''

content = content.replace(old_health, new_health)

with open('tests/test_comprehensive.py', 'w') as f:
    f.write(content)

print('Fixed health check tests!')