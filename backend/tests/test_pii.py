from app.pii import mask_pii, unmask_pii


def test_mask_phone_and_id_number():
    text = "Bệnh nhân Nguyễn Văn An, SĐT 0912345678, CCCD 079123456789."
    masked, mapping = mask_pii(text)
    assert "0912345678" not in masked
    assert "079123456789" not in masked
    assert "Nguyễn Văn An" not in masked
    assert any(token.startswith("[PHONE") for token in mapping)
    assert any(token.startswith("[ID_NUMBER") for token in mapping)
    assert any(token.startswith("[PATIENT_NAME") for token in mapping)


def test_round_trip_restores_original():
    text = "Bệnh nhân Trần Thị Bình hẹn tái khám, gọi 0987654321."
    masked, mapping = mask_pii(text)
    assert unmask_pii(masked, mapping) == text


def test_text_without_pii_unchanged():
    text = "lấy cao răng và đánh bóng"
    masked, mapping = mask_pii(text)
    assert masked == text
    assert mapping == {}
