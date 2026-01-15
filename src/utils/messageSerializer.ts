import type { 
  NetworkMessage, 
  MessageType,
  DraftActionPayload,
  JoinRequestPayload,
  JoinAcceptedPayload,
  JoinRejectedPayload,
  StateSyncPayload,
} from "../types/multiplayer";

/**
 * Serializes a network message to JSON string
 * 
 * Converts a NetworkMessage object to a JSON string for transmission over PeerJS.
 * Handles circular references and non-serializable data gracefully.
 * 
 * @param message - The message to serialize
 * @returns JSON string representation
 * @throws Error if serialization fails
 * 
 * @example
 * const msg: NetworkMessage<DraftActionPayload> = {
 *   type: MessageType.SELECT_UMA,
 *   payload: { action: "pick", itemType: "uma", itemId: "uma-1" },
 *   timestamp: Date.now(),
 *   senderId: "peer-123"
 * };
 * const json = serializeMessage(msg);
 */
export function serializeMessage<T>(message: NetworkMessage<T>): string {
  try {
    return JSON.stringify(message);
  } catch (error) {
    throw new Error(
      `Failed to serialize message: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Deserializes a network message from JSON string
 * 
 * Parses a JSON string back into a NetworkMessage object.
 * Validates basic structure but does not type-check the payload.
 * 
 * @param json - The JSON string to deserialize
 * @returns Parsed NetworkMessage
 * @throws Error if parsing fails or structure is invalid
 * 
 * @example
 * const json = '{"type":"select-uma","payload":{...},"timestamp":123,"senderId":"peer-1"}';
 * const message = deserializeMessage(json);
 */
export function deserializeMessage<T = unknown>(json: string): NetworkMessage<T> {
  try {
    const parsed = JSON.parse(json);
    
    // Basic validation
    if (!validateMessageStructure(parsed)) {
      throw new Error("Invalid message structure");
    }
    
    return parsed as NetworkMessage<T>;
  } catch (error) {
    throw new Error(
      `Failed to deserialize message: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Validates the basic structure of a network message
 * 
 * Type guard to check if an object has all required NetworkMessage fields.
 * Does not validate payload contents.
 * 
 * @param obj - Object to validate
 * @returns true if valid NetworkMessage structure
 * 
 * @example
 * if (validateMessageStructure(data)) {
 *   // data is a valid NetworkMessage
 * }
 */
export function validateMessageStructure(obj: unknown): obj is NetworkMessage {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  
  const msg = obj as Partial<NetworkMessage>;
  
  return (
    typeof msg.type === "string" &&
    msg.payload !== undefined &&
    typeof msg.timestamp === "number" &&
    typeof msg.senderId === "string"
  );
}

/**
 * Type guard for DraftActionPayload
 * 
 * @param payload - Payload to validate
 * @returns true if valid DraftActionPayload
 */
export function isDraftActionPayload(payload: unknown): payload is DraftActionPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  
  const p = payload as Partial<DraftActionPayload>;
  
  return (
    (p.action === "pick" || p.action === "ban") &&
    (p.itemType === "uma" || p.itemType === "map") &&
    typeof p.itemId === "string"
  );
}

/**
 * Type guard for JoinRequestPayload
 */
export function isJoinRequestPayload(payload: unknown): payload is JoinRequestPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  
  const p = payload as Partial<JoinRequestPayload>;
  
  return (
    (p.connectionType === "host" || p.connectionType === "player" || p.connectionType === "spectator") &&
    typeof p.label === "string"
  );
}

/**
 * Type guard for JoinAcceptedPayload
 */
export function isJoinAcceptedPayload(payload: unknown): payload is JoinAcceptedPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  
  const p = payload as Partial<JoinAcceptedPayload>;
  
  return (
    p.roomState !== undefined &&
    typeof p.yourId === "string"
  );
}

/**
 * Type guard for JoinRejectedPayload
 */
export function isJoinRejectedPayload(payload: unknown): payload is JoinRejectedPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  
  const p = payload as Partial<JoinRejectedPayload>;
  
  return typeof p.reason === "string";
}

/**
 * Type guard for StateSyncPayload
 */
export function isStateSyncPayload(payload: unknown): payload is StateSyncPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  
  const p = payload as Partial<StateSyncPayload>;
  
  return (
    p.draftState !== undefined &&
    typeof p.version === "number"
  );
}

/**
 * Creates a network message with current timestamp and sender ID
 * 
 * Helper function to construct properly formatted NetworkMessage objects.
 * 
 * @param type - Message type
 * @param payload - Message payload
 * @param senderId - ID of the sending peer
 * @returns Complete NetworkMessage
 * 
 * @example
 * const msg = createMessage(
 *   MessageType.SELECT_UMA,
 *   { action: "pick", itemType: "uma", itemId: "uma-1" },
 *   myPeerId
 * );
 */
export function createMessage<T>(
  type: MessageType,
  payload: T,
  senderId: string
): NetworkMessage<T> {
  return {
    type,
    payload,
    timestamp: Date.now(),
    senderId,
  };
}
