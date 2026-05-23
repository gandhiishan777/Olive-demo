import { EventEmitter } from "node:events";

export type OliveEvent =
  | { type: "order_created"; data: unknown }
  | { type: "order_updated"; data: unknown }
  | { type: "order_submitted"; data: unknown }
  | { type: "order_completed"; data: unknown }
  | { type: "menu_update"; data: { item_id: number; in_stock: boolean } }
  | { type: "call_started"; data: { conversation_id: string; from_number: string | null; started_at: string } }
  | { type: "call_ended"; data: { conversation_id: string; ended_reason?: string } }
  | { type: "transcript_chunk"; data: { conversation_id: string; role: "agent" | "user"; text: string; timestamp: string } };

class OliveBus extends EventEmitter {
  emitEvent(ev: OliveEvent) {
    this.emit("event", ev);
  }
  onEvent(handler: (ev: OliveEvent) => void) {
    this.on("event", handler);
    return () => this.off("event", handler);
  }
}

export const bus = new OliveBus();
bus.setMaxListeners(100);
