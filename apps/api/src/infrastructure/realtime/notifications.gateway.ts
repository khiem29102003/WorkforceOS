import { Logger } from "@nestjs/common";
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";

export type NotificationEvent = "leave.updated" | "employee.updated" | "ai.insight.ready" | "rule.alert";

@WebSocketGateway({
  namespace: "notifications",
  cors: { origin: true, credentials: true }
})
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  private server?: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  handleConnection(client: Socket): void {
    const rawTenantId = client.handshake.auth["tenantId"];
    const tenantId = typeof rawTenantId === "string" ? rawTenantId : undefined;
    if (!tenantId) {
      client.disconnect(true);
      return;
    }
    void client.join(this.tenantRoom(tenantId));
    this.logger.log(`notification client joined tenant ${tenantId}`);
  }

  emitToTenant(tenantId: string, event: NotificationEvent, payload: Record<string, unknown>): void {
    this.server?.to(this.tenantRoom(tenantId)).emit(event, payload);
  }

  private tenantRoom(tenantId: string): string {
    return `tenant:${tenantId}`;
  }
}
