use crate::{ProjectLaunch, ProjectLaunchClient};
use cross_chain_bridge::{CrossChainBridge, CrossChainBridgeClient};
use shared::{
    constants::{MIN_FUNDING_GOAL, MIN_PROJECT_DURATION},
    types::ChainId,
};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{StellarAssetClient, TokenClient},
    Address, Bytes, BytesN, Env, String,
};

fn create_token_contract<'a>(env: &'a Env, admin: &'a Address) -> (TokenClient<'a>, StellarAssetClient<'a>) {
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    (
        TokenClient::new(env, &sac.address()),
        StellarAssetClient::new(env, &sac.address()),
    )
}

#[test]
fn test_cross_chain_deposit_and_fund() {
    let env = Env::default();
    env.mock_all_auths();

    // 1. Deploy Bridge
    let bridge_id = env.register_contract(None, CrossChainBridge);
    let bridge = CrossChainBridgeClient::new(&env, &bridge_id);
    let bridge_admin = Address::generate(&env);
    bridge.initialize(&bridge_admin, &1000, &3);

    // 2. Deploy Project Launch
    let launch_id = env.register_contract(None, ProjectLaunch);
    let launch = ProjectLaunchClient::new(&env, &launch_id);
    let launch_admin = Address::generate(&env);
    launch.initialize(&launch_admin);
    
    // Deploy and set up Identity contract
    let identity_id = env.register_contract(None, identity::IdentityContract);
    let identity = identity::IdentityContractClient::new(&env, &identity_id);
    identity.initialize(&launch_admin);
    launch.mock_all_auths().set_identity_contract(&identity_id);


    // 3. Register wrapped asset (e.g., WETH)
    let supported_bridge = BytesN::<32>::from_array(&env, &[1u8; 32]);
    bridge.add_supported_chain(
        &ChainId::Ethereum,
        &String::from_str(&env, "Ethereum"),
        &supported_bridge,
        &12,
        &5000000000u64,
    );

    let original_contract = BytesN::<32>::from_array(&env, &[2u8; 32]);
    let (token_client, _token_admin) = create_token_contract(&env, &bridge.address);
    let weth_issuer = token_client.address.clone();

    bridge.register_wrapped_asset(
        &String::from_str(&env, "ETH"),
        &weth_issuer,
        &ChainId::Ethereum,
        &original_contract,
        &18,
    );

    // 4. Create Project accepting WETH
    let creator = Address::generate(&env);
    let metadata_hash = Bytes::from_slice(&env, b"QmHash123");
    env.ledger().set_timestamp(1000000);
    let deadline = 1000000 + MIN_PROJECT_DURATION + 86400;
    
        let project_id = launch.create_project(
        &creator,
        &MIN_FUNDING_GOAL,
        &deadline,
        &weth_issuer,
        &metadata_hash,
        &None,
    );

    // 5. User bridges WETH
    let user = Address::generate(&env);
    
    // Verify user identity mapping
    let proof = Bytes::from_slice(&env, &[1, 2, 3]);
    let public_inputs = Bytes::from_slice(&env, &[0]);
    identity.verify_identity(&user, &shared::types::Jurisdiction::UnitedStates, &proof, &public_inputs);

    let source_tx_hash = BytesN::<32>::from_array(&env, &[3u8; 32]);
    let sender = BytesN::<32>::from_array(&env, &[4u8; 32]);
    let bridge_amount = 50_000_000_000;

    bridge.deposit(
        &ChainId::Ethereum,
        &source_tx_hash,
        &sender,
        &user,
        &weth_issuer,
        &bridge_amount,
    );

    assert_eq!(token_client.balance(&user), bridge_amount);

    // 6. User contributes WETH to project
    let contribution = 10_000_000_000;
    let res = launch.mock_all_auths().try_contribute(&project_id, &user, &contribution);
    assert_eq!(res, Ok(Ok(())));


    assert_eq!(token_client.balance(&user), bridge_amount - contribution);
    assert_eq!(token_client.balance(&launch.address), contribution);
    assert_eq!(launch.get_user_contribution(&project_id, &user), contribution);
}
