with open('tests/test_comprehensive.py', 'r') as f:
    content = f.read()

# Fix the memory consent test section - the issue is that execute() returns an awaitable
# that resolves to a result object with scalar_one_or_none()
old_memory_section = '''    @pytest.mark.asyncio
    async def test_save_memory_with_consent(self, test_user, mock_db_session):
        """Test that saving memory works when user has consent."""
        from app.routes.chat import execute_save_memory

        # Properly mock the async execute call chain
        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = test_user
        mock_db_session.execute.return_value = mock_result
        mock_db_session.commit = AsyncMock()
        mock_db_session.refresh = AsyncMock()
        mock_db_session.add = MagicMock()

        args = {"content": "Test memory", "memory_type": "preference"}
        result = await execute_save_memory(args, 1, mock_db_session)

        assert result.success is True
        assert "id" in result.result
        mock_db_session.add.assert_called()
        await mock_db_session.commit()

    @pytest.mark.asyncio
    async def test_save_memory_without_consent(self, test_user_no_consent, mock_db_session):
        """Test that saving memory fails when user lacks consent."""
        from app.routes.chat import execute_save_memory

        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = test_user_no_consent
        mock_db_session.execute.return_value = mock_result

        args = {"content": "Test memory", "memory_type": "preference"}
        result = await execute_save_memory(args, 2, mock_db_session)

        assert result.success is False
        assert "consent" in result.error.lower()

    @pytest.mark.asyncio
    async def test_save_memory_requires_auth(self, mock_db_session):
        """Test that save_memory requires authenticated user."""
        from app.routes.chat import execute_save_memory

        # When user is not found in database (None returned)
        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        args = {"content": "Test memory", "memory_type": "preference"}
        result = await execute_save_memory(args, 999, mock_db_session)

        assert result.success is False
        assert "consent" in result.error.lower()'''

new_memory_section = '''    @pytest.mark.asyncio
    async def test_save_memory_with_consent(self, test_user, mock_db_session):
        """Test that saving memory works when user has consent."""
        from app.routes.chat import execute_save_memory

        # Properly mock the async execute call chain
        # db.execute is async and returns a result object
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = test_user
        mock_db_session.execute = AsyncMock(return_value=mock_result)
        mock_db_session.commit = AsyncMock()
        mock_db_session.refresh = AsyncMock()
        mock_db_session.add = MagicMock()

        args = {"content": "Test memory", "memory_type": "preference"}
        result = await execute_save_memory(args, 1, mock_db_session)

        assert result.success is True
        assert "id" in result.result
        mock_db_session.add.assert_called()
        await mock_db_session.commit()

    @pytest.mark.asyncio
    async def test_save_memory_without_consent(self, test_user_no_consent, mock_db_session):
        """Test that saving memory fails when user lacks consent."""
        from app.routes.chat import execute_save_memory

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = test_user_no_consent
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        args = {"content": "Test memory", "memory_type": "preference"}
        result = await execute_save_memory(args, 2, mock_db_session)

        assert result.success is False
        assert "consent" in result.error.lower()

    @pytest.mark.asyncio
    async def test_save_memory_requires_auth(self, mock_db_session):
        """Test that save_memory requires authenticated user."""
        from app.routes.chat import execute_save_memory

        # When user is not found in database (None returned)
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        args = {"content": "Test memory", "memory_type": "preference"}
        result = await execute_save_memory(args, 999, mock_db_session)

        assert result.success is False
        assert "consent" in result.error.lower()'''

content = content.replace(old_memory_section, new_memory_section)

with open('tests/test_comprehensive.py', 'w') as f:
    f.write(content)

print('Fixed memory consent tests!')