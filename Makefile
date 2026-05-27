.PHONY: install backend dashboard tunnel demo stop

install:
	pnpm install

backend:
	pnpm --filter @olive/backend dev

dashboard:
	pnpm --filter @olive/dashboard dev

tunnel:
	@if [ -z "$$NGROK_DOMAIN" ]; then \
		echo "ngrok http 8787 (set NGROK_DOMAIN env for stable subdomain)"; \
		ngrok http 8787; \
	else \
		ngrok http --domain=$$NGROK_DOMAIN 8787; \
	fi

# One command: backend + dashboard + tunnel in a tmux session
demo:
	@command -v tmux >/dev/null 2>&1 || { echo "tmux required. brew install tmux. Or run backend/dashboard/tunnel in 3 terminals."; exit 1; }
	@tmux new-session -d -s olive -n stack 'pnpm --filter @olive/backend dev' \; \
		split-window -h 'pnpm --filter @olive/dashboard dev' \; \
		split-window -v 'make tunnel' \; \
		select-pane -t 0 \; \
		attach-session -t olive

stop:
	-tmux kill-session -t olive 2>/dev/null
	-pkill -f "ngrok http"
