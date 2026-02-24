import re
with open("contracts/project-launch/src/lib.rs", "r") as f:
    text = f.read()

text = re.sub(
    r'<<<<<<< HEAD\n\s*\.ok_or\(Error::NotInit\)\?;\n\s*\n=======\n\s*\.ok_or\(Error::NotInitialized\)\?;\n>>>>>>> [^\n]+\n',
    '            .ok_or(Error::NotInit)?;\n        \n', text)

text = re.sub(
    r'<<<<<<< HEAD\n\s*if duration < MIN_PROJECT_DURATION \|\| duration > MAX_PROJECT_DURATION \{\n\s*return Err\(Error::InvInput\);\n=======\n\s*if !\(MIN_PROJECT_DURATION..=MAX_PROJECT_DURATION\)\.contains\(&duration\) \{\n\s*return Err\(Error::InvalidDeadline\);\n>>>>>>> [^\n]+\n',
    '        if !(MIN_PROJECT_DURATION..=MAX_PROJECT_DURATION).contains(&duration) {\n            return Err(Error::InvInput);\n', text)

text = re.sub(
    r'<<<<<<< HEAD\n\s*// If jurisdictions are required but no identity contract is set, fail safe\.\n\s*return Err\(Error::Unauthorized\);\n=======\n\s*// If jurisdictions are required but no identity contract is set, fail safe\.\n\s*return Err\(Error::IdentityNotVerified\);\n>>>>>>> [^\n]+\n',
    '                // If jurisdictions are required but no identity contract is set, fail safe.\n                return Err(Error::Unauthorized);\n', text)

text = re.sub(
    r'<<<<<<< HEAD\n=======\n\n#\[cfg\(test\)\]\nmod cross_chain_integration_test;\n>>>>>>> [^\n]+\n',
    '\n#[cfg(test)]\nmod cross_chain_integration_test;\n', text)

with open("contracts/project-launch/src/lib.rs", "w") as f:
    f.write(text)

with open("contracts/escrow/src/lib.rs", "r") as f:
    content = f.read()
blocks = list(re.finditer(r'<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>> [^\n]+\n', content, re.DOTALL))
print(f"Found {len(blocks)} blocks in escrow/src/lib.rs.")
for i, b in enumerate(blocks):
    print(f"Block {i}:")
    print("HEAD:")
    print(b.group(1))
    print("UPSTREAM:")
    print(b.group(2))
    print("-" * 40)
