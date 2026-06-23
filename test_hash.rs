fn main() {
    let output = std::process::Command::new("mkpasswd")
        .arg("-m")
        .arg("yescrypt")
        .arg("test")
        .output()
        .unwrap();
    println!("{}", String::from_utf8_lossy(&output.stdout));
}
