#[cfg(test)]
mod tests {
    use soroban_sdk::{
        symbol_short, Address, Env, testutils::{Address as _},
    };
    use crate::{AMMLiquidityPools, SwapParams, LiquidityParams};

    fn setup_contract(env: &Env) -> Address {
        let admin = Address::generate(env);
        let _contract_id = env.register_contract(None, AMMLiquidityPools);
        AMMLiquidityPools::initialize(env.clone(), admin.clone(), 30u32); // 0.3% fee
        admin
    }

    #[test]
    fn test_initialize() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let _contract_id = env.register_contract(None, AMMLiquidityPools);
        
        AMMLiquidityPools::initialize(env.clone(), admin.clone(), 30u32);
        
        // Test that admin is set correctly
        let stored_admin = env.storage().instance().get(&symbol_short!("ADMIN")).unwrap();
        assert_eq!(admin, stored_admin);
    }

    #[test]
    fn test_create_pool() {
        let env = Env::default();
        let _contract_id = setup_contract(&env);
        let token_a = Address::generate(&env);
        let token_b = Address::generate(&env);
        
        let pool_id = AMMLiquidityPools::create_pool(env.clone(), token_a.clone(), token_b.clone());
        
        assert_eq!(pool_id, 1);
        
        let pool = AMMLiquidityPools::get_pool(env.clone(), pool_id);
        assert_eq!(pool.reserve_a, 0);
        assert_eq!(pool.reserve_b, 0);
        assert_eq!(pool.total_liquidity, 0);
        assert_eq!(pool.fee_rate, 30);
    }

    #[test]
    fn test_add_liquidity_first_provider() {
        let env = Env::default();
        let _contract_id = setup_contract(&env);
        let token_a = Address::generate(&env);
        let token_b = Address::generate(&env);
        
        let pool_id = AMMLiquidityPools::create_pool(env.clone(), token_a.clone(), token_b.clone());
        
        let liquidity = AMMLiquidityPools::add_liquidity(
            env.clone(),
            LiquidityParams {
                token_a: token_a.clone(),
                token_b: token_b.clone(),
                amount_a: 1000,
                amount_b: 1000,
                min_liquidity: 900,
                deadline: env.ledger().timestamp() + 1000,
            }
        );
        
        assert!(liquidity >= 900);
        
        let pool = AMMLiquidityPools::get_pool(env.clone(), pool_id);
        assert_eq!(pool.reserve_a, 1000);
        assert_eq!(pool.reserve_b, 1000);
        assert_eq!(pool.total_liquidity, liquidity);
    }

    #[test]
    fn test_swap() {
        let env = Env::default();
        let _contract_id = setup_contract(&env);
        let token_a = Address::generate(&env);
        let token_b = Address::generate(&env);
        
        let pool_id = AMMLiquidityPools::create_pool(env.clone(), token_a.clone(), token_b.clone());
        
        // Add liquidity
        AMMLiquidityPools::add_liquidity(
            env.clone(),
            LiquidityParams {
                token_a: token_a.clone(),
                token_b: token_b.clone(),
                amount_a: 1000,
                amount_b: 1000,
                min_liquidity: 900,
                deadline: env.ledger().timestamp() + 1000,
            }
        );
        
        // Perform swap
        let amount_out = AMMLiquidityPools::swap(
            env.clone(),
            SwapParams {
                token_in: token_a.clone(),
                token_out: token_b.clone(),
                amount_in: 100,
                min_amount_out: 90,
                deadline: env.ledger().timestamp() + 1000,
            }
        );
        
        assert!(amount_out >= 90);
        
        let pool = AMMLiquidityPools::get_pool(env.clone(), pool_id);
        assert_eq!(pool.reserve_a, 1100);
        assert!(pool.reserve_b < 1000); // Should be less due to swap
    }

    #[test]
    fn test_sqrt_function() {
        // Test basic sqrt functionality
        assert_eq!(crate::AMMLiquidityPools::sqrt(0), 0);
        assert_eq!(crate::AMMLiquidityPools::sqrt(1), 1);
        assert_eq!(crate::AMMLiquidityPools::sqrt(4), 2);
        assert_eq!(crate::AMMLiquidityPools::sqrt(9), 3);
        assert_eq!(crate::AMMLiquidityPools::sqrt(16), 4);
        
        // Test larger numbers
        let result = crate::AMMLiquidityPools::sqrt(1000000);
        assert!(result >= 999 && result <= 1001); // Allow for rounding
    }
}
