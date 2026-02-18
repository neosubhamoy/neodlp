export interface KvStoreTable {
    key: string;
    value: string;
}

export interface KvStore {
    ytdlp_update_last_check: number | null;
    macos_registered_version: string | null;
    linux_registered_version: string | null;
}
