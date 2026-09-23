import re

PATTERNS = {
    "EMAIL": re.compile(
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
    ),
    "PHONE": re.compile(
        r"(?:\+84|0)(?:[.\s-]?\d){9,10}\b"
    ),
    "ID_NUMBER": re.compile(
        r"\b\d{9}\b|\b\d{12}\b"  # Chỉ bắt đúng 9 số (CMND cũ) hoặc 12 số (CCCD/CMND mới)
    ),
    "DATE_OF_BIRTH": re.compile(
        r"\b(?:0?[1-9]|[12][0-9]|3[01])[\/.-](?:0?[1-9]|1[012])[\/.-](?:19|20)\d{2}\b"
    ),
    "PATIENT_NAME": re.compile(
        r"\b[A-Za-zÀÁẢÃẠÂẤẦẨẪẬĂẮẰẲẴẶĐÊẾỀỂỄỆÔỐỒỔỖỘƠỚỜỞỠỢƯỨỪỬỮỰÍÌỈĨỊÓÒỎÕỌÚÙỦŨỤÝỲỶỸỴa-zàáảãạâấầẩẫậăắằẳẵặđêếềểễệôốồổỗộơớờởỡợưứừửữựíìỉĩịóòỏõọúùủũụýỳỷỹỵ]+"
        r"(?:\s+[A-Za-zÀÁẢÃẠÂẤẦẨẪẬĂẮẰẲẴẶĐÊẾỀỂỄỆÔỐỒỔỖỘƠỚỜỞỠỢƯỨỪỬỮỰÍÌỈĨỊÓÒỎÕỌÚÙỦŨỤÝỲỶỸỴa-zàáảãạâấầẩẫậăắằẳẵặđêếềểễệôốồổỗộơớờởỡợưứừửữựíìỉĩịóòỏõọúùủũụýỳỷỹỵ]+){1,5}\b"
    ),
}

def mask_pii(text: str) -> tuple[str, dict]:
    if not text:
        return "", {}

    mapping = {}
    counter = {}

    def replace_func(match, label: str) -> str:
        value = match.group(0)
        
        if value in mapping.values():
            for token, orig_val in mapping.items():
                if orig_val == value:
                    return token

        counter[label] = counter.get(label, 0) + 1
        token = f"[{label}_{counter[label]}]"
        mapping[token] = value
        return token

    masked_text = text

    priority_order = ["EMAIL", "PHONE", "ID_NUMBER", "DATE_OF_BIRTH", "PATIENT_NAME"]
    
    for label in priority_order:
        pattern = PATTERNS[label]
        masked_text = pattern.sub(lambda m: replace_func(m, label), masked_text)

    return masked_text, mapping


def unmask_pii(text: str, mapping: dict) -> str:
    """Khôi phục lại dữ liệu gốc từ token đã ẩn."""
    if not text or not mapping:
        return text
    
    unmasked_text = text
    for token, value in mapping.items():
        unmasked_text = unmasked_text.replace(token, value)
    return unmasked_text