# Contributing to NovaFund Smart Contracts

Thank you for your interest in contributing to the NovaFund backend! This document provides guidelines for contributing to our Soroban-based smart contracts.

## Development Standards

### 1. Security First
- Always use `require_auth()` for any action that modifies state or handles funds.
- Check for arithmetic overflows/underflows (though Rust handles this, be explicit with `checked_add`, `checked_sub`, etc.).
- Validate all inputs (e.g., amounts > 0, future timestamps).

### 2. Gas & Resource Optimization
- **Storage:** Prefer `instance()` for frequently accessed data and `persistent()` for long-term data. Avoid storing large `Vec`s in a single key; use mapping patterns instead.
- **Types:** Use the smallest appropriate types. Use `BytesN<32>` for hashes instead of `String`.

### 3. Code Style
- Follow standard Rust naming conventions (`snake_case` for functions/variables, `PascalCase` for structs/enums).
- Add doc comments (`///`) to all public functions and structures.
- Ensure `no_std` is at the top of every contract crate.

## Workflow

1. **Fork the Repository**: Create your own fork and work on a feature branch.
2. **Implement Changes**: Ensure your code follows the standards above.
3. **Add Tests**: Every new feature or bug fix must include corresponding tests in the `tests` module or `tests.rs` file.
4. **Run Tests**: Use `cargo test` to ensure all tests pass.
5. **Submit a PR**: Provide a clear description of the changes and link to any relevant issues.

## Testing Guidelines
- Use the `soroban-sdk` test utilities.
- Mock external contracts (like tokens) using `env.register_stellar_asset_contract()`.
- Test both "happy paths" and error conditions.

## License
By contributing, you agree that your contributions will be licensed under the project's MIT License.
