.PHONY: install seed backend dashboard tunnel demo stop clean

install:
	pnpm install

smoke:
	pnpm --filter @olive/backend smoke

backend:
	pnpm --filter @olive/backend dev

dashboard:
	pnpm --filter @olive/dashboard dev

tunnel:
	@if [ -z "$$NGROK_DOMAIN" ]; then \
		echo "Starting ngrok with random URL (set NGROK_DOMAIN in .env for stable URL)"; \
		ngrok http 8787; \
	else \
		ngrok http --domain=$$NGROK_DOMAIN 8787; \
	fi

# One-command demo start. Opens 3 panes: backend, dashboard, tunnel.
demo:
	@command -v tmux >/dev/null 2>&1 || { echo "tmux required for 'make demo'. Install with: brew install tmux"; exit 1; }
	@tmux new-session -d -s olive -n stack 'pnpm --filter @olive/backend dev' \; \
		split-window -h 'pnpm --filter @olive/dashboard dev' \; \
		split-window -v 'make tunnel' \; \
		select-pane -t 0 \; \
		attach-session -t olive

stop:
	-tmux kill-session -t olive 2>/dev/null
	-pkill -f "ngrok http"

clean:
	rm -rf node_modules backend/node_modules dashboard/node_modules agent/node_modules seed/node_modules tests/noise/node_modules
	rm -rf backend/data/olive.db backend/dist dashboard/dist
