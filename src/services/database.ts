import Database from "@tauri-apps/plugin-sql";
import type { KvStoreTable } from "@/types/kv-store";
import type { SettingsTable } from "@/types/settings";

export const fetchAllSettings = async () => {
	const db = await Database.load("sqlite:database.db");
	const result = await db.select<SettingsTable[]>(
		`SELECT key, value FROM settings`,
	);

	return result.reduce((acc: Record<string, unknown>, curr) => {
		try {
			const parsed = JSON.parse(curr.value) as { value: unknown };
			acc[curr.key] = parsed.value;
		} catch (error) {
			console.error(`Error parsing setting ${curr.key}:`, error);
		}

		return acc;
	}, {});
};

export const saveSettingsKey = async (key: string, value: unknown) => {
	const db = await Database.load("sqlite:database.db");
	const jsonValue = JSON.stringify(value);
	return await db.execute(
		`INSERT INTO settings (
            key,
            value
        ) VALUES ($1, json_object('value', json($2)))
        ON CONFLICT(key) DO UPDATE SET
            value = json_object('value', json($2))`,
		[key, jsonValue],
	);
};

export const resetSettings = async () => {
	const db = await Database.load("sqlite:database.db");
	return await db.execute("DELETE FROM settings");
};

export const fetchAllKvPairs = async () => {
	const db = await Database.load("sqlite:database.db");
	const result = await db.select<KvStoreTable[]>(
		`SELECT key, value FROM kv_store`,
	);

	return result.reduce((acc: Record<string, unknown>, curr) => {
		try {
			const parsed = JSON.parse(curr.value) as { value: unknown };
			acc[curr.key] = parsed.value;
		} catch (error) {
			console.error(`Error parsing KV pair ${curr.key}:`, error);
		}

		return acc;
	}, {});
};

export const saveKvPair = async (key: string, value: unknown) => {
	const db = await Database.load("sqlite:database.db");
	const jsonValue = JSON.stringify(value);
	return await db.execute(
		`INSERT INTO kv_store (
            key,
            value
        ) VALUES ($1, json_object('value', json($2)))
        ON CONFLICT(key) DO UPDATE SET
            value = json_object('value', json($2))`,
		[key, jsonValue],
	);
};

export const deleteKvPair = async (key: string) => {
	const db = await Database.load("sqlite:database.db");
	return await db.execute("DELETE FROM kv_store WHERE key = $1", [key]);
};
