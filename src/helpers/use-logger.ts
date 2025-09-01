import { useLogsStore } from "@/services/store";

export function useLogger() {
    const logs = useLogsStore((state) => state.logs);
    const addLog = useLogsStore((state) => state.addLog);
    const clearLogs = useLogsStore((state) => state.clearLogs);

    const logger = {
        info: (context: string, message: string) => {
            addLog({ timestamp: Date.now(), level: 'info', context, message });
        },
        warning: (context: string, message: string) => {
            addLog({ timestamp: Date.now(), level: 'warning', context, message });
        },
        error: (context: string, message: string) => {
            addLog({ timestamp: Date.now(), level: 'error', context, message });
        },
        debug: (context: string, message: string) => {
            addLog({ timestamp: Date.now(), level: 'debug', context, message });
        },
        getLogs: () => logs,
        clearLogs,
    };

    return logger;
}