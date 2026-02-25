use shared::errors::Error;
use shared::types::EscrowInfo;
use soroban_sdk::Address;

/// Validate that an address is a validator in the escrow
pub fn validate_validator(escrow: &EscrowInfo, validator: &Address) -> Result<(), Error> {
    if escrow.validators.iter().any(|v| v == *validator) {
        Ok(())
    } else {
        Err(Error::NotAValidator)
    }
}

/// Simple oracle authorization check. An oracle must be registered on the
/// milestone itself (passed in by higher‑level code) so this helper is
/// primarily for readability.
pub fn validate_oracle(_escrow: &EscrowInfo, oracle: &Address, expected: &Address) -> Result<(), Error> {
    if oracle == expected {
        Ok(())
    } else {
        Err(Error::OracleUnauthorized)
    }
}
