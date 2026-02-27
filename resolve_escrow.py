import re

with open("contracts/escrow/src/lib.rs", "r") as f:
    text = f.read()

# Block 0: HEAD has our new types
text = re.sub(
    r'<<<<<<< HEAD\n\s*types::\{\n\s*Amount, Dispute, DisputeResolution, DisputeStatus, EscrowInfo, Hash, JurorInfo, Milestone,\n\s*MilestoneStatus, PauseState, PendingUpgrade, VoteCommitment,\n\s*\},\n\s*MIN_APPROVAL_THRESHOLD, MAX_APPROVAL_THRESHOLD,\n=======\n\s*types::\{Amount, EscrowInfo, Milestone, MilestoneStatus, PauseState, PendingUpgrade\},\n\s*MAX_APPROVAL_THRESHOLD, MIN_APPROVAL_THRESHOLD,\n>>>>>>> [^\n]+\n',
    '    types::{\n        Amount, Dispute, DisputeResolution, DisputeStatus, EscrowInfo, Hash, JurorInfo, Milestone,\n        MilestoneStatus, PauseState, PendingUpgrade, VoteCommitment,\n    },\n    MIN_APPROVAL_THRESHOLD, MAX_APPROVAL_THRESHOLD,\n', text)

# Block 1
text = re.sub(
    r'<<<<<<< HEAD\n\s*// Validate inputs\n\s*if \(validators\.len\(\) as u32\) < MIN_VALIDATORS \{\n\s*return Err\(Error::InvInput\);\n=======\n\s*// FIX: Removed unnecessary cast\n\s*if validators\.len\(\) < MIN_VALIDATORS \{\n\s*return Err\(Error::InvalidInput\);\n>>>>>>> [^\n]+\n',
    '        // FIX: Removed unnecessary cast\n        if validators.len() < MIN_VALIDATORS {\n            return Err(Error::InvInput);\n', text)

# Block 2
text = re.sub(
    r'<<<<<<< HEAD\n\s*if approval_threshold < MIN_APPROVAL_THRESHOLD \|\| approval_threshold > MAX_APPROVAL_THRESHOLD \{\n\s*return Err\(Error::InvInput\);\n=======\n\s*if !\(MIN_APPROVAL_THRESHOLD..=MAX_APPROVAL_THRESHOLD\)\.contains\(&approval_threshold\) \{\n\s*return Err\(Error::InvalidInput\);\n>>>>>>> [^\n]+\n',
    '        if !(MIN_APPROVAL_THRESHOLD..=MAX_APPROVAL_THRESHOLD).contains(&approval_threshold) {\n            return Err(Error::InvInput);\n', text)

# Block 3
text = re.sub(
    r'<<<<<<< HEAD\n\s*// Validate new validators\n\s*if \(new_validators\.len\(\) as u32\) < MIN_VALIDATORS \{\n\s*return Err\(Error::InvInput\);\n=======\n\s*// FIX: Removed unnecessary cast\n\s*if new_validators\.len\(\) < MIN_VALIDATORS \{\n\s*return Err\(Error::InvalidInput\);\n>>>>>>> [^\n]+\n',
    '        // Validate new validators\n        // FIX: Removed unnecessary cast\n        if new_validators.len() < MIN_VALIDATORS {\n            return Err(Error::InvInput);\n', text)

# Block 4
text = re.sub(
    r'<<<<<<< HEAD\n\s*// ==================== Dispute Resolution System ====================\n\s*/// Configure the global token used for juror staking\n(.*?)=======\n\s*// ---------- Admin Management ----------\n>>>>>>> [^\n]+\n',
    r'    // ==================== Dispute Resolution System ====================\n\n    /// Configure the global token used for juror staking\n\1', text, flags=re.DOTALL)

# Block 5: The deregister_as_juror vs resume_contract
text = re.sub(
    r'<<<<<<< HEAD\n(.*?)=======\n\s*/// Resume the contract — only allowed after the time delay has passed\n\s*///\n\s*/// # Arguments\n\s*/// \* `admin` - Must be the platform admin\n>>>>>>> [^\n]+\n',
    r'\1    /// Resume the contract — only allowed after the time delay has passed\n    ///\n    /// # Arguments\n    /// * `admin` - Must be the platform admin\n', text, flags=re.DOTALL)

# Block 6: file_appeal vs ... wait
text = re.sub(
    r'<<<<<<< HEAD\n(.*?)=======\n\s*// ---------- Upgrade \(time-locked, admin only, requires pause\) ----------\n>>>>>>> [^\n]+\n',
    r'\1    // ---------- Upgrade (time-locked, admin only, requires pause) ----------\n', text, flags=re.DOTALL)

with open("contracts/escrow/src/lib.rs", "w") as f:
    f.write(text)

