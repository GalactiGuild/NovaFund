use crate::{CrossChainBridge, CrossChainBridgeClient};
use shared::types::{BridgeTransactionStatus, ChainId};
use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    Address, BytesN, Env, String,
};

fn setup_env() -> (Env, CrossChainBridgeClient<'static>) {
    let env = Env::default();
    let contract_id = env.register_contract(None, CrossChainBridge);
    let client = CrossChainBridgeClient::new(&env, &contract_id);
    (env, client)
}

fn create_token_contract<'a>(
    env: &'a Env,
    admin: &'a Address,
) -> (TokenClient<'a>, StellarAssetClient<'a>) {
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    (
        TokenClient::new(env, &sac.address()),
        StellarAssetClient::new(env, &sac.address()),
    )
}

#[test]
fn test_initialize() {
    let (env, client) = setup_env();
    let admin = Address::generate(&env);

    client.mock_all_auths().initialize(&admin, &1000, &3);

    let config = client.get_config();
    assert_eq!(config.admin, admin);
    assert_eq!(config.min_relayer_stake, 1000);
    assert_eq!(config.confirmation_threshold, 3);
    assert!(!config.paused);
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn test_initialize_already_initialized() {
    let (env, client) = setup_env();
    let admin = Address::generate(&env);

    client.mock_all_auths().initialize(&admin, &1000, &3);
    client.mock_all_auths().initialize(&admin, &1000, &3);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_initialize_zero_threshold() {
    let (env, client) = setup_env();
    let admin = Address::generate(&env);

    client.mock_all_auths().initialize(&admin, &1000, &0);
}

#[test]
fn test_add_supported_chain() {
    let (env, client) = setup_env();
    let admin = Address::generate(&env);

    client.mock_all_auths().initialize(&admin, &1000, &3);

    let bridge_contract = BytesN::<32>::from_array(&env, &[1u8; 32]);

    client.mock_all_auths().add_supported_chain(
        &ChainId::Ethereum,
        &String::from_str(&env, "Ethereum"),
        &bridge_contract,
        &12,
        &5000000000u64,
    );

    let chain_config = client.get_chain_config(&ChainId::Ethereum);
    assert_eq!(chain_config.confirmations_required, 12);
    assert!(chain_config.is_active);
}

#[test]
fn test_remove_supported_chain() {
    let (env, client) = setup_env();
    let admin = Address::generate(&env);

    client.mock_all_auths().initialize(&admin, &1000, &3);

    let bridge_contract = BytesN::<32>::from_array(&env, &[1u8; 32]);

    client.mock_all_auths().add_supported_chain(
        &ChainId::Ethereum,
        &String::from_str(&env, "Ethereum"),
        &bridge_contract,
        &12,
        &5000000000u64,
    );

    client
        .mock_all_auths()
        .remove_supported_chain(&ChainId::Ethereum);

    let chain_config = client.get_chain_config(&ChainId::Ethereum);
    assert!(!chain_config.is_active);
}

#[test]
fn test_register_wrapped_asset() {
    let (env, client) = setup_env();
    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);

    client.mock_all_auths().initialize(&admin, &1000, &3);

    let bridge_contract = BytesN::<32>::from_array(&env, &[1u8; 32]);

    client.mock_all_auths().add_supported_chain(
        &ChainId::Ethereum,
        &String::from_str(&env, "Ethereum"),
        &bridge_contract,
        &12,
        &5000000000u64,
    );

    let original_contract = BytesN::<32>::from_array(&env, &[2u8; 32]);

    let asset = client.mock_all_auths().register_wrapped_asset(
        &String::from_str(&env, "ETH"),
        &issuer,
        &ChainId::Ethereum,
        &original_contract,
        &18,
    );

    let wrapped = client.get_wrapped_asset(&asset);
    assert_eq!(wrapped.asset_code, String::from_str(&env, "ETH"));
    assert_eq!(wrapped.decimals, 18);
    assert!(wrapped.is_active);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_register_wrapped_asset_unsupported_chain() {
    let (env, client) = setup_env();
    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);

    client.mock_all_auths().initialize(&admin, &1000, &3);

    let original_contract = BytesN::<32>::from_array(&env, &[2u8; 32]);

    client.mock_all_auths().register_wrapped_asset(
        &String::from_str(&env, "ETH"),
        &issuer,
        &ChainId::Ethereum,
        &original_contract,
        &18,
    );
}

#[test]
fn test_deposit() {
    let (env, client) = setup_env();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    client.mock_all_auths().initialize(&admin, &1000, &3);

    let bridge_contract = BytesN::<32>::from_array(&env, &[1u8; 32]);

    client.mock_all_auths().add_supported_chain(
        &ChainId::Ethereum,
        &String::from_str(&env, "Ethereum"),
        &bridge_contract,
        &12,
        &5000000000u64,
    );

    let original_contract = BytesN::<32>::from_array(&env, &[2u8; 32]);

    let (token_client, token_admin) = create_token_contract(&env, &client.address);
    let issuer = token_client.address.clone();

    let _asset = client.mock_all_auths().register_wrapped_asset(
        &String::from_str(&env, "ETH"),
        &issuer,
        &ChainId::Ethereum,
        &original_contract,
        &18,
    );

    // Create token contract for the wrapped asset (needed for the test to work with balances)

    // Mint some tokens to the bridge contract for distribution
    token_admin.mock_all_auths().mint(&client.address, &1000000);

    let source_tx_hash = BytesN::<32>::from_array(&env, &[3u8; 32]);
    let sender = BytesN::<32>::from_array(&env, &[4u8; 32]);

    let tx_id = client.mock_all_auths().deposit(
        &ChainId::Ethereum,
        &source_tx_hash,
        &sender,
        &recipient,
        &issuer, // Use the issuer address as the asset
        &1000,
    );

    assert_eq!(tx_id, 0);

    let transaction = client.get_transaction(&tx_id);
    assert_eq!(transaction.status, BridgeTransactionStatus::Confirmed);
    assert_eq!(transaction.amount, 1000);
    assert_eq!(transaction.recipient, recipient);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_deposit_paused_bridge() {
    let (env, client) = setup_env();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    client.mock_all_auths().initialize(&admin, &1000, &3);

    let bridge_contract = BytesN::<32>::from_array(&env, &[1u8; 32]);

    client.mock_all_auths().add_supported_chain(
        &ChainId::Ethereum,
        &String::from_str(&env, "Ethereum"),
        &bridge_contract,
        &12,
        &5000000000u64,
    );

    let original_contract = BytesN::<32>::from_array(&env, &[2u8; 32]);

    let (token_client, token_admin) = create_token_contract(&env, &client.address);
    let issuer = token_client.address.clone();

    let _asset = client.mock_all_auths().register_wrapped_asset(
        &String::from_str(&env, "ETH"),
        &issuer,
        &ChainId::Ethereum,
        &original_contract,
        &18,
    );

    // Mint some tokens to the bridge contract for distribution
    token_admin.mock_all_auths().mint(&client.address, &1000000);

    // Pause the bridge
    client.mock_all_auths().pause_bridge();

    let source_tx_hash = BytesN::<32>::from_array(&env, &[3u8; 32]);
    let sender = BytesN::<32>::from_array(&env, &[4u8; 32]);

    client.mock_all_auths().deposit(
        &ChainId::Ethereum,
        &source_tx_hash,
        &sender,
        &recipient,
        &issuer, // Use the issuer address as the asset
        &1000,
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn test_deposit_duplicate_transaction() {
    let (env, client) = setup_env();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    client.mock_all_auths().initialize(&admin, &1000, &3);

    let bridge_contract = BytesN::<32>::from_array(&env, &[1u8; 32]);

    client.mock_all_auths().add_supported_chain(
        &ChainId::Ethereum,
        &String::from_str(&env, "Ethereum"),
        &bridge_contract,
        &12,
        &5000000000u64,
    );

    let original_contract = BytesN::<32>::from_array(&env, &[2u8; 32]);

    let (token_client, _token_admin) = create_token_contract(&env, &client.address);
    let issuer = token_client.address.clone();

    let _asset = client.mock_all_auths().register_wrapped_asset(
        &String::from_str(&env, "ETH"),
        &issuer,
        &ChainId::Ethereum,
        &original_contract,
        &18,
    );

    let (_token_client, token_admin) = create_token_contract(&env, &issuer);
    token_admin.mock_all_auths().mint(&client.address, &1000000);

    let source_tx_hash = BytesN::<32>::from_array(&env, &[3u8; 32]);
    let sender = BytesN::<32>::from_array(&env, &[4u8; 32]);

    client.mock_all_auths().deposit(
        &ChainId::Ethereum,
        &source_tx_hash,
        &sender,
        &recipient,
        &issuer, // Use the issuer address as the asset
        &1000,
    );

    // Try to deposit with same source hash - should fail
    client.mock_all_auths().deposit(
        &ChainId::Ethereum,
        &source_tx_hash,
        &sender,
        &recipient,
        &issuer, // Use the issuer address as the asset
        &1000,
    );
}

#[test]
fn test_pause_and_unpause_bridge() {
    let (env, client) = setup_env();
    let admin = Address::generate(&env);

    client.mock_all_auths().initialize(&admin, &1000, &3);

    // Pause
    client.mock_all_auths().pause_bridge();
    let config = client.get_config();
    assert!(config.paused);

    // Unpause
    client.mock_all_auths().unpause_bridge();
    let config = client.get_config();
    assert!(!config.paused);
}

#[test]
fn test_update_config() {
    let (env, client) = setup_env();
    let admin = Address::generate(&env);

    client.mock_all_auths().initialize(&admin, &1000, &3);

    client
        .mock_all_auths()
        .update_config(&Some(2000), &Some(5), &Some(2000000000u64));

    let config = client.get_config();
    assert_eq!(config.min_relayer_stake, 2000);
    assert_eq!(config.confirmation_threshold, 5);
    assert_eq!(config.max_gas_price, 2000000000u64);
}

#[test]
fn test_is_chain_supported() {
    let (env, client) = setup_env();
    let admin = Address::generate(&env);

    client.mock_all_auths().initialize(&admin, &1000, &3);

    // Initially not supported
    assert!(!client.is_chain_supported(&ChainId::Ethereum));

    let bridge_contract = BytesN::<32>::from_array(&env, &[1u8; 32]);

    client.mock_all_auths().add_supported_chain(
        &ChainId::Ethereum,
        &String::from_str(&env, "Ethereum"),
        &bridge_contract,
        &12,
        &5000000000u64,
    );

    // Now supported
    assert!(client.is_chain_supported(&ChainId::Ethereum));
}

#[test]
fn test_get_transaction_count() {
    let (env, client) = setup_env();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    client.mock_all_auths().initialize(&admin, &1000, &3);

    let bridge_contract = BytesN::<32>::from_array(&env, &[1u8; 32]);

    client.mock_all_auths().add_supported_chain(
        &ChainId::Ethereum,
        &String::from_str(&env, "Ethereum"),
        &bridge_contract,
        &12,
        &5000000000u64,
    );

    let original_contract = BytesN::<32>::from_array(&env, &[2u8; 32]);

    let (token_client, _token_admin) = create_token_contract(&env, &client.address);
    let issuer = token_client.address.clone();

    let _asset = client.mock_all_auths().register_wrapped_asset(
        &String::from_str(&env, "ETH"),
        &issuer,
        &ChainId::Ethereum,
        &original_contract,
        &18,
    );

    let (_token_client, token_admin) = create_token_contract(&env, &issuer);
    token_admin.mock_all_auths().mint(&client.address, &1000000);

    assert_eq!(client.get_transaction_count(), 0);

    let source_tx_hash = BytesN::<32>::from_array(&env, &[3u8; 32]);
    let sender = BytesN::<32>::from_array(&env, &[4u8; 32]);

    client.mock_all_auths().deposit(
        &ChainId::Ethereum,
        &source_tx_hash,
        &sender,
        &recipient,
        &issuer, // Use the issuer address as the asset
        &1000,
    );

    assert_eq!(client.get_transaction_count(), 1);
}

#[test]
fn test_wrapped_asset_total_tracking() {
    let (env, client) = setup_env();
    let admin = Address::generate(&env);
    let recipient1 = Address::generate(&env);
    let recipient2 = Address::generate(&env);

    client.mock_all_auths().initialize(&admin, &1000, &3);

    let bridge_contract = BytesN::<32>::from_array(&env, &[1u8; 32]);

    client.mock_all_auths().add_supported_chain(
        &ChainId::Ethereum,
        &String::from_str(&env, "Ethereum"),
        &bridge_contract,
        &12,
        &5000000000u64,
    );

    let original_contract = BytesN::<32>::from_array(&env, &[2u8; 32]);

    let (token_client, _token_admin) = create_token_contract(&env, &client.address);
    let issuer = token_client.address.clone();

    let _asset = client.mock_all_auths().register_wrapped_asset(
        &String::from_str(&env, "ETH"),
        &issuer,
        &ChainId::Ethereum,
        &original_contract,
        &18,
    );

    let (_token_client, token_admin) = create_token_contract(&env, &issuer);
    token_admin
        .mock_all_auths()
        .mint(&client.address, &10000000);

    // Initial total should be 0
    assert_eq!(client.get_total_wrapped(&issuer), 0);

    // First deposit
    let source_tx_hash1 = BytesN::<32>::from_array(&env, &[3u8; 32]);
    let sender1 = BytesN::<32>::from_array(&env, &[4u8; 32]);

    client.mock_all_auths().deposit(
        &ChainId::Ethereum,
        &source_tx_hash1,
        &sender1,
        &recipient1,
        &issuer, // Use the issuer address as the asset
        &1000,
    );

    assert_eq!(client.get_total_wrapped(&issuer), 1000);

    // Second deposit
    let source_tx_hash2 = BytesN::<32>::from_array(&env, &[5u8; 32]);
    let sender2 = BytesN::<32>::from_array(&env, &[6u8; 32]);

    client.mock_all_auths().deposit(
        &ChainId::Ethereum,
        &source_tx_hash2,
        &sender2,
        &recipient2,
        &issuer, // Use the issuer address as the asset
        &2500,
    );

    assert_eq!(client.get_total_wrapped(&issuer), 3500);
}

// Test for multiple chains functionality
#[test]
fn test_multiple_chains() {
    let (env, client) = setup_env();
    let admin = Address::generate(&env);

    client.mock_all_auths().initialize(&admin, &1000, &3);

    // Add multiple chains
    let chain_ids = [
        ChainId::Ethereum,
        ChainId::Polygon,
        ChainId::BinanceSmartChain,
        ChainId::Arbitrum,
    ];
    let names = ["Ethereum", "Polygon", "BSC", "Arbitrum"];
    let confirmations = [12u32, 20u32, 15u32, 50u32];

    for i in 0..chain_ids.len() {
        let chain_id = chain_ids[i];
        let name = names[i];
        let confirmations = confirmations[i];
        let bridge_contract = BytesN::<32>::from_array(&env, &[((chain_id as u32) as u8); 32]);

        client.mock_all_auths().add_supported_chain(
            &chain_id,
            &String::from_str(&env, name),
            &bridge_contract,
            &confirmations,
            &5000000000u64,
        );

        assert!(client.is_chain_supported(&chain_id));
    }
}
