## Resumo

Simplifica o modo `Remote Web` do Live Installer no backend/frontend do `kryonix-installer`.

Este PR mantém a detecção de `kryonix.installer.mode=remote` via `/proc/cmdline`, mas remove a camada de token/login do fluxo remoto. O backend continua decidindo entre bind local e remoto, e a UI passa a abrir direto sem autenticação intermediária.

## O que mudou

### Backend Rust

- Novo parser de modo do instalador:
  - fallback seguro: `local`
  - `kryonix.installer.mode=remote` ativa modo remoto
- Bind:
  - local: `127.0.0.1:8080`
  - remote: `0.0.0.0:8080`
- Rotas HTTP do live installer permanecem públicas dentro da sessão efêmera da ISO.
- `/health` continua público e mínimo.

### Frontend React

- Remove `Login.jsx`.
- Remove uso de `sessionStorage` para token de sessão.
- Remove header `Authorization: Bearer` do cliente HTTP do installer.

## Segurança

- Modo inválido ou ausente cai em local seguro.
- O modo remoto abre a UI explicitamente na LAN apenas quando escolhido manualmente no bootloader.
- A sessão live continua efêmera e desaparece no reboot.
- `/health` é público de propósito e não deve expor dados sensíveis.

## Dependência cruzada

Este PR depende do PR correspondente no repositório `kryonix`, que adiciona:

- entrada de boot Remote Web;
- `kryonix.installer.mode=remote`;
- controle de kiosk local/remoto;
- banner TTY com IP/URL.

## Validações

Executado:

```bash
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test
npm --prefix ui ci
npm --prefix ui test
npm --prefix ui run build
git diff --check
```

## Riscos restantes

- Precisa teste de boot real da ISO em VM.
- Precisa validar acesso real via navegador em outra máquina.
- `/health` público é intencional, mas deve permanecer mínimo.
