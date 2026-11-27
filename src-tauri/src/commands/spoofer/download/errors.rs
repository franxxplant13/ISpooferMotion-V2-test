use serde_json::Value;
use std::time::Duration;

fn structured_error_details(body: &[u8]) -> String {
    let Ok(value) = serde_json::from_slice::<Value>(body) else {
        return "Roblox supplied no structured error details.".to_string();
    };
    let mut messages = Vec::new();
    if let Some(errors) = value.get("errors").and_then(Value::as_array) {
        for error in errors.iter().take(5) {
            if let Some(message) = error.get("message").and_then(Value::as_str) {
                let code = error.get("code").map(|code| format!("code {code}: ")).unwrap_or_default();
                messages.push(format!("{code}{message}"));
            }
        }
    }
    if messages.is_empty() {
        if let Some(message) = value.get("message").and_then(Value::as_str) {
            messages.push(message.to_string());
        }
    }
    if messages.is_empty() {
        return "Roblox supplied no structured error details.".to_string();
    }
    let details: String = messages.join(" | ").chars().take(1500).collect();
    crate::commands::ipc::redact_log_message(&details)
}

pub fn request_error_details(error: reqwest::Error) -> String {
    let error = error.without_url();
    let mut details = error.to_string();
    let mut source = std::error::Error::source(&error);
    for _ in 0..5 {
        let Some(cause) = source else { break };
        details.push_str(": ");
        details.push_str(&cause.to_string());
        source = cause.source();
    }
    crate::commands::ipc::redact_log_message(&details)
}

pub async fn read_download_failure(mut response: reqwest::Response) -> String {
    let read = tokio::time::timeout(Duration::from_secs(3), async {
        let mut body = Vec::new();
        while let Some(chunk) = response.chunk().await? {
            if body.len() + chunk.len() > 8192 {
                return Ok::<_, reqwest::Error>("Roblox error response exceeded the 8 KB diagnostic limit.".to_string());
            }
            body.extend_from_slice(&chunk);
        }
        Ok(structured_error_details(&body))
    }).await;
    match read {
        Ok(Ok(details)) => details,
        Ok(Err(error)) => format!("Could not read Roblox's error response: {error}"),
        Err(_) => "Timed out reading Roblox's error response.".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::{request_error_details, structured_error_details};

    #[test]
    fn download_diagnostics_include_the_underlying_network_error() {
        let error = reqwest::Client::new().get("http://[").build().expect_err("invalid URL");
        let details = request_error_details(error);
        assert!(details.contains("invalid"));
        assert!(!details.contains("http://["));
    }

    #[test]
    fn download_diagnostics_keep_returned_codes_and_messages() {
        let body = br#"{"errors":[{"code":3,"message":"Asset is not approved for the requester"}]}"#;
        assert_eq!(structured_error_details(body), "code 3: Asset is not approved for the requester");
    }

    #[test]
    fn download_diagnostics_do_not_dump_unstructured_bodies() {
        assert_eq!(structured_error_details(b"<html>private proxy response</html>"),
            "Roblox supplied no structured error details.");
    }

    #[test]
    fn download_diagnostics_redact_credentials_and_bound_text() {
        let details = structured_error_details(br#"{"message":"api_key=secret-token .ROBLOSECURITY=secret-cookie"}"#);
        assert!(!details.contains("secret-token"));
        assert!(!details.contains("secret-cookie"));
        let body = serde_json::json!({"message": "x".repeat(4000)}).to_string();
        assert!(structured_error_details(body.as_bytes()).len() <= 1500);
    }
}
