//! Local development only: speaks the exchange rate canister's `get_exchange_rate` interface with
//! made-up prices that drift a little each minute, so the Crypto kit works without mainnet. Never
//! deployed to mainnet, where notebooks call the real XRC (uf6dk-hyaaa-aaaaq-qaaaq-cai).
use candid::{CandidType, Deserialize};
use ic_cdk::update;

#[derive(CandidType, Deserialize, Clone)]
pub enum AssetClass {
    Cryptocurrency,
    FiatCurrency,
}
#[derive(CandidType, Deserialize, Clone)]
pub struct Asset {
    pub symbol: String,
    pub class: AssetClass,
}
#[derive(CandidType, Deserialize)]
pub struct GetExchangeRateRequest {
    pub base_asset: Asset,
    pub quote_asset: Asset,
    pub timestamp: Option<u64>,
}
#[derive(CandidType, Deserialize)]
pub struct ExchangeRateMetadata {
    pub decimals: u32,
    pub base_asset_num_received_rates: u64,
    pub base_asset_num_queried_sources: u64,
    pub quote_asset_num_received_rates: u64,
    pub quote_asset_num_queried_sources: u64,
    pub standard_deviation: u64,
    pub forex_timestamp: Option<u64>,
}
#[derive(CandidType, Deserialize)]
pub struct ExchangeRate {
    pub base_asset: Asset,
    pub quote_asset: Asset,
    pub timestamp: u64,
    pub rate: u64,
    pub metadata: ExchangeRateMetadata,
}
#[derive(CandidType, Deserialize)]
pub enum ExchangeRateError {
    CryptoBaseAssetNotFound,
    NotEnoughCycles,
}

/// Rough prices in dollars; anything else is "not listed", like a coin the exchanges do not carry.
fn base(symbol: &str) -> Option<f64> {
    Some(match symbol {
        "BTC" => 98_000.0,
        "ETH" => 3_600.0,
        "SOL" => 190.0,
        "HYPE" => 38.0,
        "ICP" => 9.5,
        "USDC" | "USDT" => 1.0,
        _ => return None,
    })
}

#[update]
fn get_exchange_rate(req: GetExchangeRateRequest) -> Result<ExchangeRate, ExchangeRateError> {
    if ic_cdk::api::msg_cycles_available() < 1_000_000_000 {
        return Err(ExchangeRateError::NotEnoughCycles);
    }
    ic_cdk::api::msg_cycles_accept(200_000_000);
    let p = base(&req.base_asset.symbol).ok_or(ExchangeRateError::CryptoBaseAssetNotFound)?;
    let ts = req.timestamp.unwrap_or(ic_cdk::api::time() / 1_000_000_000) / 60 * 60;
    // up to ±3%, the same for everyone asking about the same minute
    let drift = 1.0 + (((ts / 60) % 13) as f64 - 6.0) / 200.0;
    let decimals = 9;
    Ok(ExchangeRate {
        rate: (p * drift * 1e9) as u64,
        timestamp: ts,
        metadata: ExchangeRateMetadata { decimals, base_asset_num_received_rates: 3, base_asset_num_queried_sources: 3, quote_asset_num_received_rates: 1, quote_asset_num_queried_sources: 1, standard_deviation: 0, forex_timestamp: None },
        base_asset: req.base_asset,
        quote_asset: req.quote_asset,
    })
}

ic_cdk::export_candid!();
