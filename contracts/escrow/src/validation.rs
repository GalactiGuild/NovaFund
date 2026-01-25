use soroban_sdk::Address;
use shared::types::EscrowInfo;
use shared::errors::Error;

/// Validate that an address is a validator in the escrow
pub fn validate_validator(escrow: &EscrowInfo, validator: &Address) -> Result<(), Error> {
    if escrow.validators.iter().any(|v| v == *validator) {
        Ok(())
    } else {
        Err(Error::NotAValidator)
    }
}
