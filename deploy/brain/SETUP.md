# Setting up Grove's brain

Grove chats with language models through [Ollama](https://ollama.com). The bot itself stays on the Azure VM (2 vCPU, 1 GiB RAM, no GPU) and has two possible brains:

```
                                  ┌─ https://ollama.com ── cloud model (optional, monthly credits)
Discord ── Grove bot (Azure VM) ──┤
                                  └─ 127.0.0.1:11434 ══ SSH tunnel ══ Ollama on your PC (free, unlimited)
```

| Brain                                    | Available                                            | Limit                       |
|------------------------------------------|------------------------------------------------------|-----------------------------|
| **local**, `qwen3.5:4b` on your PC       | while the PC is on, Ollama runs and the tunnel is up | none, only your GPU's speed |
| **cloud**, `glm-5.3-flash` on ollama.com | always (only if `GROVE_CLOUD_API_KEY` is set)        | your plan's monthly credits |

Grove asks the brains in order (cloud first by default) and uses the first one that's awake. When the cloud runs out of credits or gets rate limited, it rests until the credits refill (Grove asks ollama.com every 5 minutes) and the local brain answers instead. With neither awake, Grove runs commands and moderation only, and answers people with 💤 (plus a short note at most every 15 minutes per channel).

The bot checks every 20 seconds while a brain is away (every minute while it's there), so Grove wakes up by itself. `!brain` in Discord shows each brain's state and the credits left.

## 1. Ollama on the PC (CachyOS)

```sh
sudo pacman -S ollama-cuda
sudo systemctl edit ollama          # paste deploy/brain/ollama-override.conf
sudo systemctl enable --now ollama
ollama pull qwen3.5:4b              # a 3-4 GB download
ollama run qwen3.5:4b "say hi"      # quick check, Ctrl+D to leave
```

`ollama ps` should show the model at `100% GPU`. Ollama keeps listening on `127.0.0.1` only, so nothing on your network can reach it.

### Which model

Local models have no usage limit at all: the only limits are your GPU's speed and memory.

| Model                      | Size            | Fits a 6 GB RTX 3060 Laptop | Notes                                                                                                                                       |
|----------------------------|-----------------|-----------------------------|---------------------------------------------------------------------------------------------------------------------------------------------|
| **`qwen3.5:4b`** (default) | 3.3 GB          | fully on the GPU            | tool calling, vision and an optional thinking mode. Fitting entirely in VRAM is what keeps it fast                                          |
| `qwen3.5:4b-mtp-q4_K_M`    | 4.1 GB          | fully on the GPU            | the same model with multi-token prediction: it guesses a few tokens ahead, so replies come faster. Set `GROVE_BRAIN_DRAFT_TOKENS=3` with it |
| `qwen3.5:9b`               | 6.6 GB          | spills onto the CPU         | the same family, bigger: smarter but slower. Try it if replies feel too simple                                                              |
| `gemma4:e4b-it-qat`        | 6.1 GB          | barely, spills a little     | Google's Gemma 4, an alternative to try                                                                                                     |
| `gemma4:e2b-it-qat`        | 4.3 GB          | fully on the GPU            | smaller Gemma 4, weaker than `qwen3.5:4b`                                                                                                   |
| `glm-5.3-flash`            | 320B parameters | no                          | an Ollama *cloud* model: use it as the cloud brain below. The smallest local build is ~93 GB                                                |
| DeepSeek R1 distills       | 5-9 GB          | partly                      | reason at length before every reply, too slow for chat                                                                                      |

Switch with `GROVE_BRAIN_MODEL` in the VM's `.env` (and `ollama pull` it on the PC).

## Optional: a cloud brain

1. Make an API key at <https://ollama.com/settings/keys>.
2. In the VM's `.env`, add `GROVE_CLOUD_API_KEY=<the key>`. To use another cloud model than `glm-5.3-flash`, add `GROVE_CLOUD_MODEL=<name>` with a name from `curl https://ollama.com/api/tags` that your plan includes.
3. To save the credits for when your computer is off, add `GROVE_CLOUD_FIRST=false`: the local model then answers whenever it can, and the cloud only covers the rest.

Cloud requests are processed on Ollama's servers (their docs say prompts aren't used for training). The local brain never leaves your computer.

## 2. Try Grove locally first

In a clone of this repo, with Node 22.18+:

```sh
npm install
npm run knowledge -- sync    # downloads the Handbook + the Apoli/Origins source of every build (about 20 seconds)
npm run chat                 # talk to Grove in the terminal, against your local Ollama
```

## 3. The tunnel (PC → VM)

1. Make a key just for this:
   ```sh
   ssh-keygen -t ed25519 -f ~/.ssh/grove_brain -N "" -C grove-brain
   cat ~/.ssh/grove_brain.pub
   ```
2. On the VM, add that public key to `~/.ssh/authorized_keys` of the VM user, **with these options in front of it**, so the key can open this one tunnel and nothing else:
   ```
   restrict,port-forwarding,permitlisten="127.0.0.1:11434",command="/bin/false" ssh-ed25519 AAAA... grove-brain
   ```
3. Recommended on the VM, in `/etc/ssh/sshd_config`, so a tunnel left behind by a sleeping laptop is dropped in about 90 seconds instead of hours (then `sudo systemctl reload ssh`):
   ```
   ClientAliveInterval 30
   ClientAliveCountMax 3
   ```
4. On the PC, install the service and fill in the VM's address and user:
   ```sh
   mkdir -p ~/.config/systemd/user
   cp deploy/brain/grove-brain-tunnel.service ~/.config/systemd/user/
   nano ~/.config/systemd/user/grove-brain-tunnel.service     # VM_HOST and VM_USER
   systemctl --user daemon-reload
   systemctl --user enable --now grove-brain-tunnel
   journalctl --user -u grove-brain-tunnel -f                 # should stay quiet
   ```
   It reconnects on its own after sleep or a network change. To have it run before you log in, also run `sudo loginctl enable-linger $USER`.

## 4. The VM

The deploy workflow only pulls the new image; the compose file on the VM is not updated by it. Edit `/home/cactus-bot/bot/docker-compose.yaml` once so the container shares the VM's network (that's where the tunnel arrives):

```yaml
services:
  bot:
    image: ghcr.io/fldebug10/cactus-bot:master
    container_name: cactus-bot
    restart: unless-stopped
    network_mode: host
    env_file:
      - .env
    environment:
      - NODE_ENV=production
    volumes:
      - ./data:/app/data
```

Nothing has to be added to `.env`: the defaults point at `http://127.0.0.1:11434` and `qwen3.5:4b`. See the settings table in the README to change them.

Grove also needs these Discord permissions for the new moderation: **Moderate Members** (to time out people who keep asking explicit questions) and **Add Reactions** (the 💤).

## Troubleshooting

| `!brain` says               | Check                                                                                                                                                                             |
|-----------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| can't reach ollama          | Is the PC on? `systemctl --user status grove-brain-tunnel` on the PC, `ss -ltn \| grep 11434` on the VM.                                                                          |
| the model isn't pulled      | `ollama pull <model>` on the PC, with the same name as `GROVE_BRAIN_MODEL`.                                                                                                       |
| awake, but replies are slow | `ollama ps` on the PC: anything below `100% GPU` means the model or context is too big. Lower `GROVE_BRAIN_CONTEXT` or use a smaller model. Games using the GPU slow it down too. |
