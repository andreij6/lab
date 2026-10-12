//! Local development only: speaks the LLM canister's `v1_chat` interface and answers with a local
//! Ollama (http://localhost:11434), so the notes chat works without an API key. Never deployed to
//! mainnet, where notebooks call the real LLM canister (w36hm-eqaaa-aaaal-qr76a-cai).
use candid::{CandidType, Deserialize};
use ic_cdk::{query, update};
use ic_cdk_management_canister as mgmt;
use ic_llm::{AssistantMessage, ChatMessage, Response, Tool};
use std::cell::RefCell;

thread_local! {
    /// whichever model the local Ollama has; every requested model name maps to it
    static MODEL: RefCell<String> = RefCell::new("gemma4:12b".into());
}

#[derive(CandidType, Deserialize)]
struct Request {
    model: String,
    messages: Vec<ChatMessage>,
    tools: Option<Vec<Tool>>,
}

/// Controllers pick the Ollama model the stand-in uses (`ollama list` shows what is installed).
#[update]
fn set_model(model: String) {
    if !ic_cdk::api::is_controller(&ic_cdk::api::msg_caller()) {
        ic_cdk::trap("controllers only");
    }
    MODEL.with_borrow_mut(|m| *m = model);
}
#[query]
fn model() -> String {
    MODEL.with_borrow(|m| m.clone())
}

#[query]
fn transform(args: mgmt::TransformArgs) -> mgmt::HttpRequestResult {
    mgmt::HttpRequestResult { status: args.response.status, headers: vec![], body: args.response.body }
}

#[update]
async fn v1_chat(req: Request) -> Response {
    let _ = (&req.model, &req.tools);
    let messages: Vec<serde_json::Value> = req
        .messages
        .iter()
        .map(|m| match m {
            ChatMessage::System { content } => serde_json::json!({"role": "system", "content": content}),
            ChatMessage::User { content } => serde_json::json!({"role": "user", "content": content}),
            ChatMessage::Assistant(a) => serde_json::json!({"role": "assistant", "content": a.content.clone().unwrap_or_default()}),
            ChatMessage::Tool { content, .. } => serde_json::json!({"role": "tool", "content": content}),
        })
        .collect();
    let body = serde_json::json!({"model": model(), "messages": messages, "stream": false, "options": {"num_predict": 800}});
    let r = mgmt::HttpRequest::new("http://localhost:11434/api/chat")
        .with_method(mgmt::HttpMethod::POST)
        .with_header("Content-Type", "application/json")
        .with_body(serde_json::to_vec(&body).unwrap())
        .with_max_response_bytes(400_000)
        .with_transform(mgmt::transform_context_from_query("transform".into(), vec![]))
        .send()
        .await
        .unwrap_or_else(|e| ic_cdk::trap(format!("Ollama did not answer (is `ollama serve` running?): {e}")));
    if r.status.0.to_string() != "200" {
        ic_cdk::trap(format!("Ollama answered {}: {}", r.status.0, String::from_utf8_lossy(&r.body).chars().take(300).collect::<String>()));
    }
    let v: serde_json::Value = serde_json::from_slice(&r.body).unwrap_or_else(|e| ic_cdk::trap(format!("bad Ollama reply: {e}")));
    let text = v["message"]["content"].as_str().unwrap_or_default().to_string();
    Response { message: AssistantMessage { content: Some(text), tool_calls: vec![] } }
}

ic_cdk::export_candid!();
