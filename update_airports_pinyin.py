import re
from pypinyin import pinyin, Style

def get_pinyin_details(text):
    if not text:
        return "", ""
    # Normalize text to remove non-alphanumeric/Chinese if needed, but pypinyin is fine
    full = pinyin(text, style=Style.NORMAL)
    full_str = "".join([w[0] for w in full]).lower()
    
    first = pinyin(text, style=Style.FIRST_LETTER)
    first_str = "".join([w[0] for w in first]).lower()
    
    return full_str, first_str

# Read airports.ts
with open('web/lib/airports.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
in_airports = False

# Regex to parse the airport entries
# E.g. { code: "SIN", name: "樟宜国际机场", city: "新加坡", cityEn: "Singapore" },
pattern = re.compile(r'\{\s*code:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*city:\s*"([^"]+)",\s*cityEn:\s*"([^"]+)"\s*\}')

for line in lines:
    # Check if we are inside the interface declaration to update it
    if 'export interface AirportInfo {' in line:
        new_lines.append(line)
        continue
    if 'cityEn: string;' in line and 'export interface AirportInfo {' in lines[lines.index(line)-8:lines.index(line)+3]:
        # we are in the interface
        new_lines.append(line)
        new_lines.append('  /** 拼音及首字母（辅助搜索） */\n  pinyin: string;\n')
        continue
        
    match = pattern.search(line)
    if match:
        code, name, city, city_en = match.groups()
        # Get pinyin for name and city
        name_pinyin_full, name_pinyin_first = get_pinyin_details(name)
        city_pinyin_full, city_pinyin_first = get_pinyin_details(city)
        
        # Combine them
        pinyin_val = f"{name_pinyin_full} {city_pinyin_full} {name_pinyin_first} {city_pinyin_first}"
        # De-duplicate words and strip extra spaces
        words = []
        for word in pinyin_val.split():
            if word not in words:
                words.append(word)
        pinyin_clean = " ".join(words)
        
        # Replace line with new field
        new_line = f'  {{ code: "{code}", name: "{name}", city: "{city}", cityEn: "{city_en}", pinyin: "{pinyin_clean}" }},\n'
        new_lines.append(new_line)
    else:
        new_lines.append(line)

# Let's also check if we need to update searchAirports function in the file
# Currently:
#   return AIRPORTS.filter(
#     (a) =>
#       a.code.toLowerCase().includes(q) ||
#       a.name.includes(q) ||
#       a.city.includes(q) ||
#       a.cityEn.toLowerCase().includes(q),
#   ).slice(0, 8);
#
# We should update it to also include matching on a.pinyin.

content_out = "".join(new_lines)

# Replace the search logic to include a.pinyin.includes(q)
old_search_logic = """  return AIRPORTS.filter(
    (a) =>
      a.code.toLowerCase().includes(q) ||
      a.name.includes(q) ||
      a.city.includes(q) ||
      a.cityEn.toLowerCase().includes(q),
  ).slice(0, 8);"""

new_search_logic = """  return AIRPORTS.filter(
    (a) =>
      a.code.toLowerCase().includes(q) ||
      a.name.includes(q) ||
      a.city.includes(q) ||
      a.cityEn.toLowerCase().includes(q) ||
      a.pinyin.includes(q),
  ).slice(0, 8);"""

if old_search_logic in content_out:
    content_out = content_out.replace(old_search_logic, new_search_logic)
else:
    # Try with single quotes or different whitespace
    print("Warning: old search logic not found exactly, will need manual check/replace")

with open('web/lib/airports.ts', 'w', encoding='utf-8') as f:
    f.write(content_out)

print("airports.ts updated successfully!")
