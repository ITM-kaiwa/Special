import json
import os
import re
import random
import pykakasi

kks = pykakasi.kakasi()

EXTRACTED_DIR = r"C:\Users\Admin\Projects\Special\extracted"
DATA_DIR = r"C:\Users\Admin\Projects\Special\data"

CATEGORIES = {
    "1": "introduction",
    "3": "greeting", "11": "greeting",
    "4": "classroom", "10": "classroom",
    "5": "japan",
    "6": "work", "14": "work", "16": "work", "24": "work", "36": "work", "37": "work",
    "7": "fives",
    "8": "manners", "17": "manners", "21": "manners", "25": "manners", "27": "manners", "28": "manners",
    "9": "living", "9.1": "living", "20": "living", "38": "living",
    "12": "tools", "13": "tools",
    "15": "basics",
    "18": "communication", "19": "communication", "35": "communication", "39": "communication",
    "22": "health", "23": "health",
    "26": "safety",
    "29": "law", "30": "law", "31": "law", "32": "law",
    "33": "culture", "34": "culture"
}
for i in range(41, 53):
    CATEGORIES[str(i)] = "speech"

NOISE_STRINGS = [
    "ITM外語センター",
    "Trung tâm ngoại ngữ tiếng Nhật ITM",
    "Trung tâm ngoại ngữ ITM",
    "NỘI DUNG BÀI GIẢNG",
    "THẢO LUẬN",
    "Cùng suy nghĩ nào",
    "ITM"
]

def is_noise(text):
    if not text or not text.strip():
        return True
    t = text.strip()
    if t in NOISE_STRINGS:
        return True
    if re.match(r'^\d+$', t):
        return True
    return False

def has_kanji(text):
    return bool(re.search(r'[\u4e00-\u9fff々]', text))

def is_japanese(text):
    return bool(re.search(r'[\u3040-\u30ff\u4e00-\u9fff々]', text))

def is_vietnamese(text):
    # Has Latin with accents (à, á, ả, ã, ạ, ê, ô, ư, đ, etc.) or typical Vietnamese words
    return bool(re.search(r'[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠÂẦẤẨẪẬĂẰẮẲẴẶÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]', text))

def get_romaji(text):
    if not text:
        return ""
    result = kks.convert(text)
    romaji_list = [item['hepburn'] for item in result if item['hepburn']]
    return " ".join(romaji_list)

def auto_furigana(text):
    if not text:
        return ""
    # Convert existing ( ) to { } for kanji
    text = re.sub(r'([一-龥々]+)[（\(]([ぁ-んァ-ン]+)[）\)]', r'\1{\2}', text)
    if '{' in text and '}' in text:
        return text
    
    result = kks.convert(text)
    out = []
    for item in result:
        orig = item['orig']
        hira = item['hira']
        if re.search(r'[\u4e00-\u9fff々]', orig):
            if orig != hira and not re.match(r'^[ぁ-んァ-ヶ]+$', orig):
                out.append(f"{orig}{{{hira}}}")
            else:
                out.append(orig)
        else:
            out.append(orig)
    return "".join(out)

def get_chapter_num(filename):
    match = re.match(r'^(\d+(?:\.\d+)?)[．.]', filename)
    if match:
        return match.group(1)
    return None

def build():
    os.makedirs(DATA_DIR, exist_ok=True)
    summary_file = os.path.join(EXTRACTED_DIR, "_summary.json")
    with open(summary_file, 'r', encoding='utf-8') as f:
        summary = json.load(f)

    chapters = []
    flashcards = []
    drills = []
    
    seen_files = set()
    random.seed(42)  # For deterministic drill generation

    for item in summary:
        filename = item["filename"]
        if "自動保存済み" in filename:
            continue
        
        chap_num_str = get_chapter_num(filename)
        if not chap_num_str:
            continue
            
        if chap_num_str in seen_files:
            continue
        seen_files.add(chap_num_str)
        
        category = CATEGORIES.get(chap_num_str, "misc")
        
        with open(item["output"], 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        title_jp = ""
        title_vn = ""
        
        # Determine title from slide 1
        if data["slides"] and len(data["slides"]) > 0:
            slide1_texts = [t.strip() for t in data["slides"][0].get("texts", []) if not is_noise(t)]
            for t in slide1_texts:
                if is_japanese(t) and not title_jp:
                    title_jp = auto_furigana(t)
                elif is_vietnamese(t) and not title_vn:
                    title_vn = t
                elif not title_jp:
                    title_jp = auto_furigana(t)
                    
        if not title_jp:
            title_jp = auto_furigana(filename.replace(".pptx", "").replace(".pptm", ""))
            
        chapter_id = f"ch{chap_num_str.replace('.', '_')}"
        
        sections = []
        vocab_pairs = []
        
        for slide in data["slides"]:
            slide_num = slide["slide_number"]
            raw_texts = [t.strip() for t in slide.get("texts", []) if not is_noise(t)]
            tables = slide.get("tables", [])
            notes = slide.get("notes", "").strip()
            
            if not raw_texts and not tables and not notes:
                continue
                
            block_items = []
            heading_jp = f"Slide {slide_num}"
            heading_vn = ""
            
            # Look for Japanese - Vietnamese pairs within the slide
            jp_texts = []
            vn_texts = []
            
            for t in raw_texts:
                if is_japanese(t):
                    jp_texts.append(t)
                elif is_vietnamese(t):
                    vn_texts.append(t)
                else:
                    # General text
                    jp_texts.append(t)
            
            # Pair Japanese and Vietnamese where possible
            for i, t in enumerate(raw_texts):
                t_furi = auto_furigana(t)
                
                # Check if next text is Vietnamese translation
                vn_trans = ""
                if i + 1 < len(raw_texts) and is_vietnamese(raw_texts[i+1]) and is_japanese(t):
                    vn_trans = raw_texts[i+1]
                    
                if is_japanese(t) and len(t) < 30 and vn_trans:
                    vocab_pairs.append({
                        "jp": t_furi,
                        "raw_jp": t,
                        "romaji": get_romaji(t),
                        "vn": vn_trans
                    })
                    
                block_items.append({
                    "type": "p",
                    "text": t_furi,
                    "textVN": vn_trans if vn_trans else (t if is_vietnamese(t) else "")
                })
                
            # Tables
            if tables:
                for tbl in tables:
                    formatted_rows = []
                    for row in tbl:
                        formatted_rows.append([auto_furigana(cell) for cell in row])
                    block_items.append({
                        "type": "table",
                        "rows": formatted_rows
                    })
                    
            # Notes
            if notes and not is_noise(notes):
                block_items.append({
                    "type": "note",
                    "text": auto_furigana(notes),
                    "textVN": ""
                })
                
            sections.append({
                "heading": heading_jp,
                "headingVN": heading_vn,
                "blocks": block_items
            })
            
        # Add collected vocab pairs to flashcards
        for vp in vocab_pairs:
            flashcards.append({
                "id": f"fc_{chapter_id}_{len(flashcards)}",
                "category": category,
                "chapter": chapter_id,
                "jp": vp["jp"],
                "romaji": vp["romaji"],
                "vn": vp["vn"]
            })
            
        # Also create fallback flashcards from short Japanese phrases if vocab pairs are few
        if len([f for f in flashcards if f["chapter"] == chapter_id]) < 3:
            for slide in data["slides"]:
                for t in slide.get("texts", []):
                    t = t.strip()
                    if is_japanese(t) and not is_noise(t) and 2 <= len(t) <= 25:
                        flashcards.append({
                            "id": f"fc_{chapter_id}_{len(flashcards)}",
                            "category": category,
                            "chapter": chapter_id,
                            "jp": auto_furigana(t),
                            "romaji": get_romaji(t),
                            "vn": ""
                        })
                        
        # Generate Drills from vocab pairs or lesson content
        chapter_vocabs = [vp for vp in vocab_pairs if vp["jp"] and vp["vn"]]
        if len(chapter_vocabs) >= 3:
            for idx, vp in enumerate(chapter_vocabs):
                # Pick 3 wrong options from other vocabs
                other_vocabs = [v for v in chapter_vocabs if v["vn"] != vp["vn"]]
                if len(other_vocabs) >= 3:
                    wrong_samples = random.sample(other_vocabs, 3)
                    options = [vp["vn"]] + [w["vn"] for w in wrong_samples]
                    # Shuffle options
                    indices = list(range(len(options)))
                    random.shuffle(indices)
                    shuffled_options = [options[i] for i in indices]
                    correct_answer = indices.index(0)
                    
                    drills.append({
                        "id": f"dr_{chapter_id}_{len(drills)}",
                        "category": category,
                        "chapter": chapter_id,
                        "type": "choice",
                        "question": f" Nghĩa của 「{vp['jp']}」 là gì?",
                        "questionVN": f"Từ 「{vp['raw_jp']}」 có nghĩa là gì?",
                        "options": shuffled_options,
                        "answer": correct_answer
                    })
        elif chapter_vocabs:
            # Generate reverse question (VN to JP)
            for idx, vp in enumerate(chapter_vocabs):
                other_vocabs = [v for v in chapter_vocabs if v["jp"] != vp["jp"]]
                if len(other_vocabs) >= 2:
                    wrong_samples = random.sample(other_vocabs, min(3, len(other_vocabs)))
                    options = [vp["jp"]] + [w["jp"] for w in wrong_samples]
                    indices = list(range(len(options)))
                    random.shuffle(indices)
                    shuffled_options = [options[i] for i in indices]
                    correct_answer = indices.index(0)
                    
                    drills.append({
                        "id": f"dr_{chapter_id}_{len(drills)}",
                        "category": category,
                        "chapter": chapter_id,
                        "type": "choice",
                        "question": f" Tiếng Nhật của \"{vp['vn']}\" là gì?",
                        "questionVN": f"Hãy chọn từ tiếng Nhật tương ứng với \"{vp['vn']}\"",
                        "options": shuffled_options,
                        "answer": correct_answer
                    })

        chapters.append({
            "id": chapter_id,
            "num": float(chap_num_str) if '.' in chap_num_str else int(chap_num_str),
            "category": category,
            "title": title_jp,
            "subtitle": title_vn,
            "sections": sections
        })

    # Sort chapters by num
    chapters.sort(key=lambda x: x["num"])

    with open(os.path.join(DATA_DIR, "chapters.js"), "w", encoding="utf-8") as f:
        f.write("window.DATA_CHAPTERS = " + json.dumps(chapters, ensure_ascii=False, indent=2) + ";")
        
    with open(os.path.join(DATA_DIR, "flashcards.js"), "w", encoding="utf-8") as f:
        f.write("window.DATA_FLASHCARDS = " + json.dumps(flashcards, ensure_ascii=False, indent=2) + ";")
        
    with open(os.path.join(DATA_DIR, "drills.js"), "w", encoding="utf-8") as f:
        f.write("window.DATA_DRILLS = " + json.dumps(drills, ensure_ascii=False, indent=2) + ";")

    print(f"Build completed successfully!")
    print(f"Chapters: {len(chapters)}")
    print(f"Flashcards: {len(flashcards)}")
    print(f"Drills: {len(drills)}")

if __name__ == "__main__":
    build()
