/**
 * waAuth.ts — MongoDB-backed auth state for Baileys
 *
 * Mirrors Baileys' official `useMultiFileAuthState` (which persists creds
 * and signal keys as files on disk) but stores each entry as a Mongo
 * document instead. This is what makes the session portable to a stateless
 * runner like GitHub Actions: nothing is written to local disk, so a fresh
 * checkout on every scheduled run can still pick up where the last run
 * (or your one-time local `npm run link`) left off.
 */
import { BufferJSON, initAuthCreds, proto, AuthenticationState, AuthenticationCreds } from '@whiskeysockets/baileys';
import { WaAuthModel } from './db';

async function readData<T>(id: string): Promise<T | null> {
  const doc = await WaAuthModel.findById(id).lean();
  if (!doc) return null;
  return JSON.parse(doc.value, BufferJSON.reviver) as T;
}

async function writeData(id: string, data: unknown): Promise<void> {
  const value = JSON.stringify(data, BufferJSON.replacer);
  await WaAuthModel.updateOne({ _id: id }, { $set: { value } }, { upsert: true });
}

async function removeData(id: string): Promise<void> {
  await WaAuthModel.deleteOne({ _id: id });
}

export async function useMongoAuthState(): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  const creds: AuthenticationCreds = (await readData<AuthenticationCreds>('creds')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data: Record<string, any> = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData<any>(`${type}-${id}`);
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks: Promise<void>[] = [];
          for (const category of Object.keys(data)) {
            for (const id of Object.keys((data as any)[category])) {
              const value = (data as any)[category][id];
              const key = `${category}-${id}`;
              tasks.push(value ? writeData(key, value) : removeData(key));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: () => writeData('creds', creds),
  };
}
