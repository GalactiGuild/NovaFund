use shared::errors::Error;
use shared::types::EscrowInfo;
use soroban_sdk::Address;

/// Validate that an address is a validator in the escrow
pub fn validate_validator(escrow: &EscrowInfo, validator: &Address) -> Result<(), Error> {
    if escrow.validators.iter().any(|v| v == *validator) {
        Ok(())
    } else {
        Err(Error::NotValidator)
    }
}
