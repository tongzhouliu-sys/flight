import re

# Read airports.ts
with open('web/lib/airports.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Find all Chinese characters
chinese_chars = set(re.findall(r'[\u4e00-\u9fa5]', content))
print(f"Total unique Chinese characters: {len(chinese_chars)}")
print("".join(sorted(list(chinese_chars))))
