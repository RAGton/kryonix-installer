use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum InstallerMode {
    #[default]
    Local,
    Remote,
}

impl InstallerMode {
    /// Detects the installer mode by reading /proc/cmdline.
    /// Looks for the parameter `kryonix.installer.mode=remote` or `kryonix.installer.mode=local`.
    /// Returns `Local` if not specified or unable to read.
    pub fn detect() -> Self {
        if let Ok(cmdline) = fs::read_to_string("/proc/cmdline") {
            for token in cmdline.split_whitespace() {
                if let Some(val) = token.strip_prefix("kryonix.installer.mode=") {
                    return match val {
                        "remote" => Self::Remote,
                        _ => Self::Local,
                    };
                }
            }
        }
        Self::Local
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_is_local() {
        assert_eq!(InstallerMode::default(), InstallerMode::Local);
    }

    // A helper function to test detection logic would require abstracting `/proc/cmdline`
    // but we can test the basic behavior by ensuring it defaults to Local in non-Kryonix test envs.
    #[test]
    fn test_detect_in_test_env_defaults_to_local() {
        // Since we are running cargo test on the host, the kernel cmdline won't have the param
        let mode = InstallerMode::detect();
        assert_eq!(mode, InstallerMode::Local);
    }
}
