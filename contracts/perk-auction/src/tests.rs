#[cfg(test)]
mod tests {
    use soroban_sdk::{
        testutils::{Address as _, AuthorizedFunction, AuthorizedInvocation},
        Address, Env, Symbol,
    };

    use crate::{PerkAuctionContract, Perk, AuctionState};

    #[test]
    fn test_initialize() {
        let env = Env::default();
        let admin = Address::generate(&env);

        PerkAuctionContract::initialize(&env, &admin);

        let stored_admin: Address = env.storage().instance().get(&Symbol::new(&env, "ADMIN")).unwrap();
        assert_eq!(stored_admin, admin);

        let state: AuctionState = env.storage().instance()
            .get(&Symbol::new(&env, "AUCTION_STATE"))
            .unwrap();
        assert_eq!(state.admin, admin);
        assert_eq!(state.next_perk_id, 1);
        assert_eq!(state.total_perks, 0);
        assert!(!state.is_paused);
    }

    #[test]
    fn test_create_perk() {
        let env = Env::default();
        let admin = Address::generate(&env);

        PerkAuctionContract::initialize(&env, &admin);

        env.mock_all_auths(&[
            AuthorizedInvocation {
                contract: &env.current_contract_address(),
                sub_contract: None,
                function: Symbol::new(&env, "create_perk"),
                args: (&env).into(),
            },
        ]);

        let perk_id = PerkAuctionContract::create_perk(
            &env,
            1u64,
            String::from_str(&env, "Test Perk"),
            String::from_str(&env, "Test Description"),
            String::from_str(&env, "ipfs://test"),
            100u64,
            1000i64,
            100i64,
            1000u64,
        );

        assert_eq!(perk_id, 1);

        let perk = PerkAuctionContract::get_perk(&env, perk_id);
        assert_eq!(perk.id, 1);
        assert_eq!(perk.project_id, 1);
        assert_eq!(perk.title, String::from_str(&env, "Test Perk"));
        assert_eq!(perk.total_supply, 100);
        assert_eq!(perk.initial_price, 1000);
        assert_eq!(perk.reserve_price, 100);
        assert!(!perk.sold_out);
    }

    #[test]
    fn test_price_decay() {
        let env = Env::default();
        let admin = Address::generate(&env);

        PerkAuctionContract::initialize(&env, &admin);

        env.mock_all_auths(&[
            AuthorizedInvocation {
                contract: &env.current_contract_address(),
                sub_contract: None,
                function: Symbol::new(&env, "create_perk"),
                args: (&env).into(),
            },
        ]);

        let perk_id = PerkAuctionContract::create_perk(
            &env,
            1u64,
            String::from_str(&env, "Test Perk"),
            String::from_str(&env, "Test Description"),
            String::from_str(&env, "ipfs://test"),
            100u64,
            1000i64,
            100i64,
            1000u64,
        );

        // Initial price should be 1000
        let initial_price = PerkAuctionContract::get_current_price(&env, perk_id);
        assert_eq!(initial_price, 1000);

        // Simulate ledger progression
        env.ledger().set_sequence(500);

        // Price should have decayed
        let decayed_price = PerkAuctionContract::get_current_price(&env, perk_id);
        assert!(decayed_price < 1000);
        assert!(decayed_price > 100); // Should be above reserve price
    }

    #[test]
    fn test_purchase_perk() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let buyer = Address::generate(&env);

        PerkAuctionContract::initialize(&env, &admin);

        env.mock_all_auths(&[
            AuthorizedInvocation {
                contract: &env.current_contract_address(),
                sub_contract: None,
                function: Symbol::new(&env, "create_perk"),
                args: (&env).into(),
            },
        ]);

        let perk_id = PerkAuctionContract::create_perk(
            &env,
            1u64,
            String::from_str(&env, "Test Perk"),
            String::from_str(&env, "Test Description"),
            String::from_str(&env, "ipfs://test"),
            100u64,
            1000i64,
            100i64,
            1000u64,
        );

        env.mock_all_auths(&[
            AuthorizedInvocation {
                contract: &env.current_contract_address(),
                sub_contract: None,
                function: Symbol::new(&env, "purchase_perk"),
                args: (&env, perk_id, buyer.clone()).into(),
            },
        ]);

        let price_paid = PerkAuctionContract::purchase_perk(&env, perk_id, buyer.clone());
        assert!(price_paid > 0);

        let user_perks = PerkAuctionContract::get_user_perks(&env, buyer);
        assert_eq!(user_perks.len(), 1);
        assert_eq!(user_perks.get(0).unwrap(), perk_id);
    }

    #[test]
    fn test_pause_contract() {
        let env = Env::default();
        let admin = Address::generate(&env);

        PerkAuctionContract::initialize(&env, &admin);

        env.mock_all_auths(&[
            AuthorizedInvocation {
                contract: &env.current_contract_address(),
                sub_contract: None,
                function: Symbol::new(&env, "pause_contract"),
                args: (&env).into(),
            },
        ]);

        PerkAuctionContract::pause_contract(&env);

        let state: AuctionState = env.storage().instance()
            .get(&Symbol::new(&env, "AUCTION_STATE"))
            .unwrap();
        assert!(state.is_paused);
    }
}
