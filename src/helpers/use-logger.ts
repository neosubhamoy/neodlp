import { useLogsStore } from "@/services/store";
import { warn, debug, info, error } from "@tauri-apps/plugin-log";

export function useLogger() {
    const logs = useLogsStore((state) => state.logs);
    const addLog = useLogsStore((state) => state.addLog);
    const clearLogs = useLogsStore((state) => state.clearLogs);

    const logger = {
        info: (context: string, message: string) => {
            addLog({ timestamp: Date.now(), level: 'info', context, message });
            info(`${context}: ${message}`);
        },
        warning: (context: string, message: string) => {
            addLog({ timestamp: Date.now(), level: 'warning', context, message });
            warn(`${context}: ${message}`);
        },
        error: (context: string, message: string) => {
            addLog({ timestamp: Date.now(), level: 'error', context, message });
            error(`${context}: ${message}`);
        },
        debug: (context: string, message: string) => {
            addLog({ timestamp: Date.now(), level: 'debug', context, message });
            debug(`${context}: ${message}`);
        },
        progress: (context: string, message: string) => {
            addLog({ timestamp: Date.now(), level: 'progress', context, message });
            info(`${context}: ${message}`);
        },
        getLogs: () => logs,
        clearLogs,
    };

    return logger;
}
