import {
  createTestRoom as createBaseTestRoom,
  type TestRoomClass,
  type TestRoomHandle,
  type TestRoomOptions,
} from "../../../packages/server/dist/testing.js";
import { CONTENT_REVISION } from "../config/ww1-content.js";

export * from "../../../packages/server/dist/testing.js";

export const createUnreadyTestRoom = createBaseTestRoom;

export async function createTestRoom<TState>(
  RoomClass: TestRoomClass<TState>,
  options: TestRoomOptions = {},
): Promise<TestRoomHandle<TState>> {
  const handle = await createBaseTestRoom(RoomClass, options);
  return {
    ...handle,
    async connect(session?: string) {
      const connection = await handle.connect(session);
      await connection.send("contentReady", { revision: CONTENT_REVISION });
      return connection;
    },
  };
}
