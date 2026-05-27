import { EventEmitter } from "node:events";

export type OliveEvent =
  | { type: "order_created"; data: unknown }
  | { type: "order_updated"; data: unknown }
  | { type: "order_submitted"; data: unknown }
  | { type: "order_completed"; data: unknown }
  | { type: "menu_update"; data: { item_id: number; in_stock: boolean } };

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
