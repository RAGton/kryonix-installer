use crate::AppState;
use crate::mode::InstallerMode;
use axum::{
    extract::Request, extract::State, http::StatusCode, middleware::Next, response::Response,
};
use std::sync::Arc;

pub async fn require_token(
    State(state): State<Arc<AppState>>,
    req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Local mode does not require auth
    if state.mode == InstallerMode::Local {
        return Ok(next.run(req).await);
    }

    // Remote mode requires auth
    if let Some(expected_token) = &state.session_token {
        if let Some(auth_header) = req.headers().get("Authorization")
            && let Ok(auth_str) = auth_header.to_str()
            && let Some(token) = auth_str.strip_prefix("Bearer ")
            && token == expected_token
        {
            return Ok(next.run(req).await);
        }

        // Let's also check if the token is provided via query param `?token=` (useful for SSE or initial loading if needed)
        if let Some(query) = req.uri().query() {
            for pair in query.split('&') {
                if let Some(token) = pair.strip_prefix("token=")
                    && token == expected_token
                {
                    return Ok(next.run(req).await);
                }
            }
        }

        Err(StatusCode::UNAUTHORIZED)
    } else {
        // If remote mode but no token was generated for some reason, deny access to be safe
        Err(StatusCode::UNAUTHORIZED)
    }
}
