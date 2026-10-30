with open('tests/test_comprehensive.py', 'r') as f:
    content = f.read()

# Fix the memory consent test section - need to mock ai_service.get_embedding
old_memory_section = '''    @pytest.mark.asyncio
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
        await mock_db_session.commit()'''

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

        # Mock ai_service.get_embedding to avoid real API call
        with patch('app.routes.chat.ai_service.get_embedding', new_callable=AsyncMock) as mock_embedding:
            mock_embedding.return_value = [0.1] * 1024  # Mock embedding vector

            args = {"content": "Test memory", "memory_type": "preference"}
            result = await execute_save_memory(args, 1, mock_db_session)

            assert result.success is True
            assert "id" in result.result
            mock_db_session.add.assert_called()
            await mock_db_session.commit()'''

content = content.replace(old_memory_section, new_memory_section)

with open('tests/test_comprehensive.py', 'w') as f:
    f.write(content)

print('Fixed memory consent test - added ai_service mock!')