import os
import re

files_with_conflicts = [
    "contracts/project-launch/src/lib.rs",
    "contracts/insurance-pool/src/lib.rs",
    "contracts/governance/src/lib.rs",
    "contracts/escrow/src/tests.rs",
    "contracts/escrow/src/lib.rs",
    "contracts/cross-chain-bridge/src/tests.rs",
    "contracts/cross-chain-bridge/src/lib.rs"
]

for file_path in files_with_conflicts:
    if os.path.exists(file_path):
        with open(file_path, "r") as f:
            content = f.read()

        # re.DOTALL makes . match newlines
        resolved_content = re.sub(
            r'<<<<<<< HEAD\n(.*?)\n=======\n.*?\n>>>>>>> [^\n]+\n',
            r'\1\n',
            content,
            flags=re.DOTALL
        )

        with open(file_path, "w") as f:
            f.write(resolved_content)
        print(f"Resolved {file_path}")
