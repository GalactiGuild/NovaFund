#![cfg(test)]

use super::*;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::token::StellarAssetClient;
use soroban_sdk::{Address, BytesN, Env, String};

fn setup_test() -> (Env, GovernanceContractClient<'static>, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, GovernanceContract);
    let client = GovernanceContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let gov_token = env.register_stellar_asset_contract(admin.clone());

    (env, client, admin, gov_token)
}

#[test]
fn test_governance_flow() {
    let (env, client, admin, gov_token) = setup_test();
    let token_admin = StellarAssetClient::new(&env, &gov_token);

    client.initialize(&admin, &gov_token);

    let creator = Address::generate(&env);
    let title = String::from_str(&env, "Test Proposal");
    let desc_hash = BytesN::from_array(&env, &[1u8; 32]);

    let proposal_id = client.create_proposal(&creator, &title, &desc_hash);
    assert_eq!(proposal_id, 0);

    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);

    token_admin.mint(&voter1, &1000);
    token_admin.mint(&voter2, &500);

    // Voter 1 votes YES
    client.vote(&voter1, &proposal_id, &VoteOption::Yes);

    // Voter 2 votes NO
    client.vote(&voter2, &proposal_id, &VoteOption::No);

    let proposal = client.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.votes_for, 1000);
    assert_eq!(proposal.votes_against, 500);

    // Fast forward time to end of voting period
    env.ledger()
        .set_timestamp(env.ledger().timestamp() + VOTING_PERIOD + 1);

    client.execute_proposal(&proposal_id);

    let proposal = client.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.status, ProposalStatus::Approved);
}
