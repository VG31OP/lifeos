from app.auth import create_access_token, decode_access_token, get_password_hash, verify_password


def test_password_hash_round_trip():
    password = "secure-test-password"

    hashed_password = get_password_hash(password)

    assert hashed_password != password
    assert verify_password(password, hashed_password)
    assert not verify_password("incorrect-password", hashed_password)


def test_access_token_encodes_subject_as_string():
    token = create_access_token({"sub": 42})

    assert decode_access_token(token)["sub"] == "42"
