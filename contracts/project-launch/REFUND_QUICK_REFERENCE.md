# ProjectLaunch Refund Mechanism - Quick Reference

## API Quick Start

### Initialize Contract
```rust
client.initialize(&admin)?;
```

### Create Project
```rust
let project_id = client.create_project(
    &creator,
    &funding_goal,        // Min: 1000 XLM (MIN_FUNDING_GOAL)
    &deadline,            // Unix timestamp, must be 1-180 days from now
    &token,               // Token contract address
    &metadata_hash,       // IPFS hash or metadata reference
)?;
```

### Contribute to Project
```rust
client.contribute(
    &project_id,
    &contributor,
    &amount,               // Min: 10 XLM (MIN_CONTRIBUTION)
)?;
```

### Mark Project as Failed (Permissionless)
```rust
// After deadline passes, anyone can call:
client.mark_project_failed(&project_id)?;

// Project status becomes:
// - Failed (if total_raised < funding_goal)
// - Completed (if total_raised >= funding_goal)
```

### Refund Contributor (Permissionless)
```rust
// After project marked as failed, anyone can refund a contributor:
let refund_amount = client.refund_contributor(
    &project_id,
    &contributor_address,
)?;
```

### Check Refund Status
```rust
// Check if contributor already refunded
let is_refunded = client.is_refunded(&project_id, &contributor);

// Check if project status finalized
let is_processed = client.is_failure_processed(&project_id);

// Get project details
let project = client.get_project(&project_id)?;

// Check project status:
// - Active: Still accepting contributions
// - Completed: Goal reached or deadline passed with goal met
// - Failed: Deadline passed with insufficient funding
// - Cancelled: Manually cancelled
```

## User Workflows

### For Contributors

#### Scenario: Project Succeeds
```
1. Create wallet account
2. View active projects
3. Click "Invest" on project
4. Approve token transfer
5. Send contribution (min 10 XLM)
6. Contribution confirmed
7. Wait for project completion or withdraw before deadline
```

#### Scenario: Project Fails - Receive Refund
```
1. Contributed to project
2. Project deadline passes
3. Project goal NOT reached
4. System marks project as FAILED
5. Click "Claim Refund" in UI
6. Refund transaction sent
7. Tokens returned to wallet
8. Refund event emitted
```

**Note**: No action needed from project creator or admins - refunds are automatic and permissionless!

### For Project Creators

#### When Project Succeeds
```
1. Created project with goal of 1000 XLM
2. Collected 1500 XLM from 50 contributors
3. Deadline passes
4. System marks project as COMPLETED
5. Funds available for disbursement to escrow/distribution
```

#### When Project Fails
```
1. Created project with goal of 1000 XLM
2. Only collected 300 XLM from 10 contributors
3. Deadline passes
4. System marks project as FAILED
5. Contributors individually claim refunds
6. All funds returned to contributors
7. No action required from creator
```

### For Developers/Bots

#### Automated Failure Marking
```rust
// Implement a bot that periodically calls:
let projects = fetch_all_active_projects();
for project in projects {
    if has_deadline_passed(project) {
        contract.mark_project_failed(project.id)?;
    }
}
```

#### Bulk Refund Processing
```rust
// Process refunds for multiple contributors:
let contributors = get_contributors_for_failed_project(project_id);
for contributor in contributors {
    if !client.is_refunded(&project_id, &contributor) {
        client.refund_contributor(&project_id, &contributor)?;
    }
}
```

#### Event Monitoring
```rust
// Subscribe to refund events:
// Event: REFUND_ISSUED
// Data: (project_id, contributor_address, amount)

// Create UI notification system:
on_event(REFUND_ISSUED, (project_id, contributor, amount) => {
    notification.send(
        contributor,
        `Refund of ${amount} XLM issued for project ${project_id}`
    );
});
```

## Error Codes & Solutions

| Error | Cause | Solution |
|---|---|---|
| `ProjectNotFound` | Project ID doesn't exist | Verify project ID |
| `ProjectNotActive` | Trying to refund from non-failed project | Wait for project to fail |
| `InvalidInput` | Already refunded or no contribution | Check `is_refunded()` first |
| `DeadlinePassed` | Contributing after deadline | Contribute before deadline |
| `ContributionTooLow` | Amount < 10 XLM | Increase contribution amount |
| `InvalidFundingGoal` | Goal < 1000 XLM | Increase funding goal |
| `InvalidDeadline` | Duration < 1 day or > 180 days | Set deadline within valid range |
| `InvalidProjectStatus` | Trying to mark already processed project | Already marked (check `is_failure_processed()`) |

## Event Reference

### PROJECT_CREATED
```
Emitted: When project is created
Data: (project_id, creator, funding_goal, deadline, token)
Use for: Tracking new projects
```

### CONTRIBUTION_MADE
```
Emitted: When contribution accepted
Data: (project_id, contributor, amount, total_raised)
Use for: Tracking contributions, progress updates
```

### PROJECT_FAILED
```
Emitted: When project marked as failed (goal not met)
Data: (project_id)
Use for: Notifying contributors to claim refunds
```

### REFUND_ISSUED
```
Emitted: When refund successfully processed
Data: (project_id, contributor, amount)
Use for: Confirmation, notifications, accounting
```

## Common Tasks

### Check if Contributor Can Refund
```rust
fn can_refund(client, project_id, contributor) -> bool {
    // Must be failed
    let project = client.get_project(project_id).ok()?;
    if project.status != ProjectStatus::Failed {
        return false;
    }
    
    // Must not already refunded
    if client.is_refunded(project_id, contributor) {
        return false;
    }
    
    // Must have contributed
    if client.get_user_contribution(project_id, contributor) == 0 {
        return false;
    }
    
    true
}
```

### Calculate Total Claimable Refunds for Project
```rust
fn total_claimable_refunds(client, project_id, contributors) -> i128 {
    let project = client.get_project(project_id).ok()?;
    if project.status != ProjectStatus::Failed {
        return 0;
    }
    
    contributors.iter()
        .filter(|c| !client.is_refunded(project_id, c))
        .map(|c| client.get_user_contribution(project_id, c))
        .sum()
}
```

### Wait for Project to Become Refundable
```rust
async fn wait_for_refund_eligibility(client, project_id, timeout_secs) {
    let start = now();
    loop {
        if let Ok(project) = client.get_project(project_id) {
            if project.status == ProjectStatus::Failed {
                return Ok(());
            }
        }
        
        if elapsed_secs(start) > timeout_secs {
            return Err("Timeout waiting for project to fail");
        }
        
        sleep(30 secs);
    }
}
```

## Performance Characteristics

| Operation | Gas Cost | Time |
|---|---|---|
| mark_project_failed() | ~1,500 | Instant |
| refund_contributor() | ~5,000-6,000 | Instant |
| get_project() | ~500 | Instant |
| is_refunded() | ~500 | Instant |
| Bulk refund (10 contrib) | ~50,000-60,000 | <1 sec |
| Bulk refund (100 contrib) | ~500,000-600,000 | <5 sec |

## Security Best Practices

### For Users
- ✅ Always verify project deadline before contributing
- ✅ Keep track of project status
- ✅ Check `is_refunded()` before attempting refund if unsure
- ⚠️ Never send funds directly to contract address

### For Developers
- ✅ Always check `is_failure_processed()` before `mark_project_failed()`
- ✅ Verify `is_refunded()` before `refund_contributor()`
- ✅ Monitor all emitted events for accuracy
- ✅ Handle failures gracefully in bulk operations
- ⚠️ Don't assume refund succeeds - check events
- ⚠️ Don't expose refund endpoint without rate limiting

### For Project Creators
- ✅ Set realistic funding goals
- ✅ Set appropriate deadlines (considering project scope)
- ✅ Communicate clearly about project timeline
- ✅ Be prepared for refunds to be issued automatically
- ⚠️ Don't try to prevent refunds - system is permissionless
- ⚠️ Plan for worst case where project fails

## Testing Checklist

For integration tests:
- [ ] Create project with valid parameters
- [ ] Contribute multiple times from same user
- [ ] Contribute from multiple users
- [ ] Verify contributions tracked correctly
- [ ] Wait for deadline and mark project as failed
- [ ] Verify status changes to Failed
- [ ] Refund each contributor
- [ ] Verify balances restored
- [ ] Verify refund flags set
- [ ] Attempt double refund (should fail)
- [ ] Verify events emitted correctly

## Troubleshooting

### "ProjectNotFound" when calling mark_project_failed
- Project ID doesn't exist
- Wrong contract instance
- Project was created in different transaction

### "InvalidInput" when trying to refund
- Already refunded (check `is_refunded()`)
- No contribution exists
- No refund needed (check project status)

### Refund succeeds but tokens not received
- Check contract has sufficient balance
- Verify contributor address is correct
- Check token contract is valid
- Monitor REFUND_ISSUED event

### mark_project_failed fails with InvalidInput
- Deadline hasn't passed yet
- Project already processed
- Check current timestamp

## Additional Resources

- Full Documentation: [REFUND_MECHANISM.md](./REFUND_MECHANISM.md)
- Implementation Details: [REFUND_IMPLEMENTATION_SUMMARY.md](./REFUND_IMPLEMENTATION_SUMMARY.md)
- Contract Code: [src/lib.rs](./src/lib.rs)
- Shared Types: [../shared/src/types.rs](../shared/src/types.rs)
