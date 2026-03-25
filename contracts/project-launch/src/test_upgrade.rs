#[cfg(test)]
mod test {
    use soroban_sdk::{Env, BytesN};
    use crate::*;

    #[test]
    fn test_upgrade_timelock() {
        let env = Env::default();

        // mock addresses etc

        // 1. propose upgrade
        // 2. attempt execute -> should panic
        // 3. advance time
        // 4. execute -> should succeed
    }
}
#[test]
#[should_panic]
fn test_execute_before_timelock() {
    // setup
    // propose upgrade
    // execute immediately -> should panic
}

env.ledger().with_mut(|li| {
    li.timestamp += 48 * 60 * 60;
});

#[test]
#[should_panic]
fn test_pause_blocks_function() {
    // pause
    // try fund
}

#[test]
#[should_panic]
fn test_double_proposal_fails() {
    // propose
    // propose again -> panic
}